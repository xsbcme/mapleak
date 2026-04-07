/**
 * 共享工具函数
 *
 * 集中存放跨模块复用的常量和小工具，避免散落重复：
 *   - USER_AGENT     : npm 请求标识头，所有 fetch 统一使用
 *   - tryJson        : 安全 JSON 解析（api.js / reporter.js 原有重复实现）
 *   - formatBytes    : 字节大小格式化（reporter.js 原有，供日志使用）
 *   - npmFetch       : 带 User-Agent 的 npm 请求封装（单次，不重试）
 *   - withRetry      : 通用指数退避重试（exponential backoff + jitter）
 *   - npmFetchRetry  : npmFetch + 自动重试（429/5xx/超时）
 */

export const USER_AGENT = "npm-sourcemap-leak-detector/1.0";

/**
 * 安全 JSON 解析：解析失败时返回 fallback
 * @template T
 * @param {string|null|undefined} str
 * @param {T} fallback
 * @returns {T}
 */
export function tryJson(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * 字节大小人类可读格式
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

/**
 * 带统一 User-Agent 的 npm fetch 包装（单次，不重试）
 * @param {string} url
 * @param {number} [timeoutMs=15000]
 * @returns {Promise<Response>}
 */
export function npmFetch(url, timeoutMs = 15_000) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// ─── 重试工具 ─────────────────────────────────────────────────────────────────

/** @param {number} ms */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 判断错误是否值得重试：网络超时、连接失败、429 限流、5xx 服务端故障
 * @param {unknown} err
 * @returns {boolean}
 */
function isRetryable(err) {
  if (!err) return false;
  // AbortSignal.timeout() 超时 → TimeoutError；手动 abort → AbortError
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  // fetch 网络层异常（DNS 失败 / 连接被拒等）→ TypeError
  if (err instanceof TypeError) return true;
  // HTTP 状态码（由 npmFetchRetry 封装后抛出）
  if (typeof err.status === "number") {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

/**
 * 通用指数退避重试（exponential backoff with full jitter）
 *
 * 退避公式：delay × factor^attempt × U(1-jitter, 1+jitter)
 *
 * @template T
 * @param {() => Promise<T>} fn         - 要重试的异步操作
 * @param {object}           [opts]
 * @param {number}           [opts.attempts=3]    - 最大尝试次数（含首次）
 * @param {number}           [opts.delay=600]     - 首次重试基础延迟 (ms)
 * @param {number}           [opts.factor=2]      - 退避倍数
 * @param {number}           [opts.jitter=0.25]   - 随机抖动系数 (±25%)
 * @param {string}           [opts.tag='']        - 日志标签，便于溯源
 * @param {(e:Error)=>boolean} [opts.retryIf]     - 过滤哪些错误触发重试
 * @returns {Promise<T>}
 */
export async function withRetry(
  fn,
  { attempts = 3, delay = 600, factor = 2, jitter = 0.25, tag = "", retryIf = isRetryable } = {}
) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const last = i === attempts - 1;
      if (last || !retryIf(err)) throw err;

      const spread = delay * factor ** i;
      const backoff = Math.round(spread * (1 + (Math.random() - 0.5) * jitter * 2));
      const label = tag ? ` [${tag}]` : "";
      console.warn(`[retry]${label} attempt ${i + 1}/${attempts} – ${err.message} → retry in ${backoff}ms`);
      await sleep(backoff);
    }
  }
  /* c8 ignore next */
  throw new Error("withRetry: unreachable");
}

/**
 * 带自动重试的 npm fetch
 *
 * 在 npmFetch 基础上，将 429 / 5xx 状态码转换为可重试错误，
 * 网络超时和连接失败也会自动退避重试。
 *
 * @param {string} url
 * @param {number} [timeoutMs=15000]
 * @param {object} [retryOpts]          - 透传给 withRetry 的选项（attempts/delay/…）
 * @returns {Promise<Response>}         - 返回 2xx / 4xx（非429）的 Response；超出重试次数后抛出
 */
export function npmFetchRetry(url, timeoutMs = 15_000, retryOpts = {}) {
  const tag = url.length > 55 ? url.slice(0, 52) + "…" : url;
  return withRetry(
    async () => {
      const res = await npmFetch(url, timeoutMs);
      if (res.status === 429 || res.status >= 500) {
        const err = new Error(`HTTP ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }
      return res;
    },
    { tag, retryIf: isRetryable, ...retryOpts }
  );
}

/**
 * 轻量并发限制器（无外部依赖）
 *
 * 用法：
 *   const limit = pLimit(8);
 *   await Promise.all(items.map((x) => limit(() => doWork(x))));
 *
 * @param {number} concurrency
 * @returns {(fn: () => Promise<any>) => Promise<any>}
 */
export function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return fn =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

/**
 * 从 npm registry 拉取指定包版本的 README
 * @param {string} name
 * @param {string} [version='latest']
 * @returns {Promise<string>} - readme 字符串，失败时返回空串
 */
export async function fetchReadme(name, version = "latest") {
  try {
    const res = await npmFetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`, 8_000);
    if (!res.ok) return "";
    const data = await res.json();
    return data.readme ?? "";
  } catch {
    return "";
  }
}
