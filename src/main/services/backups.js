"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync, backup } = require("node:sqlite");
const { Store } = require("../db");
const dirFor = (store) => path.join(store.folder, "backup");
function list(store) {
  const dir = dirFor(store);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((x) => x.endsWith(".db"))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size, date: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
function prune(store) {
  const keep = Number(
    store.get("SELECT value FROM settings WHERE key='backupKeep'")?.value ?? 30,
  );
  if (keep === 0) return 0;
  const old = list(store).slice(keep);
  for (const entry of old) fs.unlinkSync(path.join(dirFor(store), entry.name));
  return old.length;
}
async function create(store, label = "manual") {
  const dir = dirFor(store);
  fs.mkdirSync(dir, { recursive: true });
  const safe = label.replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "manual";
  const name = `hoadon_${safe}_${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  const target = path.join(dir, name);
  const pending = `${target}.tmp`;
  try {
    if (backup) await backup(store.db, pending);
    else store.db.exec(`VACUUM INTO '${pending.replace(/'/g, "''")}'`);
    verify(pending);
    fs.renameSync(pending, target);
  } finally {
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
  }
  prune(store);
  return { name, path: target };
}
async function daily(store) {
  const enabled = store.get(
    "SELECT value FROM settings WHERE key='dailyBackup'",
  )?.value;
  if (enabled === "false") return null;
  const day = new Date().toLocaleDateString("en-CA");
  if (list(store).some((x) => x.name.includes(`daily_${day}`))) return null;
  return create(store, `daily_${day}`);
}
function verify(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Bản sao lưu bị lỗi.");
    if (
      !db
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='invoices'",
        )
        .get()
    )
      throw Error("Không đúng file dữ liệu hóa đơn.");
  } finally {
    db.close();
  }
}
async function restore(state, source) {
  verify(source);
  const store = state.store;
  const target = store.file,
    pending = `${target}.pending`,
    previous = `${target}.previous`;
  if (path.resolve(source).toLowerCase() === path.resolve(target).toLowerCase())
    throw Error("Không chọn database đang sử dụng để khôi phục.");
  try {
    fs.copyFileSync(source, pending);
    verify(pending);
    await create(store, "before_restore");
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
    store.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    store.close();
    try {
      fs.renameSync(target, previous);
      fs.renameSync(pending, target);
      state.store = new Store(store.folder);
      try {
        fs.unlinkSync(previous);
      } catch {
        /* Bản dự phòng còn trên đĩa. */
      }
      return true;
    } catch (error) {
      if (fs.existsSync(previous)) {
        if (fs.existsSync(target)) fs.unlinkSync(target);
        fs.renameSync(previous, target);
      }
      state.store = new Store(store.folder);
      throw error;
    }
  } finally {
    if (fs.existsSync(pending)) fs.unlinkSync(pending);
  }
}
module.exports = { list, prune, create, daily, restore, verify, dirFor };
