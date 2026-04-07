/**
 * Scanner 主逻辑
 *
 * 与原版唯一区别：直接调用 db.js 函数，不再通过 HTTP client。
 * 同进程内 event loop 串行，无 SQLite 锁竞争。
 *
 * 环境变量：
 *   SCAN_INTERVAL       cron 表达式，默认每 30 分钟
 *   CONCURRENCY         并发工作数，默认 5
 *   SCAN_NODE_MODULES   设为 1 时扫描包内 node_modules/ 的 .map（默认忽略）
 */
import { fetchRecentPackages, fetchCurrentSeq, getTarballUrl } from "./registry.js";
import { sortByPriority, fetchTopPackages } from "./popularity.js";
import { analyzeTarball } from "./detector.js";
import { report } from "./reporter.js";
import { isAlreadyScanned, markScanned, getState, setState } from "../db.js";

const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY ?? "5", 10));
const CRON_EXPR = process.env.SCAN_INTERVAL ?? "*/30 * * * *";
const TOP_POPULAR = 500;
const INCLUDE_NODE_MODULES = process.env.SCAN_NODE_MODULES === "1";

// ─── 核心扫描 ─────────────────────────────────────────────────────────────────

async function runScan() {
  console.log(`\n[scan] 开始扫描 @ ${new Date().toISOString()}`);
  const t0 = Date.now();

  // 1. Changes Feed 增量
  let recentPackages = [];
  try {
    let sinceSeq = getState("lastSeq");
    if (!sinceSeq) {
      sinceSeq = await fetchCurrentSeq();
      setState("lastSeq", sinceSeq);
      console.log(`[scan] 首次运行，起始 seq: ${sinceSeq}`);
    }
    const result = await fetchRecentPackages(sinceSeq);
    recentPackages = result.packages;
    setState("lastSeq", result.lastSeq);
    console.log(`[scan] Changes Feed: ${recentPackages.length} 个包`);
  } catch (err) {
    console.error("[scan] Changes Feed 失败:", err.message);
  }

  // 2. 热门包
  let popularPackages = [];
  try {
    popularPackages = await fetchTopPackages(TOP_POPULAR);
    console.log(`[scan] 热门包: ${popularPackages.length} 个`);
  } catch (err) {
    console.warn("[scan] 热门包拉取失败:", err.message);
  }

  // 3. 合并去重
  const seen = new Set();
  const allPackages = [];
  for (const pkg of [...recentPackages, ...popularPackages]) {
    const key = `${pkg.name}@${pkg.version}`;
    if (!seen.has(key)) {
      seen.add(key);
      allPackages.push(pkg);
    }
  }

  // 4. 过滤已扫描（同步直接查 DB，无 HTTP 往返）
  const pending = allPackages.filter(p => !isAlreadyScanned(p.name, p.version));
  console.log(`[scan] 待扫描: ${pending.length} 个（已跳过 ${allPackages.length - pending.length} 个）`);
  if (pending.length === 0) {
    console.log("[scan] 无新包，本轮结束");
    return;
  }

  // 5. 优先级排序
  const sorted = await sortByPriority(pending);
  if (sorted.length > 0) {
    const top = sorted[0];
    console.log(`[scan] 优先级最高: ${top.name}@${top.version} | 得分: ${top.priorityScore?.toFixed(0)}`);
  }

  // 6. Worker Pool
  await runWorkerPool(sorted, CONCURRENCY, analyzePkg);
  console.log(`[scan] 本轮完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ─── 单包分析 ─────────────────────────────────────────────────────────────────

async function analyzePkg(pkg) {
  let tarball = pkg.tarball;
  if (!tarball) {
    try {
      tarball = await getTarballUrl(pkg.name, pkg.version);
    } catch {
      markScanned(pkg.name, pkg.version, false);
      return;
    }
  }
  if (!tarball) {
    markScanned(pkg.name, pkg.version, false);
    return;
  }

  try {
    const leaks = await analyzeTarball(tarball, { includeNodeModules: INCLUDE_NODE_MODULES });
    const hasLeak = leaks.length > 0;
    markScanned(pkg.name, pkg.version, hasLeak);
    if (hasLeak) {
      await report({
        package: pkg.name,
        version: pkg.version,
        tarball,
        repoStatus: pkg.repoStatus,
        repository: pkg.repository ?? null,
        author: pkg.author ?? null,
        maintainers: pkg.maintainers ?? [],
        weeklyDownloads: pkg.weeklyDownloads ?? 0,
        description: pkg.description ?? "",
        keywords: pkg.keywords ?? [],
        leaks,
      });
    }
  } catch (err) {
    markScanned(pkg.name, pkg.version, false);
    if (process.env.DEBUG) console.warn(`[worker] ${pkg.name}@${pkg.version} 失败: ${err.message}`);
  }
}

// ─── Worker Pool ──────────────────────────────────────────────────────────────

function runWorkerPool(items, concurrency, fn) {
  return new Promise(resolve => {
    const queue = [...items];
    let active = 0;
    function pump() {
      while (active < concurrency && queue.length > 0) {
        const item = queue.shift();
        active++;
        fn(item).finally(() => {
          active--;
          if (queue.length === 0 && active === 0) resolve();
          else pump();
        });
      }
      if (queue.length === 0 && active === 0) resolve();
    }
    pump();
  });
}

// ─── 调度器 ───────────────────────────────────────────────────────────────────

export async function startScanner() {
  console.log(`[scanner] 并发: ${CONCURRENCY} | Cron: ${CRON_EXPR} | 热门包: TOP ${TOP_POPULAR}`);

  await runScan();

  try {
    const { default: cron } = await import("node-cron");
    if (!cron.validate(CRON_EXPR)) {
      console.error(`[scheduler] 无效的 cron 表达式: ${CRON_EXPR}`);
      return;
    }
    let running = false;
    cron.schedule(CRON_EXPR, async () => {
      if (running) {
        console.warn("[scheduler] 上一轮未结束，跳过");
        return;
      }
      running = true;
      await runScan().catch(e => console.error("[scan] 未捕获错误:", e));
      running = false;
    });
    console.log(`[scheduler] 定时任务已启动: ${CRON_EXPR}`);
  } catch {
    console.warn("[scheduler] node-cron 不可用，使用 setInterval(30min) 兜底");
    setInterval(runScan, 30 * 60 * 1000);
  }
}
