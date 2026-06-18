/**
 * Reasonix 会话浏览器 — 本地服务器
 * 用法: node session-server.js
 * 然后打开 http://localhost:3099 即可浏览所有历史会话
 *
 * 功能:
 *   - 列表展示所有历史会话（摘要/时间/消息数/大小）
 *   - 点击会话查看完整对话内容
 *   - 搜索过滤
 *   - 一键打开源文件
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3099;
const SESSIONS_DIR = path.join(process.env.USERPROFILE || '~', '.reasonix', 'sessions');
const PROJECT_DIR = __dirname;

// ─── MIME ────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.jsonl': 'text/plain; charset=utf-8',
  '.png': 'image/png',
};

// ─── Helpers ─────────────────────────────────────────────────────
function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readJSONL(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  return lines.map(line => {
    try { return JSON.parse(line); } catch (e) { return { role: 'parse-error', content: line.substring(0, 200) }; }
  });
}

function parseSessionName(filename) {
  // code-excel-tools__archive_202605172102.jsonl → 解析出时间戳
  const parts = filename.replace('.jsonl', '').split('__archive_');
  if (parts.length > 1) {
    const ts = parts[parts.length - 1].replace(/_/g, '').substring(0, 12);
    const y = ts.substring(0, 4);
    const M = ts.substring(4, 6);
    const d = ts.substring(6, 8);
    const h = ts.substring(8, 10);
    const m = ts.substring(10, 12);
    return { isCurrent: false, date: `${y}-${M}-${d} ${h}:${m}` };
  }
  return { isCurrent: true, date: '当前' };
}

function listSessions() {
  const files = fs.readdirSync(SESSIONS_DIR);
  const sessions = [];

  for (const file of files) {
    if (!file.endsWith('.jsonl') || file.includes('.events') || file.startsWith('subagent-')) continue;

    const filePath = path.join(SESSIONS_DIR, file);
    const stat = fs.statSync(filePath);

    // Try to get summary from meta
    const metaFile = file.replace('.jsonl', '.meta.json');
    const metaPath = path.join(SESSIONS_DIR, metaFile);
    let summary = '';
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        summary = meta.summary || '';
      } catch (e) { /* ignore */ }
    }

    // Count messages quickly
    let messageCount = 0;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      messageCount = (raw.match(/\n/g) || []).length + (raw.length > 0 ? 1 : 0);
    } catch (e) { /* ignore */ }

    const { isCurrent, date } = parseSessionName(file);

    sessions.push({
      name: file.replace('.jsonl', ''),
      file,
      path: filePath,
      size: stat.size,
      messageCount,
      mtime: stat.mtimeMs,
      summary,
      isCurrent,
      date,
    });
  }

  // Sort: current first, then by mtime desc
  sessions.sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return b.mtime - a.mtime;
  });

  return sessions;
}

// ─── HTML Template ────────────────────────────────────────────────
function renderPage(sessions) {
  const sessionCards = sessions.map((s, i) => {
    const d = new Date(s.mtime);
    const dateStr = d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const sizeStr = s.size < 1024 ? s.size + 'B' :
      s.size < 1048576 ? (s.size / 1024).toFixed(1) + 'KB' : (s.size / 1048576).toFixed(1) + 'MB';
    const badge = s.isCurrent
      ? '<span class="badge badge-current">当前</span>'
      : '<span class="badge badge-archive">归档</span>';

    return `<div class="session-card" onclick="loadSession('${escJS(s.file)}')" data-file="${escHtml(s.file)}">
      <div class="session-header">
        <div class="session-summary">${escHtml(s.summary || '(无摘要)')}</div>
        ${badge}
      </div>
      <div class="session-meta">
        <span>💬 ${s.messageCount} 条</span>
        <span>📦 ${sizeStr}</span>
        <span>🕐 ${dateStr}</span>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reasonix 会话浏览器</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; background:#0d1117; color:#c9d1d9; display:flex; height:100vh; overflow:hidden; }
/* Sidebar */
.sidebar { width:380px; min-width:380px; background:#0d1117; border-right:1px solid #30363d; display:flex; flex-direction:column; }
.sidebar-header { padding:16px 20px; border-bottom:1px solid #30363d; }
.sidebar-header h1 { font-size:16px; color:#58a6ff; }
.sidebar-header p { font-size:11px; color:#8b949e; margin-top:4px; }
.search-box { padding:12px 16px; border-bottom:1px solid #30363d; }
.search-box input { width:100%; padding:8px 12px; background:#161b22; border:1px solid #30363d; border-radius:6px; color:#c9d1d9; font-size:13px; outline:none; }
.search-box input:focus { border-color:#58a6ff; }
.search-box input::placeholder { color:#484f58; }
.session-list { flex:1; overflow-y:auto; padding:8px; }
.session-card { background:#161b22; border:1px solid #30363d; border-radius:6px; padding:12px 14px; margin-bottom:6px; cursor:pointer; transition:border-color 0.15s; }
.session-card:hover { border-color:#58a6ff; }
.session-card.active { border-color:#58a6ff; background:#1c2533; }
.session-summary { font-size:13px; line-height:1.4; color:#e6edf3; margin-bottom:6px; word-break:break-all; }
.session-meta { display:flex; gap:12px; font-size:11px; color:#8b949e; flex-wrap:wrap; }
.badge { display:inline-block; padding:1px 8px; border-radius:10px; font-size:10px; font-weight:500; }
.badge-current { background:#23863626; color:#3fb950; border:1px solid #23863640; }
.badge-archive { background:#1f6feb26; color:#58a6ff; border:1px solid #1f6feb40; }
/* Main area */
.main { flex:1; display:flex; flex-direction:column; background:#0d1117; }
.main-header { padding:12px 20px; border-bottom:1px solid #30363d; display:flex; align-items:center; gap:10px; }
.main-header h2 { font-size:14px; font-weight:400; color:#8b949e; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.main-header button { padding:5px 12px; border:1px solid #30363d; border-radius:6px; background:#21262d; color:#c9d1d9; cursor:pointer; font-size:11px; }
.main-header button:hover { background:#30363d; }
.conversation { flex:1; overflow-y:auto; padding:16px 20px; }
.msg { padding:10px 14px; margin-bottom:8px; border-radius:6px; border-left:3px solid #30363d; }
.msg.user { border-left-color:#58a6ff; background:#1c253315; }
.msg.assistant { border-left-color:#3fb950; background:#2386360a; }
.msg.tool { border-left-color:#8b949e; background:#8b949e08; font-size:11px; opacity:0.7; }
.msg-role { font-weight:600; font-size:11px; margin-bottom:4px; text-transform:uppercase; }
.msg-role.user { color:#58a6ff; }
.msg-role.assistant { color:#3fb950; }
.msg-role.tool { color:#8b949e; }
.msg-content { font-size:13px; line-height:1.6; white-space:pre-wrap; word-break:break-word; }
.msg-content.tool-content { font-size:11px; max-height:200px; overflow-y:auto; }
.empty-state { display:flex; align-items:center; justify-content:center; height:100%; color:#8b949e; font-size:14px; }
.tool-call { background:#21262d; border:1px solid #30363d; border-radius:4px; padding:6px 10px; margin:4px 0; font-size:11px; color:#8b949e; white-space:pre-wrap; word-break:break-all; }
@media (max-width:768px) { body { flex-direction:column; } .sidebar { width:100%; min-width:100%; max-height:40vh; } }
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-header">
    <h1>📋 Reasonix 会话浏览器</h1>
    <p>共 ${sessions.length} 条会话 · 点击查看对话</p>
  </div>
  <div class="search-box">
    <input type="text" id="search" placeholder="搜索摘要..." oninput="filter()">
  </div>
  <div class="session-list" id="sessionList">
    ${sessionCards}
  </div>
</div>
<div class="main">
  <div class="main-header">
    <h2 id="mainTitle">← 选择一条会话开始浏览</h2>
    <button onclick="openSource()" id="btnSource" style="display:none">📂 打开源文件</button>
  </div>
  <div class="conversation" id="conversation">
    <div class="empty-state">👈 从左侧选择一条历史会话</div>
  </div>
</div>
<script>
let currentFile = null;

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escJS(s) {
  return s.replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'").replace(/"/g,'\\\\"');
}

async function loadSession(file) {
  currentFile = file;
  document.querySelectorAll('.session-card').forEach(c => c.classList.remove('active'));
  const card = document.querySelector('[data-file="' + file.replace(/"/g,'&quot;') + '"]');
  if (card) card.classList.add('active');

  document.getElementById('mainTitle').textContent = '📄 ' + file.replace('.jsonl','');
  document.getElementById('btnSource').style.display = 'inline-block';
  document.getElementById('conversation').innerHTML = '<div class="empty-state">⏳ 加载中...</div>';

  try {
    const res = await fetch('/api/session/' + encodeURIComponent(file));
    const data = await res.json();
    renderConversation(data.messages);
  } catch(e) {
    document.getElementById('conversation').innerHTML = '<div class="empty-state">❌ 加载失败: ' + e.message + '</div>';
  }
}

function renderConversation(messages) {
  let html = '';
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const role = m.role || 'unknown';
    let content = m.content || '';
    let toolCalls = m.tool_calls || [];

    // Truncate very long content
    if (content && content.length > 5000) {
      content = content.substring(0, 5000) + '\\n... [截断，共 ' + content.length + ' 字符]';
    }

    let roleLabel = role.toUpperCase();
    if (role === 'tool') {
      // Show tool result compactly
      roleLabel = '🔧 TOOL: ' + (m.name || m.tool_call_id || '');
      html += '<div class="msg tool"><div class="msg-role tool">' + escHtml(roleLabel) + '</div><div class="msg-content tool-content">' + escHtml(String(content).substring(0, 2000)) + '</div></div>';
    } else if (role === 'assistant' && toolCalls.length > 0) {
      html += '<div class="msg assistant"><div class="msg-role assistant">🤖 ASSISTANT</div>';
      for (const tc of toolCalls) {
        html += '<div class="tool-call">🔨 ' + escHtml(tc.function?.name || tc.type || '') + '<br>' + escHtml(String(tc.function?.arguments || '').substring(0, 500)) + '</div>';
      }
      if (content) html += '<div class="msg-content">' + escHtml(content) + '</div>';
      html += '</div>';
    } else if (role === 'assistant') {
      html += '<div class="msg assistant"><div class="msg-role assistant">🤖 ASSISTANT</div><div class="msg-content">' + escHtml(content) + '</div></div>';
    } else if (role === 'user') {
      html += '<div class="msg user"><div class="msg-role user">👤 USER</div><div class="msg-content">' + escHtml(content) + '</div></div>';
    } else {
      html += '<div class="msg"><div class="msg-role">' + escHtml(roleLabel) + '</div><div class="msg-content">' + escHtml(content) + '</div></div>';
    }
  }
  document.getElementById('conversation').innerHTML = html || '<div class="empty-state">空会话</div>';
}

function openSource() {
  if (currentFile) {
    fetch('/api/open/' + encodeURIComponent(currentFile)).catch(() => {});
    alert('已在默认编辑器中打开: ' + currentFile);
  }
}

function filter() {
  const q = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.session-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}
</script>
</body>
</html>`;
}

// ─── Server ───────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);

  try {
    // GET / → main page
    if (req.method === 'GET' && url.pathname === '/') {
      const sessions = listSessions();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderPage(sessions));
      return;
    }

    // GET /api/session/:filename → read JSONL and return messages
    if (req.method === 'GET' && url.pathname.startsWith('/api/session/')) {
      const filename = decodeURIComponent(url.pathname.replace('/api/session/', ''));
      const filePath = path.join(SESSIONS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        json(res, { error: 'Session not found: ' + filename }, 404);
        return;
      }
      const messages = readJSONL(filePath);
      json(res, { messages });
      return;
    }

    // GET /api/open/:filename → open file in default editor
    if (req.method === 'GET' && url.pathname.startsWith('/api/open/')) {
      const filename = decodeURIComponent(url.pathname.replace('/api/open/', ''));
      const filePath = path.join(SESSIONS_DIR, filename);
      if (fs.existsSync(filePath)) {
        const cmd = process.platform === 'win32'
          ? 'start "" "' + filePath + '"'
          : process.platform === 'darwin'
            ? 'open "' + filePath + '"'
            : 'xdg-open "' + filePath + '"';
        exec(cmd);
      }
      json(res, { ok: true });
      return;
    }

    // GET /api/sessions → list all sessions as JSON
    if (req.method === 'GET' && url.pathname === '/api/sessions') {
      json(res, listSessions());
      return;
    }

    // 404
    json(res, { error: 'Not found' }, 404);
  } catch (e) {
    json(res, { error: e.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  📋 Reasonix 会话浏览器已启动');
  console.log('  → 打开浏览器访问: http://localhost:' + PORT);
  console.log('  → 按 Ctrl+C 停止');
  console.log('');
});
