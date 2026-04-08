/**
 * 一次性迁移脚本：清理误判的 node_modules-only 泄露记录
 *
 * 背景：
 *   scanner 的 parseSourceMap 在修复前未过滤 node_modules/ 路径，
 *   导致部分将依赖源码打包进 source map 但自身无 sourcesContent 的包被误判为泄露。
 *
 * 识别策略：
 *   findings.source_paths JSON 数组中的【所有路径】均包含 "node_modules/" →
 *   说明该记录完全由第三方依赖源码构成，属于误判，直接删除。
 *
 * 注意：
 *   - 含有 node_modules/ 路径同时也含有自身源码路径的记录【不会被删除】
 *     （这类记录文件数/字节数被高估，需单独处理）
 *   - 运行前请确认服务器已停止（避免 WAL 锁冲突）
 *     或服务器支持 WAL + busy_timeout 可带锁运行（大多数情况安全）
 *
 * 用法：
 *   node scripts/purge-nm-only-findings.mjs [--dry-run]
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, rmSync } from "node:fs";

const isDryRun = process.argv.includes("--dry-run");

const SERVER_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "apps", "map-leak-server");
const DB_PATH = process.env.DB_PATH ?? resolve(SERVER_ROOT, "data.db");

// 动态加载 server 目录下的 node-sqlite3-wasm
const { default: pkg } = await import(
  new URL("../apps/map-leak-server/node_modules/node-sqlite3-wasm/dist/node-sqlite3-wasm.js", import.meta.url).href
);
const { Database } = pkg;

if (!existsSync(DB_PATH)) {
  console.error(`[error] 数据库不存在: ${DB_PATH}`);
  process.exit(1);
}

// 清理遗留锁文件
for (const f of [DB_PATH + ".lock", DB_PATH + "-wal", DB_PATH + "-shm"]) {
  if (existsSync(f)) {
    try { rmSync(f, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 10000");

console.log(`[info] 数据库: ${DB_PATH}`);
console.log(`[info] 模式: ${isDryRun ? "DRY-RUN（不实际删除）" : "实际删除"}\n`);

// 查出所有记录
const rows = db.prepare("SELECT id, name, version, map_file, source_paths FROM findings").all([]);
console.log(`[info] 共 ${rows.length} 条 findings 记录`);

// 识别：source_paths 中所有路径都含 node_modules/
const falsePositives = rows.filter(row => {
  let paths;
  try { paths = JSON.parse(row.source_paths ?? "[]"); } catch { return false; }
  if (!Array.isArray(paths) || paths.length === 0) return false;
  return paths.every(p => typeof p === "string" && p.includes("node_modules/"));
});

if (falsePositives.length === 0) {
  console.log("[info] 未发现误判记录，无需处理。");
  db.close();
  process.exit(0);
}

console.log(`[info] 发现 ${falsePositives.length} 条误判记录（全部 source_paths 均为 node_modules/）:\n`);
// 按 name+version 分组打印
const grouped = new Map();
for (const r of falsePositives) {
  const key = `${r.name}@${r.version}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(r);
}
for (const [pkg_, recs] of grouped) {
  console.log(`  ${pkg_}  (${recs.length} 个 .map 文件)`);
  for (const r of recs) {
    console.log(`    id=${r.id}  ${r.map_file}`);
  }
}

if (isDryRun) {
  console.log("\n[dry-run] 以上记录将被删除。去掉 --dry-run 参数后重新运行以实际删除。");
  db.close();
  process.exit(0);
}

console.log("\n[info] 开始删除…");

db.exec("BEGIN IMMEDIATE");
try {
  let totalFindings = 0;
  let totalSummary = 0;

  for (const [pkg_, recs] of grouped) {
    const [name, ...verParts] = pkg_.split("@").slice(pkg_.startsWith("@") ? 1 : 0);
    // 重新拆分：处理 scoped 包名 "@scope/name@version"
    const atIdx = pkg_.lastIndexOf("@");
    const pkgName = pkg_.slice(0, atIdx);
    const version = pkg_.slice(atIdx + 1);

    const df = db.prepare("DELETE FROM findings WHERE name = ? AND version = ?").run([pkgName, version]);
    const sumRow = db.prepare("SELECT id FROM findings_summary WHERE name = ? AND version = ?").get([pkgName, version]);
    const ds = db.prepare("DELETE FROM findings_summary WHERE name = ? AND version = ?").run([pkgName, version]);
    if (sumRow) {
      db.prepare("DELETE FROM findings_fts WHERE rowid = ?").run([sumRow.id]);
    }
    // scanned 保留但标记 has_leak=0，防止重新触发扫描
    db.prepare("UPDATE scanned SET has_leak = 0 WHERE name = ? AND version = ?").run([pkgName, version]);

    totalFindings += df.changes;
    totalSummary += ds.changes;
    console.log(`  ✓ 已删除 ${pkgName}@${version}  (findings: ${df.changes}, summary: ${ds.changes})`);
  }

  db.exec("COMMIT");
  console.log(`\n[done] 共删除 findings=${totalFindings} 条，summary=${totalSummary} 条。`);
} catch (err) {
  db.exec("ROLLBACK");
  console.error("[error] 事务回滚:", err.message);
  process.exit(1);
}

db.close();
