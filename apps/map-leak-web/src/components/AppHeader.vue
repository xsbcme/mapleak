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
      <!-- GitHub 链接 -->
      <a
        href="https://github.com/xsbcme/mapleak"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center w-7 h-7 rounded-md border transition-opacity hover:opacity-75"
        style="color: var(--c-muted); border-color: var(--c-border)"
        title="GitHub"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      </a>
      <!-- Gitee 链接 -->
      <a
        href="https://gitee.com/xsbcme/mapleak"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center w-7 h-7 rounded-md border transition-opacity hover:opacity-75"
        style="color: var(--c-muted); border-color: var(--c-border)"
        title="Gitee"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.265.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.265.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.594.594 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.594.594 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296z"/>
        </svg>
      </a>
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
