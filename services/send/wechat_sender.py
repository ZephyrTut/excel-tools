"""WeChat PC sender script driven by uiautomation."""

import argparse
import ctypes
import ctypes.wintypes
import json
import os
import sys
import time


CF_HDROP = 0xF
GMEM_MOVEABLE = 0x0002
GMEM_ZEROINIT = 0x0040
GHND = GMEM_MOVEABLE | GMEM_ZEROINIT


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class DROPFILES(ctypes.Structure):
    _fields_ = [
        ("pFiles", ctypes.wintypes.DWORD),
        ("pt", POINT),
        ("fNC", ctypes.wintypes.BOOL),
        ("fWide", ctypes.wintypes.BOOL),
    ]


_k32 = ctypes.windll.kernel32
_k32.GlobalAlloc.argtypes = [ctypes.wintypes.UINT, ctypes.c_size_t]
_k32.GlobalAlloc.restype = ctypes.wintypes.HGLOBAL
_k32.GlobalLock.argtypes = [ctypes.wintypes.HGLOBAL]
_k32.GlobalLock.restype = ctypes.c_void_p
_k32.GlobalUnlock.argtypes = [ctypes.wintypes.HGLOBAL]
_k32.GlobalUnlock.restype = ctypes.wintypes.BOOL
_k32.GlobalFree.argtypes = [ctypes.wintypes.HGLOBAL]
_k32.GlobalFree.restype = ctypes.wintypes.HGLOBAL

_u32 = ctypes.windll.user32
_u32.OpenClipboard.argtypes = [ctypes.wintypes.HWND]
_u32.OpenClipboard.restype = ctypes.wintypes.BOOL
_u32.EmptyClipboard.argtypes = []
_u32.EmptyClipboard.restype = ctypes.wintypes.BOOL
_u32.SetClipboardData.argtypes = [ctypes.wintypes.UINT, ctypes.wintypes.HANDLE]
_u32.SetClipboardData.restype = ctypes.wintypes.HANDLE
_u32.CloseClipboard.argtypes = []
_u32.CloseClipboard.restype = ctypes.wintypes.BOOL


try:
    import uiautomation as auto
except ImportError:
    result = {"success": False, "error": "uiautomation 未安装，请运行: pip install uiautomation"}
    print(json.dumps(result, ensure_ascii=True))
    sys.exit(0)


def copy_file_to_clipboard(file_path: str) -> bool:
    """Put the file path into the Windows clipboard as CF_HDROP."""
    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        return False

    files_encoded = abs_path.encode("utf-16-le") + b"\0\0"
    drop_files = DROPFILES()
    drop_files.pFiles = ctypes.sizeof(DROPFILES)
    drop_files.fWide = True

    buf_size = ctypes.sizeof(DROPFILES) + len(files_encoded)
    buffer = ctypes.create_string_buffer(buf_size)
    ctypes.memmove(buffer, ctypes.byref(drop_files), ctypes.sizeof(DROPFILES))
    ctypes.memmove(
        ctypes.byref(buffer, ctypes.sizeof(DROPFILES)),
        files_encoded,
        len(files_encoded),
    )

    h_mem = _k32.GlobalAlloc(GHND, buf_size)
    if not h_mem:
        return False

    locked = _k32.GlobalLock(h_mem)
    if not locked:
        _k32.GlobalFree(h_mem)
        return False

    ctypes.memmove(locked, buffer, buf_size)
    _k32.GlobalUnlock(h_mem)

    if not _u32.OpenClipboard(None):
        _k32.GlobalFree(h_mem)
        return False

    try:
        if not _u32.EmptyClipboard():
            _k32.GlobalFree(h_mem)
            return False
        result = _u32.SetClipboardData(CF_HDROP, h_mem)
        return bool(result)
    finally:
        _u32.CloseClipboard()


def send_file_to_group(group_name: str, file_path: str) -> dict:
    if not os.path.exists(file_path):
        return {"success": False, "error": f"文件不存在: {file_path}"}

    abs_path = os.path.abspath(file_path)

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

    wechat.SendKeys("{Ctrl}f")
    time.sleep(0.3)
    wechat.SendKeys("{Ctrl}a")
    wechat.SendKeys(group_name)
    time.sleep(1.5)

    group_chat = auto.TextControl(searchDepth=10, SubName="群聊")
    if not group_chat.Exists(maxSearchSeconds=1):
        return {"success": False, "error": f"未找到微信群「{group_name}」"}

    wechat.SendKeys("{Enter}")
    time.sleep(0.8)

    edit = auto.EditControl(searchDepth=3)
    if edit.Exists(maxSearchSeconds=1):
        edit.Click()
        time.sleep(0.3)

    if not copy_file_to_clipboard(abs_path):
        return {"success": False, "error": "无法将文件复制到剪贴板"}

    time.sleep(0.8)
    wechat.SendKeys("{Ctrl}v")
    time.sleep(1.5)
    wechat.SendKeys("{Enter}")
    time.sleep(0.8)

    return {"success": True, "group": group_name, "file": abs_path}


def minimize_wechat() -> dict:
    """Minimize the WeChat PC main window."""
    wechat = auto.WindowControl(searchDepth=1, ClassName="WeChatMainWndForPC")
    if not wechat.Exists(maxSearchSeconds=3):
        wechat = auto.WindowControl(searchDepth=1, Name="微信")
    if not wechat.Exists(maxSearchSeconds=3):
        wechat = auto.WindowControl(searchDepth=1, SubName="微信")
    if not wechat.Exists(maxSearchSeconds=5):
        return {"success": False, "error": "未找到微信窗口"}

    try:
        wechat.GetWindowPattern().SetWindowVisualState(2)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="微信 PC 端发送文件")
    parser.add_argument("--action", choices=["send", "minimize"], default="send", help="操作类型：发送文件或最小化窗口")
    parser.add_argument("--group", help="目标微信群名称")
    parser.add_argument("--file", help="要发送的文件路径")
    args = parser.parse_args()

    if args.action == "minimize":
        result = minimize_wechat()
    else:
        if not args.group or not args.file:
            result = {"success": False, "error": "send 操作需要 --group 和 --file 参数"}
        else:
            result = send_file_to_group(args.group, args.file)
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()

