const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { parseRuleExcel } = require("../services/send/parseRuleExcel");
const { matchFiles } = require("../services/send/ruleMatcher");
const { buildSendQueue } = require("../services/send/sendService");

const TEMPLATE_PATH = path.join(__dirname, "发送规则模板2.xlsx");

test("parseRuleExcel 正确解析模板（3 条有效规则）", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.getWorksheet(1);
  const { rules, warnings } = parseRuleExcel(ws);

  assert.equal(rules.length, 3, "应有 3 条有效规则");
  assert.ok(warnings.length >= 0, "warnings 应为数组");

  // 验证具体规则内容
  const names = rules.map((r) => r.originalName);
  assert.ok(names.includes("2026年5月上海恺红塑料模具有限公司武义仓进销存报表(1)(42).xlsx"));
  assert.ok(names.includes("2026年5月深圳市富程威科技股份有限公司武义仓进销存报表(1)(42).xlsx"));
  assert.ok(names.includes("2026年5月芜湖博康机电股份有限公武义仓进销存报表(1)(25).xlsx"));
});

test("matchFiles 正确匹配文件名", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.getWorksheet(1);
  const { rules } = parseRuleExcel(ws);

  const files = [
    "2026年5月上海恺红塑料模具有限公司武义仓进销存报表(1)(42).xlsx",
    "不存在的文件.xlsx",
    "2026年5月深圳市富程威科技股份有限公司武义仓进销存报表(1)(42).xlsx",
  ];

  const { matched, unmatched } = matchFiles(files, rules);

  assert.equal(matched.length, 2, "应匹配 2 个文件");
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0], "不存在的文件.xlsx");
});

test("发送队列中失败项不中断后续", () => {

  const matched = [
    {
      originalName: "file1.xlsx",
      filePath: "/tmp/file1.xlsx",
      channels: ["wechat"],
      rule: { wechatGroup: "不存在群", emailTo: [] },
    },
    {
      originalName: "file2.xlsx",
      filePath: "/tmp/file2.xlsx",
      channels: ["wechat"],
      rule: { wechatGroup: "测试群8", emailTo: [] },
    },
  ];

  const queue = buildSendQueue(matched, true);
  assert.equal(queue.length, 2, "队列应有 2 项");
  assert.equal(queue[0].rule.wechatGroup, "不存在群", "第一项是不存在群");
  assert.equal(queue[1].rule.wechatGroup, "测试群8", "第二项是正常群");
});

test("parseRuleExcel 正确剥离无效渠道", async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.getWorksheet(1);
  const { rules } = parseRuleExcel(ws);

  // 上海恺红: 微信+邮件 → 邮件无收件人被剥离 → 仅微信
  const shanghai = rules.find((r) =>
    r.originalName === "2026年5月上海恺红塑料模具有限公司武义仓进销存报表(1)(42).xlsx"
  );
  assert.ok(shanghai, "应找到上海恺红");
  assert.deepEqual(shanghai.channels, ["wechat"]);
  assert.deepEqual(shanghai.strippedChannels, ["email"]);

  // 芜湖博康: 仅微信 → 无剥离
  const wuhu = rules.find((r) =>
    r.originalName === "2026年5月芜湖博康机电股份有限公武义仓进销存报表(1)(25).xlsx"
  );
  assert.ok(wuhu, "应找到芜湖博康");
  assert.deepEqual(wuhu.channels, ["wechat"]);
  assert.equal(wuhu.strippedChannels.length, 0);

  // 力高: 仅邮件但无收件人 → 所有渠道无效，被整体跳过
  const ligao = rules.find((r) =>
    r.originalName === "2026年5月力高（山东）新能源技术股份有限公司武义仓进销存报表(48).xlsx"
  );
  assert.equal(ligao, undefined, "力高因所有渠道无效应被跳过");

  // 马鞍山纳百川: 分发方式为空 → 被整体跳过
  const maanshan = rules.find((r) =>
    r.originalName === "2026年5月马鞍山纳百川热交换器有限公司武义仓进销存报表(1)(48).xlsx"
  );
  assert.equal(maanshan, undefined, "马鞍山纳百川因分发方式为空应被跳过");
});
