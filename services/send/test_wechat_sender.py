import importlib.util
import pathlib
import tempfile
import unittest
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).with_name("wechat_sender.py")
SPEC = importlib.util.spec_from_file_location("wechat_sender", MODULE_PATH)
wechat_sender = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wechat_sender)


class FakeControl:
    def __init__(self, name="", control_type="TextControl", children=None):
        self.Name = name
        self.ControlTypeName = control_type
        self._children = list(children or [])
        self.sent_keys = []
        self.active = False
        self.focused = False

    def GetChildren(self):
        return list(self._children)

    def Exists(self, maxSearchSeconds=None):
        return True

    def SetActive(self):
        self.active = True

    def SetFocus(self):
        self.focused = True

    def SendKeys(self, keys):
        self.sent_keys.append(keys)


class FakeExistsControl:
    def __init__(self, exists):
        self._exists = exists

    def Exists(self, maxSearchSeconds=None):
        return self._exists


class FakeAutoModule:
    def __init__(self, wechat, no_result_exists=False, wechat_exists=True):
        self._wechat = wechat
        self._no_result_exists = no_result_exists
        self._wechat_exists = wechat_exists

    def WindowControl(self, **_kwargs):
        if self._wechat_exists:
            return self._wechat
        return FakeExistsControl(False)

    def TextControl(self, **_kwargs):
        return FakeExistsControl(self._no_result_exists)


class WechatSenderTests(unittest.TestCase):
    def test_send_success_uses_clipboard_paste_instead_of_file_dialog(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(root)

        with tempfile.NamedTemporaryFile(suffix=".xlsx") as handle:
            with mock.patch.object(wechat_sender, "auto", fake_auto), \
                mock.patch.object(wechat_sender.time, "sleep", return_value=None), \
                mock.patch.object(wechat_sender, "copy_file_to_clipboard", return_value=True):
                result = wechat_sender.send_file_to_group("测试群1", handle.name)

        self.assertTrue(result["success"])
        self.assertEqual(
            root.sent_keys,
            ["{Ctrl}f", "{Ctrl}a", "测试群1", "{Enter}", "{Ctrl}v", "{Enter}"],
        )

    def test_fails_when_group_not_found(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(root, no_result_exists=True)

        with tempfile.NamedTemporaryFile(suffix=".xlsx") as handle:
            with mock.patch.object(wechat_sender, "auto", fake_auto), \
                mock.patch.object(wechat_sender.time, "sleep", return_value=None), \
                mock.patch.object(wechat_sender, "copy_file_to_clipboard", return_value=True):
                result = wechat_sender.send_file_to_group("测试群3", handle.name)

        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "未找到微信群「测试群3」")
        self.assertNotIn("{Ctrl}v", root.sent_keys)

    def test_fails_when_clipboard_copy_fails(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(root)

        with tempfile.NamedTemporaryFile(suffix=".xlsx") as handle:
            with mock.patch.object(wechat_sender, "auto", fake_auto), \
                mock.patch.object(wechat_sender.time, "sleep", return_value=None), \
                mock.patch.object(wechat_sender, "copy_file_to_clipboard", return_value=False):
                result = wechat_sender.send_file_to_group("测试群1", handle.name)

        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "无法将文件复制到剪贴板")
        self.assertNotIn("{Ctrl}v", root.sent_keys)

    def test_fails_when_file_not_exists(self):
        result = wechat_sender.send_file_to_group("测试群1", "Z:/not-found.xlsx")
        self.assertFalse(result["success"])
        self.assertIn("文件不存在", result["error"])


if __name__ == "__main__":
    unittest.main()
