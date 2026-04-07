import { ref, onMounted } from "vue";

export function useFindings() {
  const findings = ref([]);
  const total = ref(0);
  const loading = ref(false);
  const page = ref(0);
  const PAGE_SIZE = 50;
  const searchQuery = ref("");
  const repoFilter = ref("");
  const sortBy = ref("time");

  const error = ref("");

  async function load(reset = false) {
    if (loading.value) return;
    if (reset) {
      page.value = 0;
      findings.value = [];
    }
    loading.value = true;
    error.value = "";
    try {
      const q = searchQuery.value.trim();
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: page.value * PAGE_SIZE,
        ...(q ? { q } : {}),
        ...(repoFilter.value ? { repo_status: repoFilter.value } : {}),
        sort: sortBy.value,
      });
      const res = await fetch(`/api/findings?${params}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data ?? json; // 兼容
        total.value = data.total;
        findings.value = reset ? data.rows : [...findings.value, ...data.rows];
        page.value++;
      } else {
        const d = await res.json().catch(() => ({}));
        error.value = d.msg ?? d.error ?? `请求失败 (${res.status})`;
      }
    } catch (e) {
      error.value = e.message || "网络错误，无法连接服务";
    } finally {
      loading.value = false;
    }
  }

  function search(q) {
    searchQuery.value = q;
    load(true);
  }
  function filter(s) {
    repoFilter.value = s;
    load(true);
  }
  function setSort(s) {
    sortBy.value = s;
    load(true);
  }

  onMounted(() => load(true));
  return {
    findings,
    total,
    loading,
    error,
    searchQuery,
    repoFilter,
    sortBy,
    search,
    filter,
    setSort,
    loadMore: () => load(false),
  };
}
