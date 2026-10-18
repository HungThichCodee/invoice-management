"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../src/main/db");
const customers = require("../src/main/services/customers");
const backups = require("../src/main/services/backups");
const settings = require("../src/main/services/settings");

test("backup and restore recover a consistent earlier database", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-backup-"));
  const state = { store: new Store(dir) };
  try {
    customers.create(state.store, { name: "Khách giữ lại" });
    const copy = await backups.create(state.store);
    assert.ok(fs.statSync(copy.path).size > 0);
    backups.verify(copy.path);
    customers.create(state.store, { name: "Khách sau backup" });
    assert.equal(customers.list(state.store).length, 2);
    await backups.restore(state, copy.path);
    assert.deepEqual(
      customers.list(state.store).map((x) => x.name),
      ["Khách giữ lại"],
    );
  } finally {
    state.store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("restoring oldest retained backup survives pruning its source", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-restore-prune-"));
  const state = { store: new Store(dir) };
  try {
    settings.update(state.store, { backupKeep: 2 });
    customers.create(state.store, { name: "Trước bản đầu" });
    const first = await backups.create(state.store, "first");
    customers.create(state.store, { name: "Sau bản đầu" });
    await backups.create(state.store, "second");
    assert.equal(backups.list(state.store).length, 2);
    await backups.restore(state, first.path);
    assert.deepEqual(customers.list(state.store).map(x => x.name), ["Trước bản đầu"]);
    assert.equal(fs.existsSync(`${state.store.file}.pending`), false);
  } finally {
    state.store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("corrupt restore file leaves active data untouched", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-restore-corrupt-"));
  const state = { store: new Store(dir) };
  try {
    customers.create(state.store, { name: "Khách hiện tại" });
    const corrupt = path.join(dir, "broken.db");
    fs.writeFileSync(corrupt, "not a SQLite database");
    await assert.rejects(backups.restore(state, corrupt));
    assert.deepEqual(customers.list(state.store).map(x => x.name), ["Khách hiện tại"]);
    assert.equal(fs.existsSync(`${state.store.file}.pending`), false);
  } finally {
    state.store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("startup recovers the previous database after an interrupted restore", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-restore-crash-"));
  const state = { store: new Store(dir) };
  try {
    customers.create(state.store, { name: "Khách trước sự cố" });
    const target = state.store.file;
    state.store.close();
    fs.renameSync(target, `${target}.previous`);
    state.store = new Store(dir);
    assert.deepEqual(customers.list(state.store).map(x => x.name), ["Khách trước sự cố"]);
    assert.equal(fs.existsSync(`${target}.previous`), false);
  } finally {
    state.store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
