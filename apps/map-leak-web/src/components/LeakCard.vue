<template>
  <article class="panel anim-slide-down overflow-hidden" :class="highlight ? 'panel-accent' : ''">
    <div class="p-4 space-y-3">
      <!-- 鈹€鈹€ 椤惰 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- LIVE 鏍囪 -->
        <span v-if="highlight" class="tag tag-green text-[10px] shrink-0">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"
            style="animation: live-dot 1.5s ease-in-out infinite"
          ></span>
          LIVE
        </span>

        <a
          :href="`https://www.npmjs.com/package/${pkgName}`"
          target="_blank"
          rel="noopener noreferrer"
          class="font-semibold text-sm break-all hover:underline"
          style="color: var(--c-text)"
          >{{ pkgName }}</a
        >
        <span class="tag tag-blue font-mono">v{{ finding.version }}</span>
        <span class="tag" :class="repoTagClass">{{ repoLabel }}</span>
        <!-- GitHub / 浠撳簱閾炬帴 -->
        <a
          v-if="repoUrl"
          :href="repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity"
          style="color: var(--c-muted); text-decoration: none"
          :title="t('repo.viewTooltip')"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
        </a>
        <span class="ml-auto text-xs shrink-0" style="color: var(--c-muted)">{{ timeStr }}</span>
      </div>

      <!-- 鈹€鈹€ 鍖呯畝浠?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
      <p v-if="descText" class="text-xs leading-relaxed" style="color: var(--c-text2)">{{ descText }}</p>

      <!-- 鈹€鈹€ 鍏抽敭瀛楁爣绛?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
      <div v-if="keywords.length" class="flex flex-wrap gap-1">
        <span
          v-for="kw in keywords"
          :key="kw"
          class="text-[10px] px-1.5 py-0.5 rounded font-mono"
          style="
            background: rgba(56, 189, 248, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.2);
            color: var(--c-accent);
          "
        >
          {{ kw }}
        </span>
      </div>

      <!-- 鈹€鈹€ 鏍稿績鎸囨爣 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div class="rounded-md p-2 text-center" style="background: var(--c-surface2)">
          <div class="text-xl font-bold tabular-nums" style="color: var(--c-danger)">{{ leaks.length }}</div>
          <div class="text-[10px] mt-0.5" style="color: var(--c-muted)">{{ t("card.mapFiles") }}</div>
        </div>
        <div class="rounded-md p-2 text-center" style="background: var(--c-surface2)">
          <div class="text-xl font-bold tabular-nums" style="color: var(--c-warn)">{{ totalSize }}</div>
          <div class="text-[10px] mt-0.5" style="color: var(--c-muted)">{{ t("card.leakSource") }}</div>
        </div>
        <div class="rounded-md p-2 text-center" style="background: var(--c-surface2)">
          <div class="text-xl font-bold tabular-nums" style="color: var(--c-accent)">{{ fmtDl }}</div>
          <div class="text-[10px] mt-0.5" style="color: var(--c-muted)">{{ t("card.weeklyDl") }}</div>
        </div>
        <div
          v-if="hasCloud"
          class="rounded-md p-2 text-center flex flex-col items-center justify-center gap-1"
          style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.3)"
        >
          <span style="color: var(--c-warn)">&#9729;</span>
          <div class="text-[10px]" style="color: var(--c-warn)">{{ t("card.cloudRef") }}</div>
        </div>
      </div>

      <!-- 鈹€鈹€ 浣滆€?/ 浠撳簱 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs" style="color: var(--c-text2)">
        <span v-if="authorName">
          <span style="color: var(--c-muted)">{{ t("card.author") }}</span>
          <span class="ml-1 font-medium">{{ authorName }}</span>
        </span>
        <span v-if="maintainerList.length" class="flex items-center gap-1 flex-wrap">
          <span style="color: var(--c-muted)">{{ t("card.maintainers") }}</span>
          <span
            v-for="m in maintainerList"
            :key="m"
            class="px-1.5 py-0.5 rounded text-[10px] font-mono"
            style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--c-border)"
            >{{ m }}</span
          >
        </span>
        <a
          v-if="repoUrl"
          :href="repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline truncate max-w-xs"
          style="color: var(--c-accent)"
          >{{ repoUrl }}</a
        >
      </div>

      <!-- 鈹€鈹€ 鏂囦欢璇︽儏鎶樺彔 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
      <div>
        <!-- 鎿嶄綔鏍忥細璇︽儏灞曞紑 + 瀹屾暣宸ョ▼瑙嗗浘鎸夐挳 -->
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="cursor-pointer text-xs flex items-center gap-1.5"
            style="color: var(--c-muted); background: none; border: none; padding: 0"
            @click="detailOpen = !detailOpen"
          >
            <span
              class="inline-block transition-transform duration-150"
              :style="detailOpen ? 'transform:rotate(90deg)' : ''"
              >&#9654;</span
            >
            {{ detailOpen ? t("card.collapseDetail") : t("card.viewDetail", { n: leaks.length }) }}
          </button>

          <!-- 完整工程视图按钮（有 .map 时常驻显示）-->
          <button
            v-if="leaks.length >= 1"
            @click="projectOpen = !projectOpen"
            class="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded border hover:opacity-80 transition-opacity"
            :style="
              projectOpen
                ? 'color: var(--c-accent); border-color: rgba(56,189,248,.5); background: rgba(56,189,248,.08)'
                : 'color: var(--c-text2); border-color: var(--c-border)'
            "
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"
              />
            </svg>
            {{ projectOpen ? t("card.collapseProject") : t("card.viewProject", { n: leaks.length }) }}
          </button>
        </div>

        <div v-show="detailOpen" class="mt-2 space-y-1.5">
          <template v-for="(lk, i) in leaks" :key="i">
            <!-- 鈹€鈹€ 鍗曟簮鏂囦欢锛氱揣鍑戝崟琛?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
            <div
              v-if="(lk.fileCount ?? lk.file_count ?? 0) <= 1"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-md text-xs"
              style="background: var(--c-bg); border: 1px solid var(--c-border)"
            >
              <!-- .map 璺緞锛堝彇鏂囦欢鍚嶉儴鍒嗭紝hover 鏄剧ず鍏ㄨ矾寰勶級 -->
              <span
                class="font-mono truncate max-w-[50%]"
                style="color: var(--c-warn)"
                :title="lk.mapFile ?? lk.map_file"
              >
                {{ (lk.mapFile ?? lk.map_file ?? "").split("/").pop() }}
              </span>
              <!-- 绠ご + 婧愭枃浠惰矾寰?-->
              <span
                v-if="srcPaths(lk).length"
                class="font-mono truncate flex-1 min-w-0 text-[11px]"
                style="color: var(--c-muted)"
                :title="srcPaths(lk)[0]"
              >
                → {{ srcPaths(lk)[0].split("/").pop() }}
              </span>
              <!-- 浣撶Н -->
              <span class="text-[10px] shrink-0" style="color: var(--c-text2)">{{
                fmtBytes(lk.totalBytes ?? lk.total_bytes)
              }}</span>
              <span v-if="lk.hasCloudRef || lk.has_cloud_ref" class="shrink-0" style="color: var(--c-warn)"
                >&#9729;</span
              >
              <!-- 鏌ョ湅婧愮爜鎸夐挳 -->
              <button
                v-if="lk.id"
                @click="viewerOpenId = viewerOpenId === lk.id ? null : lk.id"
                class="shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border hover:opacity-80 transition-opacity"
                :style="
                  viewerOpenId === lk.id
                    ? 'color: var(--c-accent); border-color: rgba(56,189,248,.5); background: rgba(56,189,248,.08)'
                    : 'color: var(--c-text2); border-color: var(--c-border)'
                "
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path
                    d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm1 3v1h6V5H5zm0 2.5v1h6v-1H5zm0 2.5v1h4v-1H5z"
                  />
                </svg>
                {{ viewerOpenId === lk.id ? t("card.collapseSource") : t("card.viewSource") }}
              </button>
            </div>

            <!-- 鈹€鈹€ 澶氭簮鏂囦欢锛氬畬鏁寸洅瀛?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
            <div
              v-else
              class="rounded-md p-3 text-xs space-y-2"
              style="background: var(--c-bg); border: 1px solid var(--c-border)"
            >
              <!-- .map 鏂囦欢璺緞 -->
              <div class="font-mono break-all" style="color: var(--c-warn)">
                {{ lk.mapFile ?? lk.map_file ?? t("card.unknownPath") }}
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-1" style="color: var(--c-text2)">
                <span>{{ t("card.sourceFiles", { n: lk.fileCount ?? lk.file_count ?? 0 }) }}</span>
                <span>{{ fmtBytes(lk.totalBytes ?? lk.total_bytes) }}</span>
                <span v-if="lk.hasCloudRef || lk.has_cloud_ref" style="color: var(--c-warn)"
                  >&#9729; {{ t("card.cloudRef") }}</span
                >
              </div>
              <!-- 婧愭枃浠惰矾寰勫垪琛?-->
              <ul v-if="srcPaths(lk).length" class="space-y-0.5 font-mono" style="color: var(--c-muted)">
                <li v-for="p in srcPaths(lk).slice(0, 5)" :key="p" class="truncate text-[11px]">— {{ p }}</li>
                <li v-if="srcPaths(lk).length > 5" class="text-[11px]" style="color: var(--c-border2)">
                  {{ t("card.moreFiles", { n: srcPaths(lk).length - 5 }) }}
                </li>
              </ul>
              <!-- tarball 涓嬭浇 + 鏌ョ湅婧愮爜鍏ュ彛 -->
              <div v-if="lk.tarball ?? finding.tarball" class="pt-1 flex items-center gap-2 flex-wrap">
                <a
                  :href="lk.tarball ?? finding.tarball"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border hover:opacity-80 transition-opacity"
                  style="color: var(--c-muted); border-color: var(--c-border); text-decoration: none"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 12l-4-4h2.5V3h3v5H12L8 12zm-5 2h10v1.5H3V14z" />
                  </svg>
                  {{ t("card.downloadTarball") }}
                </a>
                <!-- 鏌ョ湅/鎻愬彇婧愮爜鎸夐挳锛堥渶瑕?lk.id锛?-->
                <button
                  v-if="lk.id"
                  @click="viewerOpenId = viewerOpenId === lk.id ? null : lk.id"
                  class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border hover:opacity-80 transition-opacity"
                  :style="
                    viewerOpenId === lk.id
                      ? 'color: var(--c-accent); border-color: rgba(56,189,248,.5); background: rgba(56,189,248,.08)'
                      : 'color: var(--c-text2); border-color: var(--c-border)'
                  "
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                    <path
                      d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm1 3v1h6V5H5zm0 2.5v1h6v-1H5zm0 2.5v1h4v-1H5z"
                    />
                  </svg>
                  {{ viewerOpenId === lk.id ? t("card.collapseSource") : t("card.viewSource") }}
                </button>
              </div>

              <!-- 婧愮爜鎻愬彇鏌ョ湅鍣紙澶氭簮鏂囦欢鍒嗘敮锛?-->
              <SourceViewer
                v-if="viewerOpenId === lk.id && lk.id"
                :id="lk.id"
                :map-file="lk.map_file ?? lk.mapFile"
                @close="viewerOpenId = null"
              />
            </div>

            <!-- 婧愮爜鎻愬彇鏌ョ湅鍣紙鍗曟簮鏂囦欢绱у噾琛岋級 -->
            <SourceViewer
              v-if="(lk.fileCount ?? lk.file_count ?? 0) <= 1 && viewerOpenId === lk.id && lk.id"
              :id="lk.id"
              :map-file="lk.map_file ?? lk.mapFile"
              @close="viewerOpenId = null"
            />
          </template>
        </div>

        <!-- 完整工程 SourceViewer（折叠区域外，常驻渲染）-->
        <SourceViewer v-if="projectOpen && leaks.length >= 1" :finding="finding" @close="projectOpen = false" />
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import SourceViewer from "./SourceViewer.vue";
import { fmtBytes, fmtDownloads } from "../utils/format.js";

const { t, locale } = useI18n();

const props = defineProps({
  finding: { type: Object, required: true },
  highlight: { type: Boolean, default: false },
});

// 文件详情折叠状态（Vue 控制，防止 unshift 时 DOM 状态丢失）
const detailOpen = ref(false);
// 当前展开查看源码的 lk.id（null = 未展开）
const viewerOpenId = ref(null);
// 完整工程视图是否展开
const projectOpen = ref(false);

const pkgName = computed(() => props.finding.name ?? props.finding.package ?? "?");
const descText = computed(() => props.finding.description ?? "");
const keywords = computed(() => {
  const kw = props.finding.keywords;
  if (Array.isArray(kw)) return kw.slice(0, 8);
  return [];
});
const leaks = computed(() => props.finding.leaks ?? [props.finding]);

const weeklyDownloads = computed(() => props.finding.weeklyDownloads ?? props.finding.weekly_downloads ?? 0);

const totalSize = computed(() => {
  const bytes = leaks.value.reduce((s, l) => s + (l.totalBytes ?? l.total_bytes ?? 0), 0);
  return fmtBytes(bytes);
});

const hasCloud = computed(() => leaks.value.some(l => l.hasCloudRef || l.has_cloud_ref));

const repoStatus = computed(() => props.finding.repoStatus ?? props.finding.repo_status ?? "");

const repoLabel = computed(
  () =>
    ({
      none: t("repo.label.none"),
      private: t("repo.label.private"),
      "open-source": t("repo.label.openSource"),
    })[repoStatus.value] ?? t("repo.unknown")
);

const repoTagClass = computed(
  () =>
    ({
      none: "tag-red",
      private: "tag-yellow",
      "open-source": "tag-green",
    })[repoStatus.value] ?? "tag-muted"
);

const repoUrl = computed(() => {
  const r = props.finding.repository ?? props.finding.repo_url;
  if (!r) return null;
  if (typeof r === "string") return r;
  return r.url ?? null;
});

const authorName = computed(() => {
  const a = props.finding.author;
  if (!a) return "";
  return typeof a === "string" ? a : (a.name ?? "");
});

const maintainerList = computed(() => {
  const ms = props.finding.maintainers ?? [];
  return ms
    .map(m => (typeof m === "string" ? m : (m.name ?? "")))
    .filter(Boolean)
    .slice(0, 6);
});

const fmtDl = computed(() => fmtDownloads(weeklyDownloads.value));

const timeStr = computed(() => {
  const ts = props.finding.foundAt ?? props.finding.found_at;
  if (!ts) return "";
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  return d.toLocaleString(locale.value === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

function srcPaths(lk) {
  const sp = lk.sourcePaths ?? lk.source_paths;
  if (Array.isArray(sp)) return sp;
  if (typeof sp === "string") {
    try {
      return JSON.parse(sp);
    } catch {
      return [];
    }
  }
  return [];
}
</script>
