---
name: wx4-skill
description: 微信自动化操作 skill，用于帮助用户快速完成微信消息群发、文件发送、群管理、聊天记录获取、多群监听、AI 自动回复等自动化任务。当用户需要批量发送微信消息、管理微信群、获取聊天记录、监听群消息、或接入 AI 群聊机器人时使用此 skill。
---

# 微信自动化操作 Skill

## ⚠️ 使用前必读：安装检查

**在执行任何操作前，必须先确认 wx4py 库已安装。**

### 步骤1：检查是否已安装

```python
try:
    from wx4py import WeChatClient
    print("✅ wx4py 已安装")
except ImportError:
    print("❌ 未安装 wx4py")
```

### 步骤2：如果未安装，执行安装

```bash
# 方法1：从 PyPI 安装（推荐）
pip install wx4py

# 方法2：从 GitHub 安装（最新版）
pip install git+https://github.com/claw-codes/wx4py.git
```

### 步骤3：验证安装成功

```python
from wx4py import WeChatClient
print("✅ 安装成功！")
import wx4py
print(f"版本: {wx4py.__version__}")
```

---

## 概述

本 skill 基于 wx4py 库，帮助用户通过 Python 代码自动化控制 Windows 微信客户端，完成重复性的消息发送、群管理等任务。

**适用场景**：
- 批量群发通知到多个群或联系人
- 定时发送文件、图片、消息
- 获取和分析聊天记录
- 管理群公告、群昵称、免打扰等设置
- 监听多个群聊消息，并在被 @ 时自动回复
- 接入 OpenAI 兼容接口或自定义 AI 回调，构建群聊机器人

**前置要求**：
- Windows 系统
- 微信 PC 客户端已安装并登录（Qt 版本，已测试 4.1.7.59、4.1.8.29）
- Python >=3.9

---

## 核心功能

### 1. 消息/文件发送

```python
from wx4py import WeChatClient

with WeChatClient() as wx:
    # 发消息到群
    wx.chat_window.send_to("测试群5", "通知消息", target_type='group')
    # 发文件到群
    wx.chat_window.send_file_to("测试群5", r"C:\file.xlsx", target_type='group')
    # 批量群发
    wx.chat_window.batch_send(["群1", "群2"], "消息", target_type='group')
```

### 2. 聊天记录获取

```python
with WeChatClient() as wx:
    msgs = wx.chat_window.get_chat_history("工作群", target_type='group', since='today')
    for m in msgs:
        print(f"[{m['time']}] {m['content']}")
```

### 3. 群管理

```python
with WeChatClient() as wx:
    members = wx.group_manager.get_group_members("工作群")
    wx.group_manager.set_do_not_disturb("工作群", enable=True)
    wx.group_manager.set_pin_chat("工作群", enable=True)
    wx.group_manager.modify_announcement_simple("工作群", "新公告内容")
```

### 4. 群聊监听 + AI 自动回复

```python
from wx4py import AsyncCallbackHandler, MessageEvent, WeChatClient

def reply(event: MessageEvent):
    if not event.is_at_me:
        return ""
    return f"收到：{event.content}"

with WeChatClient(auto_connect=True) as wx:
    wx.process_groups(
        ["工作群"],
        [AsyncCallbackHandler(reply, auto_reply=True, reply_on_at=True)],
        block=True,
    )
```

---

## 注意事项

- 仅支持 Windows，微信需已登录且窗口可见
- 操作期间不要手动操作微信窗口
- 使用上下文管理器（`with WeChatClient() as wx:`）确保连接正确释放

---

## 快速参考

| 操作 | 方法 |
|------|------|
| 发消息到群 | `wx.chat_window.send_to("群名", "消息", target_type='group')` |
| 批量群发 | `wx.chat_window.batch_send(["群1", "群2"], "消息", target_type='group')` |
| 发文件到群 | `wx.chat_window.send_file_to("群名", r"C:\file.xlsx", target_type='group')` |
| 获取聊天记录 | `wx.chat_window.get_chat_history("群名", 'group', 'today')` |
| 获取群成员 | `wx.group_manager.get_group_members("群名")` |
| 消息免打扰 | `wx.group_manager.set_do_not_disturb("群名", True)` |
| 监听/处理多群 | `wx.process_groups(["群1"], [handler], block=True)` |
