'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const electron = require('electron');
const tests = ['export.test.js','import.test.js','store.test.js','upgrade.test.js'].map(x=>path.join(__dirname,'..','test',x));
const result = spawnSync(electron,['--test',...tests],{stdio:'inherit',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
if (result.error) { console.error(result.error); process.exitCode=1; }
else process.exitCode=result.status ?? 1;
