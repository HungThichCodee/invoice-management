"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { Store } = require("../db");
const settings = require("./settings");
function move(state, folder) {
  const old = state.store;
  const source = fs.realpathSync.native(old.folder);
  fs.mkdirSync(folder, { recursive: true });
  const target = fs.realpathSync.native(folder);
  const sourceKey = source.toLowerCase(),
    targetKey = target.toLowerCase();
  if (sourceKey === targetKey) return target;
  if (targetKey.startsWith(`${sourceKey}${path.sep}`))
    throw Error("Không chọn thư mục con của thư mục dữ liệu hiện tại.");
  if (fs.readdirSync(target).length)
    throw Error("Thư mục đích phải trống để tránh ghi đè dữ liệu.");
  const dbFile = path.join(target, "hoadon_xenang.db");
  old.db.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
  for (const name of ["backup", "exports"]) {
    const from = path.join(source, name);
    if (fs.existsSync(from))
      fs.cpSync(from, path.join(target, name), {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
  }
  const priorLogo = settings.get(old).sellerLogo;
  let next;
  try {
    next = new Store(target);
    if (
      priorLogo &&
      path.dirname(path.resolve(priorLogo)).toLowerCase() === sourceKey &&
      fs.existsSync(priorLogo)
    ) {
      const newLogo = path.join(target, path.basename(priorLogo));
      fs.copyFileSync(priorLogo, newLogo);
      settings.update(next, { sellerLogo: newLogo });
    }
    const temp = `${state.configFile}.pending`;
    let config = {};
    try {
      config = JSON.parse(fs.readFileSync(state.configFile, "utf8"));
    } catch {
      /* lần đầu */
    }
    fs.writeFileSync(
      temp,
      JSON.stringify({ ...config, dataFolder: target }),
      "utf8",
    );
    old.close();
    try {
      fs.renameSync(temp, state.configFile);
    } catch (error) {
      state.store = new Store(source);
      throw error;
    }
    state.store = next;
    return target;
  } catch (error) {
    next?.close();
    throw error;
  }
}
module.exports = { move };
