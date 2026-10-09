import {displayContractDate} from './contract-time.mjs';
import {refreshPs,renderPs,psSnapshot} from './ps-ui.mjs';
import {model,report} from './model.mjs';
const SHEET='1RzhVHTJQOI6f1Iv1VL7-_wt6oB7TksVANdEcEIzcbSI';
const $=id=>document.getElementById(id),fmt=(n,d=0)=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:d}).format(n),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,lastSuccess;let seq=0;const expandedOutlets=new Set,expandedMonths=new Set;
$('source').href=`https://docs.google.com/spreadsheets/d/${SHEET}/edit`;
$('unit').value='million';
function readSheet(name){return new Promise((resolve,reject)=>{const cb='sheetCallback'+(++seq),script=document.createElement('script');let done=false;const timer=setTimeout(()=>finish(Error('Google Sheets timed out. Please refresh and try again.')),25000);function finish(err,result){if(done)return;done=true;clearTimeout(timer);script.remove();delete window[cb];err?reject(err):resolve(result)}window[cb]=r=>{if(r.status!=='ok'||!r.table)return finish(Error('Unable to read sheet '+name+'. Check Google Sheets viewing permissions.'));finish(null,[r.table.cols.map(c=>c.label),...r.table.rows.map(r=>r.c.map(c=>c?.v??null))])};script.onerror=()=>finish(Error('Unable to connect to Google Sheets. Check your connection and sheet permissions.'));script.src=`https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?sheet=${encodeURIComponent(name)}&headers=1&tqx=${encodeURIComponent('out:json;responseHandler:'+cb)}&_=${Date.now()}`;document.head.append(script)})}
function options(id,items,all){const prev=$(id).value;$(id).innerHTML=(all?`<option value="">${escape(all)}</option>`:'')+items.map(v=>`<option value="${escape(v)}">${escape(v)}</option>`).join('');if([...$(id).options].some(o=>o.value===prev))$(id).value=prev;$(id).disabled=false;}
function periods(){const available=data.periods.filter(p=>p.split('-')[0]===$('year').value);options('period',available);const latest=data.purchases.map(p=>p.period).filter(p=>available.includes(p)).sort().at(-1);$('period').value=latest||available[0]||'';}
function filters(){return {period:$('period').value,region:$('region').value,fsm:$('fsm').value,level:$('level').value,outlet:$('outlet').value,search:$('search').value,price:$('price').value,unit:$('unit').value,mode:'cumulative'}}
function render(){if(!data)return;renderPs(data,filters());const f=filters(),r=report(data,f);const cumulative=f.mode==='cumulative';$('periodtitle').textContent='REPORT ON TRADE PROGRAM';
 const cards=[['Total outlets',fmt(r.totalOutlets),'Participating outlets'],['Total phased target',fmt(r.targetTotal,2),'Million VND · full program'],['Cumulative phased target',fmt(r.plan,2),`Million VND · ${r.startPeriod} → ${f.period}`],['Cumulative purchase revenue',fmt(r.amount/1e6),'Price 110'],['% Total achievement',r.targetTotal>0?fmt(r.amount/1e6/r.targetTotal*100,1)+'%':'—','Cumulative actual / total phased target'],['% Cumulative achievement',r.achievement===null?'—':fmt(r.achievement*100,1)+'%','Cumulative actual / cumulative target']];
 $('kpis').innerHTML=cards.map(([label,value,note])=>`<article><span>${label}</span><strong>${value}</strong>${note?`<small>${note}</small>`:''}</article>`).join('');
 const months=cumulative?data.periods.filter(p=>p<=f.period):data.periods.filter(p=>p.startsWith($('year').value+'-'));
 const points=months.map(period=>({...report(data,{...f,period,mode:'month'}),period}));
 const max=Math.max(1,...points.map(p=>p.amount));
 const yearGroups=[];
 points.forEach((p,index)=>{const year=p.period.split('-')[0];const last=yearGroups.at(-1);if(last?.year===year)last.count++;else yearGroups.push({year,start:index+1,count:1});});
 $('chart').innerHTML=`<div class="chart-grid" style="grid-template-columns:repeat(${Math.max(1,points.length)},minmax(67px,1fr))">${points.map((p,index)=>`<div class="barcol ${p.period===f.period?'selected':''}" style="grid-column:${index+1};grid-row:1" title="${p.period}: ${fmt(p.amount)} VND"><span class="barvalue">${fmt(p.amount/1e6,1)}</span><div class="bar" style="height:${Math.max(1,p.amount/max*155)}px"></div><span>${p.period.split('-')[1]}</span></div>`).join('')}${yearGroups.map(g=>`<div class="chart-year" style="grid-column:${g.start} / span ${g.count};grid-row:2">${g.year}</div>`).join('')}</div>`;
 $('coverage').innerHTML=`<div class="bigcoverage">${r.coverage===null?'—':fmt(r.coverage*100,1)+'%'}</div><div class="muted" style="font-size:.875rem">Planned outlets with purchases</div><div class="track"><i style="width:${(r.coverage??0)*100}%"></i></div><div class="coverrow"><span>Purchased / Planned</span><b>${r.bought} / ${r.planned}</b></div><div class="coverrow"><span>No purchases yet</span><b>${r.planned-r.bought}</b></div><div class="coverrow"><span>Purchases outside the period plan</span><b>${r.unplanned}</b></div>`;
 $('rowcount').textContent=`${r.rows.length} outlet · ${cumulative?r.startPeriod+' → ':''}${f.period} · Currency: VND · Price 110`;
 $('runtime-note').textContent=`Running time as of ${displayContractDate(r.asOf)} (Vietnam): elapsed contract time / total contract duration · 0–100%.`;
 const sortedRows=r.rows.sort((a,b)=>b.amount-a.amount);
 if(!sortedRows.length){
  $('rows').innerHTML='<tr><td colspan="11" class="empty">No outlets match the selected filters.</td></tr>';
 }else{
  const html=[];
  sortedRows.forEach(o=>{
   const outletId='out_'+String(o.code||o.name).replace(/[^a-zA-Z0-9_-]/g,'_');
   const hasMonths=o.months&&o.months.length>0;
   const isOpen=expandedOutlets.has(o.key);
   html.push(`<tr class="outlet-row ${isOpen?'is-open':''}" data-outlet-id="${outletId}" data-outlet-key="${escape(o.key)}"><td><div class="outlet-cell-wrap">${hasMonths?`<button type="button" class="tree-toggle-btn ${isOpen?'is-open':''}" data-target-outlet="${outletId}" title="Xem chi tiết từng tháng">▸</button>`:'<span style="width:16px;display:inline-block"></span>'}<div><b>${escape(o.name)}</b><small>${escape(o.code)}</small></div></div></td><td>${escape(o.region)}<small>${escape(o.fsm)}</small></td><td>${escape(o.level)}</td><td class="contract-date">${displayContractDate(o.startDate)}</td><td class="contract-running" title="${escape('End Date: '+displayContractDate(o.endDate)+' · As of: '+displayContractDate(r.asOf))}">${o.runningTime===null?'—':fmt(o.runningTime,1)+'%'}</td><td>${o.onList?fmt(o.targetTotal*1e6):'—'}</td><td>${o.plan===null?'—':fmt(o.plan*1e6)}</td><td><b>${fmt(o.amount)}</b></td><td>${o.achievement===null?'—':fmt(o.achievement*100,1)+'%'}</td><td>${o.totalAchievement===null?'—':fmt(o.totalAchievement*100,1)+'%'}</td><td><span class="pill ${o.plan===null?'':o.transactions?'yes':'wait'}">${o.plan===null?'Outside plan':o.transactions?'Purchased':'No purchases'}</span></td></tr>`);
   if(hasMonths){
    o.months.forEach(m=>{
     const monthKey=o.key+'_'+m.period;
     const monthId=outletId+'_'+m.period.replace(/[^a-zA-Z0-9_-]/g,'_');
     const isMonthOpen=expandedMonths.has(monthKey);
     const hasDays=m.days&&m.days.length>0;
     html.push(`<tr class="child-row month-row ${outletId}" data-month-id="${monthId}" data-month-key="${escape(monthKey)}" style="display:${isOpen?'table-row':'none'}"><td><div class="month-cell-wrap">${hasDays?`<button type="button" class="tree-toggle-btn day-toggle ${isMonthOpen?'is-open':''}" data-target-month="${monthId}" title="Xem chi tiết theo ngày">▸</button>`:'<span style="width:14px;display:inline-block;color:#1c796f;font-weight:700">•</span>'}<span class="month-badge">${escape(m.period)}</span></div></td><td><small>Tháng ${escape(m.period)}</small></td><td style="color:#8ba0ad">—</td><td class="contract-date">—</td><td class="contract-running">—</td><td style="color:#8ba0ad">—</td><td>${m.target===null?'—':fmt(m.target)}</td><td><b>${fmt(m.amount)}</b></td><td>${m.achievement===null?'—':fmt(m.achievement*100,1)+'%'}</td><td>${m.totalAchievement===null?'—':fmt(m.totalAchievement*100,1)+'%'}</td><td><span class="pill ${m.target===null?'':m.transactions?'yes':'wait'}">${m.target===null?'Outside plan':m.transactions?'Purchased':'No purchases'}</span></td></tr>`);
     if(hasDays){
      m.days.forEach(d=>{
       html.push(`<tr class="child-row day-row ${outletId} ${monthId}" style="display:${(isOpen&&isMonthOpen)?'table-row':'none'}"><td><div class="day-cell-wrap"><span class="day-dot">↳</span><span class="day-date">${escape(d.date)}</span></div></td><td colspan="6" style="color:#647b8a;font-size:0.8rem;font-style:italic">${d.transactions} giao dịch mua hàng</td><td><b>${fmt(d.amount)}</b></td><td colspan="2" style="color:#8ba0ad">—</td><td><span class="pill yes">Purchased</span></td></tr>`);
      });
     }
    });
   }
  });
  $('rows').innerHTML=html.join('');
 }
 $('quality').textContent=`Loaded ${data.outlets.filter(o=>o.onList).length} outlets from On_list and ${data.sourceRows} purchase rows. ${data.invalidPeriods} rows excluded due to missing or invalid fiscal periods; ${data.missingCodes} purchase rows have no outlet code. Source rows are summed without automatic deduplication.`;
}
async function refresh(){if($('refresh').disabled)return;refreshPs(()=>[data,filters()]);$('refresh').disabled=true;$('refresh').textContent='Refreshing…';try{const [p,b]=await Promise.all([readSheet('On_list'),readSheet('ONT mua hàng')]);const next=model(p,b);if(!next.periods.length)throw Error('No fiscal periods found in the data.');data=next;options('year',[...new Set(data.periods.map(p=>p.split('-')[0]))]);const latest=data.purchases.map(p=>p.period).sort().at(-1)||data.periods[0];$('year').value=latest.split('-')[0];periods();$('period').value=latest;options('region',[...new Set(data.outlets.map(o=>o.region))].sort(),'All regions');options('fsm',[...new Set(data.outlets.map(o=>o.fsm))].sort(),'All FSMs');options('level',[...new Set(data.outlets.filter(o=>o.onList).map(o=>o.level))].sort(),'All levels');const prevOutlet=$('outlet').value;$('outlet').innerHTML='<option value="">All outlets</option>'+data.outlets.slice().sort((a,b)=>a.name.localeCompare(b.name,'vi')).map(o=>`<option value="${escape(o.key)}">${escape(o.name)}</option>`).join('');if(data.outlets.some(o=>o.key===prevOutlet))$('outlet').value=prevOutlet;lastSuccess=new Date();$('synctime').textContent='Updated '+lastSuccess.toLocaleString('en-GB');$('error').hidden=true;render()}catch(e){$('error').hidden=false;$('error').textContent=e.message+(data?' Showing data from the last successful refresh.':' No data is available for this report.');$('synctime').textContent=lastSuccess?'Previous data · '+lastSuccess.toLocaleString('en-GB'):'Not connected';if(!data)$('rows').innerHTML='<tr><td colspan="11" class="empty">Unable to load data. Select Refresh data to retry.</td></tr>'}finally{$('refresh').disabled=false;$('refresh').textContent='↻ Refresh data'}}
$('refresh').addEventListener('click',refresh);$('year').addEventListener('change',()=>{periods();render()});['period','region','fsm','outlet','level','price','unit'].forEach(id=>$(id).addEventListener('change',render));$('search').addEventListener('input',render);
$('rows').addEventListener('click',e=>{
 const dayBtn=e.target.closest('.day-toggle');
 if(dayBtn){
  e.stopPropagation();
  const monthRow=dayBtn.closest('.month-row');
  const monthId=dayBtn.dataset.targetMonth;
  const monthKey=monthRow?.dataset.monthKey;
  if(!monthId)return;
  const willOpen=!expandedMonths.has(monthKey);
  if(willOpen)expandedMonths.add(monthKey);else expandedMonths.delete(monthKey);
  dayBtn.classList.toggle('is-open',willOpen);
  document.querySelectorAll(`.day-row.${monthId}`).forEach(el=>{el.style.display=willOpen?'table-row':'none';});
  return;
 }
 const monthRow=e.target.closest('.month-row');
 if(monthRow){
  const toggle=monthRow.querySelector('.day-toggle');
  if(toggle){
   const monthId=toggle.dataset.targetMonth;
   const monthKey=monthRow.dataset.monthKey;
   if(monthId){
    const willOpen=!expandedMonths.has(monthKey);
    if(willOpen)expandedMonths.add(monthKey);else expandedMonths.delete(monthKey);
    toggle.classList.toggle('is-open',willOpen);
    document.querySelectorAll(`.day-row.${monthId}`).forEach(el=>{el.style.display=willOpen?'table-row':'none';});
   }
  }
  return;
 }
 const outletRow=e.target.closest('.outlet-row');
 if(outletRow){
  const btn=outletRow.querySelector('.tree-toggle-btn');
  if(!btn)return;
  const outletId=outletRow.dataset.outletId;
  const outletKey=outletRow.dataset.outletKey;
  if(!outletId)return;
  const willOpen=!expandedOutlets.has(outletKey);
  if(willOpen)expandedOutlets.add(outletKey);else expandedOutlets.delete(outletKey);
  outletRow.classList.toggle('is-open',willOpen);
  btn.classList.toggle('is-open',willOpen);
  document.querySelectorAll(`.month-row.${outletId}`).forEach(mRow=>{
   mRow.style.display=willOpen?'table-row':'none';
   const mId=mRow.dataset.monthId;
   const mKey=mRow.dataset.monthKey;
   const isMOpen=expandedMonths.has(mKey);
   if(mId){
    document.querySelectorAll(`.day-row.${mId}`).forEach(dRow=>{
     dRow.style.display=(willOpen&&isMOpen)?'table-row':'none';
    });
   }
  });
 }
});
$('btnExpandAll')?.addEventListener('click',()=>{
 document.querySelectorAll('.outlet-row').forEach(row=>{
  const k=row.dataset.outletKey;
  const id=row.dataset.outletId;
  const btn=row.querySelector('.tree-toggle-btn');
  if(btn&&k&&id){
   expandedOutlets.add(k);
   row.classList.add('is-open');
   btn.classList.add('is-open');
   document.querySelectorAll(`.month-row.${id}`).forEach(mRow=>{
    mRow.style.display='table-row';
    const mId=mRow.dataset.monthId;
    const mKey=mRow.dataset.monthKey;
    if(mId&&expandedMonths.has(mKey)){
     document.querySelectorAll(`.day-row.${mId}`).forEach(dRow=>{dRow.style.display='table-row';});
    }
   });
  }
 });
});
$('btnCollapseAll')?.addEventListener('click',()=>{
 expandedOutlets.clear();
 expandedMonths.clear();
 document.querySelectorAll('.outlet-row').forEach(row=>{
  row.classList.remove('is-open');
  const btn=row.querySelector('.tree-toggle-btn');
  if(btn)btn.classList.remove('is-open');
 });
 document.querySelectorAll('.day-toggle').forEach(btn=>btn.classList.remove('is-open'));
 document.querySelectorAll('.child-row').forEach(row=>{row.style.display='none';});
});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_ontrade_report',title:'Read ONTRADE report',description:'Read the report using the current filters without changing source data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('This tool accepts no parameters');if(!data)throw Error('Data is still loading');return {filters:filters(),...report(data,filters()),ps:psSnapshot(data,filters()),updatedAt:lastSuccess.toISOString()}}})).catch(()=>{})}catch{}}
refresh();

