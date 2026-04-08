/**
 * SQLite 存储层（node-sqlite3-wasm）
 *
 * Schema v3:
 *   scanned  —— 已扫描记录（防重）
 *   findings —— 泄露详情，UNIQUE(name, version, map_file) 保证去重
 *   state    —— 键值持久化
 *
 * findings 每行 = 一个 .map 文件；同一 (name, version) 可有多行。
 * 对外查询时按 (name, version) 分组，将多个 .map 文件聚合为 leaks 数组。
 */
import pkg from "node-sqlite3-wasm";
const { Database } = pkg;
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rmSync, existsSync } from "node:fs";

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const DB_PATH = resolve(process.env.DB_PATH ?? `${PKG_ROOT}/data.db`);

/** 当 schema 结构发生 breaking change 时递增，自动重建 findings 表 */
const SCHEMA_V = "3";
/** 预聚合摘要表版本，变更时重建 findings_summary + findings_fts */
const SUMMARY_V = "1";

let _db = null;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * 清理 node-sqlite3-wasm 遗留的锁文件/目录（进程意外退出时不会自动清除）
 * 必须在 Database() 打开之前调用，否则 WAL 模式下会报 SQLITE_BUSY/SQLITE_CANTOPEN
 */
function cleanStaleLocks() {
  const targets = [
    DB_PATH + ".lock", // node-sqlite3-wasm 用目录实现的进程锁
    DB_PATH + "-wal",  // WAL 日志（异常退出时可能残留）
    DB_PATH + "-shm",  // 共享内存文件
  ];
  for (const f of targets) {
    if (existsSync(f)) {
      try {
        rmSync(f, { recursive: true, force: true });
        console.log(`[db] 已清理遗留锁文件: ${f}`);
      } catch (e) {
        console.warn(`[db] 清理锁文件失败: ${f}: ${e.message}`);
      }
    }
  }
}

export function getDb() {
  if (_db) return _db;

  // 清理上次进程意外退出遗留的锁文件，防止 SQLITE_BUSY / SQLITE_CANTOPEN
  cleanStaleLocks();

  let lastErr;
  for (let i = 0; i < 5; i++) {
    try {
      _db = new Database(DB_PATH);
      _db.exec("PRAGMA journal_mode = WAL");
      _db.exec("PRAGMA synchronous = NORMAL");
      _db.exec("PRAGMA busy_timeout = 8000"); // 锁冲突时最多等待 8s，避免并发写直接 SQLITE_BUSY
      _db.exec("PRAGMA cache_size = -65536");
      _db.exec("PRAGMA mmap_size = 268435456"); // 256 MB 内存映射，加速大表顺序读
      _db.exec("PRAGMA temp_store = MEMORY"); // 临时结果集放内存，避免磁盘 I/O
      _db.exec("PRAGMA foreign_keys = ON");
      break;
    } catch (err) {
      lastErr = err;
      _db = null;
      if (i < 4) {
        console.warn(`[db] 打开数据库失败，400ms 后重试（第 ${i + 1} 次）: ${err.message}`);
        sleep(400);
      }
    }
  }
  if (!_db) throw lastErr;

  // ── 基础表（不涉及迁移）────────────────────────────────────────────────
  _db.exec(`
    CREATE TABLE IF NOT EXISTS scanned (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      version    TEXT    NOT NULL,
      scanned_at INTEGER NOT NULL DEFAULT (unixepoch()),
      has_leak   INTEGER NOT NULL DEFAULT 0,
      UNIQUE(name, version)
    );
    CREATE INDEX IF NOT EXISTS idx_scanned_name ON scanned(name);

    CREATE TABLE IF NOT EXISTS state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ── Schema 版本迁移 ───────────────────────────────────────────────────
  // v3: 引入 UNIQUE(name, version, map_file)；旧 findings 表直接重建
  const vRow = _db.prepare("SELECT value FROM state WHERE key = ?").get(["schema_version"]);
  if (!vRow || vRow.value !== SCHEMA_V) {
    _db.exec("DROP TABLE IF EXISTS findings");
    console.log(`[db] findings 表已重建（升级至 schema ${SCHEMA_V}）`);
  }

  _db.exec(`
    CREATE TABLE IF NOT EXISTS findings (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      version          TEXT    NOT NULL,
      tarball          TEXT    NOT NULL,
      map_file         TEXT    NOT NULL,
      file_count       INTEGER NOT NULL DEFAULT 0,
      total_bytes      INTEGER NOT NULL DEFAULT 0,
      source_paths     TEXT    NOT NULL DEFAULT '[]',
      has_cloud_ref    INTEGER NOT NULL DEFAULT 0,
      author           TEXT,
      maintainers      TEXT,
      weekly_downloads INTEGER NOT NULL DEFAULT 0,
      repo_url         TEXT,
      repo_status      TEXT,
      description      TEXT,
      keywords         TEXT,
      found_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(name, version, map_file)
    );
    CREATE INDEX IF NOT EXISTS idx_findings_name   ON findings(name, version);
    CREATE INDEX IF NOT EXISTS idx_findings_time   ON findings(found_at DESC);
    CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(repo_status);
  `);

  if (!vRow || vRow.value !== SCHEMA_V) {
    _db.prepare("INSERT OR REPLACE INTO state(key,value) VALUES(?,?)").run(["schema_version", SCHEMA_V]);
  }

  // ── 预聚合摘要表（每 name+version 一行，彻底避免热路径全表 GROUP BY）──────
  _db.exec(`
    CREATE TABLE IF NOT EXISTS findings_summary (
      id               INTEGER PRIMARY KEY,
      name             TEXT    NOT NULL,
      version          TEXT    NOT NULL,
      tarball          TEXT    NOT NULL,
      has_cloud_ref    INTEGER NOT NULL DEFAULT 0,
      author           TEXT,
      maintainers      TEXT,
      weekly_downloads INTEGER NOT NULL DEFAULT 0,
      repo_url         TEXT,
      repo_status      TEXT,
      description      TEXT,
      keywords         TEXT,
      found_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      map_count        INTEGER NOT NULL DEFAULT 0,
      total_bytes      INTEGER NOT NULL DEFAULT 0,
      leaks_json       TEXT    NOT NULL DEFAULT '[]',
      UNIQUE(name, version)
    );
    CREATE INDEX IF NOT EXISTS idx_summary_found  ON findings_summary(found_at DESC);
    CREATE INDEX IF NOT EXISTS idx_summary_dl     ON findings_summary(weekly_downloads DESC);
    CREATE INDEX IF NOT EXISTS idx_summary_maps   ON findings_summary(map_count DESC);
    CREATE INDEX IF NOT EXISTS idx_summary_size   ON findings_summary(total_bytes DESC);
    CREATE INDEX IF NOT EXISTS idx_summary_status ON findings_summary(repo_status);
    CREATE INDEX IF NOT EXISTS idx_summary_name   ON findings_summary(name);

    CREATE VIRTUAL TABLE IF NOT EXISTS findings_fts USING fts5(
      name, description, keywords
    );
  `);

  // ── 首次建立 / 版本升级时从 findings 回填（一次性迁移）──────────────────
  const svRow = _db.prepare("SELECT value FROM state WHERE key = 'summary_v'").get([]);
  if (!svRow || svRow.value !== SUMMARY_V) {
    const _t0 = Date.now();
    console.log("[db] 正在构建 findings_summary（首次迁移，大库需数分钟）…");
    _db.exec("DELETE FROM findings_summary");
    _db.exec("DELETE FROM findings_fts");
    _db.exec(`
      INSERT INTO findings_summary
        (id, name, version, tarball, has_cloud_ref, author, maintainers, weekly_downloads,
         repo_url, repo_status, description, keywords, found_at, map_count, total_bytes, leaks_json)
      SELECT
        MIN(f.id), f.name, f.version, f.tarball,
        MAX(f.has_cloud_ref), f.author, f.maintainers, MAX(f.weekly_downloads),
        f.repo_url, f.repo_status, f.description, f.keywords,
        MIN(f.found_at), COUNT(*), SUM(f.total_bytes),
        json_group_array(json_object(
          'id',            f.id,
          'map_file',      f.map_file,
          'file_count',    f.file_count,
          'total_bytes',   f.total_bytes,
          'source_paths',  f.source_paths,
          'has_cloud_ref', f.has_cloud_ref
        ))
      FROM findings f
      GROUP BY f.name, f.version
    `);
    _db.exec(`
      INSERT INTO findings_fts(rowid, name, description, keywords)
      SELECT id, name, COALESCE(description, ''), COALESCE(keywords, '')
      FROM findings_summary
    `);
    _db.prepare("INSERT OR REPLACE INTO state(key,value) VALUES('summary_v',?)").run([SUMMARY_V]);
    console.log(`[db] findings_summary 构建完成，耗时 ${((Date.now() - _t0) / 1000).toFixed(1)}s`);
  }

  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ─── 状态 KV ──────────────────────────────────────────────────────────────────

export function getState(key) {
  const row = getDb().prepare("SELECT value FROM state WHERE key = ? LIMIT 1").get([key]);
  return row ? row.value : null;
}

export function setState(key, value) {
  getDb()
    .prepare("INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run([key, String(value)]);
}

// ─── 已扫描记录 ──────────────────────────────────────────────────────────────

export function isAlreadyScanned(name, version) {
  return !!getDb().prepare("SELECT 1 FROM scanned WHERE name = ? AND version = ? LIMIT 1").get([name, version]);
}

export function markScanned(name, version, hasLeak) {
  getDb()
    .prepare(
      "INSERT INTO scanned (name, version, has_leak) VALUES (?, ?, ?) ON CONFLICT(name, version) DO UPDATE SET has_leak = excluded.has_leak"
    )
    .run([name, version, hasLeak ? 1 : 0]);
}

// ─── 写入泄露记录 ────────────────────────────────────────────────────────────

export function saveFindings(name, version, tarball, leaks, meta = {}) {
  const authorStr = meta.author ? JSON.stringify(meta.author) : null;
  const maintainersStr = meta.maintainers ? JSON.stringify(meta.maintainers) : null;
  const keywordsStr = meta.keywords ? JSON.stringify(meta.keywords) : null;
  const repoUrl = typeof meta.repository === "string" ? meta.repository : (meta.repository?.url ?? null);

  const db = getDb();
  // BEGIN IMMEDIATE：立即获取写锁，避免多个并发写事务在 COMMIT 阶段才发现锁冲突（SQLITE_BUSY）
  db.exec("BEGIN IMMEDIATE");
  try {
    const stmt = db.prepare(`
      INSERT INTO findings
        (name, version, tarball, map_file, file_count, total_bytes, source_paths,
         has_cloud_ref, author, maintainers, weekly_downloads, repo_url, repo_status, description, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name, version, map_file) DO UPDATE SET
        tarball          = excluded.tarball,
        file_count       = excluded.file_count,
        total_bytes      = excluded.total_bytes,
        source_paths     = excluded.source_paths,
        has_cloud_ref    = excluded.has_cloud_ref,
        author           = excluded.author,
        maintainers      = excluded.maintainers,
        weekly_downloads = excluded.weekly_downloads,
        repo_url         = excluded.repo_url,
        repo_status      = excluded.repo_status,
        description      = excluded.description,
        keywords         = excluded.keywords
    `);
    for (const l of leaks) {
      stmt.run([
        name,
        version,
        tarball,
        l.mapFile,
        l.fileCount,
        l.totalBytes,
        JSON.stringify(l.sourcePaths),
        l.hasCloudRef ? 1 : 0,
        authorStr,
        maintainersStr,
        meta.weeklyDownloads ?? 0,
        repoUrl,
        meta.repoStatus ?? null,
        meta.description ?? null,
        keywordsStr,
      ]);
    }

    // ── 同步 findings_summary + FTS（在同一事务内，保证一致性）──────────────
    const _s = db
      .prepare(
        `
      SELECT MIN(f.id) AS id, f.name, f.version, f.tarball,
        MAX(f.has_cloud_ref) AS has_cloud_ref, f.author, f.maintainers,
        MAX(f.weekly_downloads) AS weekly_downloads, f.repo_url, f.repo_status,
        f.description, f.keywords, MIN(f.found_at) AS found_at,
        COUNT(*) AS map_count, SUM(f.total_bytes) AS total_bytes,
        json_group_array(json_object(
          'id', f.id, 'map_file', f.map_file, 'file_count', f.file_count,
          'total_bytes', f.total_bytes, 'source_paths', f.source_paths,
          'has_cloud_ref', f.has_cloud_ref
        )) AS leaks_json
      FROM findings f WHERE f.name = ? AND f.version = ?
      GROUP BY f.name, f.version
    `
      )
      .get([name, version]);

    if (_s) {
      db.prepare(
        `
        INSERT INTO findings_summary
          (id,name,version,tarball,has_cloud_ref,author,maintainers,weekly_downloads,
           repo_url,repo_status,description,keywords,found_at,map_count,total_bytes,leaks_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(name,version) DO UPDATE SET
          id=excluded.id, tarball=excluded.tarball,
          has_cloud_ref=excluded.has_cloud_ref, author=excluded.author,
          maintainers=excluded.maintainers, weekly_downloads=excluded.weekly_downloads,
          repo_url=excluded.repo_url, repo_status=excluded.repo_status,
          description=excluded.description, keywords=excluded.keywords,
          found_at=excluded.found_at, map_count=excluded.map_count,
          total_bytes=excluded.total_bytes, leaks_json=excluded.leaks_json
      `
      ).run([
        _s.id,
        name,
        version,
        _s.tarball,
        _s.has_cloud_ref,
        _s.author,
        _s.maintainers,
        _s.weekly_downloads,
        _s.repo_url,
        _s.repo_status,
        _s.description,
        _s.keywords,
        _s.found_at,
        _s.map_count,
        _s.total_bytes,
        _s.leaks_json,
      ]);
      // FTS 同步：先删旧索引再插入新索引
      db.prepare("DELETE FROM findings_fts WHERE rowid = ?").run([_s.id]);
      db.prepare("INSERT INTO findings_fts(rowid,name,description,keywords) VALUES(?,?,?,?)").run([
        _s.id,
        name,
        _s.description ?? "",
        _s.keywords ?? "",
      ]);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ─── 查询辅助 ─────────────────────────────────────────────────────────────────

function assembleFromSummary(row, { slim = false } = {}) {
  const { leaks_json, ...rest } = row;
  let leaks = [];
  try {
    leaks = JSON.parse(leaks_json ?? "[]");
  } catch {
    /* ignore */
  }
  if (slim && leaks.length > 20) leaks = leaks.slice(0, 20);
  return { ...rest, leaks };
}

/**
 * 将搜索词转为 FTS5 安全查询（每词前缀匹配，特殊字符剥离）
 * 返回 null 时调用方应降级为 LIKE
 *
 * 处理逻辑：
 *   1. 按空白分词后，再按 `-` / `/` 拆子词（FTS5 unicode61 tokenizer 将它们视为分隔符）
 *   2. 剥离 FTS5 保留字符：" ( ) * ^ : @ \ /
 *   3. 每个非空子词加 `*` 做前缀匹配，多词用 AND 连接
 */
function buildFtsQuery(q) {
  const parts = q
    .trim()
    .split(/\s+/) // 先按空格分词
    .flatMap(t => t.split(/[-/]/)) // 再按 - / 拆子词（tokenizer 分隔符）
    .map(t => t.replace(/["()*^:@\\]/g, "").trim())
    .filter(Boolean)
    .map(t => `${t}*`);
  return parts.length ? parts.join(" AND ") : null;
}

const ORDER_MAP = {
  time: "found_at DESC",
  downloads: "weekly_downloads DESC, found_at DESC",
  mapCount: "map_count DESC, found_at DESC",
  size: "total_bytes DESC, found_at DESC",
};

// ─── 查询：列表（分页 + 搜索 + 筛选）────────────────────────────────────────

export function queryFindings({ limit = 50, offset = 0, q = "", repoStatus = "", sort = "time" } = {}) {
  const db = getDb();
  const order = ORDER_MAP[sort] ?? ORDER_MAP.time;

  const conds = [];
  const params = [];

  if (repoStatus) {
    conds.push("fs.repo_status = ?");
    params.push(repoStatus);
  }
  if (q) {
    const ftsQ = buildFtsQuery(q);
    if (ftsQ) {
      conds.push("fs.id IN (SELECT rowid FROM findings_fts WHERE findings_fts MATCH ?)");
      params.push(ftsQ);
    } else {
      const like = `%${q}%`;
      conds.push("(fs.name LIKE ? OR fs.description LIKE ? OR fs.keywords LIKE ?)");
      params.push(like, like, like);
    }
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  // 列表查询只取前 20 条 leaks（避免 map_count 极大的包把整个响应撑爆）
  // 准确总数由 map_count 字段承载，前端显示用它而非 leaks.length
  const rows = db
    .prepare(`
      SELECT fs.id, fs.name, fs.version, fs.tarball,
             fs.has_cloud_ref, fs.author, fs.maintainers, fs.weekly_downloads,
             fs.repo_url, fs.repo_status, fs.description, fs.keywords,
             fs.found_at, fs.map_count, fs.total_bytes, fs.leaks_json
      FROM findings_summary fs ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all([...params, limit, offset]);

  const total = db.prepare(`SELECT COUNT(*) AS n FROM findings_summary fs ${where}`).get([...params]).n;

  return { rows: rows.map(r => assembleFromSummary(r, { slim: true })), total };
}

// ─── 按 findings.id 查单条（供 /api/extract/:id 使用）────────────────────────

export function getFindingById(id) {
  return getDb().prepare("SELECT * FROM findings WHERE id = ? LIMIT 1").get([id]);
}

// ─── 按 name+version 查分组详情 ─────────────────────────────────────────────
// slim=true：leaks_json 截断为 20 条，用于 SSE 推送等展示场景
// slim=false（默认）：返回完整 leaks_json，用于 /api/extract-package 需要所有 .map 路径

export function getFindingGrouped(name, version, { slim = false } = {}) {
  const row = getDb()
    .prepare("SELECT * FROM findings_summary WHERE name = ? AND version = ?")
    .get([name, version]);
  return row ? assembleFromSummary(row, { slim }) : null;
}

// ─── 下载量刷新 ──────────────────────────────────────────────────────────────

export function getDistinctPackageNames() {
  return getDb()
    .prepare("SELECT DISTINCT name FROM findings_summary")
    .all([])
    .map(r => r.name);
}

export function updateDownloadsByName(name, count) {
  const db = getDb();
  db.prepare("UPDATE findings         SET weekly_downloads = ? WHERE name = ?").run([count, name]);
  db.prepare("UPDATE findings_summary SET weekly_downloads = ? WHERE name = ?").run([count, name]);
}

/**
 * 删除指定包版本的全部泄露记录（findings + findings_summary + findings_fts + scanned）
 * 用于清理扫描器逻辑修复前产生的误判记录
 * @param {string} name
 * @param {string} version
 * @returns {{ deletedFindings: number, deletedSummary: number }}
 */
export function deleteFindings(name, version) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    // 先查 summary id，用于删 FTS 索引
    const sumRow = db.prepare("SELECT id FROM findings_summary WHERE name = ? AND version = ?").get([name, version]);
    const deletedFindings = db.prepare("DELETE FROM findings WHERE name = ? AND version = ?").run([name, version]).changes;
    const deletedSummary = db.prepare("DELETE FROM findings_summary WHERE name = ? AND version = ?").run([name, version]).changes;
    if (sumRow) {
      db.prepare("DELETE FROM findings_fts WHERE rowid = ?").run([sumRow.id]);
    }
    // scanned 表保留记录但将 has_leak 置 0，防止重新入队扫描（包本身仍已扫描过）
    db.prepare("UPDATE scanned SET has_leak = 0 WHERE name = ? AND version = ?").run([name, version]);
    db.exec("COMMIT");
    return { deletedFindings, deletedSummary };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ─── 统计 ─────────────────────────────────────────────────────────────────────

export function getStats() {
  const db = getDb();
  const todayTs = Math.floor(Date.now() / 1000) - 86400;
  return {
    totalLeaks: db.prepare("SELECT COUNT(*) AS n FROM findings_summary").get([]).n,
    totalScanned: db.prepare("SELECT COUNT(*) AS n FROM scanned").get([]).n,
    last24h: db.prepare("SELECT COUNT(*) AS n FROM findings_summary WHERE found_at >= ?").get([todayTs]).n,
  };
}

// ─── 图表数据 ─────────────────────────────────────────────────────────────────

export function getTimeline(hours = 24) {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  return getDb()
    .prepare(
      `
    SELECT strftime('%Y-%m-%dT%H:00:00', datetime(found_at, 'unixepoch')) AS hour,
           COUNT(*) AS count
    FROM findings_summary WHERE found_at >= ?
    GROUP BY hour ORDER BY hour
  `
    )
    .all([since]);
}

export function getRepoStatusBreakdown() {
  return getDb()
    .prepare(
      `
    SELECT COALESCE(repo_status, 'unknown') AS status, COUNT(*) AS count
    FROM findings_summary
    GROUP BY status ORDER BY count DESC
  `
    )
    .all([]);
}

export function getTopByDownloads(limit = 10) {
  return getDb()
    .prepare(
      `
    SELECT name, MAX(weekly_downloads) AS downloads
    FROM findings_summary GROUP BY name
    ORDER BY downloads DESC LIMIT ?
  `
    )
    .all([limit]);
}

export function getTopBySize(limit = 10) {
  return getDb()
    .prepare(
      `
    SELECT name, version, total_bytes AS total_size
    FROM findings_summary
    ORDER BY total_size DESC LIMIT ?
  `
    )
    .all([limit]);
}

export function getDailyActivity(days = 7) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const scanned = getDb()
    .prepare(
      `
    SELECT strftime('%Y-%m-%d', datetime(scanned_at, 'unixepoch')) AS day, COUNT(*) AS count
    FROM scanned WHERE scanned_at >= ? GROUP BY day ORDER BY day
  `
    )
    .all([since]);
  const leaks = getDb()
    .prepare(
      `
    SELECT strftime('%Y-%m-%d', datetime(found_at, 'unixepoch')) AS day, COUNT(*) AS count
    FROM findings_summary WHERE found_at >= ?
    GROUP BY day ORDER BY day
  `
    )
    .all([since]);
  return { scanned, leaks };
}
