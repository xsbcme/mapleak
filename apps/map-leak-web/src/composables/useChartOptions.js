import { computed } from "vue";
import { useI18n } from "vue-i18n";

const C = {
  bg: "#0d1930",
  border: "#1e3a62",
  text: "#e8f1ff",
  text2: "#94b4d8",
  muted: "#4d7099",
  blue: "#38bdf8",
  red: "#f43f5e",
  green: "#34d399",
  yellow: "#fbbf24",
  purple: "#a78bfa",
};

const baseTooltip = {
  backgroundColor: "#0d1930",
  borderColor: C.border,
  textStyle: { color: C.text, fontSize: 12 },
  confine: true,
  extraCssText: "box-shadow: 0 8px 24px rgba(0,0,0,.5)",
};

const baseAxis = {
  axisLine: { lineStyle: { color: C.border } },
  splitLine: { lineStyle: { color: "#1e3a62", type: "dashed", opacity: 0.6 } },
  axisLabel: { color: C.muted, fontSize: 11 },
  axisTick: { show: false },
};

export function useTimelineOption(timeline) {
  return computed(() => {
    const data = timeline.value ?? [];
    return {
      tooltip: { ...baseTooltip, trigger: "axis" },
      grid: { top: 10, right: 10, bottom: 52, left: 40 },
      xAxis: [
        {
          type: "category",
          data: data.map(d => d.hour?.slice(11, 16) ?? ""),
          ...baseAxis,
          axisLabel: { ...baseAxis.axisLabel, rotate: 30, hideOverlap: true },
        },
      ],
      yAxis: [{ type: "value", minInterval: 1, ...baseAxis }],
      series: [
        {
          type: "line",
          smooth: true,
          data: data.map(d => d.count),
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: C.blue, width: 2 },
          itemStyle: { color: C.blue },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(56,189,248,.25)" },
                { offset: 1, color: "rgba(56,189,248,.02)" },
              ],
            },
          },
        },
      ],
    };
  });
}

const repoColors = {
  none: C.red,
  private: C.yellow,
  "open-source": C.green,
  unknown: C.muted,
};

export function useRepoStatusOption(repoStatus) {
  const { t } = useI18n();
  return computed(() => {
    const repoNames = {
      none: t("repo.none"),
      private: t("repo.private"),
      "open-source": t("repo.openSource"),
      unknown: t("repo.unknown"),
    };
    const data = (repoStatus.value ?? []).map(d => ({
      name: repoNames[d.status] ?? d.status,
      value: d.count,
      itemStyle: { color: repoColors[d.status] ?? C.muted },
    }));
    return {
      tooltip: {
        ...baseTooltip,
        trigger: "item",
        formatter: p => p.name + "<br/>" + p.value + " (" + p.percent + "%)",
      },
      legend: {
        orient: "vertical",
        right: 0,
        top: "middle",
        textStyle: { color: C.text2, fontSize: 11 },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "68%"],
          center: ["38%", "50%"],
          data,
          label: { show: false },
          emphasis: { itemStyle: { shadowBlur: 20, shadowColor: "rgba(56,189,248,.3)" } },
        },
      ],
    };
  });
}

export function useTopDownloadsOption(topDl) {
  return computed(() => {
    const data = [...(topDl.value ?? [])].reverse();
    return {
      tooltip: { ...baseTooltip, trigger: "axis", axisPointer: { type: "none" } },
      grid: { top: 4, right: 56, bottom: 4, left: 4, containLabel: true },
      xAxis: [
        {
          type: "value",
          ...baseAxis,
          axisLabel: {
            ...baseAxis.axisLabel,
            hideOverlap: true,
            formatter: v => (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : String(v)),
          },
        },
      ],
      yAxis: [
        {
          type: "category",
          data: data.map(d => (d.name?.length > 20 ? d.name.slice(0, 18) + "\u2026" : (d.name ?? ""))),
          ...baseAxis,
          axisLabel: { ...baseAxis.axisLabel, fontSize: 10 },
        },
      ],
      series: [
        {
          type: "bar",
          barMaxWidth: 16,
          data: data.map(d => ({
            value: d.downloads,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: "rgba(56,189,248,.15)" },
                  { offset: 1, color: C.blue },
                ],
              },
            },
          })),
          label: {
            show: true,
            position: "right",
            color: C.muted,
            fontSize: 10,
            formatter: p => {
              const n = p.value;
              return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "k" : String(n);
            },
          },
        },
      ],
    };
  });
}

export function useTopSizeOption(topSize) {
  return computed(() => {
    const data = [...(topSize.value ?? [])].reverse();
    return {
      tooltip: {
        ...baseTooltip,
        trigger: "axis",
        axisPointer: { type: "none" },
        formatter: params => {
          const p = params[0];
          return p.name + "<br/>" + (p.value / 1024 / 1024).toFixed(2) + " MB";
        },
      },
      grid: { top: 4, right: 56, bottom: 4, left: 4, containLabel: true },
      xAxis: [
        {
          type: "value",
          ...baseAxis,
          axisLabel: {
            ...baseAxis.axisLabel,
            hideOverlap: true,
            formatter: v => {
              const mb = v / 1024 / 1024;
              return mb >= 1 ? mb.toFixed(1) + "M" : (v / 1024).toFixed(0) + "K";
            },
          },
        },
      ],
      yAxis: [
        {
          type: "category",
          data: data.map(d => (d.name?.length > 20 ? d.name.slice(0, 18) + "\u2026" : (d.name ?? ""))),
          ...baseAxis,
          axisLabel: { ...baseAxis.axisLabel, fontSize: 10 },
        },
      ],
      series: [
        {
          type: "bar",
          barMaxWidth: 16,
          data: data.map(d => ({
            value: d.total_size,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: "rgba(244,63,94,.15)" },
                  { offset: 1, color: C.red },
                ],
              },
            },
          })),
          label: {
            show: true,
            position: "right",
            color: C.muted,
            fontSize: 10,
            formatter: p => {
              const mb = p.value / 1024 / 1024;
              return mb >= 1 ? mb.toFixed(1) + "MB" : (p.value / 1024).toFixed(0) + "KB";
            },
          },
        },
      ],
    };
  });
}

export function useDailyOption(daily) {
  const { t } = useI18n();
  return computed(() => {
    const d = daily.value ?? { scanned: [], leaks: [] };
    const days = [...new Set([...d.scanned.map(x => x.day), ...d.leaks.map(x => x.day)])].sort();
    const scannedMap = Object.fromEntries(d.scanned.map(x => [x.day, x.count]));
    const leakMap = Object.fromEntries(d.leaks.map(x => [x.day, x.count]));

    return {
      tooltip: { ...baseTooltip, trigger: "axis" },
      legend: {
        data: [t("chart.scanned"), t("chart.leaksFound")],
        textStyle: { color: C.text2, fontSize: 11 },
        top: 0,
        right: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
      },
      grid: { top: 28, right: 16, bottom: 28, left: 16, containLabel: true },
      xAxis: [
        {
          type: "category",
          data: days.map(d => d.slice(5)),
          ...baseAxis,
          axisLabel: { ...baseAxis.axisLabel, hideOverlap: true },
        },
      ],
      yAxis: [{ type: "value", minInterval: 1, ...baseAxis }],
      series: [
        {
          name: t("chart.scanned"),
          type: "bar",
          barMaxWidth: 22,
          data: days.map(d => scannedMap[d] ?? 0),
          itemStyle: { color: "rgba(56,189,248,.4)", borderRadius: [3, 3, 0, 0] },
        },
        {
          name: t("chart.leaksFound"),
          type: "bar",
          barMaxWidth: 22,
          data: days.map(d => leakMap[d] ?? 0),
          itemStyle: { color: C.red, borderRadius: [3, 3, 0, 0] },
        },
      ],
    };
  });
}
