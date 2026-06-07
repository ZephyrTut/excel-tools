<template>
  <div class="send-grid">
    <!-- 配置区 -->
    <el-card class="panel-card">
      <template #header><span>⚙️ 配置</span></template>
      <el-form label-width="100px">
        <el-form-item label="SMTP 邮件">
          <el-tag v-if="smtpConfigured" type="success" size="small">已配置</el-tag>
          <el-tag v-else type="info" size="small">未配置</el-tag>
          <el-button text type="primary" size="small" style="margin-left: 8px" @click="showSmtpDialog = true">
            编辑
          </el-button>
        </el-form-item>
        <el-form-item label="规则模板">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
            <el-button size="small" @click="pickRuleFile">📥 导入规则表</el-button>
            <el-button size="small" text type="primary" @click="downloadTemplate">
              📋 下载空白模板
            </el-button>
            <el-button size="small" text @click="showRuleHelp = true" class="help-icon-btn" title="规则表使用说明">
              ❓
            </el-button>
          </div>
          <el-text v-if="rules.length > 0" size="small" style="margin-top: 6px">
            已导入 <b>{{ rules.length }}</b> 条规则
          </el-text>
        </el-form-item>
        <el-form-item label="辅助工具">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
            <el-button size="small" @click="pickFolderForCopy">📁 选取文件夹</el-button>
            <el-button v-if="clipboardFiles.length > 0" size="small" text type="success" @click="copyFileNames">
              📋 一键复制 {{ clipboardFiles.length }} 个文件名
            </el-button>
          </div>
          <el-text v-if="clipboardFiles.length > 0" size="small" type="info" style="margin-top: 6px">
            已粘贴到剪贴板，可直接 Ctrl+V 粘贴到 Excel A 列
          </el-text>
        </el-form-item>
        <el-form-item label="发送顺序">
          <el-radio-group v-model="wechatFirst">
            <el-radio :value="true">先微信后邮件</el-radio>
            <el-radio :value="false">先邮件后微信</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 文件选择 + 匹配预览 -->
    <el-card class="panel-card">
      <template #header><span>📂 选择文件</span></template>
      <div class="drop-zone" style="margin-bottom: 12px">
        <el-input v-model="folderPath" placeholder="选择待发送文件所在文件夹">
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
          <div v-for="item in matchResult.matched" :key="item.originalName" class="match-item">
            <el-checkbox v-model="item.selected" style="margin-right: 8px" />
            <span class="match-filename">{{ item.originalName }}</span>
            <span class="match-arrow">→</span>
            <el-tag v-for="ch in item.channels" :key="ch" size="small" :type="ch === 'wechat' ? 'primary' : 'success'" style="margin-right: 4px">
              {{ ch === 'wechat' ? '📱 微信' : '📧 邮件' }}
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
        <el-button type="primary" @click="startSend" :disabled="sending || selectedCount === 0">
          📤 开始发送 ({{ selectedCount }}项)
        </el-button>
        <el-button v-if="sending" type="warning" disabled>发送中...</el-button>
      </div>
    </el-card>

    <!-- 发送历史 -->
    <el-card class="panel-card" v-if="history.length > 0">
      <template #header><span>📜 发送历史</span></template>
      <div v-for="(entry, idx) in history.slice(0, 5)" :key="idx" class="history-item">
        <span class="history-date">{{ formatDate(entry.date) }}</span>
        <span class="history-files">{{ entry.files.join(', ') }}</span>
        <el-tag
          v-for="(t, ti) in entry.targets"
          :key="ti"
          size="small"
          :type="t.status === 'success' ? 'success' : 'danger'"
          style="margin-left: 4px"
        >
          {{ t.type === 'wechat' ? '📱' : '📧' }} {{ t.name }}
        </el-tag>
        <el-button text size="small" type="primary" style="margin-left: 8px" @click="reuseHistory(entry)">
          🔄 复用
        </el-button>
      </div>
    </el-card>

    <!-- 发送日志 -->
    <el-card class="panel-card" v-if="logs.length > 0">
      <template #header><span>📊 发送日志</span></template>
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
        <li>👥 <b>收件人</b>和<b>抄送人</b>有多个时用 <b>英文逗号</b> 分隔</li>
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

const api = window.excelTools;

// ── 状态 ──
const rules = ref([]);
const folderPath = ref("");
const matchResult = ref(null);
const wechatFirst = ref(true);
const sending = ref(false);
const logs = ref([]);
const history = ref([]);
const smtpConfigured = ref(false);
const showSmtpDialog = ref(false);
const showRuleHelp = ref(false);
const clipboardFiles = ref([]);
const sendProgress = ref(0);

const smtpForm = reactive({
  provider: "",
  host: "smtp.aliyun.com",
  port: 465,
  secure: true,
  user: "",
  pass: "",
});

const PROVIDER_CONFIG = {
  qq:    { host: "smtp.qq.com",       port: 465, secure: true },
  163:   { host: "smtp.163.com",      port: 465, secure: true },
  aliyun:{ host: "smtp.aliyun.com",   port: 465, secure: true },
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

// ── 初始化 ──
onMounted(async () => {
  if (!api) return;
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
});

// ── 方法 ──
async function pickRuleFile() {
  const file = await api.selectTemplateFile();
  if (!file) return;
  try {
    const result = await api.importSendRules(file.path);
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
  const folder = await api.selectSendFolder();
  if (folder) folderPath.value = folder;
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
    ws.addRow(["月报.xlsx", "{{date}}经营月报", "微信,邮件", "管理群", "{{date}} {{fileName}}", "boss@qq.com", "cto@qq.com,hr@qq.com"]);
    ws.addRow(["日报.xlsx", "日报", "微信", "部门群", "", "", ""]);
    ws.addRow(["周报.xlsx", "{{date}}周报", "邮件", "", "{{date}} 周报", "sales@163.com", ""]);

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

async function refreshMatch() {
  if (!folderPath.value) return;
  try {
    const result = await api.matchSendFiles(folderPath.value);
    if (result.matched) {
      result.matched.forEach((m) => (m.selected = true));
    }
    matchResult.value = result;
    addLog("info", `匹配完成: ${result.matched.length} 匹配, ${result.unmatched.length} 未匹配`);
  } catch (e) {
    addLog("error", `匹配失败: ${e.message}`);
  }
}

async function startSend() {
  if (!matchResult.value) return;
  const selected = matchResult.value.matched.filter((m) => m.selected !== false);
  if (selected.length === 0) return;

  sending.value = true;
  logs.value = [];
  sendProgress.value = 0;

  try {
    const result = await api.sendItems({ matched: selected, wechatFirst: wechatFirst.value });
    sending.value = false;
    history.value = await api.getSendHistory();
    addLog("info", `发送完成: ${result.successCount} 成功, ${result.failCount} 失败`);
  } catch (e) {
    sending.value = false;
    addLog("error", `发送异常: ${e.message}`);
  }
}

async function saveSmtp() {
  await api.saveSmtpConfig({ ...smtpForm });
  smtpConfigured.value = true;
  showSmtpDialog.value = false;
  addLog("success", "SMTP 配置已保存");
}

async function pickFolderForCopy() {
  const folder = await api.selectSendFolder();
  if (!folder) return;
  try {
    const result = await api.listFolderFiles(folder);
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

function reuseHistory(entry) {
  addLog("info", `已加载历史记录: ${entry.files.join(", ")}`);
  // TODO: 后续可以自动填入上次的收件人等信息
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

.match-item {
  display: flex;
  align-items: center;
  font-size: 14px;
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

.history-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--border-light);
}

.history-date {
  color: var(--text-muted);
  min-width: 100px;
}

.history-files {
  color: var(--text-primary);
  font-weight: 500;
  margin: 0 8px;
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
