import { ref, onUnmounted } from "vue";

/** 实时列表最多保留条目数 */
const MAX_LIVE = 100;

export function useLeakStream() {
  const liveLeaks = ref([]);
  const connected = ref(false);
  let prefilled = false;

  let es = null,
    retryMs = 1000,
    retryTimer = null;

  // SSE 连接成功后预填最近 20 条历史，让面板立即有内容
  async function prefillRecent() {
    if (prefilled) return;
    prefilled = true;
    try {
      const res = await fetch("/api/findings?limit=20&offset=0");
      if (!res.ok) return;
      const json = await res.json();
      const rows = (json.data ?? json).rows ?? [];
      if (rows.length > 0) {
        // 只填充尚不在列表中的记录（避免与 SSE 推送重叠）
        const ids = new Set(liveLeaks.value.map(x => x.id));
        const fresh = rows.filter(r => !ids.has(r.id));
        liveLeaks.value = [...liveLeaks.value, ...fresh].slice(0, MAX_LIVE);
      }
    } catch {
      /* 静默失败 */
    }
  }

  // 批量缓冲区：把同一事件循环内到达的多条推送合并为一次 Vue 更新
  const _pendingItems = [];
  let _flushScheduled = false;

  function flushPending() {
    _flushScheduled = false;
    if (_pendingItems.length === 0) return;
    // 新数据在前，保留最新 MAX_LIVE 条
    liveLeaks.value = [..._pendingItems.splice(0).reverse(), ...liveLeaks.value].slice(0, MAX_LIVE);
  }

  function pushItem(item) {
    _pendingItems.push(item);
    if (!_flushScheduled) {
      _flushScheduled = true;
      // queueMicrotask 在当前宏任务结束前批量合并，避免每条 SSE 单独触发一次重渲染
      queueMicrotask(flushPending);
    }
  }

  function connect() {
    es = new EventSource("/api/events");
    es.onopen = () => {
      connected.value = true;
      retryMs = 1000;
      prefillRecent();
    };
    es.onmessage = e => {
      try {
        pushItem(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      connected.value = false;
      es.close();
      retryTimer = setTimeout(() => {
        retryMs = Math.min(retryMs * 2, 30_000);
        connect();
      }, retryMs);
    };
  }

  connect();
  onUnmounted(() => {
    clearTimeout(retryTimer);
    es?.close();
  });
  return { liveLeaks, connected };
}
