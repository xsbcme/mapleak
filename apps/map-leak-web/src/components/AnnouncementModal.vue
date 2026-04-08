<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 outline-none"
      @click.self="close"
      @keydown.esc="close"
      tabindex="-1"
      ref="overlayRef"
    >
      <div
        class="flex flex-col w-full max-w-[900px] max-h-[88vh] overflow-hidden rounded-xl border"
        style="background:var(--c-surface); border-color:var(--c-border2); box-shadow:0 24px 64px rgba(0,0,0,.6), var(--glow-blue)"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style="background:var(--c-surface2); border-color:var(--c-border)"
        >
          <div class="flex items-center gap-3">
            <span class="text-[1.6rem]">📡</span>
            <div>
              <div class="text-base font-bold leading-snug" style="color:var(--c-accent)">npm 源码地图泄露扫描仪</div>
              <div class="text-[0.78rem] leading-snug" style="color:var(--c-text2)">npm Source Map Leak Scanner</div>
            </div>
          </div>
          <button
            class="flex items-center justify-center px-2 py-1 rounded text-base transition-colors hover:text-[var(--c-text)] hover:bg-[var(--c-border)]"
            style="background:none; border:none; color:var(--c-muted); cursor:pointer"
            @click="close"
            title="关闭 / Close"
          >✕</button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto flex flex-col gap-3 p-5">
          <!-- 项目简介 -->
          <div
            class="grid grid-cols-2 gap-4 px-3.5 py-3 rounded-lg border sm:grid-cols-2 grid-cols-1"
            style="background:var(--c-surface2); border-color:var(--c-border)"
          >
            <div class="notice-col">
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">🔍 什么是 map-leak?</h3>
              <p class="text-[0.78rem] leading-[1.65]" style="color:var(--c-text2)">
                本工具持续扫描 npm 注册表，识别 npm 包中意外发布的 <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.map</code> 文件。通过 Source Map，可还原出原始
                TypeScript / JavaScript 源代码，这意味着开发者的私有代码、密鑰检索逻辑、内部 API
                结构等可能已在无意间公开。
              </p>
            </div>
            <div class="notice-col">
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">🔍 What is map-leak?</h3>
              <p class="text-[0.78rem] leading-[1.65]" style="color:var(--c-text2)">
                This tool continuously scans the npm registry for packages that accidentally publish
                <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.map</code> files. Via Source Maps, original TypeScript / JavaScript source can be reconstructed —
                meaning private code, key retrieval logic, and internal API structures may be inadvertently exposed.
              </p>
            </div>
          </div>

          <!-- 工作原理 -->
          <div
            class="grid grid-cols-2 gap-4 px-3.5 py-3 rounded-lg border"
            style="background:var(--c-surface2); border-color:var(--c-border)"
          >
            <div>
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">⚙️ 工作原理</h3>
              <ul class="pl-[1.1em] flex flex-col gap-[5px]">
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">每 30 分钟轮询一次 npm 注册表最新发布包</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">下载 tarball，检测包含源路径映射的 <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.js.map</code> 文件</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">解析 <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">sourcesContent</code>，提取原始源文件</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">统计泄露规模、下载量及仓库公开程度并入库</li>
              </ul>
            </div>
            <div>
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">⚙️ How It Works</h3>
              <ul class="pl-[1.1em] flex flex-col gap-[5px]">
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">Polls the npm registry for new releases every 30 minutes</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">Downloads tarballs, detects <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.js.map</code> files with source path mappings</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">Parses <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">sourcesContent</code> to extract original source files</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)">Records leak size, weekly downloads, and repo visibility</li>
              </ul>
            </div>
          </div>

          <!-- 风险等级 -->
          <div
            class="grid grid-cols-2 gap-4 px-3.5 py-3 rounded-lg border"
            style="background:var(--c-surface2); border-color:var(--c-border)"
          >
            <div>
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">⚠️ 哪些包风险更高？</h3>
              <ul class="pl-[1.1em] flex flex-col gap-[5px]">
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)"><span class="font-semibold" style="color:var(--c-danger)">无 repo（闭源）</span> — 源码完全私有，泄露最敏感</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)"><span class="font-semibold" style="color:var(--c-warn)">私有仓库</span> — 仓库不公开，源码本应保密</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)"><span class="font-semibold" style="color:var(--c-ok)">开源项目</span> — 仓库公开，Source Map 影响较小</li>
              </ul>
            </div>
            <div>
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">⚠️ Risk Levels</h3>
              <ul class="pl-[1.1em] flex flex-col gap-[5px]">
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)"><span class="font-semibold" style="color:var(--c-danger)">No repo (closed)</span> — Fully private source, highest sensitivity</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)"><span class="font-semibold" style="color:var(--c-warn)">Private repo</span> — Non-public repository, source intended as private</li>
                <li class="text-[0.78rem] leading-[1.5]" style="color:var(--c-text2)"><span class="font-semibold" style="color:var(--c-ok)">Open source</span> — Public repo, Source Maps less impactful</li>
              </ul>
            </div>
          </div>

          <!-- 免责声明 -->
          <div
            class="grid grid-cols-2 gap-4 px-3.5 py-3 rounded-lg border"
            style="background:rgba(251,191,36,.04); border-color:rgba(251,191,36,.3)"
          >
            <div>
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">📋 免责声明</h3>
              <p class="text-[0.78rem] leading-[1.65]" style="color:var(--c-text2)">
                本工具仅用于合法安全研究与学术目的。所有扫描结果均来自 npm 公开 tarball，可通过 npm CLI
                自行验证。如您的包出现在结果中，建议于发布流程中移除 <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.map</code> 文件或在
                <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.npmignore</code> 中排除 Source Map。请勿将本工具用于未经授权的商业目的或恶意行为。
              </p>
            </div>
            <div>
              <h3 class="text-[0.78rem] font-semibold mb-2 tracking-wide" style="color:var(--c-accent)">📋 Disclaimer</h3>
              <p class="text-[0.78rem] leading-[1.65]" style="color:var(--c-text2)">
                This tool is intended for legitimate security research and academic purposes only. All scan results
                originate from publicly available npm tarballs, verifiable via the npm CLI. If your package appears in
                results, we recommend removing <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.map</code> files from your publish pipeline or excluding them via
                <code class="font-mono text-[0.73rem] px-[5px] py-[1px] rounded" style="background:rgba(56,189,248,.12); color:var(--c-accent)">.npmignore</code>. Do not use this tool for unauthorized commercial purposes or malicious
                activities.
              </p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between gap-3 px-5 py-3 border-t shrink-0 flex-wrap"
          style="background:var(--c-surface2); border-color:var(--c-border)"
        >
          <label class="flex items-center gap-[7px] text-[0.78rem] cursor-pointer select-none" style="color:var(--c-text2)">
            <input type="checkbox" v-model="neverAgain" class="w-3.5 h-3.5 cursor-pointer" style="accent-color:var(--c-accent)" />
            <span>不再显示 / Don't show again</span>
          </label>
          <button
            class="shrink-0 rounded-md px-[18px] py-[7px] text-[0.8rem] font-bold whitespace-nowrap transition-opacity hover:opacity-85"
            style="background:var(--c-accent); color:#070e1c; border:none; cursor:pointer"
            @click="confirm"
          >我已了解，开始探索 &nbsp;/&nbsp; Got it, Let's go</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from "vue";

const emit = defineEmits(["close"]);

const neverAgain = ref(false);
const overlayRef = ref(null);

onMounted(() => overlayRef.value?.focus());

function close()   { emit("close", false); }
function confirm() { emit("close", neverAgain.value); }
</script>

