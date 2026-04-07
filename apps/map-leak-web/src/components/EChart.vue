<template>
  <div :style="{ width: '100%', height: height + 'px', position: 'relative' }">
    <!-- 有数据时才挂载 canvas，避免渲染空坐标轴 -->
    <div v-if="!isEmpty" ref="el" style="width: 100%; height: 100%"></div>

    <!-- 无数据空态 -->
    <div
      v-else
      style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
      "
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        style="color: var(--c-border); opacity: 0.6"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
      <span style="font-size: 11px; color: var(--c-muted); letter-spacing: 0.06em">暂无数据</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, markRaw, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: Number, default: 260 },
});

// 判断是否无数据（所有 series 的 data 都为空）
const isEmpty = computed(() => {
  const series = props.option?.series ?? [];
  if (series.length === 0) return true;
  return series.every(s => (s.data ?? []).length === 0);
});

const el = ref(null);
// markRaw：阻止 Vue 对 ECharts 实例做深度响应式代理，这是卡顿的根本原因
let chart = null;
let resizeObs = null;
let resizeTimer = null;

onMounted(() => {
  if (!el.value) return; // isEmpty 时无 canvas 节点
  chart = markRaw(echarts.init(el.value, null, { renderer: "canvas", useDirtyRect: true }));
  chart.setOption(props.option);

  // 防抖 resize，避免高频触发重绘
  resizeObs = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => chart?.resize(), 60);
  });
  resizeObs.observe(el.value);
});

watch(
  () => props.option,
  async opt => {
    // 有数据时 chart 已存在，直接更新
    if (chart) {
      chart.setOption(opt, { notMerge: false, lazyUpdate: true });
      return;
    }
    // 数据从无→有：v-if 切换后 el 需等 nextTick 才挂载
    await nextTick();
    if (!el.value) return;
    chart = markRaw(echarts.init(el.value, null, { renderer: "canvas", useDirtyRect: true }));
    chart.setOption(opt);
    resizeObs = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => chart?.resize(), 60);
    });
    resizeObs.observe(el.value);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  clearTimeout(resizeTimer);
  resizeObs?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>
