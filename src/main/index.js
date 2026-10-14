'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Store } = require('./database');
const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const { pdf, excel, csv, folder: exportFolder } = require('./export');
const {readImportFile,mappedRows,validatePreview}=require('./importer');
const {HEADERS}=require('./import');
let store, mainWindow, configFile, importSession;
function config() { try { return JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { return {}; } }
function saveConfig(value) { fs.writeFileSync(configFile, JSON.stringify(value, null, 2), 'utf8'); }
function openStore(folder) { const next = new Store(folder); if (store) store.close(); store = next; }
function handle(channel, fn) { ipcMain.handle(channel, async (_event, ...args) => fn(...args)); }
function register() {
  handle('snapshot', () => store.snapshot());
  handle('createInvoice', input => { const id=store.createInvoice(input); return { id, state:store.snapshot() }; });
  handle('updateInvoice', input => { const id=store.updateInvoice(input); return { id, state:store.snapshot() }; });
  handle('deleteInvoice', input => { store.deleteInvoice(input); return store.snapshot(); });
  handle('addPayment', input => { store.addPayment(input); return store.snapshot(); });
  handle('createCustomer', input => { const id=store.createCustomer(input); return {id,state:store.snapshot()}; });
  handle('updateCustomer', input => { const id=store.updateCustomer(input); return {id,state:store.snapshot()}; });
  handle('customerProfile', (id,from,to,tab) => store.profile(id,from,to,tab));
  handle('planBulkPayment', (id,amount) => store.planBulkPayment(id,amount));
  handle('addBulkPayment', input => { const result=store.addBulkPayment(input); return {...result,state:store.snapshot()}; });
  handle('reports', (year,mode) => store.reports(year,mode));
  handle('dashboard', () => store.dashboard());
  handle('chooseImportFile', async file => { if(!file){const r=await dialog.showOpenDialog(mainWindow,{title:'Chọn file dữ liệu',filters:[{name:'Excel hoặc CSV',extensions:['xlsx','xls','csv']}],properties:['openFile']});if(r.canceled)return null;file=r.filePaths[0];}const loaded=readImportFile(file);importSession={...loaded,preview:null};return {name:loaded.name,sheets:loaded.sheets}; });
  handle('dryRunImport', input => {
    if(!importSession)throw Error('Hãy chọn file trước.');
    const parsed=mappedRows(importSession.raw,input.sheet,input.mapping,input.kind);
    if(input.kind==='wps')for(const [name,headers] of Object.entries(HEADERS)){const sheet=importSession.raw.find(s=>s.name===name);if(!sheet)parsed.issues.push({sheet:name,line:1,severity:'error',message:`Thiếu sheet ${name}.`});else for(let n=0;n<headers.length;n++)if(sheet.headers[n]!==headers[n])parsed.issues.push({sheet:name,line:1,severity:'error',message:`Tiêu đề cột ${n+1} không đúng.`});}
    if(input.kind==='app')for(const name of ['Hóa đơn','Chi tiết HĐ','Thu tiền'])if(!importSession.raw.some(s=>s.name===name))parsed.issues.push({sheet:name,line:1,severity:'error',message:`Thiếu sheet ${name}.`});
    if(input.kind==='app'||input.kind==='wps'){const paymentSheet=importSession.raw.find(s=>s.name===(input.kind==='app'?'Thu tiền':'FM_ThuTien'));if(paymentSheet){const p=mappedRows(importSession.raw,paymentSheet.name,require('./importer').guess(paymentSheet.headers),'payments');parsed.payments.push(...p.payments);parsed.issues.push(...p.issues);}}
    importSession.preview=validatePreview(parsed,store.snapshot());importSession.kind=input.kind;
    return {rows:[...parsed.invoices.map(x=>({line:x.line,type:'Hóa đơn',code:x.id||'Tự sinh'})),...parsed.customers.map(x=>({line:x.line,type:'Khách hàng',code:x.name})),...parsed.payments.map(x=>({line:x.line,type:'Phiếu thu',code:x.id||'Tự sinh'}))].slice(0,100),issues:importSession.preview.issues,counts:importSession.preview.counts};
  });
  handle('commitImport', strategy => {if(!importSession?.preview)throw Error('Hãy kiểm tra dữ liệu trước.');const latest=validatePreview(importSession.preview,store.snapshot());const result=store.importCommit(latest,importSession.name,importSession.kind,strategy);importSession=null;return {...result,state:store.snapshot()};});
  handle('downloadImportErrors', () => {if(!importSession?.preview)throw Error('Chưa có kết quả kiểm tra.');const file=path.join(exportFolder(store),`LoiNhap_${Date.now()}_${crypto.randomBytes(2).toString('hex')}.csv`),rows=[['Sheet','Dòng','Mức độ','Nội dung'],...importSession.preview.issues.map(x=>[x.sheet||'',x.line||'',x.severity,x.message])];const csv='\uFEFF'+rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');fs.writeFileSync(file,csv,{encoding:'utf8',flag:'wx'});return file;});
  handle('undoImport', () => {const id=store.undoLastImport();return {id,state:store.snapshot()};});
  handle('saveSettings', input => { store.saveSettings(input); return store.snapshot(); });
  handle('chooseDataFolder', async () => { const r=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory','createDirectory']}); if (r.canceled) return store.snapshot(); const folder=r.filePaths[0]; openStore(folder); saveConfig({ ...config(), dataFolder:folder }); return store.snapshot(); });
  handle('chooseExportFolder', async () => { const r=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory','createDirectory']}); if (r.canceled) return store.snapshot(); store.saveSettings({exportFolder:r.filePaths[0]}); return store.snapshot(); });
  handle('chooseLogo', async () => {const r=await dialog.showOpenDialog(mainWindow,{title:'Chọn logo',filters:[{name:'Hình ảnh',extensions:['png','jpg','jpeg']}],properties:['openFile']});if(r.canceled)return store.snapshot();const source=r.filePaths[0],ext=path.extname(source).toLowerCase();if(!['.png','.jpg','.jpeg'].includes(ext)||fs.statSync(source).size>5*1024*1024)throw Error('Logo phải là PNG/JPG và không quá 5 MB.');const dest=path.join(store.folder,`seller-logo${ext}`);fs.copyFileSync(source,dest);store.saveSettings({sellerLogo:dest});return store.snapshot();});
  handle('openFolder', kind => { const dir=kind==='data'?store.folder:store.settings().exportFolder || path.join(store.folder,'exports'); fs.mkdirSync(dir,{recursive:true}); return shell.openPath(dir); });
  handle('backup', () => store.backup());
  handle('restore', async () => { const r=await dialog.showOpenDialog(mainWindow,{title:'Chọn bản sao lưu',defaultPath:path.join(store.folder,'backup'),filters:[{name:'SQLite',extensions:['db']}],properties:['openFile']}); if(r.canceled)return null; const source=r.filePaths[0]; const check=new Database(source,{readonly:true,fileMustExist:true}); try { if(check.pragma('integrity_check',{simple:true})!=='ok'||![1,2].includes(check.pragma('user_version',{simple:true}))||!check.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='invoices'").get())throw Error('File backup không hợp lệ.'); } finally { check.close(); } const ok=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Hủy','Khôi phục'],defaultId:0,cancelId:0,title:'Xác nhận khôi phục',message:'Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại. Ứng dụng sẽ sao lưu dữ liệu hiện tại trước khi tiếp tục.'}); if(ok.response!==1)return null; const folder=store.folder,target=store.file,pending=path.join(folder,'restore-pending.db'); fs.copyFileSync(source,pending); let previous; try { previous=store.backup('before-restore'); store.db.pragma('wal_checkpoint(TRUNCATE)'); store.close(); fs.copyFileSync(pending,target); openStore(folder); return store.snapshot(); } catch(e) { if(previous&&!store.db.open){fs.copyFileSync(previous,target);openStore(folder);} throw e; } finally { if(fs.existsSync(pending))fs.unlinkSync(pending); } });
  handle('pdf', (kind,args) => pdf(store,kind,args));
  handle('print', (kind,args) => pdf(store,kind,args,true));
  handle('excel', filter => excel(store,filter||{}));
  handle('csv', (kind,filter) => csv(store,kind,filter||{}));
  handle('downloadTemplate', async () => {const wb=new ExcelJS.Workbook();for(const [name,rows] of [['Hóa đơn',[['Mã HĐ','Ngày','Khách hàng','Điện thoại','Địa chỉ','Hạn trả','Tổng tiền','Ghi chú'],['HD-MAU-1','2026-01-10','Khách mẫu','0901234567','Địa chỉ mẫu','2026-02-10',500000,'']]],['Chi tiết HĐ',[['Mã HĐ','Mặt hàng','Đơn vị','Số lượng','Đơn giá'],['HD-MAU-1','Thuê xe nâng','ngày',1,500000]]],['Thu tiền',[['Mã phiếu','Mã HĐ','Ngày thu','Số tiền','Phương thức','Ghi chú'],['PT-MAU-1','HD-MAU-1','2026-01-11',200000,'Tiền mặt','']]],['Khách hàng',[['Tên khách','Điện thoại','Địa chỉ','Ghi chú'],['Khách mẫu','0901234567','Địa chỉ mẫu','']]]]){const sheet=wb.addWorksheet(name);sheet.addRows(rows);sheet.columns.forEach(c=>c.width=24);sheet.getRow(1).font={bold:true};}const dir=exportFolder(store);const target=path.join(dir,`MauNhapDuLieu_${Date.now()}.xlsx`);await wb.xlsx.writeFile(target);return target;});
}
app.whenReady().then(() => {
  configFile=path.join(app.getPath('userData'),'config.json');
  openStore(config().dataFolder || path.join(app.getPath('userData'),'data'));
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>callback({cancel:true}));
  app.on('web-contents-created',(_e,contents)=>{contents.setWindowOpenHandler(()=>({action:'deny'}));contents.on('will-navigate',e=>e.preventDefault());});
  register();
  mainWindow=new BrowserWindow({width:1280,height:850,minWidth:800,minHeight:600,webPreferences:{preload:path.join(__dirname,'../preload/index.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.loadFile(path.join(__dirname,'../renderer/index.html'));
});
app.on('window-all-closed',()=>{if(store)store.close();app.quit();});
