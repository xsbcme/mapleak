// 启动前释放指定端口（Windows taskkill）并清理遗留锁文件
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PORT    = process.env.API_PORT || '3001';
const DB_PATH = process.env.DB_PATH  || path.join(__dirname, '..', 'data.db');

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// 1. 先按端口杀进程
try {
  const out = execSync('netstat -ano').toString();
  const re = new RegExp(`:${PORT}[ \\t]+[0-9.:]+[ \\t]+LISTENING[ \\t]+(\\d+)`);
  const m = out.match(re);
  if (m) {
    execSync(`taskkill /PID ${m[1]} /F /T`, { stdio: 'ignore' });
    console.log(`[pre-start] 已释放端口 ${PORT}（PID ${m[1]}）`);
  }
} catch { /* 端口未被占用，忽略 */ }

// 2. 再按进程名杀掉所有残存的 map-leak-server node 进程
//    （node --watch 会产生子进程，taskkill /T 不一定全杀干净）
try {
  const wmic = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:csv').toString();
  for (const line of wmic.split('\n')) {
    if (line.includes('map-leak-server') || line.includes('src/index.js') || line.includes('src\\index.js')) {
      const pid = line.trim().split(',').pop();
      if (pid && /^\d+$/.test(pid)) {
        try { execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' }); } catch { /* ignore */ }
        console.log(`[pre-start] 已终止残存进程 PID ${pid}`);
      }
    }
  }
} catch { /* wmic 不可用，忽略 */ }

// 3. 等待 OS 完全释放文件句柄
sleep(600);

// 4. 删除遗留的 SQLite 锁文件/目录及 WAL 文件
const stalePaths = [
  DB_PATH + '.lock',   // node-sqlite3-wasm 用目录实现的锁
  DB_PATH + '-wal',
  DB_PATH + '-shm',
];
for (const f of stalePaths) {
  try {
    if (fs.existsSync(f)) {
      // 用 rmSync 同时支持文件和目录
      fs.rmSync(f, { recursive: true, force: true });
      console.log(`[pre-start] 已删除遗留文件 ${path.basename(f)}`);
    }
  } catch (e) {
    console.warn(`[pre-start] 无法删除 ${path.basename(f)}: ${e.message}`);
  }
}
