'use strict';
const ExcelJS = require('exceljs');
const { invoiceInput, date, money, clean } = require('../shared/core');
const HEADERS = {
  FM_HoaDon: ['Mã HĐ','Ngày','Khách hàng','Điện thoại','Địa chỉ / đơn vị','Hạn trả','Tổng tiền','Ghi chú','Chi tiết JSON','Mã yêu cầu'],
  FM_ThuTien: ['Mã phiếu','Mã HĐ','Ngày thu','Số tiền','Phương thức','Ghi chú','Mã yêu cầu']
};
function iso(value) {
  if (value instanceof Date) return date(value.toISOString().slice(0,10));
  if (typeof value === 'number') return date(new Date(Math.round(value - 25569) * 86400000).toISOString().slice(0,10));
  const s=String(value||'').trim();
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if(m)return date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  return date(s);
}
async function parseWpsWorkbook(file) {
  const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  for(const [name,headers] of Object.entries(HEADERS)) { const sheet=wb.getWorksheet(name); if(!sheet)throw Error(`Thiếu sheet ${name}.`); for(let n=0;n<headers.length;n++)if(String(sheet.getRow(1).getCell(n+1).value||'')!==headers[n])throw Error(`Tiêu đề sheet ${name} không đúng ở cột ${n+1}.`); }
  const invoices=[],payments=[],ids=new Set();
  wb.getWorksheet('FM_HoaDon').eachRow((row,num)=>{if(num===1||!row.getCell(1).value)return;const id=clean(row.getCell(1).value,100);if(ids.has(id))throw Error(`Trùng mã hóa đơn ${id}.`);ids.add(id);let items;try{items=JSON.parse(String(row.getCell(9).value||''));}catch{throw Error(`Chi tiết JSON không hợp lệ ở dòng ${num}.`);}const input=invoiceInput({date:iso(row.getCell(2).value),customer:row.getCell(3).value,phone:row.getCell(4).value,address:row.getCell(5).value,due:row.getCell(6).value?iso(row.getCell(6).value):'',note:row.getCell(8).value,items});if(input.total!==money(row.getCell(7).value,true))throw Error(`Tổng tiền hóa đơn ${id} không khớp mặt hàng.`);invoices.push({legacyId:id,...input});});
  const paid=new Map();wb.getWorksheet('FM_ThuTien').eachRow((row,num)=>{if(num===1||!row.getCell(1).value)return;const id=clean(row.getCell(1).value,100),invoice=clean(row.getCell(2).value,100),day=iso(row.getCell(3).value),amount=money(row.getCell(4).value,true),method=clean(row.getCell(5).value,50),note=clean(row.getCell(6).value,1000);if(!['Tiền mặt','Chuyển khoản','Khác'].includes(method))throw Error(`Phương thức thu ở dòng ${num} không hợp lệ.`);const inv=invoices.find(i=>i.legacyId===invoice);if(!inv)throw Error(`Phiếu thu ${id} không tìm thấy hóa đơn.`);if(day<inv.date)throw Error(`Ngày thu của phiếu ${id} trước ngày hóa đơn.`);paid.set(invoice,(paid.get(invoice)||0)+amount);if(paid.get(invoice)>inv.total)throw Error(`Tổng thu của hóa đơn ${invoice} vượt tổng tiền.`);payments.push({legacyId:id,invoice,date:day,amount,method,note});});
  return {invoices,payments};
}
module.exports={parseWpsWorkbook,HEADERS,iso};
