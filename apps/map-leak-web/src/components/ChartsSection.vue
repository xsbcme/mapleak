<template>
  <div>
    <div class="relative z-10 flex items-center justify-between mb-2">
      <span class="section-label">{{ t("chart.title") }}</span>
      <button
        @click="$emit('update:modelValue', !modelValue)"
        class="text-[10px] px-2 py-0.5 rounded border hover:opacity-80 transition-opacity"
        style="color: var(--c-muted); border-color: var(--c-border); background: none; cursor: pointer"
      >
        {{ modelValue ? t("chart.collapse") : t("chart.expand") }}
      </button>
    </div>
    <section v-show="modelValue" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <!-- 近 24h 趋势（跨2列） -->
      <div class="panel p-4 md:col-span-2">
        <div class="section-label mb-3">{{ t("chart.timeline") }}</div>
        <EChart :option="timelineOpt" :height="180" />
      </div>
      <!-- 仓库类型分布 -->
      <div class="panel p-4">
        <div class="section-label mb-3">{{ t("chart.repoStatus") }}</div>
        <EChart :option="repoStatusOpt" :height="180" />
      </div>
      <!-- 周下载量 TOP10 -->
      <div class="panel p-4">
        <div class="section-label mb-3">
          {{ t("chart.topDownloads") }}
          <span class="normal-case text-[10px] ml-1" style="color: var(--c-muted)">{{ t("chart.topDlSub") }}</span>
        </div>
        <EChart :option="topDlOpt" :height="220" />
      </div>
      <!-- 泄露体积 TOP10 -->
      <div class="panel p-4">
        <div class="section-label mb-3">
          {{ t("chart.topSize") }}
          <span class="normal-case text-[10px] ml-1" style="color: var(--c-muted)">{{ t("chart.topSizeSub") }}</span>
        </div>
        <EChart :option="topSizeOpt" :height="220" />
      </div>
      <!-- 7天扫描对比 -->
      <div class="panel p-4 md:col-span-2 xl:col-span-1">
        <div class="section-label mb-3">{{ t("chart.daily") }}</div>
        <EChart :option="dailyOpt" :height="220" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import EChart from "./EChart.vue";
const { t } = useI18n();
defineProps({
  timelineOpt: { type: Object, required: true },
  repoStatusOpt: { type: Object, required: true },
  topDlOpt: { type: Object, required: true },
  topSizeOpt: { type: Object, required: true },
  dailyOpt: { type: Object, required: true },
  modelValue: { type: Boolean, default: true },
});
defineEmits(["update:modelValue"]);
</script>
