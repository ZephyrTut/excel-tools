import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { replaceVariables, matchFiles } from "./ruleMatcher.js";

describe("replaceVariables", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces {{date}} with the current date", () => {
    expect(replaceVariables("{{date}} 报告", "月报.xlsx")).toBe("2026-06-07 报告");
  });

  it("replaces {{fileName}} with the base name", () => {
    expect(replaceVariables("{{fileName}} 月报", "月报.xlsx")).toBe("月报 月报");
  });

  it("handles file names without extension", () => {
    expect(replaceVariables("{{fileName}}", "周报")).toBe("周报");
  });

  it("replaces multiple variables", () => {
    expect(replaceVariables("{{date}} {{fileName}} 报告", "月报.xlsx")).toBe("2026-06-07 月报 报告");
  });
});

describe("matchFiles", () => {
  it("returns exact file matches and unmatched files", () => {
    const rules = [
      { originalName: "月报.xlsx", channels: ["wechat", "email"], wechatGroup: "管理群", emailTo: ["boss@a.com"] },
      { originalName: "日报.xlsx", channels: ["wechat"], wechatGroup: "部门群" },
    ];
    const files = ["月报.xlsx", "日报.xlsx", "考勤.xlsx"];

    const result = matchFiles(files, rules);

    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toEqual(["考勤.xlsx"]);
    expect(result.matched[0].rule).toBe(rules[0]);
  });
});
