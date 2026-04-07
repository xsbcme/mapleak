/**
 * map-leak-server 主入口
 *
 * 启动顺序：
 *   1. 初始化 SQLite（getDb）
 *   2. 启动 Fastify HTTP 服务
 *   3. 启动 Scanner 定时任务
 *
 * 单进程，Scanner 直接调用 db.js 函数，无内部 HTTP。
 */
import { getDb, closeDb } from "./db.js";
import { startApi } from "./api.js";
import { startScanner } from "./scanner/index.js";

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
