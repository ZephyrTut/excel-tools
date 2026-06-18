# python
"""wx4py 快速测试 — 发消息到微信群"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from wx4py import WeChatClient, WeChatNotFoundError, ControlNotFoundError

GROUP = "测试群3"
MESSAGE = "测试一下！"

print(f"目标: {GROUP}")
print(f"消息: {MESSAGE}")

try:
    with WeChatClient() as wx:
        wx.chat_window.send_to(GROUP, MESSAGE, target_type='group')
except WeChatNotFoundError:
    print("❌ 未找到微信窗口，请确保微信已登录且窗口可见")
except ControlNotFoundError as e:
    print(f"❌ 未找到控件: {e}")
except Exception as e:
    print(f"❌ 错误: {e}")
