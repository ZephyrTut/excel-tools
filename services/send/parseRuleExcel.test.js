import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseRuleExcel } from "./parseRuleExcel.js";

describe("parseRuleExcel", () => {
  it("parses rules and splits delivery channels into arrays", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("规则");
    ws.addRow(["文件名(原)", "文件名(映射)", "分发方式", "微信群名", "邮件主题", "收件人", "抄送人"]);
    ws.addRow(["月报.xlsx", "{{date}}经营月报.xlsx", "微信,邮件", "管理群", "{{date}} 月报", "boss@a.com,ceo@a.com", "cto@a.com,hr@a.com"]);
    ws.addRow(["日报.xlsx", "", "微信", "部门群", "", "", ""]);

    const result = parseRuleExcel(ws);

    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].channels).toEqual(["wechat", "email"]);
    expect(result.rules[0].wechatGroup).toBe("管理群");
    expect(result.rules[0].emailTo).toEqual(["boss@a.com", "ceo@a.com"]);
    expect(result.rules[1].channels).toEqual(["wechat"]);
  });

  it("skips rows with missing required fields", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("规则");
    ws.addRow(["文件名(原)", "文件名(映射)", "分发方式", "微信群名", "邮件主题", "收件人", "抄送人"]);
    ws.addRow(["月报.xlsx", "", "微信", "", "", "", ""]);

    const result = parseRuleExcel(ws);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("微信群名为空");
    expect(result.rules).toHaveLength(0);
  });

  it("supports mixed Chinese and English channel labels", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("规则");
    ws.addRow(["文件名(原)", "文件名(映射)", "分发方式", "微信群名", "邮件主题", "收件人", "抄送人"]);
    ws.addRow(["月报.xlsx", "", "微信,email", "管理群", "月报主题", "boss@a.com", ""]);
    ws.addRow(["日报.xlsx", "", "wechat,邮件", "部门群", "日报主题", "a@b.com", ""]);

    const result = parseRuleExcel(ws);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].channels).toContain("wechat");
    expect(result.rules[1].channels).toContain("wechat");
    expect(result.rules[1].channels).toContain("email");
  });

  it("handles email-only rows", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("规则");
    ws.addRow(["文件名(原)", "文件名(映射)", "分发方式", "微信群名", "邮件主题", "收件人", "抄送人"]);
    ws.addRow(["月报.xlsx", "", "邮件", "", "月报主题", "boss@a.com", "cto@a.com"]);

    const result = parseRuleExcel(ws);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].channels).toEqual(["email"]);
    expect(result.rules[0].wechatGroup).toBeNull();
  });
});
