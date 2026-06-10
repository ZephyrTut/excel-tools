"""WeChat PC sender script driven by uiautomation."""

import argparse
import ctypes
import ctypes.wintypes
import json
import os
import sys
import time

try:
    from PIL import ImageGrab
except ImportError:
    ImageGrab = None


CF_HDROP = 0xF
GMEM_MOVEABLE = 0x0002
GMEM_ZEROINIT = 0x0040
GHND = GMEM_MOVEABLE | GMEM_ZEROINIT

SEARCH_PANEL_MARKERS = ("搜索网络结果", "最常使用")
WECHAT41_CLASS_NAME = "Qt51514QWindowIcon"
WECHAT41_RESULT_X_OFFSET = 160
WECHAT41_TOP_RESULT_Y_OFFSET = 170
WECHAT41_GROUP_RESULT_Y_OFFSET = 255
WECHAT41_SEARCH_X_OFFSET = 180
WECHAT41_SEARCH_Y_OFFSET = 70
WECHAT41_INPUT_X_OFFSET = 620
WECHAT41_INPUT_BOTTOM_OFFSET = 70


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
    result = {"success": False, "error": "uiautomation 未安装，请运行 pip install uiautomation"}
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


def find_wechat_window():
    wechat = auto.WindowControl(searchDepth=1, ClassName="WeChatMainWndForPC")
    if not wechat.Exists(maxSearchSeconds=2):
        wechat = auto.WindowControl(searchDepth=1, ClassName=WECHAT41_CLASS_NAME)
    if not wechat.Exists(maxSearchSeconds=3):
        wechat = auto.WindowControl(searchDepth=1, Name="微信")
    if not wechat.Exists(maxSearchSeconds=3):
        wechat = auto.WindowControl(searchDepth=1, SubName="微信")
    return wechat


def is_wechat41_window(wechat) -> bool:
    try:
        return wechat.ClassName == WECHAT41_CLASS_NAME
    except Exception:
        return False


def has_red_pixels_in_window_box(wechat, box_offsets) -> bool:
    if ImageGrab is None:
        return False

    try:
        rect = wechat.BoundingRectangle
        box = (
            rect.left + box_offsets[0],
            rect.top + box_offsets[1],
            rect.left + box_offsets[2],
            rect.top + box_offsets[3],
        )
        image = ImageGrab.grab(bbox=box).convert("RGB")
    except Exception:
        return False

    red_pixels = 0
    for red, green, blue in image.getdata():
        if red >= 180 and green <= 90 and blue <= 90:
            red_pixels += 1
            if red_pixels >= 8:
                return True
    return False


def is_network_search_entry_first(wechat) -> bool:
    """Detect whether WeChat 4.1 shows the red network-search entry first."""
    # The red "搜索网络结果" marker appears near the top-left of the
    # search result panel only in the layout where the network entry is
    # above the real group result.
    return has_red_pixels_in_window_box(wechat, (65, 70, 125, 130))


def click_wechat41_search_result(wechat, group_name: str) -> None:
    rect = wechat.BoundingRectangle
    y_offset = (
        WECHAT41_GROUP_RESULT_Y_OFFSET
        if is_network_search_entry_first(wechat)
        else WECHAT41_TOP_RESULT_Y_OFFSET
    )
    auto.Click(rect.left + WECHAT41_RESULT_X_OFFSET, rect.top + y_offset)


def click_wechat41_search_box(wechat) -> None:
    rect = wechat.BoundingRectangle
    auto.Click(rect.left + WECHAT41_SEARCH_X_OFFSET, rect.top + WECHAT41_SEARCH_Y_OFFSET)


def has_wechat41_result_avatar(wechat, y_offset: int) -> bool:
    """Check whether the candidate row looks like a real chat/group result."""
    if ImageGrab is None:
        return False

    try:
        rect = wechat.BoundingRectangle
        image = ImageGrab.grab(
            bbox=(
                rect.left + 25,
                rect.top + y_offset - 35,
                rect.left + 90,
                rect.top + y_offset + 35,
            )
        ).convert("RGB")
    except Exception:
        return False

    colorful_or_bright = 0
    for red, green, blue in image.getdata():
        contrast = max(red, green, blue) - min(red, green, blue)
        if (red + green + blue) >= 180 and contrast >= 18:
            colorful_or_bright += 1
            if colorful_or_bright >= 80:
                return True
    return False


def has_wechat41_candidate_title_highlight(wechat, y_offset: int) -> bool:
    """Real WeChat search hits show the matched group name in green on row 1."""
    if ImageGrab is None:
        return False

    try:
        rect = wechat.BoundingRectangle
        image = ImageGrab.grab(
            bbox=(
                rect.left + 145,
                rect.top + y_offset - 22,
                rect.left + 280,
                rect.top + y_offset + 2,
            )
        ).convert("RGB")
    except Exception:
        return False

    green_pixels = 0
    for red, green, blue in image.getdata():
        if green >= 120 and red <= 90 and blue <= 140:
            green_pixels += 1
            if green_pixels >= 80:
                return True
    return False


def is_wechat41_selected_chat_green(pixel) -> bool:
    red, green, blue = pixel
    return green >= 120 and red <= 60 and blue <= 130


def is_wechat41_candidate_inside_search_popup(wechat, y_offset: int) -> bool:
    if ImageGrab is None:
        return False

    try:
        rect = wechat.BoundingRectangle
        image = ImageGrab.grab(
            bbox=(
                rect.left + 230,
                rect.top + y_offset - 10,
                rect.left + 290,
                rect.top + y_offset + 10,
            )
        ).convert("RGB")
    except Exception:
        return False

    pixels = list(image.getdata())
    if not pixels:
        return False

    green_pixels = sum(1 for pixel in pixels if is_wechat41_selected_chat_green(pixel))
    return green_pixels < max(8, len(pixels) // 10)


def get_wechat41_candidate_y_offset(wechat) -> int:
    return (
        WECHAT41_GROUP_RESULT_Y_OFFSET
        if is_network_search_entry_first(wechat)
        else WECHAT41_TOP_RESULT_Y_OFFSET
    )


def has_wechat41_candidate_result(wechat) -> bool:
    y_offset = get_wechat41_candidate_y_offset(wechat)
    return (
        is_wechat41_candidate_inside_search_popup(wechat, y_offset)
        and has_wechat41_result_avatar(wechat, y_offset)
        and has_wechat41_candidate_title_highlight(wechat, y_offset)
    )


def click_wechat41_chat_input(wechat) -> None:
    rect = wechat.BoundingRectangle
    auto.Click(rect.left + WECHAT41_INPUT_X_OFFSET, rect.bottom - WECHAT41_INPUT_BOTTOM_OFFSET)


def is_search_panel_open(group_name: str) -> bool:
    """Detect whether WeChat is still showing the left search-result panel."""
    markers = (*SEARCH_PANEL_MARKERS, f"搜索 {group_name}", f"搜索{group_name}")
    for marker in markers:
        try:
            if auto.TextControl(searchDepth=10, SubName=marker).Exists(maxSearchSeconds=0.2):
                return True
        except Exception:
            continue
    return False


def wait_for_chat_edit(group_name: str, timeout_seconds=3.0):
    """Return the chat input after Enter opens a conversation, or None."""
    deadline = time.monotonic() + timeout_seconds
    edit = None
    while time.monotonic() < deadline:
        if is_search_panel_open(group_name):
            time.sleep(0.2)
            continue

        edit = auto.EditControl(searchDepth=8)
        if edit.Exists(maxSearchSeconds=0.2):
            return edit

        time.sleep(0.2)
    return None


def send_file_to_group(group_name: str, file_path: str) -> dict:
    if not os.path.exists(file_path):
        return {"success": False, "error": f"文件不存在: {file_path}"}

    abs_path = os.path.abspath(file_path)

    wechat = find_wechat_window()
    if not wechat.Exists(maxSearchSeconds=5):
        return {"success": False, "error": "未找到微信窗口，请确保微信已登录并打开"}

    wechat.SetActive()
    wechat.SetFocus()
    time.sleep(0.5)

    if is_wechat41_window(wechat):
        click_wechat41_search_box(wechat)
    else:
        # Keep the legacy flow: it works on old WeChat.
        wechat.SendKeys("{Ctrl}f")
    time.sleep(0.8)
    wechat.SendKeys("{Ctrl}a")
    wechat.SendKeys(group_name)
    time.sleep(1.2)

    if is_wechat41_window(wechat):
        if not has_wechat41_candidate_result(wechat):
            return {"success": False, "error": f"未找到微信群「{group_name}」"}
        click_wechat41_search_result(wechat, group_name)
        time.sleep(0.5)
        click_wechat41_chat_input(wechat)
    else:
        wechat.SendKeys("{Enter}")
        edit = wait_for_chat_edit(group_name, timeout_seconds=3.0)
        if edit is None:
            return {"success": False, "error": f"未找到微信群「{group_name}」"}
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
    wechat = find_wechat_window()
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
