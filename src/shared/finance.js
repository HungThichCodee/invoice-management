'use strict';
const { money, status, report, periodReports } = require('./core');
const daysBetween=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000);
function customerProfile(state, customerId, from='', to='', tab='all') {
  const id=Number(customerId), c=state.customers.find(x=>x.id===id); if(!c)throw Error('Không tìm thấy khách hàng.');
  const all=state.invoices.filter(i=>i.customerId===id), invoiceIds=new Set(all.map(i=>i.id));
  const payments=state.payments.filter(p=>invoiceIds.has(p.invoice));
  const due=all.filter(i=>i.balance>0), overdue=due.filter(i=>i.due&&i.due<state.today);
  const summary={total:all.reduce((n,i)=>n+i.total,0),paid:all.reduce((n,i)=>n+i.paid,0),balance:due.reduce((n,i)=>n+i.balance,0),invoiceCount:all.length,overdueCount:overdue.length,lastPurchase:all.map(i=>i.date).sort().at(-1)||'',oldestOverdueDays:Math.max(0,...overdue.map(i=>daysBetween(i.due,state.today)))};
  const aging=[0,0,0,0]; for(const i of due){const age=i.due?Math.max(0,daysBetween(i.due,state.today)):0;aging[age<=30?0:age<=60?1:age<=90?2:3]+=i.balance;}
  const events=[...all.map(i=>({kind:'invoice',date:i.date,id:i.id,amount:i.total,invoiceId:i.id,customer:i.customer,balance:i.balance,status:status(i,state.today)})),...payments.map(p=>({kind:'payment',date:p.date,id:p.id,amount:p.amount,invoiceId:p.invoice,method:p.method,note:p.note}))].sort((a,b)=>a.date.localeCompare(b.date)||(a.kind===b.kind?0:a.kind==='invoice'?-1:1)||a.id.localeCompare(b.id));
  let running=0;for(const e of events){running+=e.kind==='invoice'?e.amount:-e.amount;e.runningBalance=running;}
  const visible=events.filter(e=>(!from||e.date>=from)&&(!to||e.date<=to)&&(tab==='all'||tab==='invoice'&&e.kind==='invoice'||tab==='payment'&&e.kind==='payment'||tab==='debt'&&e.kind==='invoice'&&e.balance>0||tab==='late'&&e.kind==='invoice'&&e.status.startsWith('Quá hạn')));
  return {customer:c,summary,aging,timeline:visible,allInvoices:all};
}
function bulkPlan(state,customerId,amount){const n=money(amount,true),invoices=state.invoices.filter(i=>i.customerId===Number(customerId)&&i.balance>0).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));const total=invoices.reduce((v,i)=>v+i.balance,0);if(n>total)throw Error('Số thu vượt tổng dư nợ của khách.');let remaining=n;const allocations=[];for(const i of invoices){if(!remaining)break;const part=Math.min(remaining,i.balance);allocations.push({invoice:i.id,date:i.date,customer:i.customer,balance:i.balance,amount:part});remaining-=part;}return {customerId:Number(customerId),amount:n,allocations};}
module.exports={customerProfile,bulkPlan,report,periodReports};
