import { ref, onMounted, onUnmounted } from "vue";

export function useCharts() {
  const timeline = ref([]);
  const repoStatus = ref([]);
  const topDl = ref([]);
  const topSize = ref([]);
  const daily = ref({ scanned: [], leaks: [] });

  function safeFetch(url) {
    return fetch(url)
      .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(json => json.data ?? json);
  }

  async function load() {
    const [t, r, d, s, a] = await Promise.allSettled([
      safeFetch("/api/charts/timeline?hours=24"),
      safeFetch("/api/charts/repo-status"),
      safeFetch("/api/charts/top-downloads?limit=10"),
      safeFetch("/api/charts/top-size?limit=10"),
      safeFetch("/api/charts/daily?days=7"),
    ]);
    if (t.status === "fulfilled") timeline.value = t.value;
    if (r.status === "fulfilled") repoStatus.value = r.value;
    if (d.status === "fulfilled") topDl.value = d.value;
    if (s.status === "fulfilled") topSize.value = s.value;
    if (a.status === "fulfilled") daily.value = a.value;
  }

  let timer = null;
  onMounted(() => {
    load();
    timer = setInterval(load, 30_000);
  });
  onUnmounted(() => clearInterval(timer));

  return { timeline, repoStatus, topDl, topSize, daily, reload: load };
}
