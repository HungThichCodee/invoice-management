"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const schema = require("./schema");

class Store {
  constructor(folder) {
    fs.mkdirSync(folder, { recursive: true });
    this.folder = folder;
    this.file = path.join(folder, "hoadon_xenang.db");
    const previous = `${this.file}.previous`;
    if (!fs.existsSync(this.file) && fs.existsSync(previous))
      fs.renameSync(previous, this.file);
    this.db = new DatabaseSync(this.file);
    this.closed = false;
    this.depth = 0;
    try {
      this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL");
      this.write(() => this.db.exec(schema));
    } catch (error) {
      this.db.close();
      this.closed = true;
      throw error;
    }
  }
  write(fn) {
    const level = this.depth++,
      savepoint = `write_${level}`;
    let started = false;
    try {
      this.db.exec(level ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
      started = true;
      const result = fn();
      if (result && typeof result.then === "function")
        throw Error("Không dùng async trong transaction.");
      this.db.exec(level ? `RELEASE ${savepoint}` : "COMMIT");
      return result;
    } catch (error) {
      if (started)
        try {
          this.db.exec(
            level
              ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`
              : "ROLLBACK",
          );
        } catch {
          /* SQLite đã rollback */
        }
      throw error;
    } finally {
      this.depth--;
    }
  }
  all(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  get(sql, ...args) {
    return this.db.prepare(sql).get(...args);
  }
  run(sql, ...args) {
    if (!this.depth) throw Error("Ghi database phải nằm trong transaction.");
    return this.db.prepare(sql).run(...args);
  }
  next(kind, prefix, width = 6) {
    this.run(
      "INSERT INTO sequences(kind,value) VALUES (?,0) ON CONFLICT(kind) DO NOTHING",
      kind,
    );
    this.run("UPDATE sequences SET value=value+1 WHERE kind=?", kind);
    return `${prefix}-${String(this.get("SELECT value FROM sequences WHERE kind=?", kind).value).padStart(width, "0")}`;
  }
  audit(action, entity, id, detail = "") {
    this.run(
      "INSERT INTO audit_logs(action,entity,entity_id,detail,created_at) VALUES (?,?,?,?,?)",
      action,
      entity,
      String(id),
      detail,
      new Date().toISOString(),
    );
  }
  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
}
module.exports = { Store };
