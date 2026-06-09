<template>
  <div class="home-view">
    <!-- Hero 欢迎区 -->
    <section class="hero-section animate-fade-in-up">
      <div class="hero-accent"></div>
      <h1 class="hero-title">Excel Tools</h1>
      <p class="hero-subtitle">
        基于 Electron + ExcelJS 的高性能 Excel 自动化平台
      </p>
      <div class="hero-meta">
        <span class="hero-badge">v{{ version }}</span>
        <span class="hero-badge">Electron 31</span>
        <span class="hero-badge">ExcelJS 4</span>
      </div>
    </section>

    <!-- 功能卡片网格 -->
    <section class="features-section stagger-children">
      <article class="feature-card">
        <div class="feature-icon" style="background: rgba(8,145,178,0.1); color: var(--primary)">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/>
          </svg>
        </div>
        <h3 class="feature-title">Excel 拆分</h3>
        <p class="feature-desc">按规则对多个 sheet 执行分组拆分，支持模板样式保留、文件后缀自定义、空值过滤。</p>
        <div class="feature-actions">
          <el-button type="primary" size="medium" round @click="emit('navigate', 'split')">
            开始拆分 →
          </el-button>
        </div>
      </article>

      <article class="feature-card">
        <div class="feature-icon" style="background: rgba(16,185,129,0.1); color: var(--success)">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </div>
        <h3 class="feature-title">合并汇总</h3>
        <p class="feature-desc">多文件多 sheet 智能合并，供应商排序、列映射、透传、头部行对齐。</p>
        <div class="feature-actions">
          <el-button type="success" size="medium" round @click="emit('navigate', 'merge')">
            开始合并 →
          </el-button>
        </div>
      </article>

      <article class="feature-card">
        <div class="feature-icon" style="background: rgba(245,158,11,0.1); color: var(--warning)">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h3 class="feature-title">文件压缩</h3>
        <p class="feature-desc">XLSX ZIP 级别深度压缩——清理空单元格、冗余 XML、隐藏元数据，显著减小文件体积，兼容 Office。</p>
        <div class="feature-actions">
          <el-button type="warning" size="medium" round @click="emit('navigate', 'optimize')">
            开始压缩 →
          </el-button>
        </div>
      </article>

      <article class="feature-card">
        <div class="feature-icon" style="background: rgba(139,92,246,0.1); color: #8b5cf6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </div>
        <h3 class="feature-title">发送工具</h3>
        <p class="feature-desc">按规则表将文件通过微信或邮件自动分发，支持混搭通道、文件夹扫描、变量替换。</p>
        <div class="feature-actions">
          <el-button type="primary" size="medium" round @click="emit('navigate', 'send')">
            开始发送 →
          </el-button>
        </div>
      </article>
    </section>

    <!-- 快速统计 -->
    <section class="stats-section animate-fade-in-up">
      <el-card shadow="never" class="panel-card">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-num">4</span>
            <span class="stat-desc">核心功能</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">Worker</span>
            <span class="stat-desc">异步处理</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">4.4.x</span>
            <span class="stat-desc">ExcelJS</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num">31</span>
            <span class="stat-desc">Electron</span>
          </div>
        </div>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.home-view {
  max-width: 900px;
  margin: 0 auto;
}

/* ---- Hero 区 ---- */
.hero-section {
  text-align: center;
  padding: 48px 24px 36px;
  position: relative;
}
.hero-accent {
  width: 48px;
  height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 2px;
  margin: 0 auto 24px;
}
.hero-title {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin: 0 0 10px;
}
.hero-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0 0 20px;
  line-height: 1.5;
}
.hero-meta {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.hero-badge {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-light);
}

/* ---- 功能卡片 ---- */
.features-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.feature-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 28px 24px 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
}
.feature-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-3px);
  border-color: var(--primary-lighter);
}
.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.feature-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}
.feature-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 auto;
  flex: 1;
}
.feature-actions {
  margin-top: 18px;
}

/* ---- 快速统计 ---- */
.stats-section {
  margin-bottom: 16px;
}
.stats-section .panel-card {
  margin-bottom: 0;
}
.stats-grid {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 8px 0;
}
.stat-item {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-num {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
  color: var(--primary);
}
.stat-desc {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border);
}

/* ---- 响应式 ---- */
@media (max-width: 900px) {
  .features-section {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .features-section {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: 28px;
  }
}
</style>

<script setup>
import { version } from "../../package.json";

const emit = defineEmits(['navigate']);
</script>
