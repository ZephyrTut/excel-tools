import importlib.util
import pathlib
import tempfile
import unittest
from unittest import mock


class FakeRect:
    def __init__(self, left=100, top=200, right=900, bottom=900):
        self.left = left
        self.top = top
        self.right = right
        self.bottom = bottom


MODULE_PATH = pathlib.Path(__file__).with_name("wechat_sender.py")
SPEC = importlib.util.spec_from_file_location("wechat_sender", MODULE_PATH)
wechat_sender = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wechat_sender)


class FakeControl:
    def __init__(
        self,
        name="",
        control_type="TextControl",
        class_name="WeChatMainWndForPC",
        rect=None,
        children=None,
    ):
        self.Name = name
        self.ControlTypeName = control_type
        self.ClassName = class_name
        self.BoundingRectangle = rect or FakeRect()
        self._children = list(children or [])
        self.sent_keys = []
        self.active = False
        self.focused = False
        self.clicked = False

    def GetChildren(self):
        return list(self._children)

    def Exists(self, maxSearchSeconds=None):
        return True

    def Click(self):
        self.clicked = True

    def SetActive(self):
        self.active = True

    def SetFocus(self):
        self.focused = True

    def SendKeys(self, keys):
        self.sent_keys.append(keys)


class FakeExistsControl:
    def __init__(self, exists):
        self._exists = exists
        self.clicked = False

    def Exists(self, maxSearchSeconds=None):
        return self._exists

    def Click(self):
        self.clicked = True


class FakeAutoModule:
    def __init__(
        self,
        wechat,
        wechat_exists=True,
        group_section_exists=True,
        chat_edit_exists=True,
        search_panel_open=False,
    ):
        self._wechat = wechat
        self._wechat_exists = wechat_exists
        self._group_section_exists = group_section_exists
        self._chat_edit_exists = chat_edit_exists
        self._search_panel_open = search_panel_open
        self.clicks = []

    def WindowControl(self, **_kwargs):
        if self._wechat_exists:
            return self._wechat
        return FakeExistsControl(False)

    def EditControl(self, **_kwargs):
        return FakeExistsControl(self._chat_edit_exists)

    def TextControl(self, **kwargs):
        subname = kwargs.get("SubName", "")
        if subname in ("群聊", "缇よ亰"):
            return FakeExistsControl(self._group_section_exists)
        if subname.startswith("搜索") or subname in ("搜索网络结果", "最常使用"):
            return FakeExistsControl(self._search_panel_open)
        return FakeExistsControl(False)

    def Click(self, x, y):
        self.clicks.append((x, y))


class WechatSenderTests(unittest.TestCase):
    def run_send(self, fake_auto, group_name="测试群1", clipboard_result=True):
        with tempfile.NamedTemporaryFile(suffix=".xlsx") as handle:
            with mock.patch.object(wechat_sender, "auto", fake_auto), \
                mock.patch.object(wechat_sender.time, "sleep", return_value=None), \
                mock.patch.object(
                    wechat_sender,
                    "copy_file_to_clipboard",
                    return_value=clipboard_result,
                ):
                return wechat_sender.send_file_to_group(group_name, handle.name)

    def test_send_success_uses_enter_then_clipboard_paste(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(root, group_section_exists=True)

        result = self.run_send(fake_auto)

        self.assertTrue(result["success"])
        self.assertEqual(
            root.sent_keys,
            ["{Ctrl}f", "{Ctrl}a", "测试群1", "{Enter}", "{Ctrl}v", "{Enter}"],
        )

    def test_wechat41_network_result_first_clicks_group_result_row(self):
        root = FakeControl("微信", "WindowControl", class_name="Qt51514QWindowIcon")
        fake_auto = FakeAutoModule(root, chat_edit_exists=True)

        with mock.patch.object(
            wechat_sender,
            "is_network_search_entry_first",
            return_value=True,
        ), mock.patch.object(
            wechat_sender,
            "has_wechat41_candidate_result",
            return_value=True,
        ):
            result = self.run_send(fake_auto, group_name="测试群1")

        self.assertTrue(result["success"])
        self.assertEqual(fake_auto.clicks, [(280, 270), (260, 455), (720, 830)])
        self.assertNotIn("{Enter}", root.sent_keys[:-1])

    def test_wechat41_most_used_first_clicks_top_result_row(self):
        root = FakeControl("微信", "WindowControl", class_name="Qt51514QWindowIcon")
        fake_auto = FakeAutoModule(root, chat_edit_exists=True)

        with mock.patch.object(
            wechat_sender,
            "is_network_search_entry_first",
            return_value=False,
        ), mock.patch.object(
            wechat_sender,
            "has_wechat41_candidate_result",
            return_value=True,
        ):
            result = self.run_send(fake_auto, group_name="测试群5")

        self.assertTrue(result["success"])
        self.assertEqual(fake_auto.clicks, [(280, 270), (260, 370), (720, 830)])
        self.assertNotIn("{Enter}", root.sent_keys[:-1])

    def test_wechat41_fails_when_only_chat_history_message_matches(self):
        root = FakeControl("微信", "WindowControl", class_name="Qt51514QWindowIcon")
        fake_auto = FakeAutoModule(root, chat_edit_exists=False)

        with mock.patch.object(
            wechat_sender,
            "is_network_search_entry_first",
            return_value=True,
        ), mock.patch.object(
            wechat_sender,
            "is_wechat41_candidate_inside_search_popup",
            return_value=True,
        ), mock.patch.object(
            wechat_sender,
            "has_wechat41_result_avatar",
            return_value=True,
        ), mock.patch.object(
            wechat_sender,
            "has_wechat41_candidate_title_highlight",
            return_value=False,
        ):
            result = self.run_send(fake_auto, group_name="测试群3")

        self.assertFalse(result["success"])
        self.assertEqual(fake_auto.clicks, [(280, 270)])
        self.assertNotIn("{Ctrl}v", root.sent_keys)

    def test_wechat41_fails_when_candidate_row_has_no_avatar(self):
        root = FakeControl("微信", "WindowControl", class_name="Qt51514QWindowIcon")
        fake_auto = FakeAutoModule(root, chat_edit_exists=False)

        with mock.patch.object(
            wechat_sender,
            "is_network_search_entry_first",
            return_value=True,
        ), mock.patch.object(
            wechat_sender,
            "has_wechat41_candidate_result",
            return_value=False,
        ):
            result = self.run_send(fake_auto, group_name="测试群3")

        self.assertFalse(result["success"])
        self.assertEqual(fake_auto.clicks, [(280, 270)])
        self.assertNotIn("{Ctrl}v", root.sent_keys)

    def test_enters_most_used_result_without_group_section(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(root, group_section_exists=False, chat_edit_exists=True)

        result = self.run_send(fake_auto, group_name="测试群5")

        self.assertTrue(result["success"])
        self.assertEqual(
            root.sent_keys,
            ["{Ctrl}f", "{Ctrl}a", "测试群5", "{Enter}", "{Ctrl}v", "{Enter}"],
        )

    def test_fails_after_enter_when_search_panel_remains_open(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(
            root,
            group_section_exists=True,
            chat_edit_exists=True,
            search_panel_open=True,
        )

        result = self.run_send(fake_auto, group_name="测试群3")

        self.assertFalse(result["success"])
        self.assertIn("{Enter}", root.sent_keys)
        self.assertNotIn("{Ctrl}v", root.sent_keys)

    def test_fails_after_enter_when_chat_input_is_missing(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(
            root,
            group_section_exists=False,
            chat_edit_exists=False,
            search_panel_open=False,
        )

        result = self.run_send(fake_auto, group_name="测试群3")

        self.assertFalse(result["success"])
        self.assertIn("{Enter}", root.sent_keys)
        self.assertNotIn("{Ctrl}v", root.sent_keys)

    def test_fails_when_clipboard_copy_fails(self):
        root = FakeControl("微信", "WindowControl")
        fake_auto = FakeAutoModule(root)

        result = self.run_send(fake_auto, clipboard_result=False)

        self.assertFalse(result["success"])
        self.assertNotIn("{Ctrl}v", root.sent_keys)

    def test_fails_when_file_not_exists(self):
        result = wechat_sender.send_file_to_group("测试群1", "Z:/not-found.xlsx")
        self.assertFalse(result["success"])


if __name__ == "__main__":
    unittest.main()
