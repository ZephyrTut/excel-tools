"""微信 PC 端 uiautomation 发送文件脚本

用法:
    python wechat_sender.py --group "管理层工作群" --file "D:/reports/月报.xlsx"

返回:
    stdout 输出 JSON: {"success": true/false, "group": "...", "file": "...", "error": "..."}
"""

import argparse
import json
import sys
import time

try:
    import uiautomation as auto
except ImportError:
    print(json.dumps({"success": False, "error": "uiautomation 未安装，请运行: pip install uiautomation"}))
    sys.exit(1)


def send_file_to_group(group_name: str, file_path: str) -> dict:
    """通过 uiautomation 操作微信 PC 客户端发送文件到指定群聊"""

    # 1. 查找微信窗口
    wechat = auto.WindowControl(searchDepth=1, ClassName="WeChatMainWndForPC")
    if not wechat.Exists(maxSearchSeconds=3):
        wechat = auto.WindowControl(searchDepth=1, Name="微信")
    if not wechat.Exists(maxSearchSeconds=3):
        wechat = auto.WindowControl(searchDepth=1, SubName="微信")

    if not wechat.Exists(maxSearchSeconds=5):
        return {"success": False, "error": "未找到微信窗口，请确保微信已登录并打开"}

    wechat.SetActive()
    wechat.SetFocus()
    time.sleep(0.5)

    # 2. 搜索目标群聊：Ctrl+F -> 输入群名 -> Enter
    wechat.SendKeys("{Ctrl}f")
    time.sleep(0.3)

    wechat.SendKeys("{Ctrl}a")
    wechat.SendKeys(group_name)
    time.sleep(0.5)
    wechat.SendKeys("{Enter}")
    time.sleep(0.5)

    # 3. 发送文件快捷键
    wechat.SendKeys("{Ctrl}{Alt}f")
    time.sleep(0.5)

    # 4. 在文件选择对话框中输入文件路径
    file_dialog = auto.WindowControl(searchDepth=2, ClassName="#32770")
    if file_dialog.Exists(maxSearchSeconds=3):
        edit = file_dialog.EditControl(searchDepth=3)
        if edit.Exists():
            edit.SendKeys(file_path)
            time.sleep(0.3)
            open_btn = file_dialog.ButtonControl(searchDepth=3, Name="打开")
            if not open_btn.Exists():
                open_btn = file_dialog.ButtonControl(searchDepth=3, Name="Open")
            if open_btn.Exists():
                open_btn.Click()
                time.sleep(1.0)
                wechat.SendKeys("{Enter}")
                time.sleep(0.5)
                return {"success": True, "group": group_name, "file": file_path}
            else:
                return {"success": False, "error": "文件对话框中未找到「打开」按钮"}
        else:
            return {"success": False, "error": "文件对话框中未找到文件名输入框"}
    else:
        # 备选：直接输入路径发送
        wechat.SendKeys(file_path)
        time.sleep(0.3)
        wechat.SendKeys("{Enter}")
        time.sleep(1.0)
        return {"success": True, "group": group_name, "file": file_path}


def main():
    parser = argparse.ArgumentParser(description="微信 PC 端发送文件")
    parser.add_argument("--group", required=True, help="目标微信群名称")
    parser.add_argument("--file", required=True, help="要发送的文件路径")
    args = parser.parse_args()

    result = send_file_to_group(args.group, args.file)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
