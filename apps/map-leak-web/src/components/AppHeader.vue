<template>
  <header
    class="sticky top-0 z-50 flex items-center gap-3 px-5 h-12 border-b shrink-0"
    style="background: var(--c-header-bg); backdrop-filter: blur(10px); border-color: var(--c-border)"
  >
    <button
      class="flex items-center gap-2 shrink-0 group"
      style="background: none; border: none; padding: 0; cursor: pointer"
      @click="$emit('open-notice')"
      title="关于 MapLeak / About MapLeak"
    >
      <span class="text-base">🕵️</span>
      <span class="font-bold text-sm tracking-tight group-hover:opacity-75 transition-opacity">
        <span style="color: var(--c-danger)">Map</span><span style="color: var(--c-accent)">Leak</span>
      </span>
    </button>
    <span class="hidden sm:block text-xs" style="color: var(--c-muted)">{{ t("header.subtitle") }}</span>

    <div class="ml-auto flex items-center gap-3 shrink-0">
      <!-- 语言切换 -->
      <button
        class="flex items-center justify-center h-7 px-2 rounded-md border transition-opacity hover:opacity-75 text-[11px] font-semibold"
        style="color: var(--c-muted); border-color: var(--c-border)"
        @click="$emit('toggle-lang')"
        :title="locale === 'zh' ? 'Switch to English' : '切换为中文'"
      >
        {{ locale === "zh" ? "EN" : "中" }}
      </button>
      <!-- 主题切换 -->
      <button
        class="flex items-center justify-center w-7 h-7 rounded-md border transition-opacity hover:opacity-75 text-sm"
        style="color: var(--c-muted); border-color: var(--c-border)"
        @click="$emit('cycle-theme')"
        :title="t('header.themeTooltip', { name: t('header.theme.' + theme) })"
      >
        {{ themeIcons[theme] }}
      </button>
      <!-- 刷新下载量 -->
      <button
        class="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-opacity hover:opacity-80"
        style="color: var(--c-muted); border-color: var(--c-border)"
        :disabled="refreshingDl"
        @click="$emit('refresh-downloads')"
        :title="refreshDlMsg || t('header.refreshTooltip')"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" :class="refreshingDl ? 'animate-spin' : ''">
          <path d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.22-3.72L9 7h6V1l-1.35 1.35z" />
        </svg>
        {{ refreshDlMsg || t("header.refreshDownloads") }}
      </button>
      <!-- 连接状态 -->
      <div
        class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border"
        :style="
          connected
            ? 'color:#34d399; background:rgba(52,211,153,.08); border-color:rgba(52,211,153,.3)'
            : 'color: var(--c-muted); background:transparent; border-color: var(--c-border)'
        "
      >
        <span
          class="w-1.5 h-1.5 rounded-full inline-block"
          :style="
            connected
              ? 'background:#34d399; animation: live-dot 1.5s ease-in-out infinite'
              : 'background: var(--c-muted)'
          "
        ></span>
        {{ connected ? "LIVE" : "OFFLINE" }}
      </div>
      <!-- 时钟 -->
      <span class="hidden md:block text-xs font-mono tabular-nums" style="color: var(--c-muted)">{{ clock }}</span>
    </div>
  </header>
</template>

<script setup>
import { useI18n } from "vue-i18n";
const { t, locale } = useI18n();
defineProps({
  theme: { type: String, required: true },
  themeIcons: { type: Object, required: true },
  connected: { type: Boolean, default: false },
  clock: { type: String, default: "" },
  refreshingDl: { type: Boolean, default: false },
  refreshDlMsg: { type: String, default: "" },
});
defineEmits(["toggle-lang", "cycle-theme", "refresh-downloads", "open-notice"]);
</script>
