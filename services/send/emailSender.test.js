const test = require("node:test");
const assert = require("node:assert/strict");

const { sendEmail, toAddress } = require("./emailSender");

test("toAddress converts plain string as-is", () => {
  assert.equal(toAddress("boss@qq.com"), "boss@qq.com");
});

test("toAddress converts { name, address } to \"Name\" <address>", () => {
  assert.equal(
    toAddress({ name: "张三", address: "zhang@test.com" }),
    '"张三" <zhang@test.com>'
  );
});

test("toAddress converts name with dots", () => {
  assert.equal(
    toAddress({ name: "ailsa.lin", address: "ailsa.lin@welding-tech.com.cn" }),
    '"ailsa.lin" <ailsa.lin@welding-tech.com.cn>'
  );
});

test("toAddress converts { address } only (no name)", () => {
  assert.equal(
    toAddress({ name: null, address: "no-reply@test.com" }),
    "no-reply@test.com"
  );
});

test("toAddress handles empty object", () => {
  assert.equal(toAddress({}), "");
});

test("toAddress handles null/undefined", () => {
  assert.equal(toAddress(null), "");
  assert.equal(toAddress(undefined), "");
});

test("sendEmail is a function (module integrity)", () => {
  assert.ok(typeof sendEmail === "function");
});
