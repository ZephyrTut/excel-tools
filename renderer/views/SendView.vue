<template>
  <div class="send-grid">
    <!-- 配置区 -->
    <el-card class="panel-card">
      <template #header><span>⚙️ 配置</span></template>
      <DependencyStatus
  :results="depResults"
  :installing="depInstalling"
  :progress-percent="depProgressPercent"
  :progress-message="depProgressMessage"
/>
      <el-form label-width="100px">
        <el-form-item label="SMTP 邮件">
          <el-tag v-if="smtpConfigured" type="success" size="small">已配置</el-tag>
          <el-tag v-else type="info" size="small">未配置</el-tag>
          <el-button text type="primary" size="small" style="margin-left: 8px" @click="showSmtpDialog = true">
            编辑
          </el-button>
        </el-form-item>
        <el-form-item label="规则模板">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 4px">
            <div
              class="drop-btn-wrapper"
              :class="{ 'drop-btn-wrapper--active': ruleDropActive }"
              @dragover.prevent="ruleDropActive = true"
              @dragenter.prevent="ruleDropActive = true"
              @dragleave="onRuleDragLeave"
              @drop.prevent="onRuleDrop"
            >
              <el-button size="small" @click="pickRuleFile">📥 导入规则表</el-button>
            </div>
            <el-tag v-if="rules.length > 0" type="success" size="small">已导入 {{ rules.length }} 条</el-tag>
            <el-tag v-else type="info" size="small">未导入</el-tag>
            <el-button size="small" text type="primary" @click="downloadTemplate">
              📋 下载空白模板
            </el-button>
            <el-button size="small" text @click="showRuleHelp = true" class="help-icon-btn" title="规则表使用说明">
              ❓
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="规则范围" v-if="rules.length > 0">
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap">
            <el-input-number v-model="ruleStartRow" :min="2" :max="9999" size="small" style="width: 95px" placeholder="起始行" controls-position="right" />
            <span>～</span>
            <el-input-number v-model="ruleEndRow" :min="2" :max="9999" size="small" style="width: 95px" placeholder="结束行" controls-position="right" />
            <el-text size="small" type="info">(留空=全部行，含表头行1)</el-text>
          </div>
        </el-form-item>
        <el-form-item label="辅助工具">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 4px">
            <div
              class="drop-btn-wrapper"
              :class="{ 'drop-btn-wrapper--active': toolsDropActive }"
              @dragover.prevent="toolsDropActive = true"
              @dragenter.prevent="toolsDropActive = true"
              @dragleave="onToolsDragLeave"
              @drop.prevent="onToolsDrop"
            >
              <el-button size="small" @click="pickFolderForCopy">📁 选取文件夹</el-button>
            </div>
            <el-button v-if="clipboardFiles.length > 0" size="small" text type="success" @click="copyFileNames">
              📋 一键复制 {{ clipboardFiles.length }} 个文件名
            </el-button>
            <el-text v-if="clipboardFiles.length > 0" size="small" type="info">
              已粘贴到剪贴板，可直接 Ctrl+V 粘贴到 Excel A 列
            </el-text>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 文件选择 + 匹配预览 -->
    <el-card class="panel-card">
      <template #header><span>📂 选择文件</span></template>
      <div
        class="drop-zone"
        :class="{ 'drop-zone--active': folderDropActive }"
        @dragover.prevent="folderDropActive = true"
        @dragenter.prevent="folderDropActive = true"
        @dragleave="onFolderDragLeave"
        @drop.prevent="onFolderDrop"
        style="margin-bottom: 12px"
      >
        <el-input v-model="folderPath" placeholder="拖拽文件夹到此处，或点击浏览选择">
          <template #append>
            <el-button @click="pickFolder">浏览</el-button>
          </template>
        </el-input>
      </div>

      <el-button size="small" type="primary" @click="refreshMatch" :disabled="!folderPath || rules.length === 0">
        🔄 刷新匹配
      </el-button>

      <div v-if="matchResult" style="margin-top: 12px">
        <div v-if="matchResult.error" class="send-error">{{ matchResult.error }}</div>

        <div v-if="matchResult.matched.length > 0" class="match-list">
          <div class="match-list-header">
            <el-checkbox v-model="selectAll" style="margin-right: 8px">
              <span style="font-weight: 600">全选</span>
              <span style="color: var(--text-muted); font-size: 12px; margin-left: 4px">{{ selectedCount }}/{{ matchResult.matched.length }}</span>
            </el-checkbox>
          </div>
          <div v-for="item in matchResult.matched" :key="item.originalName" class="match-item" :class="{ 'match-item--no-channel': item._noChannel }">
            <el-checkbox v-model="item.selected" @change="() => item._noChannel = false" style="margin-right: 8px" />
            <span class="match-filename">{{ item.originalName }}</span>
            <span class="match-arrow">→</span>
            <el-tag v-for="ch in (item.displayChannels || item.channels)" :key="ch" size="small" :type="ch === 'wechat' ? 'primary' : 'success'" style="margin-right: 4px">
              {{ ch === 'wechat' ? '📱 微信' : '📧 邮件' }}
            </el-tag>
            <el-tag v-for="ch in (item.missingChannels || item.rule?.strippedChannels || [])" :key="'sc-'+ch" size="small" type="warning" style="margin-right: 4px">
              {{ ch === 'wechat' ? '📱 微信' : '📧 邮件' }} (配置不全)
            </el-tag>
            <span v-if="item.channels.includes('wechat')" class="match-target">{{ item.rule.wechatGroup }}</span>
            <span v-if="item.channels.includes('email')" class="match-target">{{ item.rule.emailTo.join(', ') }}</span>
          </div>
        </div>

        <div v-if="matchResult.unmatched.length > 0" class="send-warning" style="margin-top: 8px">
          ⚠️ 未匹配 {{ matchResult.unmatched.length }} 个文件，将跳过：{{ matchResult.unmatched.join(', ') }}
        </div>
      </div>
    </el-card>

    <!-- 操作区 -->
    <el-card class="panel-card" v-if="matchResult && matchResult.matched.length > 0">
      <div class="action-bar">
        <el-button type="primary" @click="startSend('wechat')" :disabled="sending || wechatSelectedCount === 0">
          📱 仅微信 ({{ wechatSelectedCount }}项)
        </el-button>
        <el-button type="primary" @click="startSend('email')" :disabled="sending || emailSelectedCount === 0">
          📧 仅邮件 ({{ emailSelectedCount }}项)
        </el-button>
        <el-button type="primary" @click="startSend(null)" :disabled="sending || selectedCount === 0">
          📤 全部发送 ({{ selectedCount }}项)
        </el-button>
        <el-button v-if="sending" type="danger" @click="cancelSend" style="margin-left: 8px">
          ⏹ 中断发送
        </el-button>
        <el-text v-if="sending" size="small" type="info" style="margin-left: 8px">按 Ctrl+Shift+X 可中断</el-text>
      </div>
    </el-card>

    <!-- 发送历史 -->
    <el-card class="panel-card" v-if="history.length > 0">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span>📜 发送历史 ({{ history.length }})</span>
          <el-button text size="small" type="danger" @click="showClearAllDialog = true">清空全部</el-button>
        </div>
      </template>

      <div class="history-pagination" v-if="history.length > 1">
        <el-button size="small" :disabled="historyPage <= 0" @click="historyPage--">← 较新</el-button>
        <span class="history-page-info">{{ historyPage + 1 }} / {{ history.length }}</span>
        <el-button size="small" :disabled="historyPage >= history.length - 1" @click="historyPage++">较早 →</el-button>
      </div>

      <div v-if="currentHistoryEntry" class="history-batch">
        <div class="history-batch-title">
          <span class="history-date">{{ formatDate(currentHistoryEntry.date) }}</span>
          <span class="history-files">· {{ currentHistoryEntry.files.length }} 个文件: {{ currentHistoryEntry.files.join(', ') }}</span>
        </div>
        <div class="history-table-wrap">
          <el-table :data="historyGroupedRows" size="small" style="width: 100%; margin-bottom: 2px" max-height="240px">
            <el-table-column label="文件名" min-width="140">
              <template #default="{ row }">
                <span class="match-filename">{{ row.fileName }}</span>
              </template>
            </el-table-column>
            <el-table-column label="匹配状态">
              <template #default="{ row }">
                <el-tag v-for="t in row.tags" :key="t.type + t.status + tagName(t)" size="small" :type="tagType(t)" effect="plain" style="margin-right: 4px">
                  {{ tagLabel(t) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="history-batch-actions">
          <el-button text size="small" type="primary" @click="reuseHistory(currentHistoryEntry)">🔄 复用</el-button>
          <el-button text size="small" type="success" @click="echoHistory(currentHistoryEntry)">📋 回显</el-button>
          <el-popconfirm title="确定清空此批记录？" @confirm="clearSingleHistory(historyPage)">
            <template #reference>
              <el-button text size="small" type="danger">🗑 清空此批</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </el-card>

    <!-- 清空全部发送历史确认对话框 -->
    <el-dialog v-model="showClearAllDialog" title="清空全部发送历史" width="380px">
      <p>确定要清空全部 {{ history.length }} 条发送历史记录吗？此操作不可撤销。</p>
      <template #footer>
        <el-button @click="showClearAllDialog = false">取消</el-button>
        <el-button type="danger" @click="showClearAllDialog = false; clearHistory()">确定</el-button>
      </template>
    </el-dialog>

    <!-- 发送日志 -->
    <el-card class="panel-card" v-if="logs.length > 0">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span>📊 发送日志</span>
          <div>
            <el-button v-if="logs.length > 0" text size="small" type="danger" @click="clearLogs" style="margin-right: 4px">
              🗑 清空
            </el-button>
            <el-button v-if="sendResults.length > 0" text size="small" type="primary" @click="exportResults">
              📥 导出
            </el-button>
          </div>
        </div>
      </template>
      <el-progress v-if="sending" :percentage="sendProgress" :stroke-width="14" style="margin-bottom: 8px" />
      <div v-for="(log, idx) in logs" :key="idx" class="log-line" :class="'log-' + log.level">
        {{ logText(log) }}
      </div>
    </el-card>

    <!-- SMTP 配置弹窗 -->
    <el-dialog v-model="showSmtpDialog" title="配置发件邮箱" width="520px">
      <el-alert
        title="任何支持 SMTP 的邮箱都可以用（QQ邮箱、163、阿里邮箱、企业邮箱等）"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />

      <el-form label-width="90px">
        <el-form-item label="邮箱类型">
          <el-select v-model="smtpForm.provider" placeholder="选择你的邮箱" style="width: 100%" @change="onProviderChange">
            <el-option label="QQ 邮箱 (@qq.com)" value="qq" />
            <el-option label="163 邮箱 (@163.com)" value="163" />
            <el-option label="阿里邮箱 (@aliyun.com)" value="aliyun" />
            <el-option label="其他邮箱（手动填写）" value="other" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="smtpForm.provider === 'other'" label="服务器">
          <el-input v-model="smtpForm.host" placeholder="例如 smtp.exmail.qq.com" />
        </el-form-item>
        <el-form-item v-if="smtpForm.provider === 'other'" label="端口">
          <el-input-number v-model="smtpForm.port" :min="1" :max="65535" />
        </el-form-item>

        <el-form-item v-if="smtpForm.provider" label="邮箱地址">
          <el-input v-model="smtpForm.user" placeholder="你的邮箱地址，如 zhangsan@qq.com" />
        </el-form-item>

        <el-form-item v-if="smtpForm.provider" label="授权码">
          <el-input v-model="smtpForm.pass" type="password" show-password placeholder="不是邮箱密码，是 SMTP 授权码" />
          <template v-if="smtpForm.provider === 'qq'">
            <div class="smtp-help">
              💡 如何获取：QQ邮箱 → 设置 → 账号与安全 → 安全设置 → POP3/SMTP 服务 → 开启 → 生成授权码
            </div>
          </template>
          <template v-else-if="smtpForm.provider === '163'">
            <div class="smtp-help">
              💡 如何获取：163邮箱 → 设置 → POP3/SMTP/IMAP → 开启 SMTP → 新增授权码
            </div>
          </template>
          <template v-else-if="smtpForm.provider === 'aliyun'">
            <div class="smtp-help">
              💡 如何获取：阿里邮箱 → 设置 → 账户安全 → 生成三方客户端密码
            </div>
          </template>
          <template v-else-if="smtpForm.provider === 'other'">
            <div class="smtp-help">
              💡 授权码通常在邮箱设置的「客户端专用密码」或「SMTP 授权码」中生成
            </div>
          </template>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSmtpDialog = false">取消</el-button>
        <el-button type="primary" @click="saveSmtp" :disabled="!smtpForm.user || !smtpForm.pass">保存</el-button>
      </template>
    </el-dialog>

    <!-- 发送结果弹窗 -->
    <el-dialog v-model="showResultDialog" :title="sendAborted ? '⚠️ 发送已中断' : '📊 发送结果'" width="480px" :close-on-click-modal="false">
      <div class="result-summary" :class="resultFailCount > 0 ? 'result-summary--warn' : 'result-summary--ok'">
        <span class="result-summary-icon">{{ resultFailCount > 0 ? '⚠️' : '✅' }}</span>
        <span>成功 <b>{{ resultSuccessCount }}</b> 项</span>
        <span v-if="resultFailCount > 0" style="margin-left: 12px">失败 <b style="color: var(--danger)">{{ resultFailCount }}</b> 项</span>
      </div>
      <div class="result-list" v-if="sendResults.length > 0">
        <div v-for="(r, idx) in sendResults" :key="idx" class="result-item" :class="'result-item--' + (r.success ? 'ok' : 'fail')">
          <span class="result-icon">{{ r.success ? '✓' : '✗' }}</span>
          <span class="result-channel">{{ r.channel === 'wechat' ? '📱' : '📧' }}</span>
          <span class="result-target">{{ r.target }}</span>
          <span class="result-arrow">→</span>
          <span class="result-file">{{ r.originalName }}</span>
          <span v-if="!r.success && r.error" class="result-error">{{ r.error }}</span>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showResultDialog = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 规则说明弹窗 -->
    <el-dialog v-model="showRuleHelp" title="📋 规则表使用说明" width="600px">
      <p>规则表是一份 <b>Excel 文件</b>，每一行描述"哪个文件发给谁"。表头如下：</p>
      <table class="rule-template-table" style="width: 100%; margin: 12px 0">
        <thead><tr><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th><th>G</th></tr></thead>
        <tbody>
          <tr><td><b>文件名(原)</b></td><td><b>文件名(映射)</b></td><td><b>分发方式</b></td><td><b>微信群名</b></td><td><b>邮件主题</b></td><td><b>收件人</b></td><td><b>抄送人</b></td></tr>
          <tr class="example-row"><td>月报.xlsx</td><td><code>{{date}}经营月报</code></td><td>微信,邮件</td><td>管理群</td><td><code>{{date}} 月报</code></td><td>boss@qq.com</td><td>cto@qq.com</td></tr>
        </tbody>
      </table>
      <ul class="rule-template-tips" style="padding-left: 16px">
        <li>📱 <b>分发方式</b> 填 <code>微信</code>、<code>邮件</code> 或 <code>微信,邮件</code></li>
        <li>📝 <code>{{date}}</code> → 当天日期（如 2026-06-07），<code>{{fileName}}</code> → 原始文件名</li>
        <li>📧 <b>收件人</b>和<b>抄送人</b>有多个时用 <b>英文逗号</b> 分隔。支持阿里邮箱复制格式，如 <code>"张三"&lt;zhangsan@company.com&gt;</code></li>
        <li>✅ 只发微信 → 留空邮件列；只发邮件 → 留空微信群列</li>
        <li>📋 用<b>辅助工具</b>拖入文件夹 → 一键复制文件名 → 粘贴到 Excel A 列</li>
      </ul>
      <template #footer>
        <el-button type="primary" @click="showRuleHelp = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { createSendPayload } from "../utils/sendPayload.mjs";
import { buildHistoryGroupedRows } from "../utils/sendHistoryRows.mjs";
import DependencyStatus from "../components/DependencyStatus.vue";

function getApi() {
  const api = window.excelTools;
  if (!api) {
    throw new Error(
      "桌面桥接未就绪：window.excelTools 不存在。请重启 Electron 窗口后重试。"
    );
  }
  return api;
}

// ── 状态 ──
const rules = ref([]);
const folderPath = ref("");
const matchResult = ref(null);
const sending = ref(false);
const logs = ref([]);
const sendResults = ref([]);
const skippedExportItems = ref([]); // 被跳过的文件（未匹配/无渠道），供导出使用
const history = ref([]);
const smtpConfigured = ref(false);
const showSmtpDialog = ref(false);
const showRuleHelp = ref(false);
const showResultDialog = ref(false);
const showClearAllDialog = ref(false);
const clipboardFiles = ref([]);
const depResults = ref([]);
const depInstalling = ref(false);
const depProgressPercent = ref(0);
const depProgressMessage = ref("");
const sendProgress = ref(0);
const sendAborted = ref(false);
const selectAll = computed({
  get: () => {
    const list = matchResult.value?.matched;
    if (!list || list.length === 0) return false;
    return list.every(m => m.selected !== false);
  },
  set: (val) => {
    for (const m of matchResult.value?.matched || []) {
      m.selected = val;
      m._noChannel = false;
    }
  },
});
const folderDropActive = ref(false);
const ruleDropActive = ref(false);
const toolsDropActive = ref(false);
const ruleStartRow = ref(null);
const ruleEndRow = ref(null);
const historyPage = ref(0);

const smtpForm = reactive({
  provider: "",
  host: "smtp.qiye.aliyun.com",
  port: 465,
  secure: true,
  user: "",
  pass: "",
});

const PROVIDER_CONFIG = {
  qq:    { host: "smtp.qq.com",       port: 465, secure: true },
  163:   { host: "smtp.163.com",      port: 465, secure: true },
  aliyun:{ host: "smtp.qiye.aliyun.com",   port: 465, secure: true },
};

function onProviderChange(provider) {
  const config = PROVIDER_CONFIG[provider];
  if (config) {
    smtpForm.host = config.host;
    smtpForm.port = config.port;
    smtpForm.secure = config.secure;
  }
}

const selectedCount = computed(() => {
  if (!matchResult.value) return 0;
  return matchResult.value.matched.filter((m) => m.selected !== false).length;
});

const wechatSelectedCount = computed(() => {
  if (!matchResult.value) return 0;
  return matchResult.value.matched.filter(
    (m) => m.selected !== false && (m.channels || []).includes('wechat')
  ).length;
});

const emailSelectedCount = computed(() => {
  if (!matchResult.value) return 0;
  return matchResult.value.matched.filter(
    (m) => m.selected !== false && (m.channels || []).includes('email')
  ).length;
});

const failedItems = computed(() => sendResults.value.filter((r) => !r.success));
const resultSuccessCount = computed(() => sendResults.value.filter((r) => r.success).length);
const resultFailCount = computed(() => failedItems.value.length);

const currentHistoryEntry = computed(() => {
  if (history.value.length === 0) return null;
  return history.value[historyPage.value] || null;
});

const historyGroupedRows = computed(() => {
  const entry = currentHistoryEntry.value;
  return buildHistoryGroupedRows(entry, getHistoryFileName);
});

const tagName = (t) => {
  if (t.type === 'skip') return '';
  if (t.type === 'wechat') return t.name;
  if (typeof t.name === 'object' && t.name !== null) {
    return t.name.address || t.name.name || '';
  }
  return t.name || '';
};

const tagType = (t) => {
  if (t.type === 'skip') return 'info';
  if (t.status === 'interrupted') return 'warning';
  if (t.status === 'stripped') return 'warning';
  if (t.status === 'success') return 'success';
  return 'danger';
};

const tagLabel = (t) => {
  if (t.type === 'skip') return '⏭ 跳过';
  if (t.status === 'interrupted') return '⏹ 中断';
  const icon = t.type === 'wechat' ? '📱' : '📧';
  if (t.status === 'stripped') return `${icon} ${t.type === 'wechat' ? '微信' : '邮件'} (配置不全)`;
  return `${icon} ${tagName(t)}`;
};

function getHistoryFileName(entry, target, index) {
  if (target.type === 'skip') return target.name;
  if (target._fileName) return target._fileName;
  if (entry.matchedDetails) {
    const detail = entry.matchedDetails.find(d => {
      if (target.type === 'wechat') return d.rule?.wechatGroup === target.name;
      if (target.type === 'email') return d.rule?.emailTo?.some(addr => target.name.includes(addr));
      return false;
    });
    if (detail) return detail.originalName;
  }
  return entry.files?.[index] || entry.files?.[0] || '';
}

const clearingSingleIdx = ref(null);

async function clearSingleHistory(index) {
  if (clearingSingleIdx.value !== null) return;
  clearingSingleIdx.value = index;
  try {
    await getApi().deleteHistoryEntry(index);
    history.value = await getApi().getSendHistory();
    // 如果当前页超出范围则回退一页
    if (historyPage.value >= history.value.length) {
      historyPage.value = Math.max(0, history.value.length - 1);
    }
    addLog("info", "已清空该批历史记录");
  } catch (e) {
    addLog("error", `清空失败: ${e.message}`);
  } finally {
    clearingSingleIdx.value = null;
  }
}

// ── 初始化 ──
onMounted(async () => {
  let api;
  try {
    api = getApi();
  } catch (error) {
    addLog("error", error.message);
    return;
  }
  try { rules.value = await api.getSendRules(); } catch {}
  try { history.value = await api.getSendHistory(); } catch {}
  try {
    const config = await api.getSmtpConfig();
    if (config) {
      Object.assign(smtpForm, config);
      if (config.host) {
        // 反推 provider
        for (const [key, cfg] of Object.entries(PROVIDER_CONFIG)) {
          if (cfg.host === config.host) { smtpForm.provider = key; break; }
        }
        if (!smtpForm.provider) smtpForm.provider = "other";
      }
      smtpConfigured.value = true;
    }
  } catch {}

  // 启动时自检外部依赖
  // 先注册进度监听，再触发检查
  const unsubDepEvent = api.onDependencyEvent((event) => {
    if (event.type === "log") {
      depProgressMessage.value = event.message || "";
    } else if (event.percent !== undefined) {
      depInstalling.value = true;
      depProgressPercent.value = event.percent;
      depProgressMessage.value = event.message || "";
    } else if (event.status === "fixing" || event.status === "checking") {
      depInstalling.value = true;
      depProgressPercent.value = 0;
      depProgressMessage.value = `正在${event.status === "fixing" ? "修复" : "检测"} ${event.name || ""}...`;
    } else {
      // 单项完成
      depInstalling.value = false;
    }
  });
  try {
    depResults.value = await api.runDependencyCheck();
  } catch {}
  unsubDepEvent();
});

// ── 方法 ──
async function pickRuleFile() {
  const file = await getApi().selectTemplateFile();
  if (!file) return;
  try {
    const result = await getApi().importSendRules(file.path);
    rules.value = result.rules;
    if (result.warnings.length > 0) {
      addLog("warn", `导入规则时有 ${result.warnings.length} 条警告: ${result.warnings.join("; ")}`);
    } else {
      addLog("success", `成功导入 ${result.rules.length} 条规则`);
    }
  } catch (e) {
    addLog("error", `导入失败: ${e.message}`);
  }
}

async function pickFolder() {
  const folder = await getApi().selectSendFolder();
  if (folder) {
    folderPath.value = folder;
    if (rules.value.length > 0) refreshMatch();
  }
}

function onRuleDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    ruleDropActive.value = false;
  }
}
function onToolsDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    toolsDropActive.value = false;
  }
}
function onFolderDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    folderDropActive.value = false;
  }
}
function onFolderDrop(event) {
  folderDropActive.value = false;
  const items = event.dataTransfer.items;
  if (!items) return;

  let found = null;
  // 遍历所有拖入项，找到第一个文件夹路径
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type === "") {
      // 尝试通过 webkitGetAsEntry 获取文件夹
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          found = entry;
          break;
        }
      }
    }
  }

  if (!found) return;

  // Electron 中 webkitGetAsEntry 可获得文件夹的 filesystem: URL
  // 解析出实际路径
  const fullPath = itemPathFromEntry(found);

  // 备选：从 dataTransfer.files 获取路径（Electron 特有 API）
  const file = event.dataTransfer.files[0];
  if (file && file.path) {
    // Electron 在 file 对象上提供 .path 属性
    folderPath.value = file.path;
    if (rules.value.length > 0) refreshMatch();
    return;
  }

  if (fullPath) {
    folderPath.value = fullPath;
    if (rules.value.length > 0) refreshMatch();
  }
}

function itemPathFromEntry(entry) {
  // Electron 的 webkitGetAsEntry 通常在 file.path 上暴露路径
  // 如果没有，回退到空
  return null;
}

function downloadTemplate() {
  // 用 ExcelJS 在内存生成一个空白规则表并下载
  import("exceljs").then(async ({ default: ExcelJS }) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("发送规则");

    // 表头
    ws.columns = [
      { header: "文件名(原)", key: "originalName", width: 18 },
      { header: "文件名(映射)", key: "mappedName", width: 22 },
      { header: "分发方式", key: "channels", width: 14 },
      { header: "微信群名", key: "wechatGroup", width: 18 },
      { header: "邮件主题", key: "emailSubject", width: 22 },
      { header: "收件人", key: "emailTo", width: 26 },
      { header: "抄送人", key: "emailCc", width: 26 },
    ];

    // 表头样式
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FF0891B2" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FA" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 28;
    headerRow.eachCell((cell) => (cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }
    }));

    // 示例行
    ws.addRow(["月报.xlsx", "{{fileName}}.xlsx", "微信,邮件", "管理群", "{{fileName}}", "boss@qq.com", "cto@qq.com,hr@qq.com"]);
    ws.addRow(["日报.xlsx", "{{fileName}}.xlsx", "微信", "部门群", "{{fileName}}", "", ""]);
    ws.addRow(["周报.xlsx", "{{fileName}}.xlsx", "邮件", "", "{{fileName}}", "sales@163.com", ""]);

    // 示例行样式
    for (let r = 2; r <= 4; r++) {
      const row = ws.getRow(r);
      row.alignment = { vertical: "middle" };
      row.eachCell((cell) => (cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }
      }));
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "发送规则模板.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    addLog("success", "空白规则模板已下载");
  }).catch(() => {
    addLog("error", "下载模板失败");
  });
}

function getActiveRules() {
  let activeRules = rules.value;
  if (ruleStartRow.value) {
    activeRules = activeRules.filter(r => (r.originalRow || 0) >= ruleStartRow.value);
  }
  if (ruleEndRow.value) {
    activeRules = activeRules.filter(r => (r.originalRow || 0) <= ruleEndRow.value);
  }
  return activeRules;
}

async function refreshMatch() {
  if (!folderPath.value) return;
  try {
    const activeRules = getActiveRules();
    // 将 Vue reactive proxy 转为纯对象，避免 IPC structuredClone 报错
    const plainRules = activeRules.map(r => ({
      originalName: r.originalName,
      mappedName: r.mappedName,
      channels: [...(r.channels || [])],
      strippedChannels: [...(r.strippedChannels || [])],
      wechatGroup: r.wechatGroup,
      emailSubject: r.emailSubject,
      emailTo: (r.emailTo || []).map(e => ({ name: e.name, address: e.address })),
      emailCc: (r.emailCc || []).map(e => ({ name: e.name, address: e.address })),
      originalRow: r.originalRow,
    }));
    const result = await getApi().matchSendFiles(folderPath.value, plainRules);
    if (result.matched) {
      result.matched.forEach((m) => {
        m.selected = true;
        // UI 专用：原始配置源 + 被剥离的渠道（与发送用的 channels 分离）
        m.displayChannels = [...(m.rule?.channels || [])];
        m.missingChannels = [...(m.rule?.strippedChannels || [])];
        // 将 emailTo/emailCc 对象转为纯地址字符串，避免模板 join(', ') 显示 [object Object]
        if (m.rule) {
          m.rule.emailTo = (m.rule.emailTo || []).map(e =>
            typeof e === 'string' ? e : (e.address || e.name || '')
          );
          m.rule.emailCc = (m.rule.emailCc || []).map(e =>
            typeof e === 'string' ? e : (e.address || e.name || '')
          );
        }
      });
    }
    matchResult.value = result;
    addLog("info", `匹配完成: ${result.matched.length} 匹配, ${result.unmatched.length} 未匹配`);
    // 展示渠道不全的警告
    if (result.warnings && result.warnings.length > 0) {
      for (const w of result.warnings) {
        addLog("warn", `⚠ ${w}`);
      }
    }
  } catch (e) {
    addLog("error", `匹配失败: ${e.message}`);
  }
}

async function startSend(filterChannel = null) {
  if (!matchResult.value) return;

  // 清除上次发送的 _noChannel 标记和跳过记录
  skippedExportItems.value = [];
  for (const m of matchResult.value.matched) {
    m._noChannel = false;
  }

  // 单渠道发送：自动取消勾选无该渠道的项
  if (filterChannel) {
    for (const m of matchResult.value.matched) {
      if (m.selected !== false && !(m.channels || []).includes(filterChannel)) {
        m.selected = false;
        m._noChannel = true;
        const channelLabel = filterChannel === 'wechat' ? '微信' : '邮件';
        addLog("warn", `⏭ 跳过 ${m.originalName} (无${channelLabel}渠道)`);
        skippedExportItems.value.push({
          originalName: m.originalName,
          reason: `无${channelLabel}渠道`,
        });
      }
    }
  }

  const selected = matchResult.value.matched.filter((m) => m.selected !== false);
  if (selected.length === 0) return;

  sending.value = true;
  sendAborted.value = false;
  logs.value = [];
  sendResults.value = [];
  sendProgress.value = 0;

  // Esc 键中断（双层监听确保捕获）
  const onKeyDown = (e) => {
    if (e.key === "Escape" && sending.value) {
      e.preventDefault();
      cancelSend();
    }
  };
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("keydown", onKeyDown, true);

  try {
    const result = await getApi().sendItems(
      createSendPayload(selected, true, matchResult.value.unmatched || [], filterChannel)
    );
    sending.value = false;
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keydown", onKeyDown, true);
    sendResults.value = result.results || [];

    if (result.aborted) {
      sendAborted.value = true;
      addLog("warn", `⚠ 发送已中断（已完成 ${result.successCount} 项）`);
    }

    // 显示未匹配项
    if (matchResult.value?.unmatched?.length > 0) {
      for (const umName of matchResult.value.unmatched) {
        addLog("warn", `⏭ 跳过 ${umName} (未匹配到规则)`);
        skippedExportItems.value.push({
          originalName: umName,
          reason: "未匹配到规则",
        });
      }
    }

    // 逐行显示每条发送结果
    for (const r of result.results || []) {
      const channelIcon = r.channel === "wechat" ? "📱" : "📧";
      const successIcon = r.success ? "✓" : "✗";
      const errorSuffix = r.error ? ` (${r.error})` : "";
      addLog(
        r.success ? "success" : "error",
        `${channelIcon} ${r.target} → ${r.originalName} ${successIcon}${errorSuffix}`
      );
    }
    // 对渠道不全的文件显示警告
    const seenWarn = new Set();
    for (const m of (matchResult.value?.matched || [])) {
      const sc = m.rule && m.rule.strippedChannels;
      if (sc && sc.length > 0 && !seenWarn.has(m.originalName)) {
        seenWarn.add(m.originalName);
        const strippedLabels = sc.map(c => c === "wechat" ? "微信" : "邮件").join("、");
        const usedLabels = m.channels.map(c => c === "wechat" ? "微信" : "邮件").join("、");
        addLog("warn", `⚠ ${m.originalName} 仅通过${usedLabels}发送（${strippedLabels}渠道配置不全）`);
      }
    }

    // 汇总
    if (result.failCount > 0) {
      addLog("error", `发送完成: ${result.successCount} 成功, ${result.failCount} 失败`);
    } else {
      addLog("success", `全部发送成功 (${result.successCount} 项)`);
    }

    showResultDialog.value = true;

    history.value = await getApi().getSendHistory();
    historyPage.value = 0;
  } catch (e) {
    sending.value = false;
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keydown", onKeyDown, true);
    if (e.name === "AbortError" || e.message?.includes("abort")) {
      sendAborted.value = true;
      addLog("warn", "⏹ 发送已被用户中断");
    } else {
      addLog("error", `发送异常: ${e.message}`);
    }
  } finally {
    // 发送结束后清除灰化标记，避免 _noChannel 持久残留
    if (matchResult.value) {
      for (const m of matchResult.value.matched) {
        m._noChannel = false;
      }
    }
  }
}

async function cancelSend() {
  try {
    await getApi().cancelSend();
    addLog("warn", "⏹ 用户中断，正在等待当前项完成...");
  } catch (e) {
    addLog("error", `中断失败: ${e.message}`);
  }
}

async function saveSmtp() {
  await getApi().saveSmtpConfig({ ...smtpForm });
  smtpConfigured.value = true;
  showSmtpDialog.value = false;
  addLog("success", "SMTP 配置已保存");
}

async function pickFolderForCopy() {
  const folder = await getApi().selectSendFolder();
  if (!folder) return;
  try {
    const result = await getApi().listFolderFiles(folder);
    if (result.error) {
      addLog("warn", result.error);
      return;
    }
    const names = result.files || [];
    clipboardFiles.value = names;
    if (names.length > 0) {
      const text = names.join("\n");
      await navigator.clipboard.writeText(text);
      addLog("success", `已复制 ${names.length} 个文件名到剪贴板，可直接粘贴到 Excel A 列`);
    } else {
      addLog("warn", "该文件夹下未找到 Excel 文件");
    }
  } catch (e) {
    addLog("error", `读取失败: ${e.message}`);
  }
}

async function onRuleDrop(event) {
  ruleDropActive.value = false;
  const file = event.dataTransfer.files[0];
  if (!file || !file.path) return;
  if (!file.path.toLowerCase().endsWith(".xlsx")) {
    addLog("warn", "请拖入 .xlsx 格式的规则表文件");
    return;
  }
  try {
    const result = await getApi().importSendRules(file.path);
    rules.value = result.rules;
    if (result.warnings.length > 0) {
      addLog("warn", `导入规则时有 ${result.warnings.length} 条警告: ${result.warnings.join("; ")}`);
    } else {
      addLog("success", `成功导入 ${result.rules.length} 条规则`);
    }
  } catch (e) {
    addLog("error", `导入失败: ${e.message}`);
  }
}

async function onToolsDrop(event) {
  toolsDropActive.value = false;
  const file = event.dataTransfer.files[0];
  if (!file || !file.path) return;
  try {
    const result = await getApi().listFolderFiles(file.path);
    if (result.error) {
      addLog("warn", result.error);
      return;
    }
    const names = result.files || [];
    clipboardFiles.value = names;
    if (names.length > 0) {
      const text = names.join("\n");
      await navigator.clipboard.writeText(text);
      addLog("success", `已复制 ${names.length} 个文件名到剪贴板，可直接粘贴到 Excel A 列`);
    } else {
      addLog("warn", "该文件夹下未找到 Excel 文件");
    }
  } catch (e) {
    addLog("error", `读取失败: ${e.message}`);
  }
}

function copyFileNames() {
  if (clipboardFiles.value.length === 0) return;
  const text = clipboardFiles.value.join("\n");
  navigator.clipboard.writeText(text);
  addLog("success", `已复制 ${clipboardFiles.value.length} 个文件名`);
}

async function reuseHistory(entry) {
  if (!entry.folderPath) {
    addLog("warn", "该历史记录没有保存文件夹路径，无法复用");
    return;
  }

  // 逐段显示复用过程
  addLog("info", `📂 正在定位文件夹: ${entry.folderPath}`);
  folderPath.value = entry.folderPath;

  // 检查文件夹是否存在
  try {
    const result = await getApi().listFolderFiles(entry.folderPath);
    if (result.error) {
      addLog("error", `文件夹无法访问: ${result.error}`);
      return;
    }
    addLog("success", `📁 文件夹已定位，找到 ${result.files.length} 个 Excel 文件`);
  } catch {
    addLog("error", "文件夹不存在或无法访问");
    return;
  }

  addLog("info", `🔍 正在匹配文件... (${entry.files.length} 个历史文件)`);

  // 重置规则行范围（复用历史应使用全部规则）
  ruleStartRow.value = null;
  ruleEndRow.value = null;

  // 触发刷新匹配
  await refreshMatch();

  addLog("success", `✅ 复用完成: ${entry.date ? formatDate(entry.date) : ''} 的发送配置已恢复`);
}

async function echoHistory(entry) {
  // 1. 还原匹配信息：优先用当前规则重新匹配（避免历史快照数据过期）
  if (entry.folderPath) {
    folderPath.value = entry.folderPath;
    ruleStartRow.value = null;
    ruleEndRow.value = null;
    await refreshMatch();
  } else if (entry.matchedDetails?.length > 0 || entry.unmatched?.length > 0) {
    // 没有文件夹路径时，回退到历史快照
    logs.value = []; // 仅在回退模式清空日志
    const restoredMatched = (entry.matchedDetails || []).map((d) => ({
      originalName: d.originalName,
      mappedName: d.mappedName || d.originalName,
      channels: d.channels || [],
      resolvedSubject: d.resolvedSubject || '',
      selected: true,
      displayChannels: [...(d.channels || [])],
      missingChannels: [...(d.strippedChannels || [])],
      rule: {
        wechatGroup: d.rule?.wechatGroup || null,
        emailTo: (d.rule?.emailTo || []).map(e => typeof e === 'string' ? e : (e.address || e.name || '')),
        emailCc: (d.rule?.emailCc || []).map(e => typeof e === 'string' ? e : (e.address || e.name || '')),
        emailSubject: d.rule?.emailSubject || null,
        strippedChannels: d.strippedChannels || [],
      },
      filePath: '',
    }));
    matchResult.value = {
      matched: restoredMatched,
      unmatched: entry.unmatched || [],
      error: null,
    };
  } else {
    // 既无文件夹路径也无历史快照时，不做任何事
  }

  // 2. 还原发送日志（重新匹配路径：refreshMatch 已添加匹配日志，此处追加历史发送记录）
  if (entry.targets?.length > 0) {
    addLog("info", `📋 回显历史记录 (${formatDate(entry.date)})`);
    for (let ti = 0; ti < entry.targets.length; ti++) {
      const t = entry.targets[ti];
      if (t.type === 'skip') {
        addLog("warn", `⏭ 跳过 ${t.name} (未匹配到规则)`);
      } else {
        const icon = t.type === 'wechat' ? '📱' : '📧';
        const fileName = getHistoryFileName(entry, t, ti);
        const statusIcon = t.status === 'success' ? '✓' : '✗';
        const errorStr = t.error ? ` (${t.error})` : '';
        addLog(
          t.status === 'success' ? 'success' : t.status === 'error' ? 'error' : 'warn',
          `${icon} ${t.name} → ${fileName} ${statusIcon}${errorStr}`
        );
      }
    }
  }
  // 还原渠道不全警告
  const seenWarn = new Set();
  if (entry.matchedDetails) {
    for (const md of entry.matchedDetails) {
      if (md.strippedChannels && md.strippedChannels.length > 0 && !seenWarn.has(md.originalName)) {
        seenWarn.add(md.originalName);
        const strippedLabels = md.strippedChannels.map(c => c === "wechat" ? "微信" : "邮件").join("、");
        const usedLabels = md.channels.map(c => c === "wechat" ? "微信" : "邮件").join("、");
        addLog("warn", `⚠ ${md.originalName} 仅通过${usedLabels}发送（${strippedLabels}渠道配置不全）`);
      }
    }
  }

  addLog("info", `✅ 已从 ${formatDate(entry.date)} 的历史记录回显`);

  // 恢复 sendResults 使导出按钮可见
  sendResults.value = (entry.targets || [])
    .filter(t => t.type !== 'skip' && t.type !== 'stripped')
    .map((t, ti) => ({
      originalName: t._fileName || getHistoryFileName(entry, t, ti),
      channel: t.type,
      target: t.name,
      success: t.status === 'success',
      error: t.error || null,
    }));
}

async function clearHistory() {
  try {
    await getApi().clearSendHistory();
    history.value = [];
    addLog("info", "发送历史已清空");
  } catch (e) {
    addLog("error", `清空历史失败: ${e.message}`);
  }
}

function clearLogs() {
  logs.value = [];
  sendResults.value = [];
  sendProgress.value = 0;
  sendAborted.value = false;
}

async function exportResults() {
  const results = sendResults.value;
  const skipped = skippedExportItems.value;
  if (results.length === 0 && skipped.length === 0) return;

  const headers = ["文件名", "渠道", "目标", "状态", "错误信息"];
  const rows = results.map((r) => [
    r.originalName,
    r.channel === "wechat" ? "微信" : "邮件",
    r.target,
    r.success ? "成功" : "失败",
    r.error || "",
  ]);
  // 追加被跳过的文件
  for (const s of skipped) {
    rows.push([s.originalName, "", "", "跳过", s.reason]);
  }

  try {
    const ret = await getApi().exportSendResults({ headers, rows });
    if (ret.success) {
      addLog("success", "发送结果已导出为 CSV 文件");
    } else if (ret.error !== "已取消") {
      addLog("warn", ret.error || "导出失败");
    }
  } catch (e) {
    addLog("error", `导出失败: ${e.message}`);
  }
}

function addLog(level, message) {
  logs.value.push({ level, message, time: new Date().toLocaleTimeString() });
}

function logText(log) {
  const icon = { success: "✓", error: "✗", warn: "⚠", info: "ℹ" }[log.level] || "";
  return `${icon} ${log.message}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>

<style scoped>
.send-grid {
  display: grid;
  gap: 16px;
}

.match-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.match-list-header {
  display: flex;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  margin-bottom: 4px;
}

.match-item {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.match-item--no-channel {
  opacity: 0.45;
}

.match-filename {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 120px;
}

.match-arrow {
  margin: 0 8px;
  color: var(--text-muted);
}

.match-target {
  margin-left: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}


.send-warning {
  color: var(--warning);
  font-size: 13px;
}

.send-error {
  color: var(--danger);
  font-size: 13px;
}

.history-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 4px 0 8px;
  font-size: 13px;
}

.history-page-info {
  color: var(--text-muted);
  min-width: 60px;
  text-align: center;
}

.history-table-wrap {
  max-height: 240px;
  overflow-y: auto;
}

.history-batch {
  margin-bottom: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-card);
}

.history-batch-title {
  display: flex;
  align-items: center;
  padding: 2px 0 6px;
  font-size: 13px;
}

.history-batch-actions {
  display: flex;
  align-items: center;
  padding: 4px 0 0;
}

.history-date {
  color: var(--text-muted);
  min-width: 90px;
}

.history-files {
  color: var(--text-secondary);
  margin-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-line {
  font-size: 13px;
  padding: 2px 0;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.log-success { color: var(--success); }
.log-error { color: var(--danger); }
.log-warn { color: var(--warning); }
.log-info { color: var(--text-secondary); }

/* ── 发送结果弹窗 ── */
.result-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px 0;
  font-size: 15px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}
.result-summary--ok {
  background: rgba(16,185,129,0.08);
  color: var(--success);
}
.result-summary--warn {
  background: rgba(245,158,11,0.08);
  color: var(--warning);
}
.result-summary-icon {
  font-size: 18px;
  margin-right: 4px;
}
.result-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.result-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.4;
}
.result-item--ok {
  background: rgba(16,185,129,0.05);
}
.result-item--fail {
  background: rgba(239,68,68,0.05);
}
.result-icon {
  font-family: var(--font-mono);
  font-weight: 700;
  width: 16px;
  text-align: center;
}
.result-item--ok .result-icon { color: var(--success); }
.result-item--fail .result-icon { color: var(--danger); }
.result-channel { flex-shrink: 0; }
.result-target {
  font-weight: 600;
  color: var(--text-primary);
}
.result-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
}
.result-file {
  color: var(--text-secondary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-error {
  color: var(--danger);
  font-size: 12px;
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

/* ── SMTP 帮助 ── */
.smtp-help {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.5;
}

/* ── 帮助图标按钮 ── */
.help-icon-btn {
  font-size: 15px;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.help-icon-btn:hover {
  color: var(--primary);
  border-color: var(--primary);
}

/* ── 拖拽区域 ── */
.drop-zone {
  position: relative;
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.drop-btn-wrapper {
  display: inline-flex;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.drop-zone--active,
.drop-btn-wrapper--active {
  border-style: dashed;
  border-color: mediumslateblue;
  background-color: rgba(167, 139, 250, 0.05);
}

.rule-template-help {
  margin-top: 8px;
  padding: 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
}

.rule-template-help p {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.rule-template-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 8px;
}

.rule-template-table th, .rule-template-table td {
  padding: 5px 6px;
  border: 1px solid var(--border);
  text-align: center;
}

.rule-template-table th {
  background: var(--bg-canvas);
  color: var(--text-muted);
  font-weight: 500;
}

.rule-template-table .example-row td {
  background: rgba(8, 145, 178, 0.04);
  color: var(--primary);
  font-weight: 500;
}

.rule-template-tips {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.rule-template-tips code {
  background: var(--bg-canvas);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
</style>
