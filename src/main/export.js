'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const crypto = require('node:crypto');
const { BrowserWindow } = require('electron');
const { periodReports } = require('../shared/core');
const {customerProfile}=require('../shared/finance');
const {version}=require('../../package.json');
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const vnd = n => `${Number(n || 0).toLocaleString('vi-VN')} đ`;
const vn = d => d ? `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}` : '—';
function folder(store) { const custom=store.settings().exportFolder;const dir=custom||path.join(store.folder,'exports');if(custom&&!fs.existsSync(dir))throw Error('Thư mục xuất không tồn tại. Hãy chọn lại trong Cài đặt.');if(!custom)fs.mkdirSync(dir,{recursive:true});try{fs.accessSync(dir,fs.constants.W_OK);}catch{throw Error('Không có quyền ghi vào thư mục xuất.');}return dir; }
function filename(store, stem, ext) { const safe=String(stem).replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').slice(0,80),time=new Date().toISOString().replace(/[-:]/g,'').replace('T','_').replace(/\..*/,'');let dest;do{dest=path.join(folder(store),`${safe}_${time}_${crypto.randomBytes(3).toString('hex')}.${ext}`);}while(fs.existsSync(dest));return dest; }
function writeFile(dest,data){try{fs.writeFileSync(dest,data,{flag:'wx'});}catch(e){if(['EBUSY','EPERM','EACCES'].includes(e.code))throw Error('Không ghi được file xuất. Hãy đóng file đang mở và kiểm tra quyền thư mục.');throw e;}}
function selectInvoices(s,filter={}){const q=String(filter.search||'').trim().toLocaleLowerCase('vi');return s.invoices.filter(i=>(!filter.customerId||i.customerId===Number(filter.customerId))&&(!filter.from||i.date>=filter.from)&&(!filter.to||i.date<=filter.to)&&(!q||(i.id+' '+i.customer+' '+i.phone).toLocaleLowerCase('vi').includes(q))&&(!filter.status||filter.status==='all'||filter.status==='debt'&&i.balance>0||filter.status==='late'&&i.status.startsWith('Quá hạn')||filter.status==='paid'&&i.balance===0));}
function filterLabel(filter={}){return Object.entries(filter).filter(([,v])=>v!==undefined&&v!==''&&v!==null).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Tất cả dữ liệu';}
function table(headers, rows) { return `<table><thead><tr>${headers.map(x => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
function page(title, body, settings={}) {let logo='';if(settings.sellerLogo&&fs.existsSync(settings.sellerLogo)){const ext=path.extname(settings.sellerLogo).toLowerCase();if(['.png','.jpg','.jpeg'].includes(ext)){const mime=ext==='.png'?'image/png':'image/jpeg';logo=`<img class="logo" src="data:${mime};base64,${fs.readFileSync(settings.sellerLogo).toString('base64')}">`;}}return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${h(title)}</title><style>body{font:13px Arial;color:#0F172A;margin:28px}h1{text-align:center;font-size:22px;color:#4F46E5}h2{font-size:17px}p{line-height:1.6}table{border-collapse:collapse;width:100%;margin:18px 0}th,td{border:1px solid #94A3B8;padding:7px;text-align:left}th{background:#EEF2FF}td:last-child{text-align:right}.seller{border-bottom:2px solid #4F46E5;padding-bottom:12px;white-space:pre-line;display:flex;align-items:center;gap:16px}.logo{width:64px;max-height:64px;object-fit:contain}.totals{text-align:right;font-weight:bold;line-height:1.8}@media print{body{color:#000}h1{color:#333}th{background:#eee}.seller{border-color:#333}}</style><div class="seller">${logo}<span>${h([settings.sellerName,settings.sellerAddress,settings.sellerPhone].filter(Boolean).join('\n')||'Hóa đơn xe nâng')}</span></div><h1>${h(title)}</h1>${body}</html>`; }
function invoiceHtml(s, id) { const i = s.invoices.find(x => x.id === id); if (!i) throw Error('Không tìm thấy hóa đơn.'); const settings = s.settings;
  const body = `<p>Mã: <b>${h(i.id)}</b> &nbsp; Ngày: ${vn(i.date)} &nbsp; Hạn trả: ${vn(i.due)}<br>Khách hàng: ${h(i.customer)} &nbsp; Điện thoại: ${h(i.phone)}<br>Địa chỉ: ${h(i.address)}</p>` + table(['STT','Mặt hàng','Đơn vị','Số lượng','Đơn giá','Thành tiền'], i.items.map((x,n) => [n+1,x.name,x.unit,x.qty,vnd(x.price),vnd(x.amount)])) + `<p class="totals">Tổng tiền: ${vnd(i.total)}<br>Đã thu: ${vnd(i.paid)}<br>Còn nợ: ${vnd(i.balance)}</p><p>Ghi chú: ${h(i.note)}</p><p style="text-align:right;margin-top:45px">${h(settings.sellerNote || 'Người bán hàng')}</p>`;
  return page('HÓA ĐƠN BÁN LẺ', body, settings);
}
function statementHtml(s, customerId, from, to) { const profile=customerProfile(s,customerId,from,to),c=profile.customer,sum=profile.summary;return page('BẢNG ĐỐI CHIẾU CÔNG NỢ',`<p>Khách hàng: <b>${h(c.name)}</b> (${h(c.code)})<br>Điện thoại: ${h(c.phone)}<br>Kỳ: ${vn(from)} – ${vn(to)}</p><p>Danh sách dưới đây được lọc theo kỳ. Số dư lũy kế tính từ toàn bộ lịch sử.</p>`+table(['Ngày','Loại','Mã','Hóa đơn','Phát sinh','Số dư lũy kế'],profile.timeline.map(e=>[vn(e.date),e.kind==='invoice'?'Hóa đơn':'Phiếu thu',e.id,e.invoiceId,(e.kind==='invoice'?'+':'−')+vnd(e.amount),vnd(e.runningBalance)]))+`<p class="totals">Tổng mua: ${vnd(sum.total)}<br>Đã trả: ${vnd(sum.paid)}<br>Còn nợ: ${vnd(sum.balance)}</p>`,s.settings); }
function reportHtml(s, year, mode) { const rows = periodReports(s.invoices,s.payments,year,mode),end=`${year}-12-31`,paid=new Map();for(const p of s.payments.filter(p=>p.date<=end))paid.set(p.invoice,(paid.get(p.invoice)||0)+p.amount);const debt=new Map();for(const i of s.invoices.filter(i=>i.date<=end)){const c=debt.get(i.customerId)||{name:i.customer,balance:0};c.balance+=i.total-(paid.get(i.id)||0);debt.set(i.customerId,c);}const top=[...debt.values()].filter(c=>c.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,5); return page('BÁO CÁO DOANH THU & CÔNG NỢ', `<p>Bộ lọc: Năm ${h(year)} · ${mode==='year'?'Theo năm':'Theo tháng'}</p>` + table(['Kỳ','Số HĐ','Doanh thu','Đã thu kỳ','Nợ cuối kỳ','Tỷ lệ thu'], rows.map(r=>[r.label,r.invoiceCount,vnd(r.revenue),vnd(r.collected),vnd(r.closingDebt),r.collectRate.toFixed(1)+'%'])) + '<h2>Top 5 khách hàng còn nợ đến cuối kỳ</h2>' + table(['Khách hàng','Còn nợ'],top.map(c=>[c.name,vnd(c.balance)])),s.settings); }
async function pdf(store, kind, args = {}, print = false) {
  const s = store.snapshot(); let html, stem;
  if (kind === 'invoice') { html = invoiceHtml(s, args.id); stem = 'HoaDon'; }
  else if (kind === 'statement') { html = statementHtml(s,args.customerId,args.from,args.to); stem = 'BangKe'; }
  else if (kind === 'report') { html = reportHtml(s,args.year,args.mode); stem = 'BaoCao'; }
  else throw Error('Loại tài liệu không hợp lệ.');
  const win = new BrowserWindow({ show: print, width: 920, height: 1100, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try { await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)); if (print) { win.webContents.print({ silent: false, printBackground: true }); return 'Đã mở hộp thoại in.'; } const dest = filename(store,stem,'pdf'); writeFile(dest,await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })); return dest; }
  finally { if (!print && !win.isDestroyed()) win.close(); }
}
const SHEETS = ['Thông tin','Hóa đơn','Chi tiết HĐ','Thu tiền','Công nợ KH','Báo cáo'];
function workbook(store,filter={}) {
  const s=store.snapshot(),invoices=selectInvoices(s,filter),ids=new Set(invoices.map(i=>i.id)),payments=s.payments.filter(p=>ids.has(p.invoice)),customers=s.customers.filter(c=>!filter.customerId||c.id===Number(filter.customerId)),wb=new ExcelJS.Workbook(),year=Number(filter.year||s.today.slice(0,4));
  const make=(name,rows)=>{const sheet=wb.addWorksheet(name);sheet.addRows(rows);sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4F46E5'}};sheet.columns.forEach(col=>{col.width=22;});sheet.views=[{state:'frozen',ySplit:1}];return sheet;};
  make(SHEETS[0],[['Thông tin','Giá trị'],['Ứng dụng','HoaDonXeNang'],['Phiên bản',version],['Ngày xuất',new Date().toISOString()],['Bộ lọc',filterLabel(filter)]]);
  const a=make(SHEETS[1],[['Mã HĐ','Ngày','Khách hàng','Điện thoại','Địa chỉ','Hạn trả','Tổng tiền','Đã thu','Còn nợ','Ghi chú'],...invoices.map(i=>[i.id,i.date,i.customer,i.phone,i.address,i.due,i.total,i.paid,i.balance,i.note])]);
  const b=make(SHEETS[2],[['Mã HĐ','Mặt hàng','Đơn vị','Số lượng','Đơn giá','Thành tiền'],...invoices.flatMap(i=>i.items.map(x=>[i.id,x.name,x.unit,x.qty,x.price,x.amount]))]);
  const c=make(SHEETS[3],[['Mã phiếu','Mã HĐ','Ngày thu','Số tiền','Phương thức','Ghi chú'],...payments.map(p=>[p.id,p.invoice,p.date,p.amount,p.method,p.note])]);
  const d=make(SHEETS[4],[['Mã khách','Khách hàng','Điện thoại','Địa chỉ','Tổng mua','Đã trả','Còn nợ'],...customers.map(c=>{const related=invoices.filter(i=>i.customerId===c.id);return[c.code,c.name,c.phone,c.address,related.reduce((n,i)=>n+i.total,0),related.reduce((n,i)=>n+i.paid,0),related.reduce((n,i)=>n+i.balance,0)];})]);
  make(SHEETS[5],[['Kỳ','Số HĐ','Doanh thu','Đã thu kỳ','Công nợ cuối kỳ','Tỷ lệ thu (%)'],...periodReports(invoices,payments,year,filter.mode==='year'?'year':'month').map(r=>[r.label,r.invoiceCount,r.revenue,r.collected,r.closingDebt,r.collectRate])]);
  for(const [sh,columns] of [[a,[7,8,9]],[b,[5,6]],[c,[4]],[d,[5,6,7]],[wb.getWorksheet(SHEETS[5]),[3,4,5]]])for(let row=2;row<=sh.rowCount;row++)for(const column of columns)sh.getRow(row).getCell(column).numFmt='#,##0 "₫"';
  for(const [sh,columns] of [[a,[1,4]],[b,[1]],[c,[1,2]],[d,[1,3]]])for(let row=2;row<=sh.rowCount;row++)for(const column of columns)sh.getRow(row).getCell(column).numFmt='@';
  return wb;
}
async function excel(store,filter={}) {const dest=filename(store,filter.customerId?'DoiChieuCongNo':'HoaDonXeNang','xlsx');try{await workbook(store,filter).xlsx.writeFile(dest);}catch(e){if(['EBUSY','EPERM','EACCES'].includes(e.code))throw Error('Không ghi được Excel. Hãy đóng file đang mở và kiểm tra quyền thư mục.');throw e;}return dest;}
function csv(store,kind,filter={}) {
  const s=store.snapshot(),invoices=selectInvoices(s,filter),ids=new Set(invoices.map(i=>i.id));
  const headers=kind==='payments'?['Mã phiếu','Mã HĐ','Ngày thu','Số tiền','Phương thức','Ghi chú']:['Mã HĐ','Ngày','Khách hàng','Điện thoại','Tổng tiền','Đã thu','Còn nợ','Trạng thái'];
  const data=kind==='payments'?s.payments.filter(p=>ids.has(p.invoice)).map(p=>[p.id,p.invoice,p.date,p.amount,p.method,p.note]):invoices.map(i=>[i.id,i.date,i.customer,i.phone,i.total,i.paid,i.balance,i.status]);
  const textColumns=kind==='payments'?new Set([0,1]):new Set([0,3]);
  const safe=(value,asText=false)=>{let cell=String(value??'');if(cell&&asText||/^[=+\-@]/.test(cell))cell=`'${cell}`;return `"${cell.replace(/"/g,'""')}"`;};
  const rows=[['Bộ lọc',filterLabel(filter)],[],headers,...data.map(row=>row.map((v,n)=>({value:v,asText:textColumns.has(n)})))];
  const content='\uFEFF'+rows.map(row=>row.map(cell=>cell&&typeof cell==='object'?safe(cell.value,cell.asText):safe(cell)).join(',')).join('\r\n');
  const dest=filename(store,kind==='payments'?'ThuTien':'HoaDon','csv');writeFile(dest,content);return dest;
}
module.exports={pdf,excel,csv,workbook,SHEETS,selectInvoices,folder};
