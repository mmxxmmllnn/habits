// Simple HabitKit app.js — IndexedDB + UI
const DB_NAME='habitkit_db';const DB_VERSION=1;
const year = new Date().getFullYear();
const start = new Date(year, 0, 1); // Jan 1
const end = new Date(year, 11, 31); // Dec 31
function randomColor() {
    // Generates a bright-ish color
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 50%)`;
}
function openDB(){return new Promise((res,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const db=e.target.result; if(!db.objectStoreNames.contains('habits')) db.createObjectStore('habits',{keyPath:'id'}); if(!db.objectStoreNames.contains('checks')) db.createObjectStore('checks',{keyPath:'id'});}; r.onsuccess=()=>res(r.result); r.onerror=()=>reject(r.error);});}
function uid(){return Math.random().toString(36).slice(2,9)}
function todayKey(d=new Date()){const y=d.getFullYear();const m=('0'+(d.getMonth()+1)).slice(-2);const day=('0'+d.getDate()).slice(-2);return `${y}-${m}-${day}`}


async function put(store,obj){const db=await openDB();return new Promise((res,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(obj);tx.oncomplete=()=>res();tx.onerror=()=>reject(tx.error)});}
async function getAll(store){const db=await openDB();return new Promise((res,reject)=>{const tx=db.transaction(store);const r=tx.objectStore(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>reject(r.error)});}

// Data helpers
async function addHabit(h){h.id=h.id||uid();h.created=h.created||Date.now();return put('habits',h)}
async function listHabits(){return getAll('habits')}
async function addCheck(check){check.id=check.id||uid();return put('checks',check)}
async function listChecks(){return getAll('checks')}
async function listChecksForHabit(habitId){const all=await listChecks();return all.filter(c=>c.habitId===habitId)}
function confirmDelete(id, name) {
  const ok = confirm(`delete habit "${name}"?\nall its history will be permanently removed.`);
  if (ok) deleteHabit(id);
}

async function deleteHabit(habitId) {
  const db = await openDB();

  const tx = db.transaction(['habits', 'checks'], 'readwrite');
  const hStore = tx.objectStore('habits');
  const cStore = tx.objectStore('checks');

  // delete habit
  hStore.delete(habitId);

  // delete all checks for that habit
  cStore.getAll().onsuccess = e => {
    const all = e.target.result;
    all
      .filter(c => c.habitId === habitId)
      .forEach(c => cStore.delete(c.id));
  };

  tx.oncomplete = () => render();
  tx.onerror = () => alert('Error deleting habit');
}


// UI
const listEl=document.getElementById('list');const heatGrid=document.getElementById('heatGrid');const heatTitle=document.getElementById('heatTitle');const heatmapCard=document.getElementById('heatmapCard');
const modal=document.getElementById('modal');const mTitle=document.getElementById('mTitle');const mBody=document.getElementById('mBody');

function applyDoneTodayStyles(row, done) {
    const nameEl = row.querySelector(".habit-name");
    const btn = row.querySelector(".btn-done");

    if (done) {
        nameEl.style.fontWeight = "800";
        btn.style.background = "#2ecc71";
        btn.style.color = "white";
        btn.style.borderColor = "#27ae60";
        btn.textContent = "done ✓";
    } else {
        nameEl.style.fontWeight = "600";
        btn.style.background = "";
        btn.style.color = "";
        btn.style.borderColor = "";
        btn.textContent = "done";
    }
}
async function hasCheckToday(habitId) {
    const checks = await listChecksForHabit(habitId);
    const today = todayKey();
    return checks.some(c => todayKey(new Date(c.ts)) === today);
}
async function render(){const hs=await listHabits();listEl.innerHTML='';if(hs.length===0) listEl.innerHTML='<div class="small">no habits yet. add one below.</div>'
for (const h of hs) {

    const doneToday = await hasCheckToday(h.id);

    const row=document.createElement('div');
    row.className='habit-row card';

    row.innerHTML = `
      <div class="row">
        <div style="width:40px;height:40px;border-radius:8px;background:${h.color||'#03045eff'}"></div>
        <div style="margin-left:8px">
          <div class="habit-name" style="font-weight:${doneToday ? '800' : '600'}">
            ${h.name}
          </div>
          <div class="small">${h.description||''}</div>
        </div>
      </div>
      <div class="row">
        <button class="btn-done" style="${doneToday ? 'background:#2ecc71;color:white;border-color:#27ae60;' : ''}">
          ${doneToday ? 'done ✓' : 'done'}
        </button>
        <button class="small view">heatmap</button>
        <button class="small delete">delete</button>
      </div>
`;

const btn=row.querySelector('.btn-done');const view=row.querySelector('.view');const del = row.querySelector('.delete');
del.onclick = () => confirmDelete(h.id, h.name);btn.onclick=async()=>{await addCheck({habitId:h.id,ts:Date.now()});btn.animate([{transform:'scale(1)'},{transform:'scale(0.96)'},{transform:'scale(1)'}],{duration:160});applyDoneTodayStyles(row, true);if (heatmapCard.style.display === "block" && heatTitle.textContent === h.name) {
        showHeatmap(h.id, h.name);
    }}
view.onclick=()=>showHeatmap(h.id,h.name);
listEl.appendChild(row);} }

async function showHeatmap(habitId,name){const checks=await listChecksForHabit(habitId);const map=new Map();for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  map.set(todayKey(d), 0);
}for(const c of checks){const k=todayKey(new Date(c.ts));if(map.has(k)) map.set(k,map.get(k)+1)}
const cells=[];for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const k = todayKey(d);
  cells.push({ k, count: map.get(k) || 0 });
}
heatGrid.innerHTML='';cells.forEach(c=>{const el=document.createElement('div');el.className='cell';if(c.count>0){const lvl=Math.min(4,Math.ceil(c.count/2)+1);el.classList.add('level-'+lvl)}el.title=`${c.k}: ${c.count}`;el.onclick=()=>showDay(habitId,c.k);heatGrid.appendChild(el)});
heatTitle.textContent=name;heatmapCard.style.display='block';}

async function showDay(habitId,day){const checks=await listChecksForHabit(habitId);const items=checks.filter(c=>todayKey(new Date(c.ts))===day).sort((a,b)=>a.ts-b.ts);mTitle.textContent=`details — ${day}`;mBody.innerHTML=items.length?items.map(i=>`<div>${new Date(i.ts).toLocaleTimeString()} <span class="small">(id:${i.id})</span></div>`).join(''):'<div class="small">no checks</div>';modal.classList.add('open')}

document.getElementById('close').onclick=()=>modal.classList.remove('open');

// controls
document.getElementById('addHabit').onclick=async()=>{const name=document.getElementById('habitName').value.trim();if(!name) return alert('please add a name');await addHabit({name,color: randomColor()});document.getElementById('habitName').value='';render()}

// export/import
document.getElementById('export').onclick=async()=>{const data={habits:await listHabits(),checks:await listChecks()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='habitkit-export.json';a.click();URL.revokeObjectURL(url)}
document.getElementById('import').onclick=()=>document.getElementById('importFile').click();document.getElementById('importFile').onchange=async(e)=>{const f=e.target.files[0];if(!f) return;const json=JSON.parse(await f.text());if(json.habits) for(const h of json.habits) await addHabit(h); if(json.checks) for(const c of json.checks) await addCheck(c); render() }

// on load
render();

// register service worker for production (works only when served over http/https)
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').then(()=>console.log('SW registered')).catch(e=>console.warn('SW failed',e))})}