/**
 * npm Registry 监听器
 *
 * 使用 skimdb.npmjs.com（npm 官方 CouchDB 镜像）的 _changes feed。
 * replicate.npmjs.com 不接受 timeout=0 且对 since=now 返回 400。
 *
 * 端点：
 *   GET https://skimdb.npmjs.com/registry/_changes?since=<seq>&limit=<n>
 *
 * since 参数：
 *   - 首次运行：调用 DB info 端点获取当前 update_seq，以此为起点
 *   - 后续运行：使用上次返回的 last_seq（持久化在 SQLite state 表）
 *
 * 流程：
 *   1. 获取 _changes 增量（仅含包名，不含 doc 内容，轻量）
 *   2. 批量并发拉取 registry.npmjs.org/<name>/latest 元数据
 *   3. 返回包列表 + lastSeq
 */

import { npmFetch, npmFetchRetry } from "../utils.js";

const SKIMDB_URL = "https://skimdb.npmjs.com/registry";
const REGISTRY_BASE = "https://registry.npmjs.org";

const CHANGES_LIMIT = 1000;
const META_CONCURRENCY = 20;

/**
 * 首次运行时获取当前序列号（用于增量起点，避免从头拉全量）
 * @returns {Promise<string>}
 */
export async function fetchCurrentSeq() {
  // CouchDB 序列号查询：重试 4 次，基础延迟 800ms
  const res = await npmFetchRetry(`${SKIMDB_URL}/_changes?descending=true&limit=1`, 15_000, {
    attempts: 4,
    delay: 800,
  });
  if (!res.ok) throw new Error(`DB info error: ${res.status}`);
  const data = await res.json();
  return String(data.last_seq ?? "0");
}

/**
 * 获取自 sinceSeq 之后发布/更新的包列表
 * @param {string} sinceSeq - CouchDB 序列号（来自 SQLite state 或 fetchCurrentSeq()）
 * @returns {Promise<{ packages: Array<{name,version,tarball,repository}>, lastSeq: string }>}
 */
export async function fetchRecentPackages(sinceSeq) {
  const url = `${SKIMDB_URL}/_changes` + `?since=${encodeURIComponent(String(sinceSeq))}` + `&limit=${CHANGES_LIMIT}`;

  // Changes Feed：重试 4 次，基础延迟 1s（skimdb 偶发 5xx）
  const res = await npmFetchRetry(url, 30_000, { attempts: 4, delay: 1_000 });

  if (!res.ok) {
    throw new Error(`CouchDB changes feed error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  const ids = (data.results ?? []).filter(r => !r.deleted && r.id && !r.id.startsWith("_")).map(r => r.id);

  const packages = ids.length > 0 ? await batchFetchLatest(ids) : [];

  return {
    packages,
    lastSeq: String(data.last_seq ?? sinceSeq),
  };
}

/**
 * 批量并发拉取最新版本元数据（Worker Pool）
 */
async function batchFetchLatest(names) {
  const results = [];
  const queue = [...names];

  await new Promise(resolve => {
    let active = 0;

    function pump() {
      while (active < META_CONCURRENCY && queue.length > 0) {
        const name = queue.shift();
        active++;
        fetchLatestMeta(name)
          .then(pkg => {
            if (pkg) results.push(pkg);
          })
          .finally(() => {
            active--;
            if (queue.length === 0 && active === 0) resolve();
            else pump();
          });
      }
      if (queue.length === 0 && active === 0) resolve();
    }

    pump();
  });

  return results;
}

async function fetchLatestMeta(name) {
  try {
    // 元数据查询：重试 3 次，基础延迟 600ms
    const res = await npmFetchRetry(`${REGISTRY_BASE}/${encodeURIComponent(name)}/latest`, 8_000, {
      attempts: 3,
      delay: 600,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name,
      version: data.version ?? null,
      tarball: data.dist?.tarball ?? null,
      repository: data.repository ?? null,
      author: data.author ?? null,
      maintainers: data.maintainers ?? [],
      description: data.description ?? "",
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
    };
  } catch {
    return null;
  }
}

/**
 * 获取单个包某版本的 tarball 下载地址（供 index.js 补全热门包）
 */
export async function getTarballUrl(name, version) {
  const res = await npmFetch(`${REGISTRY_BASE}/${encodeURIComponent(name)}/${version}`, 10_000);
  if (!res.ok) throw new Error(`Cannot fetch metadata for ${name}@${version}`);
  const data = await res.json();
  return data.dist?.tarball ?? null;
}
