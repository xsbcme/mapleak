/**
 * HTTP API（前端专用，纯公开路由）
 *
 * GET  /api/findings              分页查询（支持包名/简介/关键字搜索、repo_status 筛选）
 * GET  /api/findings/:id          单条详情
 * GET  /api/stats                 统计汇总
 * GET  /api/events                SSE 实时推送
 * GET  /api/charts/timeline       近 N 小时逐小时泄露数
 * GET  /api/charts/repo-status    仓库类型分布
 * GET  /api/charts/top-downloads  周下载量 TOP N
 * GET  /api/charts/top-size       泄露体积 TOP N
 * GET  /api/charts/daily          近 N 天每日扫描/发现对比
 * GET  /api/extract/:id           提取源码文件列表
 *
 * 环境变量：
 *   API_PORT    监听端口，默认 3001
 *   STATIC_DIR  前端静态文件目录（留空则不托管静态资源，开发时由 Vite 代理）
 *               生产部署时设置为 /app/web/dist 或相对路径即可
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  queryFindings,
  getFindingById,
  getStats,
  getTimeline,
  getRepoStatusBreakdown,
  getTopByDownloads,
  getTopBySize,
  getDailyActivity,
  getDistinctPackageNames,
  updateDownloadsByName,
  getFindingGrouped,
} from "./db.js";
import { leakEvents } from "./events.js";
import { extractSourceMap, extractAllSourceMaps } from "./scanner/detector.js";
import { getWeeklyDownloads, batchFetchDownloads } from "./scanner/popularity.js";
import { tryJson, fetchReadme, npmFetch } from "./utils.js";

const PORT = parseInt(process.env.API_PORT ?? "3001", 10);
const SERVER_DIR = resolve(fileURLToPath(import.meta.url), "..", "..");
// STATIC_DIR 优先从环境变量读取；若未设置则尝试 <server_root>/../map-leak-web/dist（monorepo 布局）
const STATIC_DIR = process.env.STATIC_DIR ?? resolve(SERVER_DIR, "..", "map-leak-web", "dist");

// ─── 统一响应包装 ──────────────────────────────────────────────────────────

const ok = data => ({ code: 200, msg: "", data });
const fail = (code, msg) => ({ code, msg, data: null });

// ― 工具 ――――――――――――――――――――――――――――――――――――――――――――――

function deserializeLeak(lk) {
  return {
    ...lk,
    mapFile: lk.map_file,
    fileCount: lk.file_count,
    totalBytes: lk.total_bytes,
    hasCloudRef: !!lk.has_cloud_ref,
    sourcePaths: tryJson(lk.source_paths, []),
  };
}

function deserialize(r) {
  return {
    ...r,
    author: tryJson(r.author, null),
    maintainers: tryJson(r.maintainers, []),
    keywords: tryJson(r.keywords, []),
    leaks: (r.leaks ?? []).map(deserializeLeak),
  };
}

// ─── 构建 Fastify 实例 ────────────────────────────────────────────────────

export async function buildApi() {
  const app = Fastify({ logger: { level: "warn" } });
  await app.register(cors, { origin: true });

  // ── 静态文件服务（生产模式）──────────────────────────────────────────────
  // 当 STATIC_DIR 目录存在时自动托管前端构建产物；SPA 回退到 index.html
  if (existsSync(STATIC_DIR)) {
    await app.register(staticPlugin, {
      root: STATIC_DIR,
      prefix: "/",
      decorateReply: false,
    });
    // 所有非 /api 路由回退到 index.html（Vue Router history 模式）
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile("index.html");
    });
    console.log(`[api] 静态文件: ${STATIC_DIR}`);
  }
  app.get(
    "/api/findings",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
            q: { type: "string", default: "" },
            repo_status: { type: "string", default: "" },
            sort: { type: "string", enum: ["time", "downloads", "map_count", "size"], default: "time" },
          },
        },
      },
    },
    async req => {
      const { limit, offset, q, repo_status, sort } = req.query;
      const result = queryFindings({ limit, offset, q, repo_status, sort });
      return ok({ total: result.total, rows: result.rows.map(deserialize) });
    }
  );

  // GET /api/findings/:id
  app.get(
    "/api/findings/:id",
    {
      schema: { params: { type: "object", properties: { id: { type: "integer" } } } },
    },
    async (req, reply) => {
      const row = getFindingById(parseInt(req.params.id, 10));
      if (!row) return reply.code(404).send(fail(404, "not found"));
      return ok(deserialize(row));
    }
  );

  // GET /api/stats
  app.get("/api/stats", async () => ok(getStats()));

  // GET /api/events  (SSE)
  app.get("/api/events", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(": connected\n\n");

    const onLeak = f => reply.raw.write(`data: ${JSON.stringify(f)}\n\n`);
    leakEvents.on("leak", onLeak);
    const hb = setInterval(() => reply.raw.write(": heartbeat\n\n"), 25_000);

    req.raw.on("close", () => {
      clearInterval(hb);
      leakEvents.off("leak", onLeak);
    });
    await new Promise(() => {});
  });

  // GET /api/charts/timeline
  app.get(
    "/api/charts/timeline",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { hours: { type: "integer", minimum: 1, maximum: 168, default: 24 } },
        },
      },
    },
    async req => ok(getTimeline(req.query.hours))
  );

  // GET /api/charts/repo-status
  app.get("/api/charts/repo-status", async () => ok(getRepoStatusBreakdown()));

  // GET /api/charts/top-downloads
  app.get(
    "/api/charts/top-downloads",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
        },
      },
    },
    async req => ok(getTopByDownloads(req.query.limit))
  );

  // GET /api/charts/top-size
  app.get(
    "/api/charts/top-size",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
        },
      },
    },
    async req => ok(getTopBySize(req.query.limit))
  );

  // GET /api/charts/daily
  app.get(
    "/api/charts/daily",
    {
      schema: {
        querystring: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 30, default: 7 } } },
      },
    },
    async req => ok(getDailyActivity(req.query.days))
  );

  // GET /api/readme?name=&version=  ── 从 npm registry 取包的 README 内容

  // POST /api/admin/refresh-downloads  ── 后台补刷历史数据的周下载量（异步，立即返回）
  // GET  /api/admin/refresh-downloads  ── 查询当前补刷进度
  let refreshJob = null; // { running, total, updated, startedAt, finishedAt, error }

  app.get("/api/admin/refresh-downloads", async () => {
    if (!refreshJob) return ok({ running: false, total: 0, updated: 0 });
    return ok(refreshJob);
  });

  app.post("/api/admin/refresh-downloads", async () => {
    if (refreshJob?.running) return ok({ msg: "已在运行中", ...refreshJob });

    const names = getDistinctPackageNames();
    refreshJob = {
      running: true,
      total: names.length,
      updated: 0,
      skipped: 0,
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
    };
    if (names.length === 0) {
      refreshJob = {
        running: false,
        total: 0,
        updated: 0,
        skipped: 0,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        error: null,
      };
      return ok(refreshJob);
    }

    // 后台异步执行，不阻塞请求
    (async () => {
      const BULK = 50; // 每批请求包数
      const DELAY_MS = 300; // 批次间隔，避免限流
      try {
        for (let i = 0; i < names.length; i += BULK) {
          const batch = names.slice(i, i + BULK);
          const dlMap = await batchFetchDownloads(batch);
          for (const [name, count] of dlMap) {
            if (count > 0) {
              updateDownloadsByName(name, count);
              refreshJob.updated++;
            } else {
              refreshJob.skipped++;
            }
          }
          // 批次间隔
          if (i + BULK < names.length) await new Promise(r => setTimeout(r, DELAY_MS));
        }
      } catch (err) {
        refreshJob.error = err.message;
      } finally {
        refreshJob.running = false;
        refreshJob.finishedAt = Date.now();
      }
    })();

    return ok({ msg: "已开始后台刷新", total: names.length });
  });

  app.get(
    "/api/readme",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { name: { type: "string" }, version: { type: "string", default: "latest" } },
          required: ["name"],
        },
      },
    },
    async (req, reply) => {
      const { name, version } = req.query;
      try {
        const res = await npmFetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`, 8_000);
        if (!res.ok) return reply.code(res.status).send(fail(res.status, "npm registry error"));
        const data = await res.json();
        return ok({ readme: data.readme ?? "" });
      } catch (err) {
        return reply.code(502).send(fail(502, err.message));
      }
    }
  );

  // GET /api/extract-package  ── 一次提取整个包所有 .map 的源码（整合为工程视图）
  app.get(
    "/api/extract-package",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            include_node_modules: { type: "string", default: "0" },
          },
          required: ["name", "version"],
        },
      },
      config: { timeout: 90_000 },
    },
    async (req, reply) => {
      const { name, version, include_node_modules } = req.query;
      const includeNodeModules = include_node_modules === "1";
      const grouped = getFindingGrouped(name, version);
      if (!grouped) return reply.code(404).send(fail(404, "记录不存在"));

      const leaks = grouped.leaks ?? [];
      const tarball = grouped.tarball;
      const mapFiles = leaks.map(lk => lk.map_file).filter(Boolean);
      if (mapFiles.length === 0) return reply.code(404).send(fail(404, "无泄露记录"));

      let allResults;
      try {
        allResults = await extractAllSourceMaps(tarball, mapFiles, { includeNodeModules });
      } catch (err) {
        return reply.code(502).send(fail(502, `提取失败: ${err.message}`));
      }

      // 合并所有 .map 的源文件，附加来源标注，路径去重（保留首次出现）
      const seen = new Set();
      const files = [];
      for (const [mapFile, entries] of allResults) {
        for (const entry of entries) {
          const isDup = seen.has(entry.path);
          seen.add(entry.path);
          files.push({ ...entry, mapFile, duplicate: isDup });
        }
      }

      // 并行拉取 README（失败不影响主流程）
      const readme = await fetchReadme(name, version);

      return ok({
        name,
        version,
        tarball,
        readme,
        mapCount: mapFiles.length,
        total: files.length,
        files,
      });
    }
  );

  // GET /api/extract/:id  ── 提取指定泄露记录的全部源文件内容（含 README）
  app.get(
    "/api/extract/:id",
    {
      schema: { params: { type: "object", properties: { id: { type: "integer" } } } },
      config: { timeout: 75_000 },
    },
    async (req, reply) => {
      const row = getFindingById(parseInt(req.params.id, 10));
      if (!row) return reply.code(404).send(fail(404, "记录不存在"));

      let files;
      try {
        files = await extractSourceMap(row.tarball, row.map_file);
      } catch (err) {
        return reply.code(502).send(fail(502, `提取失败: ${err.message}`));
      }
      if (files === null) {
        return reply.code(404).send(fail(404, "在 tarball 中找不到该 .map 文件"));
      }

      // 并行拉取 README（失败不影响主流程）
      const readme = await fetchReadme(row.name, row.version);

      return ok({
        id: row.id,
        name: row.name,
        version: row.version,
        mapFile: row.map_file,
        tarball: row.tarball,
        readme,
        total: files.length,
        files,
      });
    }
  );

  return app;
}

export async function startApi() {
  const app = await buildApi();
  const address = await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[api] 监听 ${address}`);
  return app;
}
