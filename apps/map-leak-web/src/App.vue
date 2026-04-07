<template>
  <AnnouncementModal v-if="showNotice" @close="dismissNotice" />
  <div class="min-h-screen flex flex-col" style="background: var(--c-bg)">
    <!-- ══ 顶栏 ════════════════════════════════════════════════════════════ -->
    <AppHeader
      :theme="theme"
      :theme-icons="THEME_ICONS"
      :connected="connected"
      :clock="clock"
      :refreshing-dl="refreshingDl"
      :refresh-dl-msg="refreshDlMsg"
      @toggle-lang="toggleLang"
      @cycle-theme="cycleTheme"
      @refresh-downloads="refreshDownloads"
      @open-notice="showNotice = true"
    />

    <div class="flex-1 flex flex-col gap-4 p-4 max-w-[1800px] w-full mx-auto">
      <!-- ══ KPI 行 ═══════════════════════════════════════════════════════ -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          :label="t('kpi.totalScanned.label')"
          :value="stats.totalScanned"
          color="blue"
          :sub="t('kpi.totalScanned.sub')"
        />
        <StatCard
          :label="t('kpi.totalLeaks.label')"
          :value="stats.totalLeaks"
          color="red"
          :sub="t('kpi.totalLeaks.sub')"
        />
        <StatCard :label="t('kpi.last24h.label')" :value="stats.last24h" color="yellow" :sub="t('kpi.last24h.sub')" />
        <StatCard
          :label="t('kpi.liveSession.label')"
          :value="liveLeaks.length"
          color="green"
          :sub="t('kpi.liveSession.sub')"
        />
      </section>

      <!-- ══ 图表区 ════════════════════════════════════════════════════════ -->
      <ChartsSection
        v-model="chartsVisible"
        :timeline-opt="timelineOpt"
        :repo-status-opt="repoStatusOpt"
        :top-dl-opt="topDlOpt"
        :top-size-opt="topSizeOpt"
        :daily-opt="dailyOpt"
      />

      <!-- ══ 数据列表区（左：实时推送 | 右：历史记录）══════════════════ -->
      <section class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <LivePanel :live-leaks="liveLeaks" :connected="connected" />
        <HistoryPanel
          :findings="findings"
          :total="total"
          :loading="loading"
          :findings-error="findingsError"
          :search-query="searchQuery"
          :repo-filter="repoFilter"
          :sort-by="sortBy"
          @search="search"
          @filter="filter"
          @set-sort="setSort"
          @load-more="loadMore"
        />
      </section>
    </div>

    <!-- ══ 页脚 ════════════════════════════════════════════════════════════ -->
    <footer
      class="shrink-0 border-t py-4 text-center"
      style="border-color: var(--c-border); background: var(--c-surface)"
    >
      <p class="text-xs" style="color: var(--c-muted)">
        Copyright © {{ new Date().getFullYear() }} MapLeak. 保留所有权利.
      </p>
      <p class="mt-2">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
          style="color: var(--c-muted)"
        >
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style="flex-shrink: 0">
            <path
              fill-rule="evenodd"
              d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z"
              clip-rule="evenodd"
            />
          </svg>
          <span style="text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px"
            >蜀ICP备2025127350号-1</span
          >
        </a>
      </p>
    </footer>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import AnnouncementModal from "./components/AnnouncementModal.vue";
import AppHeader from "./components/AppHeader.vue";
import StatCard from "./components/StatCard.vue";
import ChartsSection from "./components/ChartsSection.vue";
import LivePanel from "./components/LivePanel.vue";
import HistoryPanel from "./components/HistoryPanel.vue";

import { useStats } from "./composables/useStats.js";
import { useLeakStream } from "./composables/useLeakStream.js";
import { useFindings } from "./composables/useFindings.js";
import { useCharts } from "./composables/useCharts.js";
import {
  useTimelineOption,
  useRepoStatusOption,
  useTopDownloadsOption,
  useTopSizeOption,
  useDailyOption,
} from "./composables/useChartOptions.js";

const { t, locale } = useI18n();

// 公告弹窗（每次版本号更新后重置）
const NOTICE_KEY = "mapleak-notice-v1";
const showNotice = ref(!localStorage.getItem(NOTICE_KEY));
function dismissNotice(neverAgain) {
  if (neverAgain) localStorage.setItem(NOTICE_KEY, "1");
  showNotice.value = false;
}

const { stats } = useStats();
const { liveLeaks, connected } = useLeakStream();
const {
  findings,
  total,
  loading,
  error: findingsError,
  searchQuery,
  repoFilter,
  sortBy,
  search,
  filter,
  setSort,
  loadMore,
} = useFindings();
const { timeline, repoStatus, topDl, topSize, daily, reload: reloadCharts } = useCharts();

const timelineOpt = useTimelineOption(timeline);
const repoStatusOpt = useRepoStatusOption(repoStatus);
const topDlOpt = useTopDownloadsOption(topDl);
const topSizeOpt = useTopSizeOption(topSize);
const dailyOpt = useDailyOption(daily);

// 图表区折叠状态
const chartsVisible = ref(true);

// 语言切换
function toggleLang() {
  locale.value = locale.value === "zh" ? "en" : "zh";
  localStorage.setItem("mapleak-lang", locale.value);
}

// 主题切换
const THEMES = ["dark", "light", "terminal"];
const THEME_ICONS = { dark: "🌙", light: "☀️", terminal: "💻" };

const theme = ref(localStorage.getItem("mapleak-theme") ?? "dark");
watch(
  theme,
  v => {
    document.documentElement.setAttribute("data-theme", v);
    localStorage.setItem("mapleak-theme", v);
  },
  { immediate: true }
);

function cycleTheme() {
  const idx = THEMES.indexOf(theme.value);
  theme.value = THEMES[(idx + 1) % THEMES.length];
}

// 时钟
const clock = ref("");
let clockTimer = null;
function tick() {
  clock.value = new Date().toLocaleTimeString(locale.value === "zh" ? "zh-CN" : "en-US", { hour12: false });
}
onMounted(() => {
  tick();
  clockTimer = setInterval(tick, 1000);
});
onUnmounted(() => clearInterval(clockTimer));

// SSE 推送 → 防抖刷新图表
let chartDebounceTimer = null;
watch(liveLeaks, () => {
  clearTimeout(chartDebounceTimer);
  chartDebounceTimer = setTimeout(() => reloadCharts(), 1500);
});

// 刷新下载量
const refreshingDl = ref(false);
const refreshDlMsg = ref("");
let refreshPollTimer = null;

async function pollRefreshProgress() {
  try {
    const res = await fetch("/api/admin/refresh-downloads");
    const json = await res.json();
    const d = json.data ?? json;
    if (d.running) {
      const done = d.updated + d.skipped;
      refreshDlMsg.value = t("header.refreshing", { done, total: d.total });
      refreshPollTimer = setTimeout(pollRefreshProgress, 1500);
    } else {
      refreshingDl.value = false;
      if (d.error) {
        refreshDlMsg.value = t("header.failedMsg", { msg: d.error });
      } else if (d.total > 0) {
        const skippedTip =
          d.skipped > 0
            ? t("header.refreshDoneSkipped", { updated: d.updated, total: d.total, skipped: d.skipped })
            : t("header.refreshDone", { updated: d.updated, total: d.total });
        refreshDlMsg.value = skippedTip;
        search(searchQuery.value);
      }
      setTimeout(() => {
        refreshDlMsg.value = "";
      }, 4000);
    }
  } catch {
    refreshingDl.value = false;
    refreshDlMsg.value = t("header.queryFailed");
    setTimeout(() => {
      refreshDlMsg.value = "";
    }, 3000);
  }
}

async function refreshDownloads() {
  if (refreshingDl.value) return;
  refreshingDl.value = true;
  refreshDlMsg.value = t("header.starting");
  clearTimeout(refreshPollTimer);
  try {
    await fetch("/api/admin/refresh-downloads", { method: "POST" });
    refreshPollTimer = setTimeout(pollRefreshProgress, 1000);
  } catch {
    refreshingDl.value = false;
    refreshDlMsg.value = t("header.failed");
    setTimeout(() => {
      refreshDlMsg.value = "";
    }, 3000);
  }
}
</script>
