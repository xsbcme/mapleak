<template>
  <div class="panel flex flex-col" style="height: clamp(520px, calc(100vh - 340px), 820px)">
    <!-- 面板标题行 -->
    <div class="flex items-center gap-2 px-4 shrink-0 border-b" style="height: 52px; border-color: var(--c-border)">
      <h2 class="section-label">{{ t("live.title") }}</h2>
      <span v-if="liveLeaks.length" class="tag tag-red text-[10px]">{{ liveLeaks.length }}</span>
      <span v-if="connected" class="ml-auto flex items-center gap-1 text-[10px]" style="color: var(--c-ok)">
        <span
          class="w-1.5 h-1.5 rounded-full inline-block"
          style="background: var(--c-ok); animation: live-dot 1.5s ease-in-out infinite"
        ></span>
        {{ t("live.scanning") }}
      </span>
    </div>

    <!-- 空态 -->
    <div
      v-if="liveLeaks.length === 0"
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
        <circle cx="11" cy="11" r="7" />
        <path d="M16.5 16.5 21 21" />
        <path d="M11 8v3l2 2" />
      </svg>
      <div class="text-sm">{{ t("live.empty") }}</div>
      <div class="text-xs" style="color: var(--c-border2)">{{ t("live.emptyHint") }}</div>
    </div>

    <!-- 滚动列表 -->
    <div v-else class="flex-1 overflow-y-auto p-3 space-y-2.5">
      <LeakCard
        v-for="item in liveLeaks.slice(0, 30)"
        :key="item.id ?? item.name + item.version + item.timestamp"
        :finding="item"
        :highlight="true"
      />
      <div v-if="liveLeaks.length > 30" class="text-center text-[11px] py-2" style="color: var(--c-muted)">
        {{ t("live.showLatest", { count: liveLeaks.length }) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import LeakCard from "./LeakCard.vue";
const { t } = useI18n();
defineProps({
  liveLeaks: { type: Array, required: true },
  connected: { type: Boolean, default: false },
});
</script>
