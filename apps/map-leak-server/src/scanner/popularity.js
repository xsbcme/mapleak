/**
 * 包下载量 + 优先级评分模块
 *
 * 使用 npm 官方 Downloads API：https://api.npmjs.org/downloads/point/
 * 该 API 免费、无需鉴权，速率限制约 ~5000 req/min。
 *
 * 优先级策略（核心思路）：
 *   开源包（有公开 repo）泄露 source map 危害极低，因为代码本已公开。
 *   真正有价值的目标是：闭源 + 高下载量 + 被大量依赖的包。
 *
 *   优先级得分 = weeklyDownloads × closedSourceMultiplier
 *
 *   closedSourceMultiplier：
 *     - 无 repository 字段    → 3.0  （极可能是闭源商业包）
 *     - repository 是私有地址 → 1.5  （明确私有）
 *     - repository 指向公开 GitHub/GitLab 等 → 0.1  （开源，降权）
 *
 * 缓存策略：
 *   下载量结果内存缓存 1 小时，避免频繁请求 Downloads API。
 */

import { npmFetch, npmFetchRetry, pLimit } from "../utils.js";

/** scoped 包逐个请求时的并发上限（避免大量 scoped 包同时发起请求触发 429）*/
const SCOPED_CONCURRENCY = 8;

const DOWNLOADS_API = "https://api.npmjs.org/downloads/point/last-week";
const SEARCH_API = "https://registry.npmjs.org/-/v1/search";

// 公开代码托管平台域名特征，命中则视为开源
const OPEN_SOURCE_HOSTS = ["github.com", "gitlab.com", "bitbucket.org", "sr.ht", "codeberg.org", "gitee.com"];

// 内存缓存：name -> { count: number, expireAt: number }
// 容量上限 MAX_CACHE_SIZE，超出时按 FIFO 逐出最早插入的条目
const downloadCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时
const MAX_CACHE_SIZE = 2_000; // 最多缓存 2000 个包名，防止无界增长

function cacheSet(name, count) {
  if (downloadCache.size >= MAX_CACHE_SIZE) {
    // Map 的迭代顺序是插入顺序，删除最旧的 100 条腾出空间
    const toDelete = downloadCache.keys();
    for (let i = 0; i < 100; i++) {
      const { value, done } = toDelete.next();
      if (done) break;
      downloadCache.delete(value);
    }
  }
  downloadCache.set(name, { count, expireAt: Date.now() + CACHE_TTL_MS });
}

// ─── 开源判断 ─────────────────────────────────────────────────────────────────

/**
 * 根据 repository 字段判断开源状态
 *
 * @param {string | {url?: string, type?: string} | null | undefined} repository
 * @returns {'none' | 'private' | 'open-source'}
 *   none       - 没有 repository 字段，大概率是闭源商业包
 *   private    - 有 repository 字段但不指向公开平台（内网/私有 Git）
 *   open-source - 指向已知公开代码托管平台
 */
export function classifyRepository(repository) {
  if (!repository) return "none";

  // repository 可以是字符串或 { type, url } 对象
  const url = typeof repository === "string" ? repository : (repository.url ?? "");

  if (!url) return "none";

  // 去除 git+ 前缀和 .git 后缀，统一处理
  const normalizedUrl = url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .toLowerCase();

  if (OPEN_SOURCE_HOSTS.some(host => normalizedUrl.includes(host))) {
    return "open-source";
  }

  // 有 repository 字段但不是公开平台（内网 GitLab / 私有 Gitea 等）
  return "private";
}

/**
 * 根据开源状态返回优先级乘数
 * @param {'none' | 'private' | 'open-source'} repoStatus
 * @returns {number}
 */
export function closedSourceMultiplier(repoStatus) {
  switch (repoStatus) {
    case "none":
      return 3.0;
    case "private":
      return 1.5;
    case "open-source":
      return 0.1;
  }
}

// ─── 下载量查询 ───────────────────────────────────────────────────────────────

/**
 * 批量获取多个包的周下载量（使用 npm 批量端点，一次请求最多 50 个包）
 * 单包响应: { downloads: N, package: "name", ... }
 * 多包响应: { "pkg1": { downloads: N, ... }, "pkg2": { ... }, ... }
 *
 * @param {string[]} names
 * @returns {Promise<Map<string, number>>}
 */
export async function batchFetchDownloads(names) {
  const result = new Map(names.map(n => [n, 0]));
  if (names.length === 0) return result;

  // 先查缓存
  const uncached = names.filter(n => {
    const c = downloadCache.get(n);
    if (c && c.expireAt > Date.now()) {
      result.set(n, c.count);
      return false;
    }
    return true;
  });
  if (uncached.length === 0) return result;

  // 批量端点不支持 scoped 包（@scope/name），分开处理
  const scoped = uncached.filter(n => n.startsWith("@"));
  const unscoped = uncached.filter(n => !n.startsWith("@"));

  // unscoped 批量查
  if (unscoped.length > 0) {
    try {
      const url = `${DOWNLOADS_API}/${unscoped.join(",")}`;
      // 批量查询：重试 3 次，基础延迟 500ms
      const res = await npmFetchRetry(url, 15_000, { attempts: 3, delay: 500 });
      if (res.ok) {
        const data = await res.json();
        if (unscoped.length === 1) {
          const count = data.downloads ?? 0;
          result.set(unscoped[0], count);
          cacheSet(unscoped[0], count);
        } else {
          for (const [name, stats] of Object.entries(data)) {
            const count = stats?.downloads ?? 0;
            result.set(name, count);
            cacheSet(name, count);
          }
        }
      } else {
        console.warn(`[downloads] bulk API ${res.status}, falling back to individual requests`);
        // 批量接口返回 4xx（非 429），降级为逐个查询（并发限制 SCOPED_CONCURRENCY，重试 2 次）
        const limit = pLimit(SCOPED_CONCURRENCY);
        await Promise.all(
          unscoped.map(name =>
            limit(async () => {
              try {
                const r = await npmFetchRetry(`${DOWNLOADS_API}/${encodeURIComponent(name)}`, 8_000, {
                  attempts: 2,
                  delay: 400,
                });
                if (!r.ok) return;
                const d = await r.json();
                const count = d.downloads ?? 0;
                result.set(name, count);
                cacheSet(name, count);
              } catch {
                /* ignore */
              }
            })
          )
        );
      }
    } catch (err) {
      console.warn(`[downloads] fetch failed:`, err.message);
    }
  }

  // scoped 包逐个查（批量端点不支持），并发受限 + 重试 2 次
  if (scoped.length > 0) {
    const limit = pLimit(SCOPED_CONCURRENCY);
    await Promise.all(
      scoped.map(name =>
        limit(async () => {
          try {
            const r = await npmFetchRetry(`${DOWNLOADS_API}/${encodeURIComponent(name)}`, 8_000, {
              attempts: 2,
              delay: 400,
            });
            if (!r.ok) return;
            const d = await r.json();
            const count = d.downloads ?? 0;
            result.set(name, count);
            cacheSet(name, count);
          } catch {
            /* ignore */
          }
        })
      )
    );
  }

  return result;
}

/**
 * 获取单个包的周下载量（带内存缓存）
 * @param {string} name
 * @returns {Promise<number>}
 */
export async function getWeeklyDownloads(name) {
  const map = await batchFetchDownloads([name]);
  return map.get(name) ?? 0;
}

// ─── 优先级排序 ───────────────────────────────────────────────────────────────

/**
 * 对包列表按优先级得分降序排序，并附加得分信息。
 * 批量并发查询下载量（每批 20 个，避免超速率限制）。
 *
 * @param {Array<{name: string, version: string, tarball?: string, repository?: any}>} packages
 * @returns {Promise<Array<{
 *   name: string,
 *   version: string,
 *   tarball?: string,
 *   weeklyDownloads: number,
 *   repoStatus: 'none' | 'private' | 'open-source',
 *   priorityScore: number
 * }>>}
 */
export async function sortByPriority(packages) {
  const BULK = 50; // npm 批量端点单次上限
  const results = [];

  for (let i = 0; i < packages.length; i += BULK) {
    const batch = packages.slice(i, i + BULK);
    const dlMap = await batchFetchDownloads(batch.map(p => p.name));

    for (const pkg of batch) {
      const weeklyDl = dlMap.get(pkg.name) ?? 0;
      const repoStatus = classifyRepository(pkg.repository);
      const multiplier = closedSourceMultiplier(repoStatus);
      const priorityScore = weeklyDl * multiplier;
      results.push({ ...pkg, weeklyDownloads: weeklyDl, repoStatus, priorityScore });
    }
  }

  results.sort((a, b) => b.priorityScore - a.priorityScore);
  return results;
}

// ─── 热门包列表获取 ───────────────────────────────────────────────────────────

/**
 * 通过 npm search API 获取热门包列表（按 popularity 排序）
 * search API 返回的 package 对象包含 links.repository，直接借用。
 *
 * @param {number} total - 要获取的包总数
 * @returns {Promise<Array<{name: string, version: string, tarball?: string, repository?: any}>>}
 */
export async function fetchTopPackages(total = 250) {
  const packages = [];
  const pageSize = 250; // npm search 单页最大值
  let from = 0;

  while (packages.length < total) {
    try {
      // boost-exact:false 是一个可靠的"全量"查询方式，不过滤任何包
      // popularity=1.0 确保结果按周下载量排序
      const url =
        `${SEARCH_API}?text=boost-exact:false` +
        `&size=${pageSize}&from=${from}` +
        `&popularity=1.0&quality=0.1&maintenance=0.1`;

      const res = await npmFetch(url, 15_000);

      if (!res.ok) {
        console.warn(`[popularity] search API ${res.status}, 停止分页`);
        break;
      }

      const data = await res.json();
      const objects = data.objects ?? [];

      if (objects.length === 0) break;

      for (const obj of objects) {
        const name = obj.package?.name;
        const version = obj.package?.version;
        if (!name || !version) continue;
        const repository = obj.package?.links?.repository ?? null;
        const publisher = obj.package?.publisher?.username ?? null;
        // search API 仅提供发布者用户名，格式化为与 registry 一致的 author 对象
        const author = publisher ? { name: publisher } : null;
        const description = obj.package?.description ?? "";
        const keywords = Array.isArray(obj.package?.keywords) ? obj.package.keywords : [];
        const maintainers = Array.isArray(obj.package?.maintainers) ? obj.package.maintainers : [];
        packages.push({ name, version, tarball: undefined, repository, author, maintainers, description, keywords });
      }

      from += objects.length;

      // data.total 不一定存在，用 objects 不足一页作为终止条件
      const total_count = data.total ?? Infinity;
      if (from >= total_count || objects.length < pageSize) break;
    } catch (err) {
      console.warn("[popularity] fetchTopPackages 异常:", err.message);
      break;
    }
  }

  return packages.slice(0, total);
}
