/**
 * 报告模块 —— 直接调用 db + events，无 HTTP 中转
 */
import { saveFindings, getFindingGrouped, updateDownloadsByName } from "../db.js";
import { emitLeak } from "../events.js";
import { getWeeklyDownloads } from "./popularity.js";
import { tryJson, formatBytes } from "../utils.js";

function deserializeGrouped(r) {
  return {
    id: r.id,
    name: r.name,
    version: r.version,
    tarball: r.tarball,
    hasCloudRef: !!r.has_cloud_ref,
    author: tryJson(r.author, null),
    maintainers: tryJson(r.maintainers, []),
    weeklyDownloads: r.weekly_downloads ?? 0,
    repoUrl: r.repo_url ?? null,
    repoStatus: r.repo_status ?? null,
    description: r.description ?? null,
    keywords: tryJson(r.keywords, []),
    foundAt: r.found_at ?? null,
    mapCount: r.map_count ?? 0,
    totalBytes: r.total_bytes ?? 0,
    leaks: (r.leaks ?? []).map(lk => {
      const filtered = tryJson(lk.source_paths, []).filter(p => !p.includes("node_modules/"));
      return {
        id: lk.id,
        mapFile: lk.map_file,
        fileCount: filtered.length || lk.file_count,
        totalBytes: lk.total_bytes,
        hasCloudRef: !!lk.has_cloud_ref,
        sourcePaths: filtered.slice(0, 10),
      };
    }),
  };
}

export async function report(finding) {
  const {
    package: name,
    version,
    tarball,
    leaks,
    author,
    maintainers,
    weeklyDownloads,
    repository,
    repoStatus,
    description,
    keywords,
  } = finding;

  printToConsole({ timestamp: new Date().toISOString(), ...finding });

  // 直接写 SQLite（同一进程，无锁竞争）
  saveFindings(name, version, tarball, leaks, {
    author,
    maintainers,
    weeklyDownloads,
    repository,
    repoStatus,
    description,
    keywords,
  });

  // 从 DB 查分组结果后推送一次 SSE（slim=true：leaks_json 截断 20 条，展示用无需全量）
  const grouped = getFindingGrouped(name, version, { slim: true });
  if (grouped) emitLeak(deserializeGrouped(grouped));

  // 若扫描时下载量为 0（批量 API 失败），异步补查一次并更新 DB + 重新推送
  if (!weeklyDownloads) {
    getWeeklyDownloads(name)
      .then(count => {
        if (count > 0) {
          updateDownloadsByName(name, count);
          // 重新推送带正确下载量的分组数据
          const updated = getFindingGrouped(name, version, { slim: true });
          if (updated) emitLeak(deserializeGrouped(updated));
        }
      })
      .catch(() => {
        /* 静默失败 */
      });
  }

  // Webhook（可选）
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    await sendWebhook(webhookUrl, finding).catch(err => console.error("[reporter] Webhook failed:", err.message));
  }
}

function printToConsole(entry) {
  const { package: pkg, version, repoStatus, author, maintainers, weeklyDownloads, leaks } = entry;
  const totalBytes = leaks.reduce((s, l) => s + l.totalBytes, 0);
  const cloudRef = leaks.some(l => l.hasCloudRef);

  const repoLabel =
    { none: "无 repository（可能闭源）", private: "私有仓库", "open-source": "公开开源" }[repoStatus] ?? "未知";
  const authorName = typeof author === "string" ? author : (author?.name ?? "未知");
  const maintainerNames = (maintainers ?? [])
    .map(m => m.name ?? m)
    .slice(0, 3)
    .join(", ");

  console.log("\n" + "=".repeat(60));
  console.log(`[LEAK] ${pkg}@${version}  ${repoLabel}`);
  console.log(`  作者: ${authorName}${maintainerNames ? "  维护者: " + maintainerNames : ""}`);
  if (weeklyDownloads) console.log(`  下载量: ${weeklyDownloads.toLocaleString()}/周`);
  console.log(`  .map 文件: ${leaks.length}  泄露: ${formatBytes(totalBytes)}${cloudRef ? "  ⚠ 含云存储引用" : ""}`);
  console.log("=".repeat(60));
}

async function sendWebhook(url, entry) {
  const { package: pkg, version, repoStatus, leaks } = entry;
  const totalBytes = leaks.reduce((s, l) => s + l.totalBytes, 0);
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `[npm-leak] \`${pkg}@${version}\` (${repoStatus ?? "unknown"}) 发现 ${leaks.length} 个 Source Map，合计 ${formatBytes(totalBytes)} 源码`,
      details: entry,
    }),
    signal: AbortSignal.timeout(10_000),
  });
}
