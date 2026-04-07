import { ref, onMounted, onUnmounted } from "vue";

export function useStats() {
  const stats = ref({ totalLeaks: 0, totalScanned: 0, last24h: 0 });

  async function refresh() {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const json = await res.json();
        stats.value = json.data ?? json;
      }
    } catch {
      /* keep stale */
    }
  }

  let timer = null;
  onMounted(() => {
    refresh();
    timer = setInterval(refresh, 15_000);
  });
  onUnmounted(() => clearInterval(timer));
  return { stats, refresh };
}
