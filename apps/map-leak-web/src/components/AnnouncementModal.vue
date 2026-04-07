<template>
  <Teleport to="body">
    <div class="notice-overlay" @click.self="close" @keydown.esc="close" tabindex="-1" ref="overlayRef">
      <div class="notice-box" role="dialog" aria-modal="true">
        <!-- 标题栏 Header -->
        <div class="notice-header">
          <div class="notice-title-row">
            <span class="notice-icon">📡</span>
            <div>
              <div class="notice-title-zh">npm 源码地图泄露扫描仪</div>
              <div class="notice-title-en">npm Source Map Leak Scanner</div>
            </div>
          </div>
          <button class="notice-close" @click="close" title="关闭 / Close">✕</button>
        </div>

        <!-- 双栏正文 Bilingual Content -->
        <div class="notice-body">
          <!-- 项目简介 -->
          <div class="notice-section">
            <div class="notice-col">
              <h3>🔍 什么是 map-leak?</h3>
              <p>
                本工具持续扫描 npm 注册表，识别 npm 包中意外发布的 <code>.map</code> 文件。通过 Source Map，可还原出原始
                TypeScript / JavaScript 源代码，这意味着开发者的私有代码、密钥检索逻辑、内部 API
                结构等可能已在无意间公开。
              </p>
            </div>
            <div class="notice-col">
              <h3>🔍 What is map-leak?</h3>
              <p>
                This tool continuously scans the npm registry for packages that accidentally publish
                <code>.map</code> files. Via Source Maps, original TypeScript / JavaScript source can be reconstructed —
                meaning private code, key retrieval logic, and internal API structures may be inadvertently exposed.
              </p>
            </div>
          </div>

          <!-- 工作原理 -->
          <div class="notice-section">
            <div class="notice-col">
              <h3>⚙️ 工作原理</h3>
              <ul>
                <li>每 30 分钟轮询一次 npm 注册表最新发布包</li>
                <li>下载 tarball，检测包含源路径映射的 <code>.js.map</code> 文件</li>
                <li>解析 <code>sourcesContent</code>，提取原始源文件</li>
                <li>统计泄露规模、下载量及仓库公开程度并入库</li>
              </ul>
            </div>
            <div class="notice-col">
              <h3>⚙️ How It Works</h3>
              <ul>
                <li>Polls the npm registry for new releases every 30 minutes</li>
                <li>Downloads tarballs, detects <code>.js.map</code> files with source path mappings</li>
                <li>Parses <code>sourcesContent</code> to extract original source files</li>
                <li>Records leak size, weekly downloads, and repo visibility</li>
              </ul>
            </div>
          </div>

          <!-- 风险等级 -->
          <div class="notice-section">
            <div class="notice-col">
              <h3>⚠️ 哪些包风险更高？</h3>
              <ul>
                <li><span class="tag-red">无 repo（闭源）</span> — 源码完全私有，泄露最敏感</li>
                <li><span class="tag-yellow">私有仓库</span> — 仓库不公开，源码本应保密</li>
                <li><span class="tag-green">开源项目</span> — 仓库公开，Source Map 影响较小</li>
              </ul>
            </div>
            <div class="notice-col">
              <h3>⚠️ Risk Levels</h3>
              <ul>
                <li><span class="tag-red">No repo (closed)</span> — Fully private source, highest sensitivity</li>
                <li>
                  <span class="tag-yellow">Private repo</span> — Non-public repository, source intended as private
                </li>
                <li><span class="tag-green">Open source</span> — Public repo, Source Maps less impactful</li>
              </ul>
            </div>
          </div>

          <!-- 免责声明 -->
          <div class="notice-section notice-disclaimer">
            <div class="notice-col">
              <h3>📋 免责声明</h3>
              <p>
                本工具仅用于合法安全研究与学术目的。所有扫描结果均来自 npm 公开 tarball，可通过 npm CLI
                自行验证。如您的包出现在结果中，建议于发布流程中移除 <code>.map</code> 文件或在
                <code>.npmignore</code> 中排除 Source Map。请勿将本工具用于未经授权的商业目的或恶意行为。
              </p>
            </div>
            <div class="notice-col">
              <h3>📋 Disclaimer</h3>
              <p>
                This tool is intended for legitimate security research and academic purposes only. All scan results
                originate from publicly available npm tarballs, verifiable via the npm CLI. If your package appears in
                results, we recommend removing <code>.map</code> files from your publish pipeline or excluding them via
                <code>.npmignore</code>. Do not use this tool for unauthorized commercial purposes or malicious
                activities.
              </p>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 Footer -->
        <div class="notice-footer">
          <label class="notice-no-more">
            <input type="checkbox" v-model="neverAgain" />
            <span>不再显示 / Don't show again</span>
          </label>
          <button class="notice-btn-primary" @click="confirm">我已了解，开始探索 &nbsp;/&nbsp; Got it, Let's go</button>
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

function close() {
  emit("close", false);
}
function confirm() {
  emit("close", neverAgain.value);
}
</script>

<style scoped>
.notice-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  outline: none;
}

.notice-box {
  background: var(--c-surface);
  border: 1px solid var(--c-border2);
  border-radius: 12px;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.6),
    var(--glow-blue);
  width: 100%;
  max-width: 900px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.notice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
  background: var(--c-surface2);
}
.notice-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.notice-icon {
  font-size: 1.6rem;
}
.notice-title-zh {
  font-size: 1rem;
  font-weight: 700;
  color: var(--c-accent);
  line-height: 1.3;
}
.notice-title-en {
  font-size: 0.78rem;
  color: var(--c-text2);
  line-height: 1.3;
}
.notice-close {
  background: none;
  border: none;
  color: var(--c-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
  transition:
    color 0.15s,
    background 0.15s;
}
.notice-close:hover {
  color: var(--c-text);
  background: var(--c-border);
}

/* ── Body ── */
.notice-body {
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.notice-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--c-surface2);
  border: 1px solid var(--c-border);
}
.notice-disclaimer {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.04);
}

.notice-col h3 {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--c-accent);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}
.notice-col p {
  font-size: 0.78rem;
  color: var(--c-text2);
  line-height: 1.65;
}
.notice-col ul {
  padding-left: 1.1em;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.notice-col li {
  font-size: 0.78rem;
  color: var(--c-text2);
  line-height: 1.5;
}
.notice-col code {
  font-family: ui-monospace, "JetBrains Mono", monospace;
  font-size: 0.73rem;
  background: rgba(56, 189, 248, 0.12);
  color: var(--c-accent);
  padding: 1px 5px;
  border-radius: 3px;
}

.tag-red {
  color: var(--c-danger);
  font-weight: 600;
}
.tag-yellow {
  color: var(--c-warn);
  font-weight: 600;
}
.tag-green {
  color: var(--c-ok);
  font-weight: 600;
}

/* ── Footer ── */
.notice-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border);
  background: var(--c-surface2);
  flex-shrink: 0;
}
.notice-no-more {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  color: var(--c-text2);
  cursor: pointer;
  user-select: none;
}
.notice-no-more input[type="checkbox"] {
  accent-color: var(--c-accent);
  width: 14px;
  height: 14px;
  cursor: pointer;
}
.notice-btn-primary {
  background: var(--c-accent);
  color: #070e1c;
  border: none;
  border-radius: 6px;
  padding: 7px 18px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}
.notice-btn-primary:hover {
  opacity: 0.85;
}

/* ── 响应式：窄屏堆叠 ── */
@media (max-width: 640px) {
  .notice-section {
    grid-template-columns: 1fr;
  }
  .notice-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .notice-btn-primary {
    text-align: center;
  }
}
</style>
