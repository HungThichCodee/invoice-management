"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const ignored = new Set([".git", "node_modules", "release", "dist"]);
const extensions = new Set([
  ".js",
  ".css",
  ".html",
  ".json",
  ".yaml",
  ".yml",
  ".ps1",
]);
let failed = false;
function scan(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      scan(file);
      continue;
    }
    if (!extensions.has(path.extname(file))) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
    if (lines > 300) {
      console.error(`${lines} dòng: ${path.relative(root, file)}`);
      failed = true;
    }
  }
}
scan(root);
if (failed) process.exitCode = 1;
else console.log("Tất cả file code/cấu hình/script đều không quá 300 dòng.");
