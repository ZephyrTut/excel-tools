const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const { parseRuleExcel } = require("./parseRuleExcel");

test("parseRuleExcel parses rules and splits delivery channels into arrays", () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("规则");
  ws.addRow([
    "文件名(原)",
    "文件名(映射)",
    "分发方式",
    "微信群名",
    "邮件主题",
    "收件人",
    "抄送人",
  ]);
  ws.addRow([
    "月报.xlsx",
    "{{date}}经营月报.xlsx",
    "微信,邮件",
    "管理群",
    "{{date}} 月报",
    "boss@a.com,ceo@a.com",
    "cto@a.com,hr@a.com",
  ]);
  ws.addRow(["日报.xlsx", "", "微信", "部门群", "", "", ""]);

  const result = parseRuleExcel(ws);

  assert.equal(result.rules.length, 2);
  assert.deepEqual(result.rules[0].channels, ["wechat", "email"]);
  assert.equal(result.rules[0].wechatGroup, "管理群");
  assert.deepEqual(result.rules[0].emailTo, ["boss@a.com", "ceo@a.com"]);
  assert.deepEqual(result.rules[1].channels, ["wechat"]);
});

test("parseRuleExcel skips rows with missing required fields", () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("规则");
  ws.addRow([
    "文件名(原)",
    "文件名(映射)",
    "分发方式",
    "微信群名",
    "邮件主题",
    "收件人",
    "抄送人",
  ]);
  ws.addRow(["月报.xlsx", "", "微信", "", "", "", ""]);

  const result = parseRuleExcel(ws);

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /微信群名为空/);
  assert.equal(result.rules.length, 0);
});

test("parseRuleExcel supports mixed Chinese and English channel labels", () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("规则");
  ws.addRow([
    "文件名(原)",
    "文件名(映射)",
    "分发方式",
    "微信群名",
    "邮件主题",
    "收件人",
    "抄送人",
  ]);
  ws.addRow([
    "月报.xlsx",
    "",
    "微信,email",
    "管理群",
    "月报主题",
    "boss@a.com",
    "",
  ]);
  ws.addRow([
    "日报.xlsx",
    "",
    "wechat,邮件",
    "部门群",
    "日报主题",
    "a@b.com",
    "",
  ]);

  const result = parseRuleExcel(ws);

  assert.equal(result.rules.length, 2);
  assert.equal(result.rules[0].channels.includes("wechat"), true);
  assert.equal(result.rules[1].channels.includes("wechat"), true);
  assert.equal(result.rules[1].channels.includes("email"), true);
});

test("parseRuleExcel handles email-only rows", () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("规则");
  ws.addRow([
    "文件名(原)",
    "文件名(映射)",
    "分发方式",
    "微信群名",
    "邮件主题",
    "收件人",
    "抄送人",
  ]);
  ws.addRow([
    "月报.xlsx",
    "",
    "邮件",
    "",
    "月报主题",
    "boss@a.com",
    "cto@a.com",
  ]);

  const result = parseRuleExcel(ws);

  assert.equal(result.rules.length, 1);
  assert.deepEqual(result.rules[0].channels, ["email"]);
  assert.equal(result.rules[0].wechatGroup, null);
});
