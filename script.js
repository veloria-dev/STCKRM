const CODE_LENGTH=9; // staff codes are 9 characters; each owner account has its own
let googleClientId='';
const OFFLINE_KEY='stockroom_offline_queue';
let data={date:'',rows:[],submissions:[],reports:[]};
let navIndex=0;
let currentPreviewReport=null;
const $=id=>document.getElementById(id);
const money=n=>`₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:0,maximumFractionDigits:2})}`;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function api(action, options={}){const res=await fetch(`api.php?action=${encodeURIComponent(action)}${options.query?'&'+new URLSearchParams(options.query):''}`,{method:options.method||'GET',headers:{'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,credentials:'same-origin'});let j={};try{j=await res.json()}catch{} if(!res.ok||j.ok===false)throw new Error(j.error||'Request failed');return j;}
async function refresh(){const r=await api('bootstrap');data={owner:r.owner||null,date:r.date,rows:r.foods||[],submissions:r.submissions||[],reports:r.reports||[],staffCode:r.staff_code||''};googleClientId=r.google_client_id||'';return r;}
function show(id){['landingPage','loginPage','ownerDashboard','staffPage'].forEach(x=>{const el=$(x);if(el)el.classList.toggle('hidden',x!==id)});window.scrollTo(0,0);
  if(id==='ownerDashboard') setOwnerTab('overview');
}
// ---------- Owner tabs: Dashboard / Manage foods / Reports ----------
const PANE_INFO={
  overview:['Your shop, at a glance.','Track the stock your staff take out, what they return, and what was actually sold.'],
  foods:['Manage foods','Add new foods or edit the selling price and stock available for staff to take.'],
  reports:['Daily reports','Every day saves itself automatically once it ends. Use the arrows or the date picker to look back.'],
  settings:['Settings','Manage your shop profile, staff access and your account.']
};
function setOwnerTab(name){
  document.querySelectorAll('.owner-pane').forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==name));
  document.querySelectorAll('.owner-tab-btn').forEach(b=>{const on=b.dataset.tab===name;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false')});
  const info=PANE_INFO[name]||PANE_INFO.overview; if($('paneTitle'))$('paneTitle').textContent=info[0]; if($('paneDesc'))$('paneDesc').textContent=info[1];
  if(name==='reports'){ try{ loadReportPreview() }catch(e){} }
  window.scrollTo(0,0);
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.owner-tab-btn'); if(b) setOwnerTab(b.dataset.tab)});
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}
function getItem(id){return data.rows.find(x=>String(x.id)===String(id))}
function reportEntries(){return data.reports||[]}
function formatReportDate(k){const d=new Date(`${k}T00:00:00`);return d.toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}

$('togglePassword').addEventListener('click',()=>{const p=$('password');p.type=p.type==='text'?'password':'text'});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('login',{method:'POST',body:{email:$('email').value,password:$('password').value}});await refresh();show('ownerDashboard');navIndex=0;renderOwner();toast('Welcome back, owner.')}catch(err){toast(err.message)}});
$('forgot').addEventListener('click',e=>{e.preventDefault();toast('Use the owner credentials provided by your administrator.')});
document.addEventListener('click',async e=>{ if(e.target.closest&&e.target.closest('.js-logout')){ try{await api('logout')}catch(_){} show('loginPage'); $('password').value=''; } });
$('logoutStaff').addEventListener('click',async()=>{await api('logout');show('loginPage')});

let codeValues=Array(CODE_LENGTH).fill('');
function openCodeModal(){codeValues=Array(CODE_LENGTH).fill('');$('codeInputs').innerHTML='';for(let i=0;i<CODE_LENGTH;i++){const input=document.createElement('input');input.className='code-box';input.maxLength=1;input.inputMode='text';input.dataset.index=i;input.setAttribute('aria-label',`Code digit ${i+1}`);input.addEventListener('input',e=>{const v=e.target.value.replace(/[^a-z0-9]/gi,'').toUpperCase();e.target.value=v;codeValues[i]=v;if(v&&i<CODE_LENGTH-1)document.querySelector(`.code-box[data-index="${i+1}"]`).focus();updateCodeUI()});input.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!e.target.value&&i>0)document.querySelector(`.code-box[data-index="${i-1}"]`).focus();if(e.key==='ArrowLeft'&&i>0)document.querySelector(`.code-box[data-index="${i-1}"]`).focus();if(e.key==='ArrowRight'&&i<CODE_LENGTH-1)document.querySelector(`.code-box[data-index="${i+1}"]`).focus();if(e.key==='Enter')$('continueCode').click()});$('codeInputs').appendChild(input)}$('codeError').textContent='';$('codeModal').classList.remove('hidden');setTimeout(()=>document.querySelector('.code-box')?.focus(),50);updateCodeUI()}
function closeCodeModal(){$('codeModal').classList.add('hidden')}
function updateCodeUI(){const n=codeValues.filter(Boolean).length;$('codeCounter').textContent=`${n} / ${CODE_LENGTH}`;$('continueCode').disabled=n!==CODE_LENGTH}
$('staffAccess').addEventListener('click',openCodeModal);$('closeCodeModal').addEventListener('click',closeCodeModal);$('cancelCode').addEventListener('click',closeCodeModal);$('codeBackdrop').addEventListener('click',closeCodeModal);
$('pasteCode').addEventListener('click',async()=>{try{const t=(await navigator.clipboard.readText()).replace(/\s/g,'').slice(0,CODE_LENGTH).toUpperCase();[...t].forEach((c,i)=>{codeValues[i]=c;const el=document.querySelector(`.code-box[data-index="${i}"]`);if(el)el.value=c});updateCodeUI()}catch{toast('Paste permission was blocked. Press Ctrl+V.')}});
$('continueCode').addEventListener('click',async()=>{
  if(!navigator.onLine){$('codeError').textContent='Staff access needs an internet connection the first time. Once loaded, submissions will still work offline.';return;}
  try{await api('staff_login',{method:'POST',body:{code:codeValues.join('')}});await refresh();closeCodeModal();show('staffPage');setupStaffForm();toast('Staff access granted.')}catch(err){$('codeError').textContent=err.message;$('codeInputs').classList.remove('shake');void $('codeInputs').offsetWidth;$('codeInputs').classList.add('shake')}
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('codeModal').classList.contains('hidden'))closeCodeModal();if(e.key==='Escape'&&!$('foodModal').classList.contains('hidden'))closeFoodModal()});

function renderOwner(){
 $('todayDate').textContent=new Date(`${data.date}T00:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}).toUpperCase();
 const sales=data.submissions.reduce((a,s)=>a+Number(s.sales||0),0), sold=data.submissions.reduce((a,s)=>a+Number(s.sold||0),0), stock=data.rows.reduce((a,r)=>a+Number(r.stock||0),0);
 $('totalSales').textContent=money(sales);$('itemsSold').textContent=sold;$('stockLeft').textContent=stock;$('submissionCount').textContent=data.submissions.length;
 $('manageTable').innerHTML=data.rows.length?data.rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${money(r.price)}</td><td>${Number(r.stock)===0?'<span class="soldout-pill">SOLD OUT</span>':`<strong>${r.stock}</strong>`}</td><td><span class="type-pill">${r.type==='drink'?'Palamig / drink':'Food'}</span></td><td><div class="action-group"><button class="edit-btn" data-edit="${r.id}">Edit</button><button class="delete-btn" data-delete="${r.id}">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="5" class="empty-cell">No active food items.</td></tr>';
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openFoodModal(b.dataset.edit));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteFood(b.dataset.delete));
 if($('staffCodeValue'))$('staffCodeValue').textContent=data.staffCode||'—';
 renderOwnerExtras();
 renderReportHistory();
 loadReportPreview();
}
function renderReportHistory(){
  const reports=reportEntries();
  $('reportHistory').innerHTML=reports.length?reports.map(r=>`<button type="button" class="report-row" data-report="${r.date}"><span><b>${formatReportDate(r.date)}</b><small>${r.submissions?.length||0} staff submissions · ${r.totals?.sold||0} sold</small></span><strong>${money(r.totals?.sales||0)}</strong><i>→</i></button>`).join(''):'<div class="empty">Past days will appear here automatically once each day ends.</div>';
  document.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>{
    const dates=buildDateList(); const idx=dates.indexOf(b.dataset.report); navIndex=idx>=0?idx:0; loadReportPreview();
  });
}
async function deleteFood(id){const r=getItem(id);if(!r||!confirm(`Delete ${r.name}? Historical daily reports will remain.`))return;try{await api('delete_food',{method:'POST',body:{id}});await refresh();renderOwner();toast(`${r.name} deleted.`)}catch(e){toast(e.message)}}

// ---------- Calendar / arrow report navigation ----------
function buildDateList(){
  const set=new Set((data.reports||[]).map(r=>r.date));
  set.add(data.date);
  return Array.from(set).sort().reverse(); // newest first, today included
}
function buildLiveReportData(){
  const items=data.rows.map(r=>{
    const ss=data.submissions.filter(s=>String(s.item)===String(r.name));
    return {
      name:r.name, price:r.price, stock:r.stock, type:r.type,
      taken:ss.reduce((a,s)=>a+Number(s.taken||0),0),
      returned:ss.reduce((a,s)=>a+Number(s.returned||0),0),
      sold:ss.reduce((a,s)=>a+Number(s.sold||0),0),
      sales:ss.reduce((a,s)=>a+Number(s.sales||0),0)
    };
  });
  const totals={
    sales:data.submissions.reduce((a,s)=>a+Number(s.sales||0),0),
    sold:data.submissions.reduce((a,s)=>a+Number(s.sold||0),0),
    stock:data.rows.reduce((a,r)=>a+Number(r.stock||0),0)
  };
  const submissions=data.submissions.map(s=>({staff_name:s.staff,location:s.location,item_name:s.item,taken:s.taken,returned:s.returned,sold:s.sold,sales:s.sales,submitted_at:s.time}));
  return {date:data.date,totals,items,submissions};
}
async function fetchSavedReport(date){ try{ const j=await api('report',{query:{date}}); return j.report; }catch{ return null; } }
function renderReportNav(){
  const dates=buildDateList();
  if(navIndex>dates.length-1) navIndex=Math.max(0,dates.length-1);
  if(navIndex<0) navIndex=0;
  const date=dates[navIndex]||data.date;
  $('reportDatePicker').value=date;
  $('reportDatePicker').max=data.date;
  $('prevReportBtn').disabled=navIndex>=dates.length-1;
  $('nextReportBtn').disabled=navIndex<=0;
  return date;
}
async function loadReportPreview(){
  const date=renderReportNav();
  $('reportPreview').innerHTML='<div class="empty">Loading…</div>';
  const r = date===data.date ? buildLiveReportData() : await fetchSavedReport(date);
  currentPreviewReport=r;
  if(!r){ $('reportPreview').innerHTML=`<div class="empty">No data recorded for ${formatReportDate(date)}.</div>`; return; }
  const rows=(r.items||[]).map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${money(x.price)}</td><td>${x.stock}</td><td>${x.type==='drink'?'N/A':(x.returned||0)}</td><td><strong>${x.sold||0}</strong></td><td><b>${money(x.sales||0)}</b></td></tr>`).join('')||'<tr><td colspan="6" class="empty-cell">No items.</td></tr>';
  const subRows=(r.submissions||[]).map(s=>`<tr><td>${esc(s.staff_name||s.staff)}</td><td>${esc(s.location)}</td><td>${esc(s.item_name||s.item)}</td><td>${s.taken}</td><td>${s.returned??'N/A'}</td><td><strong>${s.sold}</strong></td><td><b>${money(s.sales)}</b></td><td>${esc(s.submitted_at||s.time||'')}</td></tr>`).join('')||'<tr><td colspan="8" class="empty-cell">No submissions this day.</td></tr>';
  $('reportPreview').innerHTML=`
    <div class="preview-stats">
      <div><span>SALES</span><b>${money(r.totals?.sales||0)}</b></div>
      <div><span>SOLD</span><b>${r.totals?.sold||0}</b></div>
      <div><span>STOCK</span><b>${r.totals?.stock||0}</b></div>
      <div><span>SUBMISSIONS</span><b>${r.submissions?.length||0}</b></div>
    </div>
    <div class="preview-subheading">ITEMS SOLD THIS DAY</div>
    <div class="table-wrap"><table><thead><tr><th>Item</th><th>Price</th><th>Stock</th><th>Returned</th><th>Sold</th><th>Sales</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="preview-subheading">FULL STAFF SUBMISSION LOG</div>
    <div class="table-wrap"><table><thead><tr><th>Staff</th><th>Selling Area</th><th>Item</th><th>Taken</th><th>Returned</th><th>Sold</th><th>Sales</th><th>Time</th></tr></thead><tbody>${subRows}</tbody></table></div>`;
}
$('prevReportBtn').onclick=()=>{navIndex++;loadReportPreview()};
$('nextReportBtn').onclick=()=>{navIndex--;loadReportPreview()};
$('reportDatePicker').onchange=e=>{const dates=buildDateList();const idx=dates.indexOf(e.target.value);navIndex=idx>=0?idx:0;loadReportPreview()};
$('printPreviewBtn').onclick=()=>{ if(currentPreviewReport) renderPrintWindow(currentPreviewReport); else toast('No data to print for this date.') };

function renderPrintWindow(r){
  const rows=(r.items||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${money(x.price)}</td><td>${x.stock}</td><td>${x.type==='drink'?'N/A':(x.returned||0)}</td><td>${x.sold||0}</td><td>${money(x.sales||0)}</td></tr>`).join('');
  const subs=(r.submissions||[]).map(s=>`<tr><td>${esc(s.staff_name||s.staff)}</td><td>${esc(s.location)}</td><td>${esc(s.item_name||s.item)}</td><td>${s.taken}</td><td>${s.returned??'N/A'}</td><td>${s.sold}</td><td>${money(s.sales)}</td><td>${esc(s.submitted_at||s.time||'')}</td></tr>`).join('')||'<tr><td colspan="8">No submissions.</td></tr>';
  const w=open('','_blank','width=1100,height=850');if(!w)return toast('Please allow pop-ups.');
  w.document.write(`<!doctype html><html><head><title>Stockroom Daily Report</title><style>body{font-family:Arial;margin:32px;color:#173f3b}table{width:100%;border-collapse:collapse;margin:12px 0 28px;font-size:11px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#edf2eb}.summary{display:flex;gap:12px}.card{border:1px solid #ddd;padding:14px;flex:1}.card b{display:block;font-size:22px;margin-top:5px}</style></head><body><h1>Stockroom — Daily Report</h1><p>${formatReportDate(r.date)}</p><div class="summary"><div class="card">Sales<b>${money(r.totals?.sales)}</b></div><div class="card">Sold<b>${r.totals?.sold||0}</b></div><div class="card">Stock<b>${r.totals?.stock||0}</b></div></div><h2>Inventory</h2><table><tr><th>Item</th><th>Price</th><th>Stock</th><th>Returned</th><th>Sold</th><th>Sales</th></tr>${rows}</table><h2>Staff Submissions</h2><table><tr><th>Staff</th><th>Selling Area</th><th>Item</th><th>Taken</th><th>Returned</th><th>Sold</th><th>Sales</th><th>Time</th></tr>${subs}</table><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

function openFoodModal(id=null){const r=id?getItem(id):null;$('editFoodId').value=r?.id||'';$('foodModalTitle').textContent=r?'Edit food item.':'Add a food item.';$('saveFoodBtn').innerHTML=r?'Save changes <span>→</span>':'Save food <span>→</span>';$('foodName').value=r?.name||'';$('foodPrice').value=r?.price??'';$('foodStock').value=r?.stock??'';$('isPalamig').checked=r?.type==='drink';$('foodModal').classList.remove('hidden');setTimeout(()=>$('foodName').focus(),50)}
function closeFoodModal(){$('foodModal').classList.add('hidden');$('foodForm').reset()}
$('addFoodBtn').onclick=()=>openFoodModal();$('closeFoodModal').onclick=closeFoodModal;$('foodBackdrop').onclick=closeFoodModal;
$('foodForm').onsubmit=async e=>{e.preventDefault();const id=$('editFoodId').value,name=$('foodName').value.trim(),price=Number($('foodPrice').value),stock=Number($('foodStock').value),type=$('isPalamig').checked?'drink':'food';try{await api('save_food',{method:'POST',body:{id,name,price,stock,type}});closeFoodModal();await refresh();renderOwner();toast(id?'Food updated.':'Food added.')}catch(err){toast(err.message)}};

function setupStaffForm(){updateItems();updatePreview();updateConnStatus();renderPendingBadge();syncQueue()}
function updateItems(){const items=data.rows;$('item').innerHTML=items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');updateItemInfo();updateFieldsForType();updatePreview()}
function selectedItem(){return getItem($('item').value)||data.rows[0]}
function updateItemInfo(){const r=selectedItem();if(!r){$('itemInfo').innerHTML='<span>No food is currently available.</span>';return}$('itemInfo').innerHTML=`<b>${money(r.price)} / unit</b><small>${r.stock} available in stockroom</small>`}
function updateFieldsForType(){const drink=selectedItem()?.type==='drink';$('foodQtyFields').classList.toggle('hidden',drink);$('palamigFields').classList.toggle('hidden',!drink);$('takenQty').required=!drink;$('returnedQty').required=!drink;$('cupsSold').required=drink;$('calcLabel').textContent=drink?'CUPS SOLD':'UNITS SOLD';$('formNote').textContent=drink?'Palamig: record only cups sold. Remaining liquid is not required.':'Food: enter stock taken and stock returned. Taken − returned = sold.'}
function updatePreview(){const r=selectedItem();if(!r){$('soldPreview').textContent='0';$('salesPreview').textContent=money(0);return}let sold=0;if(r.type==='drink')sold=Number($('cupsSold').value||0);else{const t=Number($('takenQty').value||0),ret=Number($('returnedQty').value||0);sold=t>=ret?Math.max(0,t-ret):0}$('soldPreview').textContent=sold;$('salesPreview').textContent=money(sold*r.price)}
$('item').onchange=()=>{updateItemInfo();updateFieldsForType();updatePreview()};['takenQty','returnedQty','cupsSold'].forEach(id=>$(id).oninput=updatePreview);

$('inventoryForm').onsubmit=async e=>{
  e.preventDefault();
  const r=selectedItem(); if(!r) return toast('No food selected.');
  const staff=$('staffName').value.trim(), loc=$('sellingArea').value.trim();
  let taken=0, returned=0, cups=0;
  if(r.type==='drink'){ cups=Number($('cupsSold').value||0); if(cups>r.stock) return toast(`Only ${r.stock} units are available.`); }
  else { taken=Number($('takenQty').value||0); returned=Number($('returnedQty').value||0); if(returned>taken) return toast('Returned stock cannot be greater than stock taken.'); if(taken>r.stock) return toast(`Only ${r.stock} units are available.`); }
  const payload={staff, location:loc, food_id:r.id, drink:r.type==='drink', taken, returned, cups};
  const soldNow = r.type==='drink' ? cups : Math.max(0, taken-returned);
  const expectedRemaining = Math.max(0, Number(r.stock||0) - soldNow);

  if(!navigator.onLine){
    queueSubmission(payload);
    $('inventoryForm').reset(); setupStaffForm();
    toast('No connection — saved on this device. It will sync automatically.');
    return;
  }
  try{
    const res = await api('submit',{method:'POST',body:payload});
    await refresh(); $('inventoryForm').reset(); setupStaffForm();
    const remaining = res.remaining_stock;
    toast(remaining===0 ? `Submitted. ${r.name} is now sold out (0 left).` : `Submitted. ${remaining} ${r.name} left in stock.`);
  }catch(err){
    if(err instanceof TypeError || /fetch|network|failed to fetch/i.test(err.message||'')){
      queueSubmission(payload);
      $('inventoryForm').reset(); setupStaffForm();
      toast('No connection — saved on this device. It will sync automatically.');
    } else {
      toast(err.message);
    }
  }
};

// ---------- Offline queue (staff submissions made without a signal) ----------
function getQueue(){ try{ return JSON.parse(localStorage.getItem(OFFLINE_KEY)||'[]'); }catch{ return []; } }
function setQueue(q){ localStorage.setItem(OFFLINE_KEY, JSON.stringify(q)); }
function queueSubmission(payload){ const q=getQueue(); q.push({...payload, _qid: Date.now()+'-'+Math.random().toString(36).slice(2)}); setQueue(q); renderPendingBadge(); }
function renderPendingBadge(){
  const el=$('pendingSyncBadge'); if(!el) return;
  const n=getQueue().length;
  if(n){ el.textContent=`⏳ ${n} submission${n>1?'s':''} waiting to sync`; el.classList.remove('hidden'); }
  else { el.classList.add('hidden'); }
}
async function syncQueue(){
  if(!navigator.onLine) return;
  const q=getQueue(); if(!q.length) return;
  const remaining=[];
  for(const item of q){
    const {_qid, ...payload}=item;
    try{ await api('submit',{method:'POST',body:payload}); }
    catch(e){ remaining.push(item); }
  }
  setQueue(remaining); renderPendingBadge();
  if(remaining.length<q.length){
    toast('Offline submissions synced.');
    try{ await refresh(); if(!$('ownerDashboard').classList.contains('hidden')) renderOwner(); }catch{}
  }
}
function updateConnStatus(){
  const el=$('connStatus'); if(!el) return;
  const online=navigator.onLine;
  el.classList.toggle('offline', !online);
  const label=el.querySelector('span'); if(label) label.textContent = online ? 'Online' : 'Offline — saving locally';
}
window.addEventListener('online', ()=>{ updateConnStatus(); syncQueue(); });
window.addEventListener('offline', updateConnStatus);
setInterval(syncQueue, 20000);

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}

// ---------- Owner dashboard extras + Settings ----------
function renderOwnerExtras(){
  const o=data.owner||{}, set=(id,v)=>{const el=$(id);if(el)el.textContent=v};
  set('sideShopName',o.shop_name||'OWNER WORKSPACE'); set('sideEmail',o.email||'');
  set('acctEmail',o.email||'—'); set('acctName',o.name||'—');
  set('acctMethod',o.google&&o.has_password?'Google + password':(o.google?'Google':'Email & password'));
  if($('curPwWrap'))$('curPwWrap').classList.toggle('hidden',!o.has_password);
  set('pwTitle',o.has_password?'Change password':'Set a password');
  set('pwDesc',o.has_password?'Use at least 8 characters.':'You signed in with Google. You can also set a password to log in with your email.');
  const si=$('shopNameInput'); if(si&&document.activeElement!==si) si.value=o.shop_name||'';
  const subs=data.submissions||[];
  if($('todaySubs')) $('todaySubs').innerHTML=subs.length?subs.map(s=>`<tr><td>${esc(s.time)}</td><td>${esc(s.staff)}</td><td>${esc(s.location)}</td><td><b>${esc(s.item)}</b></td><td>${esc(s.sold)}</td><td>${money(s.sales)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">No submissions yet today.</td></tr>';
  const rows=[...(data.rows||[])].sort((a,b)=>Number(a.stock)-Number(b.stock));
  const max=Math.max(1,...rows.map(r=>Number(r.stock)||0));
  if($('stockLevels')) $('stockLevels').innerHTML=rows.length?rows.map(r=>{const n=Number(r.stock)||0,low=n<=20,pct=Math.max(n>0?4:0,Math.round(n/max*100));return `<div class="sl-row"><span class="sl-name" title="${esc(r.name)}">${esc(r.name)}</span><i class="sl-bar"><b style="width:${pct}%" class="${low?'low':''}"></b></i><em class="sl-n${low?' low':''}">${n===0?'SOLD OUT':n+' left'}</em></div>`}).join(''):'<div class="empty">Add your first food in Manage foods.</div>';
}
$('saveShopBtn').onclick=async()=>{
  try{ await api('save_shop',{method:'POST',body:{name:$('shopNameInput').value}}); await refresh(); renderOwner(); toast('Shop name saved.'); }
  catch(e){ toast(e.message) }
};
document.addEventListener('submit',async e=>{
  if(!e.target||e.target.id!=='pwForm') return;
  e.preventDefault();
  const err=$('pwError'), cur=$('curPw').value, nw=$('newPw').value; err.textContent='';
  const fail=m=>{err.textContent=m;toast(m)};
  if(nw.length<8) return fail('New password must be at least 8 characters.');
  try{ await api('change_password',{method:'POST',body:{current:cur,new:nw}}); await refresh(); renderOwner(); $('pwForm').reset(); toast('Password updated.'); }
  catch(ex){ fail(ex.message||'Could not update the password.') }
});

// ---------- Google sign-in / sign-up (owners) + staff code panel ----------
function googleFallback(msg){
  ['googleBtnLogin','googleBtnSignup'].forEach((id,i)=>{
    const w=$(id); if(!w) return;
    w.innerHTML=`<button type="button" class="staff-btn" style="justify-content:center;width:100%;max-width:300px"><span>G</span> Continue with Google</button>`;
    w.firstChild.onclick=()=>toast(msg);
  });
}
function initGoogle(tries=0){
  if(!$('googleBlock')) return;
  if(!googleClientId){ googleFallback('Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID in api.php.'); return; }
  if(!(window.google&&google.accounts&&google.accounts.id)){
    if(tries<16) return setTimeout(()=>initGoogle(tries+1),500);
    googleFallback('Google needs an internet connection on this device.'); return;
  }
  google.accounts.id.initialize({client_id:googleClientId,callback:onGoogleCredential});
  ['googleBtnLogin','googleBtnSignup'].forEach(id=>google.accounts.id.renderButton($(id),{theme:'outline',size:'large',text:'continue_with',shape:'pill',width:280}));
}
async function onGoogleCredential(resp){
  try{
    const r=await api('google_login',{method:'POST',body:{credential:resp.credential}});
    await refresh();show('ownerDashboard');navIndex=0;renderOwner();
    toast(r.created?'Account created. Welcome to Stockroom!':`Welcome back, ${r.name||'owner'}.`);
  }catch(err){toast(err.message)}
}
// ---------- Landing page navigation ----------
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-go]'); if(!t) return;
  e.preventDefault();
  const g=t.getAttribute('data-go');
  if(g==='home'){ show('landingPage'); return; }
  show('loginPage'); showSignupView(g==='signup');
});
document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('a.ld-link'); if(!a) return;
  e.preventDefault(); const el=document.querySelector(a.getAttribute('href')); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
});
// ---------- Create account view (event delegation: works even if the page is partly cached) ----------
function showSignupView(on){ const l=document.querySelector('#loginPage .login-wrap'),s=$('signupWrap'); if(l)l.classList.toggle('hidden',on); if(s)s.classList.toggle('hidden',!on); const er=$('signupError'); if(er)er.textContent=''; }
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('#showSignup,#showLogin,#toggleSuPassword'); if(!t) return;
  e.preventDefault();
  if(t.id==='showSignup') showSignupView(true);
  else if(t.id==='showLogin') showSignupView(false);
  else { const p=$('suPassword'); p.type=p.type==='text'?'password':'text'; }
});
document.addEventListener('submit',async e=>{
  if(!e.target||e.target.id!=='signupForm') return;
  e.preventDefault();
  const err=$('signupError'), btn=$('signupBtn'), email=$('suEmail').value.trim(), pw=$('suPassword').value;
  const fail=m=>{err.textContent=m;toast(m)};
  err.textContent='';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.');
  if(pw.length<8) return fail('Password must be at least 8 characters.');
  btn.disabled=true;
  try{
    await api('signup',{method:'POST',body:{email,password:pw}});
    await refresh();show('ownerDashboard');navIndex=0;renderOwner();
    $('signupForm').reset();showSignupView(false);
    toast('Account created. Welcome to Stockroom!');
  }catch(ex){ fail(ex.message||'Could not create the account. Please try again.') }
  finally{btn.disabled=false}
});
if($('copyCodeBtn'))$('copyCodeBtn').onclick=async()=>{const c=data.staffCode;if(!c)return;try{await navigator.clipboard.writeText(c);toast('Staff code copied.')}catch{prompt('Copy this staff code:',c)}};
if($('newCodeBtn'))$('newCodeBtn').onclick=async()=>{
  if(!confirm('Make a new staff code? The old code will stop working for new staff logins.'))return;
  try{await api('new_code',{method:'POST'});await refresh();renderOwner();toast('New staff code ready.')}catch(e){toast(e.message)}
};

(async()=>{ try{ await refresh(); updateConnStatus(); renderPendingBadge(); syncQueue(); }catch(e){ /* API not reachable yet; login will show the useful error */ } initGoogle(); })();