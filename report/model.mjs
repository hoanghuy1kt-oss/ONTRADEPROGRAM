import {parseContractDate,contractProgress,todayInVietnam} from './contract-time.mjs';
export const canonical = v => {const m=String(v??'').trim().toUpperCase().match(/^F(\d{2,4})\s*-\s*P(\d{1,2})$/);return m&&+m[2]>=1&&+m[2]<=12?`F${m[1]}-P${m[2].padStart(2,'0')}`:null};
const norm=v=>String(v??'').trim().replace(/\s+/g,' ').toUpperCase();
const key=(code,name)=>!norm(code)||norm(code)==='NEW OUTLET'?`${norm(code)}|${norm(name)}`:norm(code);
const num=v=>{if(v===null||v===undefined||v==='')return 0;const s=typeof v==='string'?v.replace(/,/g,'').trim():v;const n=Number(s);if(!Number.isFinite(n))throw Error('Invalid numeric value in sheet: '+String(v));return n};
function formatVnDate(v){
 if(!v)return{display:'',sortKey:''};
 const s=String(v).trim();
 const m=s.match(/Date\((\d+),(\d+),(\d+)\)/);
 if(m){
  const y=m[1],mo=String(Number(m[2])+1).padStart(2,'0'),d=String(m[3]).padStart(2,'0');
  return{display:`${d}/${mo}/${y}`,sortKey:`${y}${mo}${d}`};
 }
 const parts=s.split(/[\/\-]/);
 if(parts.length===3){
  if(parts[2].length===4){
   const mo=String(parts[0]).padStart(2,'0'),d=String(parts[1]).padStart(2,'0'),y=parts[2];
   return{display:`${d}/${mo}/${y}`,sortKey:`${y}${mo}${d}`};
  }
  if(parts[0].length===4){
   const y=parts[0],mo=String(parts[1]).padStart(2,'0'),d=String(parts[2]).padStart(2,'0');
   return{display:`${d}/${mo}/${y}`,sortKey:`${y}${mo}${d}`};
  }
 }
 return{display:s,sortKey:s};
}
export function model(plan,buy,restock=[]){
 const ph=plan[0].map(norm),bh=buy[0].map(norm);const col=(h,n)=>{const i=h.indexOf(norm(n));if(i<0)throw Error('Missing source column: '+n);return i};
 const pc=col(ph,'MÃ OUTLET'),pn=col(ph,'TÊN OUTLET'),pr=col(ph,'VÙNG'),pf=col(ph,'FSM'),pl=col(ph,'LEVEL'),ps=col(ph,'Start date'),pe=col(ph,'End Date');
 const psop=ph.indexOf(norm('S.O.P T1'))>=0?ph.indexOf(norm('S.O.P T1')):ph.findIndex(h=>h.includes('S.O.P')||h.includes('SOP'));
 const bc=col(bh,'MÃ OUTLET'),bn=col(bh,'TÊN OUTLET'),bp=col(bh,'P - Tháng'),b110=col(bh,'Thành tiền (giá 110)'),b100=col(bh,'Thành tiền (giá 100)'),bf=col(bh,'FSM');
 const bdate=bh.indexOf('NGÀY HÓA ĐƠN')>=0?bh.indexOf('NGÀY HÓA ĐƠN'):bh.findIndex(h=>h.includes('NGÀY'));
 const periods=plan[0].map((x,i)=>[canonical(x),i]).filter(([p])=>p);const outlets=new Map;let invalidPeriods=0,missingCodes=0;
 for(const r of plan.slice(1)){if(!r[pn])continue;let k=key(r[pc],r[pn]);if(outlets.has(k))throw Error('Duplicate outlet code in On_list: '+r[pc]+'. Check the source before summing targets.');const targets={};for(const [p,i]of periods){if(r[i]!==null&&r[i]!==undefined&&r[i]!=='')targets[p]=num(r[i]);}outlets.set(k,{key:k,code:r[pc]||'',name:r[pn],region:r[pr]||'Unspecified',fsm:r[pf]||'Unspecified',sopT1:psop>=0&&r[psop]?String(r[psop]).trim():'',level:r[pl]||'—',targets,startDate:parseContractDate(r[ps]),endDate:parseContractDate(r[pe]),hasEndDate:r[pe]!==null&&r[pe]!==undefined&&String(r[pe]).trim()!=='',onList:true});}
 const purchases=[];for(const r of buy.slice(1)){if(!r[bn]&&!r[bc])continue;const p=canonical(r[bp]);if(!p){invalidPeriods++;continue;}const k=key(r[bc],r[bn]);if(!r[bc])missingCodes++;if(!outlets.has(k))outlets.set(k,{key:k,code:r[bc]||'',name:r[bn]||'Unnamed outlet',region:'Unspecified',fsm:r[bf]||'Unspecified',sopT1:'',level:'—',targets:{},startDate:null,endDate:null,onList:false});purchases.push({key:k,period:p,date:bdate>=0&&r[bdate]?String(r[bdate]).trim():'',v110:num(r[b110]),v100:num(r[b100])});}
 const restocks=[];
 if(Array.isArray(restock)&&restock.length>1){
  const rh=restock[0].map(norm);
  const findCol=names=>{for(const n of names){const idx=rh.indexOf(norm(n));if(idx>=0)return idx;}return -1;};
  const rc=findCol(['OL code','MÃ OUTLET','OL CODE','CODE']);
  const rn=findCol(['Outlet được restock','TÊN OUTLET','OUTLET']);
  const ra110=findCol(['Amount(110)','AMOUNT(110)','Amount (110)','Thành tiền (giá 110)']);
  const ra100=findCol(['Amount(100)','AMOUNT(100)','Amount (100)','Thành tiền (giá 100)']);
  const rp=findCol(['P-MONTH','P - Tháng','PMONTH','PERIOD','Tháng']);
  const rsop=findCol(['S.O.P T1','SOP T1','S.O.P','SOP']);
  const rf=findCol(['FSM']);
  for(const r of restock.slice(1)){
   const code=rc>=0?r[rc]:'';
   const name=rn>=0?r[rn]:'';
   if(!code&&!name)continue;
   const p=rp>=0?canonical(r[rp]):null;
   const k=key(code,name);
   const a110=ra110>=0?num(r[ra110]):0;
   const a100=ra100>=0?num(r[ra100]):0;
   const sop=rsop>=0&&r[rsop]?String(r[rsop]).trim():'';
   if(outlets.has(k)){
    const o=outlets.get(k);
    if(!o.sopT1&&sop)o.sopT1=sop;
   }else{
    outlets.set(k,{key:k,code:code||'',name:name||'Unnamed outlet',region:'Unspecified',fsm:(rf>=0&&r[rf]?String(r[rf]).trim():'Unspecified'),sopT1:sop,level:'—',targets:{},startDate:null,endDate:null,onList:false});
   }
   restocks.push({key:k,code:code||'',name:name||'',period:p,v110:a110,v100:a100,sopT1:sop});
  }
 }
 return {outlets:[...outlets.values()],purchases,restocks,periods:[...new Set([...periods.map(x=>x[0]),...purchases.map(x=>x.period),...restocks.map(x=>x.period).filter(Boolean)])].sort(),invalidPeriods,missingCodes,sourceRows:buy.length-1,restockRows:restocks.length};
}
export function report(m,{period,region='',fsm='',level='',outlet='',search='',price='110',unit='million',mode='month',asOf=todayInVietnam()}){
 const included=m.periods.filter(p=>mode==='cumulative'?p<=period:p===period);
 const selected=m.outlets.filter(o=>(!level||o.level===level)&&(!outlet||o.key===outlet)&&(!region||o.region===region)&&(!fsm||o.fsm===fsm)&&(!search||norm(o.code+' '+o.name).includes(norm(search))));
 const rows=selected.map(o=>{
 const tx=m.purchases.filter(t=>t.key===o.key&&included.includes(t.period));
 const amount=tx.reduce((s,t)=>s+t['v'+price],0);
 const rx=(m.restocks||[]).filter(t=>t.key===o.key&&(!t.period||included.includes(t.period)));
 const restockAmount=rx.reduce((s,t)=>s+(price==='100'?t.v100:t.v110),0);
 const plans=included.filter(p=>Object.hasOwn(o.targets,p));
 const plan=mode==='cumulative'?(plans.length?plans.reduce((s,p)=>s+o.targets[p],0):null):(o.targets[period]??null);
 const actual=unit==='million'?amount/1e6:unit==='vnd'?amount:null;
 const targetTotal=Object.values(o.targets).reduce((s,v)=>s+v,0);
 const months=included.map(p=>{
  const pTx=m.purchases.filter(t=>t.key===o.key&&t.period===p);
  const pAmount=pTx.reduce((s,t)=>s+t['v'+price],0);
  const pRx=(m.restocks||[]).filter(t=>t.key===o.key&&t.period===p);
  const pRestock=pRx.reduce((s,t)=>s+(price==='100'?t.v100:t.v110),0);
  const pTarget=o.targets[p]!==undefined?o.targets[p]:null;
  const pActual=unit==='million'?pAmount/1e6:pAmount;
  const pAchievement=(pTarget!==null&&pTarget>0)?pActual/pTarget:(pAmount>0?1:null);
  const pTotalAch=targetTotal>0?(pAmount/1e6)/targetTotal:null;
  const dateMap=new Map;
  for(const t of pTx){
   const dInfo=formatVnDate(t.date);
   const d=dInfo.display||'Chưa có ngày';
   const sortKey=dInfo.sortKey||'99999999';
   if(!dateMap.has(d))dateMap.set(d,{date:d,sortKey,amount:0,transactions:0});
   const entry=dateMap.get(d);
   entry.amount+=t['v'+price];
   entry.transactions++;
  }
  const days=[...dateMap.values()].sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
  return {period:p,target:pTarget!==null?pTarget*1e6:null,amount:pAmount,restockAmount:pRestock,achievement:pAchievement,totalAchievement:pTotalAch,transactions:pTx.length,days};
 }).filter(x=>x.target!==null||x.amount>0||(x.restockAmount||0)>0);
 return {...o,runningTime:contractProgress(o.startDate,o.endDate,asOf),plan,targetTotal,totalAchievement:targetTotal>0?amount/1e6/targetTotal:null,amount,restockAmount,transactions:tx.length,achievement:plan!==null&&plan>0&&actual!==null?actual/plan:null,months};
 }).filter(o=>mode==='cumulative'?(o.onList||o.transactions>0||(o.restockAmount||0)>0):(o.plan!==null||o.transactions>0||(o.restockAmount||0)>0));
 const planned=rows.filter(o=>o.plan!==null),bought=planned.filter(o=>o.transactions>0),plan=planned.reduce((s,o)=>s+o.plan,0),amount=rows.reduce((s,o)=>s+o.amount,0),restockAmount=rows.reduce((s,o)=>s+(o.restockAmount||0),0);
 const actual=unit==='million'?amount/1e6:unit==='vnd'?amount:null;
 return {rows,plan,asOf,totalOutlets:m.outlets.filter(o=>o.onList).length,targetTotal:selected.filter(o=>o.onList).reduce((s,o)=>s+Object.values(o.targets).reduce((a,v)=>a+v,0),0),amount,restockAmount,achievement:plan>0&&actual!==null?actual/plan:null,planned:planned.length,bought:bought.length,coverage:planned.length?bought.length/planned.length:null,unplanned:rows.filter(o=>o.plan===null&&o.transactions>0).length,startPeriod:included[0]??period,endPeriod:period};
}
