<template>
  <div class="panel flex flex-col" style="height: clamp(520px, calc(100vh - 340px), 820px)">
    <!-- 面板标题行 + 筛选器 -->
    <div
      class="flex flex-wrap items-center gap-2 px-4 shrink-0 border-b"
      style="min-height: 52px; padding-top: 6px; padding-bottom: 6px; border-color: var(--c-border)"
    >
      <h2 class="section-label">{{ t("history.title") }}</h2>
      <span class="tag tag-muted">{{ total.toLocaleString() }}</span>

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <select class="ui-input" :value="sortBy" @change="$emit('set-sort', $event.target.value)">
          <option value="time">{{ t("history.sortTime") }}</option>
          <option value="downloads">{{ t("history.sortDownloads") }}</option>
          <option value="map_count">{{ t("history.sortMapCount") }}</option>
          <option value="size">{{ t("history.sortSize") }}</option>
        </select>
        <select class="ui-input" :value="repoFilter" @change="$emit('filter', $event.target.value)">
          <option value="">{{ t("history.filterAll") }}</option>
          <option value="none">{{ t("history.filterNone") }}</option>
          <option value="private">{{ t("history.filterPrivate") }}</option>
          <option value="open-source">{{ t("history.filterOpen") }}</option>
        </select>
        <input type="text" v-model="localQuery" :placeholder="t('history.placeholder')" class="ui-input w-44 sm:w-56" />
      </div>
    </div>

    <!-- 错误态 -->
    <div
      v-if="findingsError && !loading"
      class="flex-1 flex flex-col items-center justify-center gap-3"
      style="color: var(--c-muted)"
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        style="color: var(--c-danger); opacity: 0.7"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div class="text-sm" style="color: var(--c-danger)">{{ findingsError }}</div>
      <button class="ui-btn text-xs" @click="$emit('search', searchQuery)">{{ t("history.retry") }}</button>
    </div>

    <!-- 空态 -->
    <div
      v-else-if="findings.length === 0 && !loading"
      class="flex-1 flex flex-col items-center justify-center gap-3"
      style="color: var(--c-muted)"
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        style="opacity: 0.35"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
      </svg>
      <div class="text-sm">{{ t("history.noRecords") }}</div>
    </div>

    <!-- 滚动列表 -->
    <div v-else class="flex-1 overflow-y-auto p-3 space-y-2.5">
      <div v-if="loading && findings.length === 0" class="py-8 text-center text-sm" style="color: var(--c-muted)">
        {{ t("history.loading") }}
      </div>
      <LeakCard v-for="item in findings" :key="item.id" :finding="item" />
    </div>

    <!-- 加载更多（固定在底部） -->
    <div
      v-if="findings.length > 0 && findings.length < total"
      class="shrink-0 px-3 pb-3 pt-2 border-t"
      style="border-color: var(--c-border)"
    >
      <button class="ui-btn w-full" :disabled="loading" @click="$emit('load-more')">
        {{ loading ? t("history.loading") : t("history.loadMore", { count: total - findings.length }) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import LeakCard from "./LeakCard.vue";
const { t } = useI18n();

const props = defineProps({
  findings: { type: Array, required: true },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  findingsError: { type: String, default: "" },
  searchQuery: { type: String, default: "" },
  repoFilter: { type: String, default: "" },
  sortBy: { type: String, default: "time" },
});
const emit = defineEmits(["search", "filter", "set-sort", "load-more"]);

// 本地持有搜索输入顿态，屏蔽父组件重渲染对 DOM 的覆盖（吸字 bug 根源）
const localQuery = ref(props.searchQuery);

// 父组件外部重置（如清空搜索）时同步过来，不干扰用户正在输入
watch(
  () => props.searchQuery,
  v => {
    if (v !== localQuery.value) localQuery.value = v;
  }
);

// 防抖发射：本地字符变化 350ms 后才提交父组件
let _searchTimer = null;
watch(localQuery, v => {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => emit("search", v), 350);
});
</script>
