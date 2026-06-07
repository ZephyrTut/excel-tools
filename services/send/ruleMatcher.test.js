const test = require("node:test");
const assert = require("node:assert/strict");

const { replaceVariables, matchFiles } = require("./ruleMatcher");

function withFrozenDate(isoString, run) {
  const RealDate = Date;
  const fixedTime = new RealDate(isoString).getTime();

  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedTime);
        return;
      }
      super(...args);
    }

    static now() {
      return fixedTime;
    }
  };

  try {
    run();
  } finally {
    global.Date = RealDate;
  }
}

test("replaceVariables replaces {{date}} with the current date", () => {
  withFrozenDate("2026-06-07T00:00:00Z", () => {
    assert.equal(
      replaceVariables("{{date}} 报告", "月报.xlsx"),
      "2026-06-07 报告"
    );
  });
});

test("replaceVariables replaces {{fileName}} with the base name", () => {
  assert.equal(replaceVariables("{{fileName}} 月报", "月报.xlsx"), "月报 月报");
});

test("replaceVariables handles file names without extension", () => {
  assert.equal(replaceVariables("{{fileName}}", "周报"), "周报");
});

test("replaceVariables replaces multiple variables", () => {
  withFrozenDate("2026-06-07T00:00:00Z", () => {
    assert.equal(
      replaceVariables("{{date}} {{fileName}} 报告", "月报.xlsx"),
      "2026-06-07 月报 报告"
    );
  });
});

test("matchFiles returns exact file matches and unmatched files", () => {
  const rules = [
    {
      originalName: "月报.xlsx",
      channels: ["wechat", "email"],
      wechatGroup: "管理群",
      emailTo: ["boss@a.com"],
    },
    {
      originalName: "日报.xlsx",
      channels: ["wechat"],
      wechatGroup: "部门群",
    },
  ];
  const files = ["月报.xlsx", "日报.xlsx", "考勤.xlsx"];

  const result = matchFiles(files, rules);

  assert.equal(result.matched.length, 2);
  assert.deepEqual(result.unmatched, ["考勤.xlsx"]);
  assert.equal(result.matched[0].rule, rules[0]);
  assert.equal(result.matched[0].originalName, "月报.xlsx");
});
