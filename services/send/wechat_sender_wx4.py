#!/usr/bin/env python3
"""
微信 PC 端发送 — wx4py 方案（UIA 直接操控控件，替代截图+OCR+坐标盲点）

原则:
  - 群存在 → UIA 搜索并打开聊天 → 粘贴并发送文件 ✅
  - 群不存在 → TargetNotFoundError → 控制台醒目报错 ❌
  - 不做截图、OCR、盲坐标点击

用法（由 wechatController.js 通过 execFile 调用）:
  python wechat_sender_wx4.py --group "测试群5" --file "C:/path/file.xlsx"

返回（stdout 纯 JSON，无任何其他内容）:
  {"success": true, "group": "群名", "file": "路径"}
  {"success": false, "error": "未找到群聊「xxx」..."}
"""

import argparse
import json
import sys
import io
import os

# 在导入 wx4py 之前，重定向 stdout 防止第三方库向 stdout 输出内容污染 JSON
# wx4py / uiautomation / comtypes 可能在 import 或运行时向 stdout 打印日志
_real_stdout = sys.stdout
_real_stderr = sys.stderr
sys.stdout = io.StringIO()

# 确保 stderr 编码正确（错误/日志走这里）
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from wx4py import (
    WeChatClient,
    WeChatNotFoundError,
    TargetNotFoundError,
    ControlNotFoundError,
)

# 恢复真实 stdout，后续仅通过 print(json.dumps(...)) 输出
sys.stdout = _real_stdout
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def send_file(group_name: str, file_path: str) -> dict:
    """通过 UIA 发送文件到微信群。成功返回 {"success": True}，失败含 error。"""
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        return {"success": False, "error": f"文件不存在: {abs_path}"}

    # 重定向 stdout 防止 wx4py 操作过程中污染 JSON 输出
    _real_stdout = sys.stdout
    sys.stdout = io.StringIO()

    try:
        with WeChatClient() as wx:
            # 打开群聊（不存在会抛 TargetNotFoundError）
            wx.chat_window.open_chat(
                group_name, target_type="group", raise_on_target_not_found=True
            )
            # 直接发送文件（不再通过 send_file_to，它内部会重复 open_chat）
            wx.chat_window.send_file(abs_path)
        return {"success": True, "group": group_name, "file": abs_path}
    except TargetNotFoundError:
        return {
            "success": False,
            "error": f"未找到群聊「{group_name}」，请检查群名是否正确",
        }
    except WeChatNotFoundError:
        return {
            "success": False,
            "error": "未找到微信窗口，请确保微信已登录且窗口可见",
        }
    except ControlNotFoundError as e:
        return {"success": False, "error": f"未找到微信控件: {e}"}
    except Exception as e:
        return {"success": False, "error": f"发送失败: {e}"}
    finally:
        # 恢复真实 stdout
        sys.stdout = _real_stdout


def main():
    parser = argparse.ArgumentParser(description="微信 PC 端发送（wx4py）")
    parser.add_argument("--group", help="微信群名称")
    parser.add_argument("--file", help="文件路径")
    args = parser.parse_args()

    if not args.group or not args.file:
        result = {"success": False, "error": "需要 --group 和 --file 参数"}
    else:
        result = send_file(args.group, args.file)

    # stdout: 纯 JSON → wechatController.js 解析
    print(json.dumps(result, ensure_ascii=True))

    # 失败时 stderr 输出突出提示
    if not result["success"]:
        msg = result.get("error", "未知错误")
        print(f"\n{'=' * 60}", file=sys.stderr)
        print(f"  ❌ {msg}", file=sys.stderr)
        print(f"{'=' * 60}\n", file=sys.stderr)


if __name__ == "__main__":
    main()
