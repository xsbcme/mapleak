/**
 * pm2-pack.mjs
 *
 * 打包生产部署包到 <root>/deploy/pm2/ 目录
 *
 * 输出结构：
 *   deploy/pm2/
 *   ├── src/               ← 后端源码
 *   │   └── scanner/
 *   ├── public/            ← 前端编译产物（STATIC_DIR）
 *   ├── package.json       ← 仅含生产依赖 + Linux start 命令
 *   ├── ecosystem.config.cjs ← PM2 配置（宝塔推荐方式）
 *   ├── .env.example       ← 环境变量示例
 *   └── start.sh           ← 一键启动脚本
 *
 * 用法：pnpm map-leak:pm2-pack
 */

import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_DIR = join(ROOT, "apps", "map-leak-server");
const WEB_DIST = join(ROOT, "apps", "map-leak-web", "dist");
const OUT = join(ROOT, "deploy", "pm2");

// ── 1. 前端是否已构建 ─────────────────────────────────────────────────────────
if (!existsSync(WEB_DIST)) {
  console.log("[pack] 前端未构建，开始构建...");
  execSync("pnpm map-leak:build", { cwd: ROOT, stdio: "inherit" });
} else {
  console.log("[pack] 使用已有前端构建产物:", WEB_DIST);
}

// ── 2. 清空并重建 deploy/pm2/ ───────────────────────────────────────────────
console.log("[pack] 清空 deploy/pm2/ ...");
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

// ── 3. 复制后端源码 ───────────────────────────────────────────────────────────
console.log("[pack] 复制后端源码 → upload/src/");
cpSync(join(SERVER_DIR, "src"), join(OUT, "src"), { recursive: true });

// ── 4. 复制前端产物 ───────────────────────────────────────────────────────────
console.log("[pack] 复制前端产物 → upload/public/");
cpSync(WEB_DIST, join(OUT, "public"), { recursive: true });

// ── 5. 生产 package.json（纯 Linux 兼容）──────────────────────────────────────
console.log("[pack] 生成 package.json ...");
const pkgJson = {
  name: "@map-leak/server",
  version: "1.0.0",
  type: "module",
  private: true,
  scripts: {
    start: "node src/index.js",
  },
  dependencies: {
    "@fastify/cors": "^9.0.1",
    "@fastify/static": "^7.0.4",
    fastify: "^4.28.1",
    "node-cron": "^3.0.3",
    "node-sqlite3-wasm": "^0.8.55",
    "tar-stream": "^3.1.7",
  },
  engines: { node: ">=18" },
};
writeFileSync(join(OUT, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n");

// ── 6. PM2 ecosystem 配置 ─────────────────────────────────────────────────────
console.log("[pack] 生成 ecosystem.config.cjs ...");
const ecosystem = `// PM2 配置文件
// 使用：pm2 start ecosystem.config.cjs
// 参考文档：https://pm2.keymetrics.io/docs/usage/application-declaration/
const path = require('path');

module.exports = {
  apps: [
    {
      name:         'map-leak',
      script:       'src/index.js',
      cwd:          __dirname,          // 显式指定工作目录
      interpreter:  'node',
      // ESM 包（package.json type:module）必须加此参数，否则 PM2 以 CJS 方式启动会报错
      interpreter_args: '--experimental-vm-modules',
      // 崩溃后自动重启，最多退避 10s
      autorestart:   true,
      restart_delay: 3000,
      max_restarts:  10,
      env: {
        NODE_ENV:      'production',
        API_PORT:      '3001',
        // 用绝对路径，避免 PM2 cwd 不确定导致相对路径失效
        STATIC_DIR:    path.join(__dirname, 'public'),
        CONCURRENCY:   '5',
        SCAN_INTERVAL: '*/30 * * * *',
        // WEBHOOK_URL: 'https://hooks.slack.com/services/xxx',
      },
    },
  ],
};
`;
writeFileSync(join(OUT, "ecosystem.config.cjs"), ecosystem);

// ── 7. .env.example ───────────────────────────────────────────────────────────
const envExample = `# map-leak 生产环境配置
# 如需覆盖 ecosystem.config.cjs 中的 env，在此文件设置后用 pm2 start --env production

# 监听端口
API_PORT=3001

# 前端静态文件目录（相对于 server 工作目录，ecosystem 已设置好，一般无需修改）
STATIC_DIR=./public

# 扫描并发工作数
CONCURRENCY=5

# 扫描 cron 表达式（默认每 30 分钟）
SCAN_INTERVAL=*/30 * * * *

# Webhook URL（可选）—— 发现新泄露时 POST 通知
# WEBHOOK_URL=https://hooks.slack.com/services/xxx

# SQLite 数据库路径（默认在工作目录，留空即可）
# DB_PATH=/data/mapleak/data.db
`;
writeFileSync(join(OUT, ".env.example"), envExample);

// ── 8. start.sh 一键启动脚本 ─────────────────────────────────────────────────
const startSh = `#!/usr/bin/env bash
# map-leak 一键部署脚本
# 适用于：宝塔面板 / 任意 Linux 主机（已安装 Node.js 18+ 和 npm）
# 用法：bash start.sh [端口]  （默认 3001）
# 示例：bash start.sh 8080

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 端口：命令行参数 > 环境变量 API_PORT > 默认 3001
PORT="\${1:-\${API_PORT:-3001}}"

# 检查 Node.js
if ! command -v node &>/dev/null; then
  echo "[ERROR] 未找到 node，请先在宝塔面板安装 Node.js 20+"
  exit 1
fi

echo "[map-leak] Node.js: $(node -v)"

# 安装依赖（只安装生产依赖）
echo "[map-leak] 安装依赖..."
npm install --omit=dev

# 安装 PM2（若未安装）
if ! command -v pm2 &>/dev/null; then
  echo "[map-leak] 安装 PM2..."
  npm install -g pm2
fi

# 停止旧进程（如存在）
pm2 stop map-leak 2>/dev/null || true
pm2 delete map-leak 2>/dev/null || true

# 启动（注入端口环境变量）
echo "[map-leak] 启动服务（端口 $PORT）..."
API_PORT="$PORT" pm2 start ecosystem.config.cjs --update-env

# 保存 PM2 进程列表 + 设置开机自启
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "========================================="
echo "  ✓ map-leak 已启动"
  echo "  访问地址: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "  查看日志: pm2 logs map-leak"
echo "  重启服务: pm2 restart map-leak"
echo "  停止服务: pm2 stop map-leak"
echo "========================================="
`;
writeFileSync(join(OUT, "start.sh"), startSh);

// ── 完成 ───────────────────────────────────────────────────────────────────────
console.log("\n[pack] ✓ 打包完成！输出目录：", OUT);
console.log("[pack] 目录结构：");
console.log("  deploy/pm2/");
console.log("  ├── src/           ← 后端源码");
console.log("  ├── public/        ← 前端静态文件");
console.log("  ├── package.json   ← 生产依赖");
console.log("  ├── ecosystem.config.cjs  ← PM2 配置");
console.log("  ├── .env.example   ← 环境变量说明");
console.log("  └── start.sh       ← 一键启动脚本");
console.log("\n[pack] 上传 deploy/pm2/ 到服务器后执行：bash start.sh");
