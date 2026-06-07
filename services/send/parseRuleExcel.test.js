import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseRuleExcel } from "./parseRuleExcel.js";

describe("parseRuleExcel", () => {
  it("应正确解析规则 Excel 表头并把分发方式拆成数组", () => {
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("规则");
    ws.addRow(["文件名(原)", "文件名(映射)", "分发方式", "微信群名", "邮件主题", "收件人", "抄送人"]);
    ws.addRow(["月报.xlsx", "{{date}}经营月报.xlsx", "微信,邮件", "管理群", "{{date}} 月报", "boss@a.com,ceo@a.com", "cto@a.com,hr@a.com"]);
    ws.addRow(["日报.xlsx", "", "微信", "部门群", "", "", ""]);

    const result = parseRuleExcel(ws);

    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].originalName).toBe("月报.xlsx");
    expect(result.rules[0].mappedName).toBe("{{date}}经营月报.xlsx");
    expect(result.rules[0].channels).toEqual(["wechat", "email"]);
    expect(result.rules[0].wechatGroup).toBe("管理群");
    expect(result.rules[0].emailTo).toEqual(["boss@a.com", "ceo@a.com"]);
    expect(result.rules[0].emailCc).toEqual(["cto@a.com", "hr@a.com"]);
    expect(result.rules[1].channels).toEqual(["wechat"]);
    expect(result.rules[1].wechatGroup).toBe("部门群");
  });

  it("应跳过缺少必填字段的行并记录警告", () => {
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("规则");
    ws.addRow(["文件名(原)", "文件名(映射)", "分发方式", "微信群名", "邮件主题", "收件人", "抄送人"]);
    ws.addRow(["月报.xlsx", "", "微信", "", "", "", ""]); // 缺微信群名

    const result = parseRuleExcel(ws);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("微信群名为空");
    expect(result.rules).toHaveLength(0);
  });

  it("应支持中文和英文分发方式标识", () => {
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

  it("应处理只有邮件分发方式的行", () => {
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
