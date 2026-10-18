"use strict";
const fs = require("node:fs");
const path = require("node:path");
const file = path.join(__dirname, "..", "package-lock.json");
const lock = JSON.parse(fs.readFileSync(file, "utf8"));
fs.writeFileSync(file, `${JSON.stringify(lock)}\n`);
console.log("Đã nén package-lock.json thành một dòng.");
