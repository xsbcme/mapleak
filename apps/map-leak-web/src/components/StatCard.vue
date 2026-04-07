<template>
  <div
    class="panel relative overflow-hidden p-5 flex flex-col gap-1.5 select-none"
    :style="`border-color: ${colors.border}`"
  >
    <!-- 顶部彩色边框线 -->
    <div
      class="absolute top-0 left-0 right-0 h-[3px] rounded-t-lg"
      :style="`background: linear-gradient(90deg, ${colors.from}, ${colors.to})`"
    ></div>

    <div class="text-xs font-semibold tracking-widest uppercase mt-1" style="color: var(--c-muted)">{{ label }}</div>

    <div class="text-4xl font-bold tabular-nums leading-none mt-1" :style="`color: ${colors.main}`">
      {{ formatted }}
    </div>

    <div v-if="sub" class="text-xs" style="color: var(--c-muted)">{{ sub }}</div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from "vue";

const props = defineProps({
  label: String,
  value: { type: Number, default: 0 },
  sub: { type: String, default: "" },
  color: { type: String, default: "blue" },
});

const palette = {
  blue: { main: "#38bdf8", border: "rgba(56,189,248,.4)", from: "#0ea5e9", to: "#38bdf8" },
  red: { main: "#f43f5e", border: "rgba(244,63,94,.4)", from: "#e11d48", to: "#fb7185" },
  yellow: { main: "#fbbf24", border: "rgba(251,191,36,.4)", from: "#d97706", to: "#fcd34d" },
  green: { main: "#34d399", border: "rgba(52,211,153,.4)", from: "#059669", to: "#6ee7b7" },
};

const colors = computed(() => palette[props.color] ?? palette.blue);

// ── 滚动计数动画 ──────────────────────────────────────────────────────────────
const displayValue = ref(props.value);
let rafId = null;

/** easeOutQuart — 快速启动，末尾柔和减速 */
function easeOutQuart(t) {
  return 1 - (1 - t) ** 4;
}

watch(
  () => props.value,
  next => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    const start = displayValue.value;
    const delta = next - start;
    const duration = Math.min(800, Math.max(300, Math.abs(delta) * 0.5)); // 动态时长
    const t0 = performance.now();

    function tick(now) {
      const progress = Math.min((now - t0) / duration, 1);
      displayValue.value = Math.round(start + delta * easeOutQuart(progress));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        displayValue.value = next;
        rafId = null;
      }
    }
    rafId = requestAnimationFrame(tick);
  }
);

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
});

const formatted = computed(() => displayValue.value.toLocaleString());
</script>
