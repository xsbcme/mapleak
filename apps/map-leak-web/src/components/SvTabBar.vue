<template>
  <!-- 标签条外层容器 -->
  <div
    class="flex items-stretch shrink-0 border-b overflow-hidden"
    style="height:36px; border-color:var(--c-border); background:var(--c-surface)"
  >
    <!-- 左箭头 -->
    <button
      v-if="tabsOverflow"
      class="flex items-center justify-center w-[22px] min-w-[22px] h-full text-base border-r shrink-0 cursor-pointer transition-colors hover:text-[var(--c-accent)] hover:bg-[rgba(56,189,248,.06)]"
      style="background:transparent; border:none; border-right:1px solid var(--c-border); color:var(--c-muted)"
      @click="scrollTabs(-120)"
    >&#8249;</button>

    <!-- 标签滚动区域 -->
    <div
      ref="tabsEl"
      class="flex-1 flex items-stretch overflow-x-auto"
      style="scrollbar-width:none"
      @wheel.prevent="e => scrollTabs(e.deltaY > 0 ? 80 : -80)"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="sv-tab group shrink-0 flex items-center gap-1.5 px-2.5 h-full border-r text-[11px] font-mono cursor-pointer"
        :class="tab.id === activeTabId ? 'sv-tab-active' : 'hover:bg-white/[0.04]'"
        style="background:transparent; border-top:none; border-bottom:none; border-left:none; border-right-color:var(--c-border)"
        :data-tab-id="tab.id"
        @click="emit('switch', tab.id)"
        @contextmenu.prevent.stop="openMenu($event, tab.id)"
      >
        <!-- 语言色点 -->
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :style="tab.fileIdx < 0 ? 'background:#94b4d8' : 'background:' + extColor(tab.path)"
        />
        <!-- 标签名 -->
        <span
          class="truncate max-w-[120px]"
          :style="tab.id === activeTabId ? 'color:var(--c-accent)' : 'color:var(--c-text2)'"
        >{{ tab.label }}</span>
        <!-- 关闭按钮 -->
        <span
          class="ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded shrink-0 cursor-pointer transition-colors hover:bg-[rgba(244,63,94,.2)] hover:text-[var(--c-danger)]"
          style="color:var(--c-muted)"
          @click.stop="emit('close', tab.id)"
        >
          <svg width="7" height="7" viewBox="0 0 7 7" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="0" y1="0" x2="7" y2="7"/><line x1="7" y1="0" x2="0" y2="7"/>
          </svg>
        </span>
      </button>
    </div>

    <!-- 右箭头 -->
    <button
      v-if="tabsOverflow"
      class="flex items-center justify-center w-[22px] min-w-[22px] h-full text-base border-l shrink-0 cursor-pointer transition-colors hover:text-[var(--c-accent)] hover:bg-[rgba(56,189,248,.06)]"
      style="background:transparent; border:none; border-left:1px solid var(--c-border); color:var(--c-muted)"
      @click="scrollTabs(120)"
    >&#8250;</button>
  </div>

  <!-- 右键菜单（Teleport 到 body） -->
  <Teleport to="body">
    <template v-if="menu.show">
      <!-- 全屏透明遮罩 -->
      <div
        class="fixed inset-0 z-[99998]"
        @click="closeMenu"
        @contextmenu.prevent="closeMenu"
      />
      <!-- 菜单主体 -->
      <div
        class="sv-ctx-menu fixed z-[99999] min-w-[164px] py-1 rounded-lg border"
        :style="`top:${menu.y}px; left:${menu.x}px; background:var(--c-surface); border-color:var(--c-border); box-shadow:0 8px 24px rgba(0,0,0,.45)`"
        @click.stop
      >
        <!-- 关闭当前 -->
        <button class="ctx-item w-full flex items-center gap-2 px-3 py-[5px] text-[12px] text-left cursor-pointer transition-colors" style="background:transparent; border:none; color:var(--c-text2)" @click="doClose(menu.tabId)">
          <svg class="w-[13px] h-[13px] shrink-0 opacity-70" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
          {{ t('sv.tabClose') }}
        </button>
        <!-- 关闭左侧 -->
        <button class="ctx-item w-full flex items-center gap-2 px-3 py-[5px] text-[12px] text-left cursor-pointer transition-colors" style="background:transparent; border:none; color:var(--c-text2)" @click="doCloseLeft(menu.tabId)">
          <svg class="w-[13px] h-[13px] shrink-0 opacity-70" viewBox="0 0 16 16" fill="currentColor"><path d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/></svg>
          {{ t('sv.tabCloseLeft') }}
        </button>
        <!-- 关闭右侧 -->
        <button class="ctx-item w-full flex items-center gap-2 px-3 py-[5px] text-[12px] text-left cursor-pointer transition-colors" style="background:transparent; border:none; color:var(--c-text2)" @click="doCloseRight(menu.tabId)">
          <svg class="w-[13px] h-[13px] shrink-0 opacity-70" viewBox="0 0 16 16" fill="currentColor"><path d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/></svg>
          {{ t('sv.tabCloseRight') }}
        </button>
        <!-- 关闭其他 -->
        <button class="ctx-item w-full flex items-center gap-2 px-3 py-[5px] text-[12px] text-left cursor-pointer transition-colors" style="background:transparent; border:none; color:var(--c-text2)" @click="doCloseOthers(menu.tabId)">
          <svg class="w-[13px] h-[13px] shrink-0 opacity-70" viewBox="0 0 16 16" fill="currentColor"><path d="M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/><path d="M1.354 4.646a.5.5 0 1 0-.708.708L3.293 8 .646 10.646a.5.5 0 0 0 .708.708L4 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L4.707 8 7.354 5.354a.5.5 0 0 0-.708-.708L4 7.293 1.354 4.646z"/></svg>
          {{ t('sv.tabCloseOthers') }}
        </button>
        <div class="my-1 h-px" style="background:var(--c-border)" />
        <!-- 关闭全部（危险色） -->
        <button class="ctx-item ctx-item-danger w-full flex items-center gap-2 px-3 py-[5px] text-[12px] text-left cursor-pointer transition-colors" style="background:transparent; border:none" @click="doCloseAll()">
          <svg class="w-[13px] h-[13px] shrink-0 opacity-70" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
          {{ t('sv.tabCloseAll') }}
        </button>
      </div>
    </template>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { extColor } from "../utils/format.js";

const { t } = useI18n();

const props = defineProps({
  tabs:        { type: Array,          required: true },
  activeTabId: { type: [Number, null], default: null  },
});

const emit = defineEmits(["switch", "close", "close-left", "close-others", "close-right", "close-all"]);

// ── 溢出检测 + 滚动
const tabsEl       = ref(null);
const tabsOverflow = ref(false);

function checkTabsOverflow() {
  const el = tabsEl.value;
  if (el) tabsOverflow.value = el.scrollWidth > el.clientWidth;
}
function scrollTabs(delta) {
  const el = tabsEl.value;
  if (el) el.scrollLeft = Math.max(0, el.scrollLeft + delta);
}
function scrollTabIntoView(tabId) {
  nextTick(() => {
    const el = tabsEl.value;
    if (!el) return;
    const btn = el.querySelector(`[data-tab-id="${tabId}"]`);
    if (btn) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
    checkTabsOverflow();
  });
}

watch(() => props.activeTabId, id => { if (id != null) scrollTabIntoView(id); });
watch(() => props.tabs, () => nextTick(checkTabsOverflow), { deep: true });

// ── 右键菜单
const menu = reactive({ show: false, x: 0, y: 0, tabId: null });

function openMenu(e, tabId) {
  menu.x     = Math.min(e.clientX, window.innerWidth  - 172);
  menu.y     = Math.min(e.clientY, window.innerHeight - 196);
  menu.tabId = tabId;
  menu.show  = true;
}
function closeMenu() { menu.show = false; }

function onKeydown(e) { if (e.key === "Escape" && menu.show) closeMenu(); }
document.addEventListener("keydown", onKeydown);
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));

function doClose(id)       { emit("close",        id); closeMenu(); }
function doCloseLeft(id)   { emit("close-left",   id); closeMenu(); }
function doCloseOthers(id) { emit("close-others", id); closeMenu(); }
function doCloseRight(id)  { emit("close-right",  id); closeMenu(); }
function doCloseAll()      { emit("close-all");        closeMenu(); }
</script>

<style scoped>
/* webkit 浏览器隐藏滚动条（scrollbar-width:none 已内联处理 Firefox） */
.flex-1::-webkit-scrollbar { display: none; }

/* 活跃标签底部蓝色线 */
.sv-tab-active {
  background: rgba(56, 189, 248, 0.07);
  border-bottom: 2px solid var(--c-accent) !important;
}

/* 右键菜单淡入 */
.sv-ctx-menu {
  animation: ctx-in 0.1s ease both;
}
@keyframes ctx-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to   { opacity: 1; transform: scale(1)   translateY(0); }
}

/* 菜单项悬停 */
.ctx-item:hover {
  background: rgba(56, 189, 248, 0.08);
  color: var(--c-text) !important;
}
.ctx-item-danger       { color: var(--c-muted) !important; }
.ctx-item-danger:hover { background: rgba(244, 63, 94, 0.1) !important; color: var(--c-danger) !important; }
</style>
