<template>
  <Teleport to="body">
    <!-- 背景遮罩：非全屏时存在，点击关闭弹窗 -->
    <div v-if="!fullscreen" class="sv-backdrop" @click="emit('close')" />
    <div :class="fullscreen ? 'source-viewer-fullscreen' : 'source-viewer-modal'" style="background: var(--c-bg)">
      <!-- ── 顶栏 ──────────────────────────────────────────────── -->
      <div class="flex items-center gap-2 px-3 shrink-0 border-b"
        style="height: 40px; border-color: var(--c-border); background: var(--c-surface)">
        <!-- 工程模式图标 -->
        <svg v-if="isProjectMode" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
          :title="t('sv.projectTitle')" style="color: var(--c-accent); flex-shrink: 0">
          <path
            d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
          style="color: var(--c-accent); flex-shrink: 0">
          <path
            d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm1 3v1h6V5H5zm0 2.5v1h6v-1H5zm0 2.5v1h4v-1H5z" />
        </svg>

        <!-- 工程模式：标题 -->
        <template v-if="isProjectMode">
          <span class="text-[12px] font-mono font-semibold truncate flex-1" style="color: var(--c-text)">
            {{ props.finding?.name ?? ""
            }}<span style="color: var(--c-muted)">@{{ props.finding?.version ?? "" }}</span>
          </span>
          <span v-if="data" class="hidden sm:block text-[10px] px-2 py-0.5 rounded shrink-0"
            style="color: var(--c-muted); background: var(--c-surface2); border: 1px solid var(--c-border)">
            {{ t("sv.projectFiles", { n: data.total, m: data.mapCount }) }}
          </span>
          <!-- 是否包含第三方依赖切换 -->
          <button class="sv-btn shrink-0 text-[10px] px-2 py-0.5 rounded"
            :class="includeNodeModules ? 'sv-btn-active' : ''" :title="t('sv.includeDepsTooltip')" @click="
              includeNodeModules = !includeNodeModules;
            load();
            ">
            {{ t("sv.includeDeps") }}
          </button>
        </template>
        <!-- 单文件模式：.map 路径 -->
        <template v-else>
          <span class="text-[11px] font-mono truncate flex-1" style="color: var(--c-text2)">{{ mapFile }}</span>
          <span v-if="fullscreen && data" class="hidden sm:block text-[10px] px-2 py-0.5 rounded shrink-0"
            style="color: var(--c-muted); background: var(--c-surface2); border: 1px solid var(--c-border)">
            {{ data.name }}@{{ data.version }}
          </span>
        </template>

        <!-- 高亮加载指示 -->
        <span v-if="highlighting" class="flex items-center gap-1 text-[10px] shrink-0" style="color: var(--c-muted)">
          <svg class="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5">
            <path
              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {{ t("sv.highlighting") }}
        </span>

        <!-- 全屏切换 -->
        <button class="sv-btn" :class="{ 'sv-btn-active': fullscreen }"
          :title="fullscreen ? t('sv.fullscreenOff') : t('sv.fullscreenOn')" @click="toggleFullscreen">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path v-if="!fullscreen"
              d="M1.5 1h4v1.5h-2.5v2.5h-1.5v-4zm9 0h4v4h-1.5v-2.5h-2.5v-1.5zm-9 9h1.5v2.5h2.5v1.5h-4v-4zm10.5 2.5v-2.5h1.5v4h-4v-1.5h2.5z" />
            <path v-else
              d="M5.5 1.5v4h-4v-1.5h2.5v-2.5h1.5zm5 0h1.5v2.5h2.5v1.5h-4v-4zm-9 9h4v4h-1.5v-2.5h-2.5v-1.5zm9 0h4v1.5h-2.5v2.5h-1.5v-4z" />
          </svg>
        </button>

        <!-- 关闭 -->
        <button @click="emit('close')" class="sv-btn">✕</button>
      </div>

      <!-- ── 加载中（tarball 提取）──────────────────────────────── -->
      <div v-if="loading" class="flex flex-col items-center justify-center gap-2"
        style="flex: 1; color: var(--c-muted)">
        <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2">
          <path
            d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span class="text-xs">{{ loadingMsg }}</span>
      </div>

      <!-- ── 错误 ──────────────────────────────────────────────── -->
      <div v-else-if="error" class="flex flex-col items-center justify-center gap-2" style="flex: 1">
        <span class="text-xs" style="color: var(--c-danger)">{{ error }}</span>
        <button @click="load" class="ui-btn text-xs">{{ t("sv.retry") }}</button>
      </div>

      <!-- ── 主体：文件列表 + 代码区 ────────────────────────────── -->
      <div v-else-if="data" class="flex" style="flex: 1; min-height: 0; overflow: hidden">
        <!-- 左侧文件列表 -->
        <div class="flex flex-col shrink-0 border-r overflow-hidden" :style="sidebarOpen
          ? 'width:' + sidebarW + 'px; border-color:var(--c-border)'
          : 'width:28px; border-color:var(--c-border); transition:width 0.15s'
          ">
          <!-- 折叠态：仅显示展开按钮 -->
          <button v-if="!sidebarOpen" @click="sidebarOpen = true"
            class="flex-1 flex items-center justify-center w-full hover:opacity-80 transition-opacity"
            style="border: none; background: transparent; cursor: pointer; color: var(--c-muted)"
            :title="t('sv.expandFiles')">
            <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor">
              <path d="M0 0l6 5-6 5z" />
            </svg>
          </button>

          <template v-else>
            <!-- 工程模式：包信息条（description + 徽章）-->
            <div v-if="isProjectMode && props.finding"
              class="flex items-center gap-2 px-2 shrink-0 border-b overflow-hidden"
              style="height: 32px; border-color: var(--c-border); background: var(--c-surface2)">
              <span class="flex-1 truncate text-[10px]" style="color: var(--c-muted)"
                :title="props.finding.description">
                {{ props.finding.description || "—" }}
              </span>
              <span v-if="props.finding.weeklyDownloads > 0" class="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono"
                style="color: var(--c-muted); background: var(--c-surface); border: 1px solid var(--c-border)">
                ↓ {{ fmtDownloads(props.finding.weeklyDownloads) }}/w
              </span>
              <span class="shrink-0 text-[9px] px-1.5 py-0.5 rounded"
                :style="repoStatusStyle(props.finding.repoStatus)">
                {{ t("repo." + (props.finding.repoStatus ?? "unknown")) }}
              </span>
            </div>
            <div class="flex items-center gap-1 px-1.5 shrink-0 border-b"
              style="height: 34px; border-color: var(--c-border); background: var(--c-surface)">
              <span class="text-[10px] uppercase tracking-wide font-bold flex-1 truncate ml-0.5"
                style="color: var(--c-muted)">
                {{
                  fileSearch
                    ? t("sv.searchResult", { n: filteredFiles.length })
                    : t("sv.fileCount", { n: data.files.length })
                }}
              </span>
              <button @click="sidebarOpen = false" class="sv-btn sv-btn-icon" :title="t('sv.collapse')">
                <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor">
                  <path d="M6 0L0 5l6 5z" />
                </svg>
              </button>
              <template v-if="!fileSearch">
                <button @click="viewMode = 'flat'" class="sv-btn sv-btn-icon"
                  :class="{ 'sv-btn-active': viewMode === 'flat' }" :title="t('sv.flatList')">
                  &#8801;
                </button>
                <button @click="viewMode = 'tree'" class="sv-btn sv-btn-icon"
                  :class="{ 'sv-btn-active': viewMode === 'tree' }" :title="t('sv.treeView')">
                  &#8862;
                </button>
              </template>
              <button @click="downloadAll" class="sv-btn sv-btn-accent" :title="t('sv.downloadAll')">↓</button>
            </div>

            <!-- 搜索框 -->
            <div class="px-2 py-1.5 shrink-0 border-b"
              style="border-color: var(--c-border); background: var(--c-surface2)">
              <input v-model="fileSearch" type="text" class="sv-search-input" :placeholder="t('sv.searchFiles')" />
            </div>

            <div ref="sidebarEl" class="overflow-y-auto flex-1" @scroll.passive="onSidebarScroll">
              <!-- 平铺模式 / 搜索结果（虚拟滚动） -->
              <template v-if="fileSearch || viewMode === 'flat'">
                <div :style="'position:relative; height:' + sidebarVirtual.totalH + 'px'">
                  <div :style="'height:' + sidebarVirtual.topH + 'px'"></div>
                  <button v-for="file in sidebarVirtual.items" :key="file.origIdx" @click="openFile(file.origIdx)"
                    class="w-full text-left px-3 flex items-center gap-1.5 transition-colors" :style="activeTab?.fileIdx === file.origIdx
                      ? 'height:32px; border-bottom:1px solid rgba(30,58,98,.4); background:rgba(56,189,248,.08); border-left:2px solid var(--c-accent)'
                      : hasTab(file.origIdx)
                        ? 'height:32px; border-bottom:1px solid rgba(30,58,98,.4); background:rgba(56,189,248,.03); border-left:2px solid rgba(56,189,248,.35)'
                        : 'height:32px; border-bottom:1px solid rgba(30,58,98,.4); border-left:2px solid transparent'
                      ">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="'background:' + extColor(file.path)"></span>
                    <span class="flex-1 truncate text-[11px] font-mono min-w-0"
                      :style="activeTab?.fileIdx === file.origIdx ? 'color:var(--c-accent)' : 'color:var(--c-text2)'">
                      {{ baseName(file.path) }}
                    </span>
                    <!-- 搜索时显示父路径 -->
                    <span v-if="fileSearch" class="shrink-0 text-[9px] font-mono truncate max-w-[80px]"
                      style="color: var(--c-border2)" :title="file.path">
                      {{ parentPath(file.path) }}
                    </span>
                    <!-- 工程模式：来源 .map -->
                    <span v-else-if="isProjectMode && file.mapFile"
                      class="shrink-0 text-[9px] font-mono truncate max-w-[70px]" style="color: var(--c-border2)"
                      :title="file.mapFile">
                      {{ baseName(file.mapFile).replace(/\.js\.map$/, "") }}
                    </span>
                    <span class="shrink-0 text-[9px]" style="color: var(--c-muted)">{{ fmtBytes(file.bytes) }}</span>
                  </button>
                </div>
                <!-- 搜索空结果 -->
                <div v-if="!filteredFiles.length" class="flex flex-col items-center justify-center gap-2 py-8 px-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                    style="opacity:0.25; color:var(--c-muted)">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                    <path d="M11 8v6M8 11h6" />
                  </svg>
                  <span class="text-[11px] text-center" style="color:var(--c-muted)">{{ t('sv.noSearchResults') }}</span>
                </div>
              </template>
              <!-- 树形模式 -->
              <template v-else>
                <template v-for="node in visibleTreeNodes" :key="node.key">
                  <!-- 目录节点 -->
                  <button v-if="node.isDir" @click="toggleDir(node.key)"
                    class="w-full text-left flex items-center gap-1.5 transition-colors hover:bg-white/3"
                    :title="node.fullPath" :style="'height:28px; border-bottom:1px solid rgba(30,58,98,.25); padding-left:' +
                      (6 + Math.min(node.depth, 5) * 8) +
                      'px'
                      ">
                    <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"
                      style="flex-shrink: 0; color: var(--c-muted); transition: transform 0.15s"
                      :style="collapsedDirs.has(node.key) ? '' : 'transform:rotate(90deg)'">
                      <polygon points="0,0 8,4 0,8" />
                    </svg>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
                      style="flex-shrink: 0; color: var(--c-muted)">
                      <path d="M2 5h5l2 2h5v7H2z" />
                    </svg>
                    <span class="truncate text-[11px] font-mono" style="color: var(--c-text2)">{{ node.name }}</span>
                  </button>
                  <!-- 文件节点 -->
                  <button v-else @click="openFile(node.fileIdx)"
                    class="w-full text-left flex items-center gap-1.5 transition-colors" :title="node.fullPath" :style="activeTab?.fileIdx === node.fileIdx
                      ? 'height:28px; border-bottom:1px solid rgba(30,58,98,.25); background:rgba(56,189,248,.08); border-left:2px solid var(--c-accent); padding-left:' +
                      (4 + Math.min(node.depth, 5) * 8) +
                      'px'
                      : hasTab(node.fileIdx)
                        ? 'height:28px; border-bottom:1px solid rgba(30,58,98,.25); background:rgba(56,189,248,.03); border-left:2px solid rgba(56,189,248,.35); padding-left:' +
                        (4 + Math.min(node.depth, 5) * 8) +
                        'px'
                        : 'height:28px; border-bottom:1px solid rgba(30,58,98,.25); border-left:2px solid transparent; padding-left:' +
                        (4 + Math.min(node.depth, 5) * 8) +
                        'px'
                      ">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="'background:' + extColor(node.name)"></span>
                    <span class="flex-1 truncate text-[11px] font-mono min-w-0"
                      :style="activeTab?.fileIdx === node.fileIdx ? 'color:var(--c-accent)' : 'color:var(--c-text2)'">
                      {{ node.name }}
                    </span>
                  </button>
                </template>
                <!-- 树形搜索空结果 -->
                <div v-if="!visibleTreeNodes.length" class="flex flex-col items-center justify-center gap-2 py-8 px-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                    style="opacity:0.25; color:var(--c-muted)">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                    <path d="M11 8v6M8 11h6" />
                  </svg>
                  <span class="text-[11px] text-center" style="color:var(--c-muted)">{{ t('sv.noSearchResults') }}</span>
                </div>
              </template>
              <!-- README 入口：仅在有内容或正在加载时显示，排在文件列表末尾 -->
              <button v-if="readmeFetching || readmeHtml" @click="openReadme"
                class="w-full text-left px-3 flex items-center gap-1.5 transition-colors" :style="isReadmeActive
                  ? 'height:32px; border-bottom:1px solid rgba(30,58,98,.4); background:rgba(56,189,248,.08); border-left:2px solid var(--c-accent)'
                  : 'height:32px; border-bottom:1px solid rgba(30,58,98,.4); border-left:2px solid transparent'
                  ">
                <span class="text-[10px]" style="flex-shrink: 0">📖</span>
                <span class="flex-1 truncate text-[11px] font-mono"
                  :style="isReadmeActive ? 'color:var(--c-accent)' : 'color:var(--c-text2)'">README.md</span>
                <svg v-if="readmeFetching" class="animate-spin shrink-0" width="8" height="8" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--c-muted)">
                  <path
                    d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </button>
            </div>
          </template>
        </div>

        <!-- 拖拽调宽手柄 -->
        <div v-if="sidebarOpen" class="sv-resize-handle" @pointerdown.prevent="onResizeStart" />

        <!-- 右侧代码区 -->
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
          <!-- ── 标签栏 ────────────────────────────────── -->
          <SvTabBar v-if="tabs.length" :tabs="tabs" :active-tab-id="activeTabId" @switch="switchTab" @close="closeTab"
            @close-left="closeTabsToLeft" @close-others="closeOtherTabs" @close-right="closeTabsToRight"
            @close-all="closeAllTabs" />

          <!-- README 渲染区 -->
          <div v-if="isReadmeActive" class="flex-1 overflow-auto px-8 py-6 sv-readme" style="background: var(--c-bg)">
            <div v-if="readmeHtml" v-html="readmeHtml" />
            <div v-else-if="readmeFetching" class="flex items-center gap-2 text-xs" style="color: var(--c-muted)">
              <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              {{ t("sv.readmeLoading") }}
            </div>
            <div v-else class="text-xs" style="color: var(--c-muted)">{{ t("sv.readmeEmpty") }}</div>
          </div>

          <!-- 无文档打开时的空态 -->
          <div v-if="!activeTab && data && !loading"
            class="flex-1 flex flex-col items-center justify-center gap-2 text-xs select-none"
            style="color: var(--c-muted)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"
              style="opacity: 0.35">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
            <span>{{ t("sv.noTabOpen") }}</span>
          </div>

          <!-- 代码区标题栏 -->
          <div v-if="!isReadmeActive && activeFile" class="flex items-center gap-2 px-3 shrink-0 border-b"
            style="height: 34px; border-color: var(--c-border); background: var(--c-surface)">
            <!-- 语言徽章 -->
            <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0" :style="'background:' +
              extColor(activeFile.path) +
              '22; color:' +
              extColor(activeFile.path) +
              '; border:1px solid ' +
              extColor(activeFile.path) +
              '44'
              ">
              {{ fileExt(activeFile.path).toUpperCase() || "TXT" }}
            </span>
            <span class="text-[10px] font-mono truncate flex-1" style="color: var(--c-text2)">
              {{ activeFile.path }}
            </span>
            <!-- 工程模式：来源 .map 文件 -->
            <span v-if="isProjectMode && activeFile.mapFile"
              class="hidden sm:block shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded truncate max-w-[120px]"
              style="color: var(--c-muted); background: var(--c-surface2); border: 1px solid var(--c-border)"
              :title="t('sv.fromMap', { map: activeFile.mapFile })">
              {{ baseName(activeFile.mapFile) }}
            </span>
            <span class="shrink-0 text-[10px]" style="color: var(--c-muted)">
              {{ t("sv.lineCount", { n: codeLines.length.toLocaleString() }) }} · {{ fmtBytes(activeFile.bytes) }}
            </span>
            <button @click="downloadFile(activeFile)" class="sv-btn">{{ t("sv.download") }}</button>
          </div>

          <!-- 代码渲染区（虚拟滚动 + Shiki 高亮）-->
          <div v-if="!isReadmeActive" ref="codeEl" class="flex-1 overflow-auto" style="background: var(--c-bg)"
            @scroll.passive="onCodeScroll">
            <div v-if="activeFile" :style="'height:' + totalCodeHeight + 'px; position:relative'">
              <div :style="'height:' + codeVirtualTop + 'px'"></div>
              <table class="border-collapse" style="
                  width: 100%;
                  font-family: ui-monospace, &quot;JetBrains Mono&quot;, monospace;
                  font-size: 12px;
                  line-height: 1.65;
                ">
                <tbody>
                  <tr v-for="li in visibleLineIndices" :key="li" class="hover:bg-white/[.025]">
                    <!-- 行号 -->
                    <td class="select-none text-right pr-3 pl-2 sticky left-0" style="
                        width: 52px;
                        min-width: 52px;
                        color: var(--c-border2);
                        border-right: 1px solid var(--c-border);
                        background: var(--c-bg);
                        user-select: none;
                        vertical-align: top;
                      ">
                      {{ li + 1 }}
                    </td>
                    <!-- 代码（有 token 时渲染高亮 span，否则纯文本）-->
                    <td class="pl-3 pr-6" style="white-space: pre; vertical-align: top">
                      <template v-if="lineTokens.length > 0">
                        <span v-for="(tok, ti) in lineTokens[li] || []" :key="ti" :style="buildTokStyle(tok)">{{
                          tok.content
                        }}</span>
                      </template>
                      <span v-else :style="'color:' + defaultFg">{{ codeLines[li] ?? "" }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 截断提示 -->
          <div v-if="truncated" class="shrink-0 text-center text-[10px] py-1"
            style="color: var(--c-muted); background: var(--c-surface); border-top: 1px solid var(--c-border)">
            {{ t("sv.truncated", { n: MAX_LINES.toLocaleString() }) }}
          </div>
        </div>
      </div>

      <!-- ── 无内容 ─────────────────────────────────────────────── -->
      <div v-else class="flex-1 flex flex-col items-center justify-center gap-3" style="color: var(--c-muted)">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"
          style="opacity: 0.2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span class="text-xs">{{ t('sv.noContent') }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick, markRaw } from "vue";
import { useI18n } from "vue-i18n";
import { marked } from "marked";
import { fmtBytes, baseName, fileExt, normPath, parentPath, extColor } from "../utils/format.js";
import SvTabBar from "./SvTabBar.vue";

const { t } = useI18n();

const props = defineProps({
  id: { type: Number, default: null },
  mapFile: { type: String, default: "" },
  // 工程模式：传入整个 finding 对象（包含 name, version, leaks[]）
  finding: { type: Object, default: null },
});
const emit = defineEmits(["close"]);

// 是否工程视图模式
const isProjectMode = computed(() => !!props.finding);

// ── 状态 ────────────────────────────────────────────────────────────
const loading = ref(false);
const loadingMsg = ref("");
const error = ref("");
const data = ref(null);
const fullscreen = ref(false);
const readmeHtml = ref("");
const readmeFetching = ref(false);
const includeNodeModules = ref(false); // 工程视图：是否包含 node_modules/ 依赖

// shallowRef：Shiki token 数组很大，不需要深度响应式，避免性能损耗
const lineTokens = shallowRef([]); // ThemedToken[][]
const highlighting = ref(false);
const defaultFg = ref("#e8f1ff"); // 从 Shiki 主题读取的默认前景色

const MAX_LINES = 20000;

// ── 标签系统 ─────────────────────────────────────────────────────────
// Tab: { id, fileIdx (-1=README), label, path, scrollY }
const tabs = ref([]);
const activeTabId = ref(null);
let _tabId = 0;

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value) ?? null);
const activeIdx = computed(() => (activeTab.value && activeTab.value.fileIdx >= 0 ? activeTab.value.fileIdx : 0));
const isReadmeActive = computed(() => activeTab.value?.fileIdx === -1);

function hasTab(fileIdx) {
  return tabs.value.some(t => t.fileIdx === fileIdx);
}
function openFile(fileIdx) {
  const existing = tabs.value.find(t => t.fileIdx === fileIdx);
  if (existing) {
    switchTab(existing.id);
    return;
  }
  const file = data.value?.files?.[fileIdx];
  if (!file) return;
  const id = ++_tabId;
  tabs.value.push({ id, fileIdx, label: baseName(file.path), path: file.path, scrollY: 0 });
  switchTab(id);
}
function openReadme() {
  const existing = tabs.value.find(t => t.fileIdx === -1);
  if (existing) {
    switchTab(existing.id);
    return;
  }
  const id = ++_tabId;
  tabs.value.push({ id, fileIdx: -1, label: "README.md", path: "README.md", scrollY: 0 });
  switchTab(id);
}
function switchTab(id) {
  // 保存当前 tab 滚动位置
  const cur = activeTab.value;
  if (cur && cur.fileIdx >= 0 && codeEl.value) {
    cur.scrollY = codeEl.value.scrollTop;
  }
  activeTabId.value = id;
  // SvTabBar 内部监听 activeTabId 变化，自动滚入视窗
}
function closeTab(id) {
  const idx = tabs.value.findIndex(t => t.id === id);
  if (idx < 0) return;
  tabs.value.splice(idx, 1);
  if (activeTabId.value === id) {
    if (tabs.value.length > 0) {
      switchTab(tabs.value[Math.min(idx, tabs.value.length - 1)].id);
    } else {
      activeTabId.value = null;
    }
  }
}
function closeOtherTabs(id) {
  const keep = tabs.value.find(t => t.id === id);
  tabs.value = keep ? [keep] : [];
  if (activeTabId.value !== id) activeTabId.value = keep ? id : null;
}
function closeTabsToLeft(id) {
  const idx = tabs.value.findIndex(t => t.id === id);
  if (idx < 0) return;
  const removed = tabs.value.splice(0, idx);
  if (removed.some(t => t.id === activeTabId.value)) switchTab(id);
}
function closeTabsToRight(id) {
  const idx = tabs.value.findIndex(t => t.id === id);
  if (idx < 0) return;
  const removed = tabs.value.splice(idx + 1);
  if (removed.some(t => t.id === activeTabId.value)) switchTab(id);
}
function closeAllTabs() {
  tabs.value = [];
  activeTabId.value = null;
}

// ── 高亮缓存：避免切换回已访问文件时重复高亮 ─────────────────────────
// fileIdx → { tokens: ThemedToken[][], fg: string }
const highlightCache = new Map();

// ── 文件搜索 ─────────────────────────────────────────────────────────
const fileSearch = ref("");
const filteredFiles = computed(() => {
  if (!data.value?.files) return [];
  const q = fileSearch.value.trim().toLowerCase();
  if (!q) return data.value.files.map((f, i) => ({ ...f, origIdx: i }));
  return data.value.files.map((f, i) => ({ ...f, origIdx: i })).filter(f => f.path.toLowerCase().includes(q));
});

// ── 侧边栏虚拟滚动（平铺/搜索模式）─────────────────────────────────
const sidebarEl = ref(null);
const sidebarScrollY = ref(0);
const SIDEBAR_ITEM_H = 32;

function onSidebarScroll() {
  sidebarScrollY.value = sidebarEl.value?.scrollTop ?? 0;
}
const sidebarVirtual = computed(() => {
  const files = filteredFiles.value;
  const h = sidebarEl.value?.clientHeight ?? 400;
  const total = files.length;
  const start = Math.max(0, Math.floor(sidebarScrollY.value / SIDEBAR_ITEM_H) - 8);
  const end = Math.min(total, start + Math.ceil(h / SIDEBAR_ITEM_H) + 16);
  return {
    totalH: total * SIDEBAR_ITEM_H,
    topH: start * SIDEBAR_ITEM_H,
    items: files.slice(start, end),
  };
});

// ── Shiki 懒加载（单例，只初始化一次）────────────────────────────────
// 使用 shiki/bundle/web（78 种 web 语言子集）替代 shiki 全包，
// 声明 langs 后 Vite 只打包实际用到的语言 grammar，
// 避免 Fortran / SPARQL / 文言文 等 200+ 无关语言进入 bundle
let _hlPromise = null;

function ensureHighlighter() {
  if (_hlPromise) return _hlPromise;
  _hlPromise = (async () => {
    const { createHighlighter } = await import("shiki/bundle/web");
    return markRaw(
      await createHighlighter({
        themes: ["vitesse-dark"],
        langs: ["typescript", "tsx", "javascript", "jsx", "vue", "css", "scss", "less", "json", "html", "markdown"],
      })
    );
  })();
  return _hlPromise;
}

const EXT_TO_LANG = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  vue: "vue",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  json5: "json",
  html: "html",
  htm: "html",
  md: "markdown",
  mdx: "markdown",
};

// fileIdx 参数用于写入缓存
async function highlightFile(file, fileIdx) {
  lineTokens.value = [];
  if (!file) return;
  highlighting.value = true;

  const content = file.content ?? "";
  const lines = content.split("\n");
  const source = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES).join("\n") : content;
  const lang = EXT_TO_LANG[fileExt(file.path)] ?? "text";

  try {
    const hl = await ensureHighlighter();
    await nextTick(); // 让 UI 先响应，防止一帧内阻塞
    const result = hl.codeToTokens(source, { lang, theme: "vitesse-dark" });
    const fg = result.fg ?? "#e8f1ff";
    defaultFg.value = fg;
    lineTokens.value = result.tokens;
    highlightCache.set(fileIdx, { tokens: result.tokens, fg });
  } catch {
    lineTokens.value = []; // 降级为纯文本
  } finally {
    highlighting.value = false;
  }
}

// fontStyle 是位标志：1=italic, 2=bold, 4=underline
function buildTokStyle(tok) {
  let s = "color:" + (tok.color || defaultFg.value);
  if (tok.fontStyle & 1) s += "; font-style:italic";
  if (tok.fontStyle & 2) s += "; font-weight:700";
  if (tok.fontStyle & 4) s += "; text-decoration:underline";
  return s;
}

// ── 当前文件数据 ─────────────────────────────────────────────────────
const activeFile = computed(() =>
  activeTab.value && !isReadmeActive.value && data.value?.files ? (data.value.files[activeIdx.value] ?? null) : null
);

const codeLines = computed(() => {
  const lines = (activeFile.value?.content ?? "").split("\n");
  return lines.length > MAX_LINES ? lines.slice(0, MAX_LINES) : lines;
});

const truncated = computed(() => (activeFile.value?.content ?? "").split("\n").length > MAX_LINES);

// 标签切换 → 恢复缓存高亮 / 触发新高亮，并恢复滚动位置
watch(
  activeTab,
  (newTab, oldTab) => {
    if (!newTab || newTab.fileIdx < 0) {
      lineTokens.value = [];
      return;
    }
    if (oldTab?.id === newTab.id) return;

    const fi = newTab.fileIdx;
    const cached = highlightCache.get(fi);
    if (cached) {
      // 缓存命中：直接恢复，无需重新高亮
      lineTokens.value = cached.tokens;
      defaultFg.value = cached.fg;
    } else {
      lineTokens.value = [];
      const file = data.value?.files?.[fi];
      if (file) highlightFile(file, fi);
    }
    nextTick(() => {
      codeScrollY.value = newTab.scrollY ?? 0;
      if (codeEl.value) codeEl.value.scrollTop = newTab.scrollY ?? 0;
    });
  },
  { flush: "post" }
);

// ── 文件列表：平铺 / 树形 ─────────────────────────────────────────────
const sidebarOpen = ref(true);
// sidebarW：可拖拽调整的宽度（px），最小 120，最大 560
const SIDEBAR_MIN = 120;
const SIDEBAR_MAX = 560;
const sidebarW = ref(220);
const viewMode = ref("flat");
const collapsedDirs = ref(new Set());

// ── 侧边栏拖拽调宽 ────────────────────────────────────────────────────
function onResizeStart(e) {
  const startX = e.clientX;
  const startW = sidebarW.value;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  function onMove(ev) {
    const delta = ev.clientX - startX;
    sidebarW.value = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + delta));
  }
  function onUp() {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function buildFileTree(files) {
  const insert = (parent, parts, fileIdx, depth, pathPrefix) => {
    const fullPath = pathPrefix + parts[0];
    if (parts.length === 1) {
      parent.push({ name: parts[0], isDir: false, fileIdx, depth, key: "file:" + fileIdx, fullPath });
      return;
    }
    const dirKey = "dir:" + fullPath;
    let dir = parent.find(n => n.key === dirKey);
    if (!dir) {
      dir = { name: parts[0], isDir: true, fileIdx: -1, depth, key: dirKey, fullPath, children: [] };
      parent.push(dir);
    }
    insert(dir.children, parts.slice(1), fileIdx, depth + 1, fullPath + "/");
  };
  const root = [];
  for (let i = 0; i < files.length; i++) {
    const p = normPath(files[i].path);
    const parts = p.split("/").filter(s => s && s !== "." && s !== "..");
    insert(root, parts.length > 0 ? parts : [baseName(files[i].path) || String(i)], i, 0, "");
  }
  return root;
}

function flattenVisible(nodes, result = []) {
  for (const node of nodes) {
    result.push(node);
    if (node.isDir && node.children && !collapsedDirs.value.has(node.key)) {
      flattenVisible(node.children, result);
    }
  }
  return result;
}

const fileTree = computed(() => (data.value ? buildFileTree(data.value.files) : []));
const visibleTreeNodes = computed(() => flattenVisible(fileTree.value));

function toggleDir(key) {
  const s = new Set(collapsedDirs.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  collapsedDirs.value = s;
}

// ── 虚拟滚动：代码行 ─────────────────────────────────────────────────
const codeEl = ref(null);
const codeScrollY = ref(0);
const LINE_H = 20; // 12px × 1.65 ≈ 20px

const totalCodeHeight = computed(() => codeLines.value.length * LINE_H);

const codeVirtualStart = computed(() => {
  const h = codeEl.value?.clientHeight ?? 600;
  return Math.max(0, Math.floor(codeScrollY.value / LINE_H) - 10);
});
const codeVirtualEnd = computed(() => {
  const h = codeEl.value?.clientHeight ?? 600;
  return Math.min(codeLines.value.length, codeVirtualStart.value + Math.ceil(h / LINE_H) + 20);
});
const codeVirtualTop = computed(() => codeVirtualStart.value * LINE_H);

// visibleLineIndices：只含当前可见行的绝对行索引，供 v-for 使用
const visibleLineIndices = computed(() => {
  const start = codeVirtualStart.value;
  const end = codeVirtualEnd.value;
  const result = [];
  for (let i = start; i < end; i++) result.push(i);
  return result;
});

function onCodeScroll() {
  codeScrollY.value = codeEl.value?.scrollTop ?? 0;
}

// ── 全屏 ─────────────────────────────────────────────────────────────
function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
  // 容器尺寸变化后强制虚拟滚动重新计算
  nextTick(() => {
    codeScrollY.value = codeEl.value?.scrollTop ?? 0;
  });
}

function onKeydown(e) {
  if (e.key === "Escape") {
    if (fullscreen.value) {
      fullscreen.value = false;
      nextTick(() => {
        codeScrollY.value = codeEl.value?.scrollTop ?? 0;
      });
    } else {
      emit("close"); // Esc 关闭弹窗
    }
  }
}

// ── 数据加载 ─────────────────────────────────────────────────────────
async function load() {
  loading.value = true;
  loadingMsg.value = t("sv.connecting");
  error.value = "";
  data.value = null;
  tabs.value = [];
  activeTabId.value = null;
  codeScrollY.value = 0;
  lineTokens.value = [];
  readmeHtml.value = "";
  highlightCache.clear();

  // 地址切换下载阶段提示
  const msgTimer = setTimeout(() => {
    loadingMsg.value = t("sv.downloading");
  }, 1_000);
  const msgTimer2 = setTimeout(() => {
    loadingMsg.value = t("sv.loadingLarge");
  }, 8_000);

  try {
    let res;
    if (isProjectMode.value) {
      // 工程模式：提取整个包的所有 .map 源码
      const name = props.finding.name ?? props.finding.package ?? "";
      const version = props.finding.version ?? "";
      const nm = includeNodeModules.value ? "&include_node_modules=1" : "";
      res = await fetch(
        `/api/extract-package?name=${encodeURIComponent(name)}&version=${encodeURIComponent(version)}${nm}`
      );
    } else {
      // 单文件模式
      res = await fetch("/api/extract/" + props.id);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.msg ?? json.error ?? "HTTP " + res.status);
    const d = json.data ?? json;
    data.value = d;
    if (d.readme) readmeHtml.value = marked.parse(d.readme);
    readmeFetching.value = false;
    clearTimeout(msgTimer);
    clearTimeout(msgTimer2);
    loadingMsg.value = t("sv.parsing");
    await nextTick();
    // 自动打开第一个文件
    if (d.files?.length) openFile(0);
  } catch (e) {
    clearTimeout(msgTimer);
    clearTimeout(msgTimer2);
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function fmtDownloads(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "k";
  return String(n);
}

const REPO_STYLES = {
  none: "color:#f43f5e; background:rgba(244,63,94,.1);  border:1px solid rgba(244,63,94,.25)",
  private: "color:#fbbf24; background:rgba(251,191,36,.1); border:1px solid rgba(251,191,36,.25)",
  "open-source": "color:#34d399; background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.25)",
  unknown: "color:#4d7099; background:rgba(77,112,153,.1);  border:1px solid rgba(77,112,153,.25)",
};
function repoStatusStyle(s) {
  return REPO_STYLES[s] ?? REPO_STYLES.unknown;
}

// ── 下载 ─────────────────────────────────────────────────────────────
function downloadFile(file) {
  const blob = new Blob([file.content], { type: "text/plain; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = baseName(file.path);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function downloadAll() {
  if (!data.value) return;
  const text = data.value.files.map(f => "// ===== " + f.path + " =====\n" + f.content).join("\n\n");
  const blob = new Blob([text], { type: "text/plain; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.value.name + "@" + data.value.version + "-sources.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── 工具 ─────────────────────────────────────────────────────────────
// baseName / fileExt / fmtBytes / normPath / parentPath 已从 utils/format.js 导入

// ── 生命周期 ──────────────────────────────────────────────────────────
onMounted(() => {
  load();
  document.addEventListener("keydown", onKeydown);
  document.body.style.overflow = "hidden"; // 打开弹窗时锁定页面滚动
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<style scoped>
.sv-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.55);
  cursor: default;
  animation: sv-backdrop-in 0.18s ease both;
}

@keyframes sv-backdrop-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* ── 文件搜索框 ──────────────────────────────────────────────────────── */
.sv-search-input {
  width: 100%;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-text);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  outline: none;
  transition: border-color 0.15s;
}

.sv-search-input:focus {
  border-color: var(--c-accent);
}

.sv-search-input::placeholder {
  color: var(--c-muted);
}

.source-viewer-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(92vw, 1280px);
  height: min(88vh, 900px);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--c-border);
  border-radius: 10px;
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.65);
  animation: sv-modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes sv-modal-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 16px)) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.source-viewer-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
  border-radius: 0;
}

/* README markdown prose 样式 */
.sv-readme {
  color: var(--c-text);
  font-size: 13px;
  line-height: 1.7;
  max-width: 860px;
}

.sv-readme h1,
.sv-readme h2,
.sv-readme h3,
.sv-readme h4 {
  color: var(--c-text);
  font-weight: 600;
  margin: 1.2em 0 0.4em;
}

.sv-readme h1 {
  font-size: 1.5em;
  border-bottom: 1px solid var(--c-border);
  padding-bottom: 0.3em;
}

.sv-readme h2 {
  font-size: 1.2em;
  border-bottom: 1px solid var(--c-border);
  padding-bottom: 0.2em;
}

.sv-readme h3 {
  font-size: 1.05em;
}

.sv-readme p {
  margin: 0.6em 0;
  color: var(--c-text2);
}

.sv-readme a {
  color: var(--c-accent);
  text-decoration: underline;
}

.sv-readme code {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  padding: 0.1em 0.4em;
  border-radius: 4px;
  background: var(--c-surface2);
  color: var(--c-warn);
}

.sv-readme pre {
  background: var(--c-surface2);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  padding: 1em;
  overflow-x: auto;
  margin: 0.8em 0;
}

.sv-readme pre code {
  background: none;
  padding: 0;
  color: var(--c-text);
}

.sv-readme ul,
.sv-readme ol {
  padding-left: 1.4em;
  margin: 0.5em 0;
  color: var(--c-text2);
}

.sv-readme li {
  margin: 0.2em 0;
}

.sv-readme blockquote {
  border-left: 3px solid var(--c-border2);
  padding-left: 0.8em;
  margin: 0.6em 0;
  color: var(--c-muted);
}

.sv-readme table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  font-size: 0.9em;
}

.sv-readme th,
.sv-readme td {
  border: 1px solid var(--c-border);
  padding: 0.4em 0.7em;
  text-align: left;
}

.sv-readme th {
  background: var(--c-surface2);
  color: var(--c-text);
}

.sv-readme img {
  max-width: 100%;
  border-radius: 4px;
}

.sv-readme hr {
  border: none;
  border-top: 1px solid var(--c-border);
  margin: 1em 0;
}

/* ── 侧边栏拖拽手柄 ─────────────────────────────────────────────────── */
.sv-resize-handle {
  width: 5px;
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 1;
  transition: background 0.1s;
}

.sv-resize-handle::after {
  content: "";
  position: absolute;
  inset: 0 -2px;
  /* 扩大热区 */
}

.sv-resize-handle:hover,
.sv-resize-handle:active {
  background: rgba(56, 189, 248, 0.35);
}
</style>
