"use strict";
const fail = (message) => {
  throw Error(message);
};
const clean = (value, length = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, length);
function nonnegative(value, label, max = Number.MAX_SAFE_INTEGER) {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  )
    fail(`${label} không hợp lệ.`);
  const n = Number(value);
  if (n < 0 || n > max) fail(`${label} phải từ 0 đến ${max}.`);
  return n;
}
function integer(value, label, max) {
  const n = nonnegative(value, label, max);
  if (!Number.isSafeInteger(n)) fail(`${label} phải là số nguyên.`);
  return n;
}
function milli(value, label) {
  const n = nonnegative(value, label, 1000000000);
  const scaled = Math.round(n * 1000);
  if (Math.abs(scaled / 1000 - n) > 0.00000001)
    fail(`${label} tối đa 3 chữ số thập phân.`);
  return scaled;
}
function isoDate(value, label) {
  const s = clean(value, 10);
  const parsed = new Date(`${s}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== s
  )
    fail(`${label} không hợp lệ.`);
  return s;
}
module.exports = { fail, clean, nonnegative, integer, milli, isoDate };
