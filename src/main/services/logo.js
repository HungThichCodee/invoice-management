"use strict";
const fs = require("node:fs");
const path = require("node:path");
const settings = require("./settings");
const types = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};
function owned(store, file) {
  return (
    file &&
    path.dirname(path.resolve(file)) === path.resolve(store.folder) &&
    types[path.extname(file).toLowerCase()]
  );
}
function dataUrl(store, file) {
  if (!owned(store, file)) return null;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) return null;
    return `data:${types[path.extname(file).toLowerCase()]};base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    return null;
  }
}
function save(store, source) {
  const ext = path.extname(source).toLowerCase();
  if (!types[ext] || fs.statSync(source).size > 5 * 1024 * 1024)
    throw Error("Logo phải là PNG/JPG dưới 5 MB.");
  const target = path.join(store.folder, `seller-logo${ext}`);
  if (path.resolve(source) !== path.resolve(target))
    fs.copyFileSync(source, target);
  settings.update(store, { sellerLogo: target });
  return target;
}
function remove(store) {
  const file = settings.get(store).sellerLogo;
  settings.update(store, { sellerLogo: "" });
  if (owned(store, file) && fs.existsSync(file)) fs.unlinkSync(file);
  return true;
}
module.exports = { dataUrl, save, remove };
