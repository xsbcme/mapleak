/**
 * Source Map 泄露检测器
 *
 * 工作流程：
 * 1. 以流式方式下载 npm tarball（.tgz 格式，即 gzip 压缩的 tar）
 * 2. 边下载边解析 tar 条目，找到 *.js.map 文件
 * 3. 解析 Source Map JSON，检测 sourcesContent 是否有实质内容
 * 4. 如泄露，返回泄露详情（哪些文件、总字节数等）
 *
 * 关键设计：
 *   - 纯内存流水线：下载 → gunzip → tar 解析，全程不落盘
 *   - tar entry 逐条处理，非 .map 文件立即 resume() 丢弃，不积压内存
 *   - .map 文件有大小上限，防止超大文件 OOM
 *   - 每个 entry 处理完后 GC 可以立即回收 Buffer
 *
 * 关键判断依据：
 *   - Source Map 标准: https://tc39.es/source-map/
 *   - sourcesContent: 原始源文件内容数组，若非空则源码泄露
 */

import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { extract as tarExtract } from "tar-stream";
import { npmFetch, npmFetchRetry } from "../utils.js";

/** 单个 .map 文件最大读取字节：100 MB，防止 OOM */
const MAX_MAP_SIZE = 100 * 1024 * 1024;

/**
 * 分析单个 tarball，返回所有泄露的 source map 信息
 * @param {string} tarballUrl
 * @param {object} [opts]
 * @param {boolean} [opts.includeNodeModules=false] - 是否扫描 node_modules/ 下的 .map（第三方依赖）
 * @returns {Promise<LeakResult[]>}
 *
 * @typedef {Object} LeakResult
 * @property {string} mapFile       - tarball 内的 .map 文件路径
 * @property {number} fileCount     - sourcesContent 中非空条目数量
 * @property {number} totalBytes    - 所有泄露源文件的字节数之和
 * @property {string[]} sourcePaths - sources 数组（文件路径列表）
 * @property {boolean} hasCloudRef  - 是否包含外部存储（如 R2/S3）引用
 */
export async function analyzeTarball(tarballUrl, { includeNodeModules = false } = {}) {
  const leaks = [];

  // tarball 下载：网络抖动和限流场景最多重试 3 次，基础退避 1.5s
  const res = await npmFetchRetry(tarballUrl, 60_000, { attempts: 3, delay: 1_500 });

  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  // 将 Web ReadableStream 直接转为 Node.js Readable（不落盘）
  const nodeStream = Readable.fromWeb(res.body);

  await new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const extract = tarExtract();

    extract.on("entry", (header, stream, next) => {
      const filePath = header.name;

      // 只关注 .js.map / .mjs.map，其余 entry 立即丢弃（不占内存）
      // 默认排除 node_modules/ 下的 map 文件（部分包误将依赖一起打包），
      // includeNodeModules=true 时保留，便于研究第三方依赖泄露情况
      if (
        (!filePath.endsWith(".js.map") && !filePath.endsWith(".mjs.map")) ||
        (!includeNodeModules && filePath.includes("/node_modules/"))
      ) {
        stream.resume();
        return next();
      }

      collectStream(stream, MAX_MAP_SIZE)
        .then(buffer => {
          const result = parseSourceMap(filePath, buffer);
          if (result) leaks.push(result);
          // buffer 在此处出作用域，GC 可立即回收
          next();
        })
        .catch(() => next()); // 单文件解析失败不中断
    });

    extract.on("finish", resolve);
    extract.on("error", reject);
    gunzip.on("error", reject);
    nodeStream.on("error", reject);

    nodeStream.pipe(gunzip).pipe(extract);
  });

  return leaks;
}

/**
 * 解析 Source Map 内容，判断是否存在源码泄露
 * @param {string} filePath
 * @param {Buffer} buffer
 * @returns {LeakResult | null}
 */
function parseSourceMap(filePath, buffer) {
  let map;
  try {
    map = JSON.parse(buffer.toString("utf8"));
  } catch {
    return null; // 无效 JSON，跳过
  }

  // sourcesContent 是泄露的核心字段
  const contents = map.sourcesContent;
  if (!Array.isArray(contents) || contents.length === 0) {
    return null;
  }

  // 统计非空条目
  const nonEmpty = contents.filter(c => typeof c === "string" && c.length > 0);
  if (nonEmpty.length === 0) return null;

  const totalBytes = nonEmpty.reduce((sum, c) => sum + Buffer.byteLength(c, "utf8"), 0);
  const sources = Array.isArray(map.sources) ? map.sources : [];

  // 检查是否引用了外部存储地址（如 Cloudflare R2、S3）
  const allText = sources.join(" ") + JSON.stringify(map.sourceRoot ?? "");
  const hasCloudRef = /r2\.cloudflarestorage|s3\.amazonaws|blob\.core\.windows/.test(allText);

  return {
    mapFile: filePath,
    fileCount: nonEmpty.length,
    totalBytes,
    sourcePaths: sources,
    hasCloudRef,
  };
}

/**
 * 将 stream 内容收集为 Buffer，超过 maxSize 则截断（不落盘）
 */
function collectStream(stream, maxSize) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let truncated = false;

    stream.on("data", chunk => {
      if (truncated) return;
      total += chunk.length;
      if (total > maxSize) {
        truncated = true;
        chunks.push(chunk.slice(0, chunk.length - (total - maxSize)));
        stream.resume(); // 丢弃剩余
        return;
      }
      chunks.push(chunk);
    });

    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * 从 tarball 中一次性提取多个 .map 文件的全部 sourcesContent
 *
 * @param {string}   tarballUrl       - tarball 下载地址
 * @param {string[]} targetMapFiles   - 需要提取的 .map 文件路径数组
 * @param {object}   [opts]
 * @param {boolean}  [opts.includeNodeModules=false] - 是否提取 node_modules/ 下的 .map（第三方依赖）
 * @returns {Promise<Map<string, Array<{index:number, path:string, bytes:number, content:string}>>>}
 *   key = mapFile 路径，value = 源文件数组（同 extractSourceMap 格式）
 */
export async function extractAllSourceMaps(tarballUrl, targetMapFiles, { includeNodeModules = false } = {}) {
  const targets = new Set(targetMapFiles);
  const results = new Map();

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(new Error("fetch timeout")), 120_000);

  let res;
  try {
    res = await npmFetch(tarballUrl, 120_000);
  } finally {
    /* fetchTimeout 交给流阶段持有 */
  }

  if (!res.ok) {
    clearTimeout(fetchTimeout);
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const nodeStream = Readable.fromWeb(res.body);

  await new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const extr = tarExtract();
    let remaining = targets.size;

    function done(err) {
      clearTimeout(fetchTimeout);
      nodeStream.destroy();
      gunzip.destroy();
      if (err && err.code !== "ERR_STREAM_DESTROYED" && err.name !== "AbortError") {
        reject(err);
      } else {
        resolve();
      }
    }

    extr.on("entry", (header, stream, next) => {
      const filePath = header.name;
      const isMapFile = filePath.endsWith(".js.map") || filePath.endsWith(".mjs.map");
      const isNodeMods = filePath.includes("/node_modules/");
      const inTargets = targets.has(filePath);

      // 处理条件：
      //   1. 在 DB targets 集合中（且不是被排除的 node_modules 路径）
      //   2. 或 includeNodeModules=true 且是 node_modules 下的 .map（DB 中从未记录此类文件）
      const shouldProcess =
        (inTargets && (includeNodeModules || !isNodeMods)) ||
        (includeNodeModules && isMapFile && isNodeMods && !inTargets);

      if (!shouldProcess) {
        stream.resume();
        return next();
      }

      const mapFile = filePath;
      collectStream(stream, MAX_MAP_SIZE)
        .then(buf => {
          try {
            const map = JSON.parse(buf.toString("utf8"));
            const sources = Array.isArray(map.sources) ? map.sources : [];
            const contents = Array.isArray(map.sourcesContent) ? map.sourcesContent : [];
            const files = sources
              .map((p, i) => {
                const c = contents[i];
                // 过滤 node_modules 内的第三方依赖源码（路径含 node_modules/ 均视为第三方）
                if (!includeNodeModules && p && p.includes("node_modules/")) return null;
                return typeof c === "string" && c.length > 0
                  ? { index: i, path: p, bytes: Buffer.byteLength(c, "utf8"), content: c }
                  : null;
              })
              .filter(Boolean);
            results.set(mapFile, files);
          } catch {
            /* parse error → skip */
          }

          // 仅在 target 命中时递减计数；node_modules 额外文件不计入
          // includeNodeModules=true 时禁用提前退出，让 tarball 流完整结束
          if (inTargets) {
            remaining--;
            if (remaining === 0 && !includeNodeModules) {
              done(); // 所有 DB 目标已收集，且无需扫描 node_modules，提前中止
              return;
            }
          }
          next();
        })
        .catch(() => next());
    });

    extr.on("finish", () => done());
    extr.on("error", done);
    gunzip.on("error", done);
    nodeStream.on("error", err => {
      if (err.name === "AbortError" || err.code === "ERR_STREAM_DESTROYED") {
        resolve();
      } else {
        done(err);
      }
    });

    nodeStream.pipe(gunzip).pipe(extr);
  });

  return results;
}

/**
 * 从 tarball 中提取指定 .map 文件的全部 sourcesContent
 *
 * @param {string} tarballUrl
 * @param {string} targetMapFile  - tarball 内的文件路径（与 DB map_file 一致）
 * @returns {Promise<Array<{index:number, path:string, bytes:number, content:string}> | null>}
 *   找不到目标文件返回 null，找到但无泄露内容返回 []
 */
export async function extractSourceMap(tarballUrl, targetMapFile) {
  // 用 AbortController 控制整个下载流：找到目标文件后立即中止，无需等待剩余数据
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(new Error("fetch timeout")), 60_000);

  let res;
  try {
    res = await npmFetch(tarballUrl, 60_000);
  } finally {
    // fetch 本身已完成（只是建立连接+响应头），超时计时器交给流阶段继续持有
  }
  if (!res.ok) {
    clearTimeout(fetchTimeout);
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const nodeStream = Readable.fromWeb(res.body);
  let result = null;

  await new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const extr = tarExtract();

    function done(err) {
      clearTimeout(fetchTimeout);
      // 销毁底层流，中止剩余下载
      nodeStream.destroy();
      gunzip.destroy();
      if (err && err.code !== "ERR_STREAM_DESTROYED" && err.name !== "AbortError") {
        reject(err);
      } else {
        resolve();
      }
    }

    extr.on("entry", (header, stream, next) => {
      if (header.name !== targetMapFile) {
        stream.resume();
        return next();
      }
      collectStream(stream, MAX_MAP_SIZE)
        .then(buf => {
          try {
            const map = JSON.parse(buf.toString("utf8"));
            const sources = Array.isArray(map.sources) ? map.sources : [];
            const contents = Array.isArray(map.sourcesContent) ? map.sourcesContent : [];
            result = sources
              .map((p, i) => {
                const c = contents[i];
                // 单文件模式默认也过滤第三方依赖源码
                if (p && p.includes("node_modules/")) return null;
                return typeof c === "string" && c.length > 0
                  ? { index: i, path: p, bytes: Buffer.byteLength(c, "utf8"), content: c }
                  : null;
              })
              .filter(Boolean);
          } catch {
            /* parse error → result stays null */
          }
          // 找到目标文件后立即中止整个流，不再继续下载剩余 tarball 内容
          done();
        })
        .catch(() => done());
    });

    extr.on("finish", () => done());
    extr.on("error", done);
    gunzip.on("error", done);
    nodeStream.on("error", err => {
      // AbortError / ERR_STREAM_DESTROYED 是主动中止，不算错误
      if (err.name === "AbortError" || err.code === "ERR_STREAM_DESTROYED") {
        resolve();
      } else {
        done(err);
      }
    });

    nodeStream.pipe(gunzip).pipe(extr);
  });

  return result;
}
