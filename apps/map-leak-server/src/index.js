/**
 * map-leak-server 主入口
 *
 * 启动顺序：
 *   1. 初始化 SQLite（getDb）
 *   2. 启动 Fastify HTTP 服务
 *   3. 启动 Scanner 定时任务
 *   4. 启动每日下载量刷新任务
 *
 * 单进程，Scanner 直接调用 db.js 函数，无内部 HTTP。
 */
import { getDb, closeDb, getDistinctPackageNames, updateDownloadsByName } from "./db.js";
import { startApi } from "./api.js";
import { startScanner } from "./scanner/index.js";
import { batchFetchDownloads } from "./scanner/popularity.js";

// 优雅退出
let apiServer = null;
async function shutdown() {
  console.log("\n[main] 正在关闭...");
  if (apiServer) await apiServer.close();
  closeDb();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ── 启动 ──────────────────────────────────────────────────────────────────────

console.log("=== MapLeak Server ===");

// 1. 初始化 DB（建表）
getDb();

// 2. 启动 API
apiServer = await startApi();

// 3. 启动 Scanner（异步，不阻塞 API 服务）
startScanner().catch(err => console.error("[scanner] 启动失败:", err));

// 4. 每日下载量刷新：每天凌晨 2 点批量更新所有包的周下载量
// 可通过环境变量 REFRESH_DL_CRON 自定义，设为 "off" 则禁用
(async () => {
  const REFRESH_DL_CRON = process.env.REFRESH_DL_CRON ?? "0 2 * * *";
  if (REFRESH_DL_CRON === "off") return;
  try {
    const { default: cron } = await import("node-cron");
    if (!cron.validate(REFRESH_DL_CRON)) {
      console.error(`[refresh-dl] 无效的 cron 表达式: ${REFRESH_DL_CRON}`);
      return;
    }
    let running = false;
    cron.schedule(REFRESH_DL_CRON, async () => {
      if (running) { console.warn("[refresh-dl] 上一轮未结束，跳过"); return; }
      running = true;
      try {
        const names = getDistinctPackageNames();
        if (names.length === 0) return;
        const BULK = 50;
        const DELAY_MS = 300;
        let updated = 0;
        for (let i = 0; i < names.length; i += BULK) {
          const dlMap = await batchFetchDownloads(names.slice(i, i + BULK));
          for (const [name, count] of dlMap) {
            if (count > 0) { updateDownloadsByName(name, count); updated++; }
          }
          if (i + BULK < names.length) await new Promise(r => setTimeout(r, DELAY_MS));
        }
        console.log(`[refresh-dl] 完成，已更新 ${updated}/${names.length} 个包`);
      } catch (err) {
        console.error("[refresh-dl] 失败:", err.message);
      } finally {
        running = false;
      }
    });
    console.log(`[refresh-dl] 每日下载量刷新已启动: ${REFRESH_DL_CRON}`);
  } catch {
    console.warn("[refresh-dl] node-cron 不可用，跳过每日下载量刷新");
  }
})();
