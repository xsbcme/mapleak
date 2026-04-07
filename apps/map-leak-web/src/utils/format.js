/**
 * 前端共享格式化工具
 *
 * LeakCard.vue 和 SourceViewer.vue 原本各自重复定义了 fmtBytes、
 * baseName、fileExt 等函数，统一提取至此处。
 */

/** 字节大小人类可读格式 */
export function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}

/** 格式化周下载量 */
export function fmtDownloads(n) {
  if (!n) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

/** 取路径最后一段文件名 */
export function baseName(p) {
  return (p ?? "").split("/").pop() || p;
}

/** 取文件扩展名（不含点） */
export function fileExt(p) {
  const parts = (p ?? "").split(".");
  return parts.length > 1 ? parts.pop() : "";
}

/**
 * 规范化 Source Map 中泄露的源文件路径
 * 去掉 webpack:/// / vite:// 等协议前缀和 ./ ../ 开头
 */
export function normPath(p) {
  return (p ?? "")
    .replace(/^\w+:\/\/\//, "")
    .replace(/^\.\//, "")
    .replace(/^(?:\.\.\/)+/, "")
    .replace(/^\//, "");
}

/** 取路径父目录部分 */
export function parentPath(p) {
  const parts = normPath(p).split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}
