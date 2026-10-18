"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../src/main/db");
const customers = require("../src/main/services/customers");
const invoices = require("../src/main/services/invoices");
const backups = require("../src/main/services/backups");
const logo = require("../src/main/services/logo");
const settings = require("../src/main/services/settings");
const dataLocation = require("../src/main/services/dataLocation");

test("moving data folder preserves invoices, backups, logo and old database", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-move-"));
  const source = path.join(root, "old"), target = path.join(root, "new");
  const state = { store: new Store(source), configFile: path.join(root, "config.json") };
  try {
    fs.writeFileSync(state.configFile, JSON.stringify({ theme: "light" }));
    const c = customers.create(state.store, { name: "Khách chuyển thư mục" });
    const invoice = invoices.create(state.store, { customerId: c.id, date: "2026-10-01", due: "2026-10-30",
      items: [{ name: "Thuê xe", qty: 1, price: 1000000 }] });
    await backups.create(state.store);
    const sourceLogo = path.join(source, "brand.png");
    fs.writeFileSync(sourceLogo, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6m4QAAAAASUVORK5CYII=", "base64"));
    logo.save(state.store, sourceLogo);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "existing.txt"), "keep");
    assert.throws(() => dataLocation.move(state, target), /phải trống/);
    assert.equal(invoices.get(state.store, invoice.id).total, 1000000);
    fs.unlinkSync(path.join(target, "existing.txt"));
    assert.equal(dataLocation.move(state, target), fs.realpathSync.native(target));
    assert.equal(invoices.get(state.store, invoice.id).total, 1000000);
    assert.ok(fs.existsSync(path.join(source, "hoadon_xenang.db")));
    assert.equal(backups.list(state.store).length, 1);
    assert.ok(logo.dataUrl(state.store, settings.get(state.store).sellerLogo)?.startsWith("data:image/png;base64,"));
    assert.equal(JSON.parse(fs.readFileSync(state.configFile, "utf8")).theme, "light");
  } finally {
    state.store.close();
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw Error("Unsafe test path");
    fs.rmSync(root, { recursive: true, force: true });
  }
});
