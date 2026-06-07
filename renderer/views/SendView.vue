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
          <el-button size="small" @click="pickRuleFile">📥 导入</el-button>
          <el-text v-if="rules.length > 0" size="small" style="margin-left: 8px">
            已导入 {{ rules.length }} 条规则
          </el-text>
          <el-text v-else size="small" type="info" style="margin-left: 8px">尚未导入</el-text>
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
    <el-dialog v-model="showSmtpDialog" title="SMTP 邮件配置" width="480px">
      <el-form label-width="100px">
        <el-form-item label="SMTP 服务器">
          <el-input v-model="smtpForm.host" placeholder="smtp.aliyun.com" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="smtpForm.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="SSL">
          <el-switch v-model="smtpForm.secure" />
        </el-form-item>
        <el-form-item label="邮箱地址">
          <el-input v-model="smtpForm.user" placeholder="your-email@aliyun.com" />
        </el-form-item>
        <el-form-item label="授权码">
          <el-input v-model="smtpForm.pass" type="password" show-password placeholder="SMTP 授权码（非密码）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSmtpDialog = false">取消</el-button>
        <el-button type="primary" @click="saveSmtp">保存</el-button>
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
const sendProgress = ref(0);

const smtpForm = reactive({
  host: "smtp.aliyun.com",
  port: 465,
  secure: true,
  user: "",
  pass: "",
});

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
</style>
