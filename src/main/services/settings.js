"use strict";
const { clean, integer, fail } = require("./validate");
const allowed = new Set([
  "sellerName",
  "sellerTaxId",
  "sellerPhone",
  "sellerEmail",
  "sellerAddress",
  "sellerBank",
  "sellerNote",
  "sellerLogo",
  "exportFolder",
  "dataFolder",
  "darkMode",
  "dailyBackup",
  "backupKeep",
  "invoicePrefix",
  "paymentPrefix",
  "invoiceNumberLength",
  "paymentNumberLength",
  "invoiceCounter",
  "paymentCounter",
  "fontSize",
]);
function get(store) {
  return Object.fromEntries(
    store.all("SELECT key,value FROM settings").map((r) => [r.key, r.value]),
  );
}
function update(store, input) {
  return store.write(() => {
    for (const [key, raw] of Object.entries(input || {})) {
      if (!allowed.has(key)) continue;
      if (key === "invoiceCounter" || key === "paymentCounter") {
        const kind = key === "invoiceCounter" ? "invoice" : "payment";
        const counter = integer(raw, "Bộ đếm chứng từ", 999999999);
        const previous =
          store.get("SELECT value FROM sequences WHERE kind=?", kind)?.value ||
          0;
        if (counter < previous)
          fail("Không thể hạ bộ đếm vì có thể tạo trùng mã chứng từ.");
        store.run(
          "INSERT INTO sequences(kind,value) VALUES (?,?) ON CONFLICT(kind) DO UPDATE SET value=excluded.value",
          kind,
          counter,
        );
        store.audit("update", "sequence", kind);
        continue;
      }
      let value;
      if (key === "invoicePrefix" || key === "paymentPrefix") {
        value = String(raw ?? "")
          .trim()
          .toUpperCase()
          .replace(/-$/, "");
        if (!/^[A-Z0-9]{1,8}$/.test(value))
          fail("Tiền tố chứng từ chỉ gồm 1–8 chữ cái hoặc số.");
      } else if (
        key === "invoiceNumberLength" ||
        key === "paymentNumberLength"
      ) {
        const width = integer(raw, "Độ dài số", 6);
        if (![4, 5, 6].includes(width)) fail("Độ dài số phải là 4, 5 hoặc 6.");
        value = String(width);
      } else if (key === "fontSize") {
        const size = integer(raw, "Cỡ chữ", 15);
        if (![13, 14, 15].includes(size))
          fail("Cỡ chữ phải là 13, 14 hoặc 15 px.");
        value = String(size);
      } else
        value =
          key === "backupKeep"
            ? String(integer(raw, "Số bản sao lưu", 365))
            : clean(raw, 1000);
      store.run(
        "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        key,
        value,
      );
      store.audit("update", "setting", key);
    }
    return get(store);
  });
}
module.exports = { get, update };
