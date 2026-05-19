<template>
  <div v-if="visible" class="panel-overlay">
    <div class="panel-content">
      <!-- Header -->
      <div class="panel-header">
        <h2>列头对照 — {{ rule?.sheetName || '' }}</h2>
        <span class="sheet-names" v-if="rule?.sheetName && rule?.outputSheetName">
          {{ rule?.sheetName }} → {{ rule?.outputSheetName }}
        </span>
        <button class="close-btn" @click="cancel">×</button>
      </div>

      <div class="panel-body">
        <div v-if="!preloadedData" class="loading-state">
          <p>⏳ 请先点击"预读取所有标题行"</p>
        </div>

        <div v-else class="panel-main">
          <!-- 状态栏 -->
          <div class="stats-bar">
            <span class="stat-item">📋 {{ totalDeletedCount }} 列已删</span>
            <span class="stat-item">📄 {{ sources.length }} 个分表</span>
            <span v-if="totalMappedCount > 0" class="stat-item" style="color:#1890ff">
              🔗 {{ totalMappedCount }} 个别名映射
            </span>
            <span v-if="hiddenDateColCount > 0" class="stat-item stat-hint">
              🗓️ 已隐藏 {{ hiddenDateColCount }} 列日期
            </span>
          </div>

          <!-- 对照表 -->
          <div class="table-scroll">
            <table class="compare-table">
              <thead>
                <tr>
                  <th class="row-label"></th>
                  <th v-for="col in displayColumns" :key="col.pos" class="col-header">
                    {{ col.letter }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- 总表行 -->
                <tr class="tpl-row">
                  <td class="row-label tpl-label">📌 总表</td>
                  <td v-for="col in displayColumns" :key="'tpl-'+col.pos"
                    :class="['cell', 'cell-tpl', { 'cell-empty': !col.template }]">
                    {{ displayText(col.template, '—') }}
                  </td>
                </tr>

                <!-- 每个分表一行 -->
                <tr v-for="src in alignedSources" :key="src.file"
                  :class="['src-row', { 'src-row-dirty': src.deletedCount > 0 }]">
                  <td class="row-label src-label" :title="src.file">
                    <span class="src-name">{{ src.displayName }}</span>
                    <span v-if="src.deletedCount > 0" class="src-del-badge">-{{ src.deletedCount }}</span>
                  </td>
                  <td v-for="col in displayColumns" :key="src.file+'-'+col.pos"
                    :class="['cell', 'cell-src', {
                      'cell-empty': !col.sourceMap[src.file],
                      'cell-mismatch': col.sourceMap[src.file] && col.sourceMap[src.file] !== col.template,
                      'cell-mapped': isMapped(src.file, col.pos)
                    }]"
                    @click.stop="openCellMenu($event, src, col)"
                    :title="col.sourceMap[src.file] ? '点击操作此列' : ''">
                    <template v-if="col.sourceMap[src.file]">
                      <span v-if="isMapped(src.file, col.pos)" class="map-arrow">⇢</span>
                      {{ displayText(col.sourceMap[src.file], '') }}
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 列操作弹出菜单 -->
      <div v-if="showMenu && menuCell" class="cell-menu-overlay" @click.self="closeMenu">
        <div class="cell-menu">
          <div class="menu-header">
            <span class="menu-src-header">{{ menuCell.header }}</span>
            <span class="menu-file-name">({{ menuCell.displayName }})</span>
          </div>
          <div class="menu-tpl-ref">
            总表对应: <strong>{{ menuCell.templateHeader || '—' }}</strong>
          </div>

          <div class="menu-actions">
            <!-- 删除 -->
            <button
              :class="['menu-btn', { 'menu-btn-active': menuCell.isDeleted }]"
              @click="deleteFromMenu"
            >
              {{ menuCell.isDeleted ? '↩ 撤销删除' : '✕ 删除此列' }}
            </button>

            <!-- 自动映射到对应总表列 -->
            <button
              v-if="menuCell.templateHeader && menuCell.header !== menuCell.templateHeader"
              :class="['menu-btn', { 'menu-btn-mapped': !!menuCell.mappedTo }]"
              @click="autoMapFromMenu"
            >
              {{ menuCell.mappedTo ? '↩ 撤销映射' : '↔ 自动映射到对应总表列' }}
            </button>
            <div v-if="menuCell.mappedTo" class="menu-map-info">
              {{ menuCell.header }} → <strong>{{ menuCell.mappedTo }}</strong>
            </div>
          </div>

          <button class="menu-close-btn" @click="closeMenu">关闭</button>
        </div>
      </div>

      <!-- Footer -->
      <div class="panel-footer">
        <button class="btn-secondary" @click="resetAll" :disabled="totalDeletedCount === 0 && totalMappedCount === 0">
          恢复全部
        </button>
        <div class="spacer"></div>
        <button class="btn-secondary" @click="cancel">取消</button>
        <button class="btn-primary" @click="confirm" :disabled="!preloadedData">确认保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  visible: { type: Boolean, default: false },
  rule: { type: Object, default: null },
  preloadedData: { type: Object, default: null },
  initialRemoveColumns: { type: Array, default: () => [] },
  initialColumnAliasMap: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["confirm", "cancel"]);

// ─── State ────────────────────────────────────────
const perFileRemoved = ref(new Map());
const aliasMapping = ref({});
const showMenu = ref(false);
const menuCell = ref(null);

// ─── Derived ──────────────────────────────────────
const templateHeaders = computed(() => props.preloadedData?.templateHeaders || []);
const sources = computed(() => props.preloadedData?.sources || []);

/**
 * 对齐总表和分表：跳过已删除列，左移填充 null
 */
const alignedSources = computed(() => {
  const tplLen = templateHeaders.value.length;
  return sources.value.map((s) => {
    const removed = perFileRemoved.value.get(s.file) || new Set();
    const shifted = [];
    const origPosMap = [];
    for (let j = 0; j < s.headers.length; j++) {
      if (removed.has(j)) continue;
      shifted.push(s.headers[j]);
      origPosMap.push(j);
    }
    const padded = [];
    for (let i = 0; i < tplLen; i++) {
      padded.push(i < shifted.length ? shifted[i] : null);
    }
    return {
      file: s.file,
      displayName: s.displayName || s.file,
      rawHeaders: s.headers,
      headers: padded,
      origPosMap,
      deletedCount: removed.size,
      removed,
    };
  });
});

/**
 * 列定义：基于总表列头，跳过日期列
 */
const displayColumns = computed(() => {
  const tpl = templateHeaders.value;
  const aSources = alignedSources.value;
  const cols = [];
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] && /^\d{2}-\d{2}$/.test(tpl[i])) continue;
    const sourceMap = {};
    for (const src of aSources) {
      sourceMap[src.file] = i < src.headers.length ? src.headers[i] : null;
    }
    cols.push({
      pos: i,
      letter: String.fromCharCode(65 + i),
      template: tpl[i],
      sourceMap,
    });
  }
  return cols;
});

const hiddenDateColCount = computed(() => {
  return templateHeaders.value.filter((h) => h && /^\d{2}-\d{2}$/.test(h)).length;
});

const totalDeletedCount = computed(() => {
  let count = 0;
  for (const val of perFileRemoved.value.values()) count += val.size;
  return count;
});

const totalMappedCount = computed(() => {
  return Object.keys(aliasMapping.value).length;
});

// ─── 菜单辅助 ──────────────────────────────────
function isMapped(fileId, displayPos) {
  const src = alignedSources.value.find((s) => s.file === fileId);
  if (!src) return false;
  const origPos = src.origPosMap[displayPos];
  const rawHeader = origPos !== undefined && origPos < src.rawHeaders.length
    ? src.rawHeaders[origPos] : null;
  return rawHeader && aliasMapping.value[rawHeader] ? true : false;
}

function openCellMenu(event, src, col) {
  const origPos = src.origPosMap[col.pos] ?? col.pos;
  const rawHeader = origPos < src.rawHeaders.length ? src.rawHeaders[origPos] : null;
  const isDeleted = (perFileRemoved.value.get(src.file) || new Set()).has(origPos);
  const mappedTo = rawHeader ? (aliasMapping.value[rawHeader] || '') : '';

  menuCell.value = {
    fileId: src.file,
    displayName: src.displayName,
    origPos,
    header: rawHeader,
    templateHeader: col.template,
    isDeleted,
    mappedTo,
  };

  showMenu.value = true;
}

function closeMenu() {
  showMenu.value = false;
  menuCell.value = null;
}

function deleteFromMenu() {
  if (!menuCell.value) return;
  const { fileId, origPos, isDeleted } = menuCell.value;
  const next = new Map(perFileRemoved.value);
  if (!next.has(fileId)) next.set(fileId, new Set());
  const fileSet = new Set(next.get(fileId));
  if (isDeleted) {
    fileSet.delete(origPos);
  } else {
    fileSet.add(origPos);
    // 删除时自动取消该列的别名映射
    if (menuCell.value.header && aliasMapping.value[menuCell.value.header]) {
      aliasMapping.value = { ...aliasMapping.value };
      delete aliasMapping.value[menuCell.value.header];
    }
  }
  if (fileSet.size === 0) next.delete(fileId);
  else next.set(fileId, fileSet);
  perFileRemoved.value = next;
  menuCell.value = { ...menuCell.value, isDeleted: !isDeleted, mappedTo: isDeleted ? menuCell.value.mappedTo : '' };
}

function autoMapFromMenu() {
  if (!menuCell.value || !menuCell.value.header || !menuCell.value.templateHeader) return;
  const { header, templateHeader, fileId, origPos, mappedTo } = menuCell.value;

  if (mappedTo) {
    const next = { ...aliasMapping.value };
    delete next[header];
    aliasMapping.value = next;
    menuCell.value = { ...menuCell.value, mappedTo: '' };
    return;
  }

  const next = { ...aliasMapping.value };
  next[header] = templateHeader;
  aliasMapping.value = next;

  // 映射时自动取消该列的删除
  const removed = new Map(perFileRemoved.value);
  if (removed.has(fileId)) {
    const fileSet = new Set(removed.get(fileId));
    if (fileSet.has(origPos)) {
      fileSet.delete(origPos);
      if (fileSet.size === 0) removed.delete(fileId);
      else removed.set(fileId, fileSet);
      perFileRemoved.value = removed;
    }
  }

  menuCell.value = { ...menuCell.value, mappedTo: templateHeader, isDeleted: false };
}

// ─── 批量操作 ──────────────────────────────────
function resetAll() {
  perFileRemoved.value = new Map();
  aliasMapping.value = {};
}

function initFromProps() {
  const perFile = new Map();
  const removeSet = new Set(
    (props.initialRemoveColumns || []).map((h) => String(h || "").replace(/\s+/g, "").trim()).filter(Boolean)
  );
  if (removeSet.size > 0 && props.preloadedData) {
    for (const s of props.preloadedData.sources || []) {
      const fileSet = new Set();
      for (let i = 0; i < s.headers.length; i++) {
        const h = s.headers[i];
        if (h && removeSet.has(String(h).replace(/\s+/g, "").trim())) {
          fileSet.add(i);
        }
      }
      if (fileSet.size > 0) perFile.set(s.file, fileSet);
    }
  }
  perFileRemoved.value = perFile;
  aliasMapping.value = { ...(props.initialColumnAliasMap || {}) };
}

watch(() => props.visible, (show) => {
  if (show) initFromProps();
});

function confirm() {
  const removedNames = new Set();
  for (const [fileId, positions] of perFileRemoved.value) {
    const src = sources.value.find((s) => s.file === fileId);
    if (!src) continue;
    for (const pos of positions) {
      const h = pos < src.headers.length ? src.headers[pos] : null;
      if (h) removedNames.add(h);
    }
  }
  emit("confirm", {
    removeColumnsByHeader: [...removedNames],
    columnAliasMap: { ...aliasMapping.value },
  });
}

function cancel() {
  emit("cancel");
}

function displayText(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  const str = String(val);
  return str.length > 50 ? str.slice(0, 47) + '...' : str;
}
</script>

<style scoped>
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.panel-content {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  width: 94%;
  max-width: 1200px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e5e5;
  flex-shrink: 0;
}

.panel-header h2 { margin: 0; font-size: 15px; font-weight: 600; }
.sheet-names { margin-left: 10px; font-size: 12px; color: #888; }

.close-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #999;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.close-btn:hover { background: #f0f0f0; color: #333; }

.panel-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.loading-state { text-align: center; padding: 60px 0; color: #999; font-size: 14px; }
.panel-main { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

.stats-bar {
  display: flex;
  gap: 16px;
  padding: 10px 20px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
  font-size: 13px;
  flex-shrink: 0;
}
.stat-item { color: #555; }
.stat-hint { color: #d48806; }

.table-scroll {
  flex: 1;
  overflow: auto;
  overflow-x: auto;
  overflow-y: auto;
  padding: 0 20px;
}

.compare-table {
  border-collapse: collapse;
  font-size: 13px;
  width: auto;
  min-width: 100%;
}

.compare-table .row-label {
  width: 150px;
  min-width: 150px;
  max-width: 150px;
  text-align: left;
  font-weight: 500;
  font-size: 12px;
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
}

.col-header {
  padding: 6px 8px;
  border-bottom: 2px solid #d0d0d0;
  font-weight: 600;
  font-size: 13px;
  text-align: center;
  background: #f7f8fa;
  position: sticky;
  top: 0;
  z-index: 1;
  white-space: nowrap;
}

.cell {
  padding: 5px 6px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

.cell-tpl { background: #f7f8fa; font-weight: 500; color: #333; }
.cell-src { color: #444; cursor: pointer; }
.cell-src:hover { background: #e6f7ff; }
.cell-empty { color: #ddd; font-style: italic; cursor: default; }
.cell-empty:hover { background: transparent; }
.cell-mismatch { background: #fff1f0 !important; color: #cf1322; }
.cell-mapped { background: #e6f7ff !important; color: #1890ff; }

.tpl-row .row-label { background: #f0f2f5; font-weight: 600; color: #333; font-size: 12px; }
.src-row .row-label { font-size: 11px; color: #666; overflow: hidden; text-overflow: ellipsis; }
.src-row-dirty .row-label { background: #fffbe6; }
.src-name { vertical-align: middle; }

.src-del-badge {
  display: inline-block;
  margin-left: 4px;
  background: #cf1322;
  color: #fff;
  font-size: 10px;
  line-height: 1.4;
  padding: 0 5px;
  border-radius: 8px;
  vertical-align: middle;
}

.map-arrow { font-size: 11px; margin-right: 2px; }

.cell-menu-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2000;
  background: transparent;
}

.cell-menu {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.18);
  padding: 18px 20px;
  min-width: 280px;
  max-width: 380px;
  z-index: 2100;
}

.menu-header {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  word-break: break-all;
}

.menu-file-name {
  font-size: 12px;
  font-weight: 400;
  color: #888;
  margin-left: 6px;
}

.menu-tpl-ref {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.menu-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-btn {
  padding: 6px 14px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  background: #fff;
  color: #333;
  text-align: center;
  transition: all .15s;
}
.menu-btn:hover { border-color: #0078d4; color: #0078d4; }
.menu-btn-active {
  background: #fff1f0;
  color: #cf1322;
  border-color: #ffa39e;
}
.menu-btn-active:hover { background: #ffccc7; border-color: #cf1322; }

.menu-btn-mapped {
  background: #e6f7ff;
  color: #1890ff;
  border-color: #91d5ff;
}
.menu-btn-mapped:hover { background: #bae7ff; border-color: #1890ff; }

.menu-map-info {
  font-size: 12px;
  color: #1890ff;
  text-align: center;
  padding: 4px 0;
  background: #f0faff;
  border-radius: 4px;
}

.menu-close-btn {
  margin-top: 10px;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: #f5f5f5;
  color: #666;
  width: 100%;
  text-align: center;
}
.menu-close-btn:hover { background: #e8e8e8; }

.panel-footer {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  border-top: 1px solid #e5e5e5;
  background: #fafafa;
  gap: 8px;
  flex-shrink: 0;
}

.spacer { flex: 1; }

.btn-primary, .btn-secondary {
  padding: 6px 18px;
  border-radius: 4px;
  border: 1px solid #d0d0d0;
  font-size: 13px;
  cursor: pointer;
}
.btn-primary {
  background: #0078d4;
  color: #fff;
  border-color: #0078d4;
}
.btn-primary:hover:not(:disabled) { background: #106ebe; }
.btn-primary:disabled { background: #ccc; border-color: #ccc; cursor: not-allowed; }
.btn-secondary { background: #fff; color: #333; }
.btn-secondary:hover { background: #f0f0f0; }
.btn-secondary:disabled { color: #ccc; cursor: not-allowed; background: #fafafa; border-color: #e0e0e0; }
</style>
