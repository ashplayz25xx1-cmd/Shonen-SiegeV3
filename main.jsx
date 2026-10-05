import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

const RARITY_COLOR = {
  Common: '#9da5b5',
  Uncommon: '#58d39a',
  Rare: '#53c9ff',
  Epic: '#a879ff',
  Legendary: '#ffbf5e',
  Mythic: '#ff6588',
};

const DEPLOY_LIMIT = 8;
const SQUAD_LIMIT = 5;
const COPY_LIMIT = { Common: 3, Uncommon: 3, Rare: 3, Epic: 2, Legendary: 2, Mythic: 1 };
const UPGRADE_LIMIT = { Common: 3, Uncommon: 3, Rare: 5, Epic: 6, Legendary: 7, Mythic: 9 };
const PACK_COST = 100;
const SLOT_RULES = {
  4: { wave: 10, gems: 250 },
  5: { wave: 25, gems: 500 },
};
const BASE_DROP_RATES = { Common: 45, Uncommon: 25, Rare: 16, Epic: 9, Legendary: 4, Mythic: 1 };
const PITY = { Rare: 10, Epic: 25, Legendary: 50, Mythic: 100 };

const CHARACTERS = [
  {id:'naruto', name:'Naruto Uzumaki', anime:'Naruto', rarity:'Rare', cost:250, baseDamage:34, range:115, attackSpeed:650, abilities:['Shadow Clone','Rasengan','Rasenshuriken']},
  {id:'ichigo', name:'Ichigo Kurosaki', anime:'Bleach', rarity:'Legendary', cost:450, baseDamage:48, range:125, attackSpeed:700, abilities:['Zangetsu Slash','Getsuga Tensho','Bankai']},
  {id:'goku', name:'Son Goku', anime:'Dragon Ball', rarity:'Mythic', cost:650, baseDamage:75, range:145, attackSpeed:800, abilities:['Ki Blast','Kamehameha','Ultra Instinct']},
  {id:'luffy', name:'Monkey D. Luffy', anime:'One Piece', rarity:'Epic', cost:375, baseDamage:43, range:110, attackSpeed:590, abilities:['Gum-Gum Pistol','Gear Second','Gear Fifth']},
  {id:'gojo', name:'Satoru Gojo', anime:'Jujutsu Kaisen', rarity:'Legendary', cost:500, baseDamage:52, range:155, attackSpeed:950, abilities:['Blue','Red','Unlimited Void']},
  {id:'denji', name:'Denji', anime:'Chainsaw Man', rarity:'Epic', cost:320, baseDamage:46, range:105, attackSpeed:520, abilities:['Chainsaw Slash','Rev Up','Full Devil']},
  {id:'deku', name:'Izuku Midoriya', anime:'My Hero Academia', rarity:'Rare', cost:280, baseDamage:37, range:120, attackSpeed:610, abilities:['Delaware Smash','Blackwhip','Full Cowl']},
  {id:'killua', name:'Killua Zoldyck', anime:'Hunter x Hunter', rarity:'Rare', cost:230, baseDamage:29, range:108, attackSpeed:390, abilities:['Godspeed','Lightning Palm','Whirlwind']},
  {id:'tanjiro', name:'Tanjiro Kamado', anime:'Demon Slayer', rarity:'Uncommon', cost:180, baseDamage:24, range:112, attackSpeed:570, abilities:['Water Wheel','Hinokami Kagura','Sun Halo Dragon']},
  {id:'asta', name:'Asta', anime:'Black Clover', rarity:'Epic', cost:340, baseDamage:45, range:105, attackSpeed:620, abilities:['Demon Slash','Black Form','Black Divider']},
  {id:'saitama', name:'Saitama', anime:'One Punch Man', rarity:'Mythic', cost:800, baseDamage:110, range:105, attackSpeed:1100, abilities:['Normal Punch','Serious Series','Serious Punch']},
  {id:'gon', name:'Gon Freecss', anime:'Hunter x Hunter', rarity:'Uncommon', cost:190, baseDamage:27, range:95, attackSpeed:600, abilities:['Rock','Scissors','Jajanken']},
];

const STARTERS = ['naruto','deku','tanjiro'];

function freshSave() {
  return {
    gems: 250,
    waveBest: 0,
    unlockedSlots: 3,
    owned: Object.fromEntries(CHARACTERS.map(c => [c.id, STARTERS.includes(c.id) ? 1 : 0])),
    pity: {Rare:0, Epic:0, Legendary:0, Mythic:0},
    cardImages: {},
  };
}

function normalizeSave(raw) {
  const fresh = freshSave();
  if (!raw || typeof raw !== 'object') return fresh;
  const merged = {...fresh, ...raw};
  if (Array.isArray(raw.owned)) {
    merged.owned = {...fresh.owned};
    raw.owned.forEach(id => merged.owned[id] = Math.max(1, Number(merged.owned[id] || 0)));
  } else {
    merged.owned = {...fresh.owned, ...(raw.owned || {})};
  }
  merged.unlockedSlots = Math.min(5, Math.max(3, Number(merged.unlockedSlots || 3)));
  merged.waveBest = Math.max(0, Number(merged.waveBest || 0));
  merged.gems = Math.max(0, Number(merged.gems || 0));
  merged.pity = {...fresh.pity, ...(raw.pity || {})};
  merged.cardImages = {...(raw.cardImages || {})};
  return merged;
}

function loadSave() {
  try {
    const v3 = localStorage.getItem('shonen-siege-v3');
    if (v3) return normalizeSave(JSON.parse(v3));
    const v2 = localStorage.getItem('shonen-siege-v2');
    if (v2) return normalizeSave(JSON.parse(v2));
    const old = localStorage.getItem('shonen-siege');
    if (old) return normalizeSave(JSON.parse(old));
  } catch {}
  return freshSave();
}

function getChar(id) {
  return CHARACTERS.find(c => c.id === id);
}

function getIcon(char) {
  const map = {
    'Dragon Ball':'☄️',
    'Bleach':'⚔️',
    'Naruto':'🌀',
    'Jujutsu Kaisen':'◉',
    'One Piece':'☠️',
    'Chainsaw Man':'⛓️',
    'My Hero Academia':'💥',
    'Hunter x Hunter':'⚡',
    'Demon Slayer':'🌊',
    'Black Clover':'♣️',
    'One Punch Man':'👊',
  };
  return map[char.anime] || '✦';
}

function gemReward(wave) {
  if (wave <= 4) return 5;
  return Math.floor(5 + wave * 0.9);
}

function cashReward(wave, type='normal') {
  const base = {normal:14, fast:18, tank:34, regen:28, shield:31, armored:36, boss:220}[type] || 14;
  return Math.round(base * (1 + wave * 0.075));
}

function enemyFor(wave, index, total, id) {
  const bossWave = wave % 4 === 0;
  if (bossWave && index === total - 1) {
    const bossTypes = [
      {name:'Ravager', hp:2400 + wave * 170, speed:0.021, damage:10, armor:0.08, shield:0},
      {name:'Warden', hp:3000 + wave * 190, speed:0.016, damage:9, armor:0.16, shield:950 + wave * 30},
      {name:'Reaper', hp:2050 + wave * 150, speed:0.028, damage:12, armor:0.06, shield:450 + wave * 18},
    ];
    const b = bossTypes[(wave / 4 - 1) % bossTypes.length];
    return {id, type:'boss', name:b.name, progress:0, hp:b.hp, maxHp:b.hp, speed:b.speed, damage:b.damage, armor:b.armor, shield:b.shield, regen:0, reward:cashReward(wave,'boss')};
  }
  const roll = (index + wave) % 19;
  let type = 'normal';
  if (wave >= 6 && roll < 2) type = 'fast';
  else if (wave >= 10 && roll < 4) type = 'tank';
  else if (wave >= 14 && roll < 6) type = 'regen';
  else if (wave >= 18 && roll < 8) type = 'shield';
  else if (wave >= 22 && roll < 10) type = 'armored';
  const stats = {
    normal: {hp:85, speed:0.035, damage:3, armor:0, shield:0, regen:0},
    fast: {hp:62, speed:0.056, damage:4, armor:0, shield:0, regen:0},
    tank: {hp:230, speed:0.020, damage:7, armor:0.08, shield:0, regen:0},
    regen: {hp:150, speed:0.026, damage:5, armor:0, shield:0, regen:2.8},
    shield: {hp:130, speed:0.028, damage:5, armor:0, shield:95 + wave * 3, regen:0},
    armored: {hp:190, speed:0.022, damage:6, armor:0.25, shield:0, regen:0},
  };
  const s = stats[type];
  const hp = Math.round(s.hp * (1 + wave * 0.12) * (1 + Math.max(0, index-total*0.5) * 0.015));
  return {id, type, name:type, progress:-0.035 * (index+1), hp, maxHp:hp, speed:s.speed*(1+wave*0.012), damage:s.damage, armor:s.armor, shield:s.shield, regen:s.regen, reward:cashReward(wave,type)};
}

const PATH = [
  [4, 17],
  [16, 17],
  [23, 29],
  [23, 43],
  [47, 43],
  [55, 32],
  [55, 20],
  [82, 20],
  [91, 30],
  [91, 49],
  [74, 49],
  [67, 59],
  [67, 74],
  [26, 74],
  [18, 64],
  [18, 53],
  [36, 53],
  [44, 63],
  [44, 87],
  [92, 87],
];

function pathPosition(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const scaled = p * (PATH.length - 1);
  const i = Math.min(PATH.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const a = PATH[i], b = PATH[i+1];
  return {x:a[0] + (b[0]-a[0])*t, y:a[1] + (b[1]-a[1])*t};
}

function distancePct(x1,y1,x2,y2) {
  const dx = x1-x2;
  const dy = (y1-y2)*1.08;
  return Math.hypot(dx,dy);
}

function randomOpenSpot(existing) {
  const spots = [
    [10,34],[10,62],[30,12],[31,32],[34,67],[49,10],[49,77],[62,47],[78,32],[78,66],[88,66],[27,88],
  ];
  const available = spots.filter(([x,y]) => existing.every(u => distancePct(x,y,u.x,u.y) > 7));
  return available[Math.floor(Math.random()*Math.max(1,available.length))] || [12,92];
}

function rollRarity(pity) {
  for (let i = RARITIES.length - 1; i >= 2; i--) {
    const r = RARITIES[i];
    if (pity[r] + 1 >= PITY[r]) return r;
  }
  const n = Math.random()*100;
  let sum = 0;
  for (const r of RARITIES) {
    sum += BASE_DROP_RATES[r];
    if (n < sum) return r;
  }
  return 'Common';
}

function openPack(pity) {
  const nextPity = {...pity};
  const results = [];
  for (let i=0;i<5;i++) {
    const rarity = rollRarity(nextPity);
    const pool = CHARACTERS.filter(c => c.rarity === rarity);
    results.push(pool[Math.floor(Math.random()*pool.length)] || CHARACTERS[0]);
    for (const r of Object.keys(nextPity)) nextPity[r] += 1;
    if (rarityRank(rarity) >= 2) nextPity.Rare = 0;
    if (rarityRank(rarity) >= 3) nextPity.Epic = 0;
    if (rarityRank(rarity) >= 4) nextPity.Legendary = 0;
    if (rarityRank(rarity) >= 5) nextPity.Mythic = 0;
  }
  return {results,nextPity};
}

function rarityRank(r) {
  return RARITIES.indexOf(r);
}

function App() {
  const [save, setSave] = useState(loadSave);
  const [page, setPage] = useState('home');
  const [squad, setSquad] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('shonen-siege-v3-squad') || 'null');
      if (Array.isArray(raw)) return raw.filter(id => getChar(id)).slice(0,SQUAD_LIMIT);
    } catch {}
    return STARTERS;
  });
  const [toast, setToast] = useState('');

  useEffect(() => { localStorage.setItem('shonen-siege-v3', JSON.stringify(save)); }, [save]);
  useEffect(() => { localStorage.setItem('shonen-siege-v3-squad', JSON.stringify(squad)); }, [squad]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(()=>setToast(''), 2600);
    return ()=>clearTimeout(t);
  }, [toast]);

  const notify = (m) => setToast(m);
  const addGems = (amount) => setSave(s => ({...s, gems: Math.max(0, s.gems + amount)}));
  const uniqueOwned = CHARACTERS.filter(c => (save.owned[c.id] || 0) > 0).length;

  const toggleSquad = (id) => {
    if ((save.owned[id] || 0) < 1) return notify('You do not own that card yet.');
    if (squad.includes(id)) {
      if (squad.length <= 1) return notify('Keep at least one fighter in your squad.');
      setSquad(squad.filter(x=>x!==id));
      return;
    }
    if (squad.length >= SQUAD_LIMIT) return notify('Squad limit is 5 different cards.');
    setSquad([...squad,id]);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={()=>setPage('home')}><span className="brand-mark">⚔</span><span>SHONEN <b>SIEGE</b></span></button>
        <nav>
          {[
            ['home','Home','⌂'],
            ['collection','Collection','▦'],
            ['summon','Summon','✦'],
            ['infinite','Infinite','∞'],
            ['admin','Admin','⚙'],
          ].map(([key,label,icon])=>
            <button key={key} onClick={()=>setPage(key)} className={page===key?'active':''}><span>{icon}</span>{label}</button>
          )}
        </nav>
        <div className="wallet"><span>💎</span>{save.gems.toLocaleString()}</div>
      </header>

      {page==='home' && <Home save={save} uniqueOwned={uniqueOwned} setPage={setPage} />}
      {page==='collection' && <Collection save={save} squad={squad} toggleSquad={toggleSquad} setSave={setSave} notify={notify} />}
      {page==='summon' && <Summon save={save} setSave={setSave} notify={notify} />}
      {page==='infinite' && <Infinite save={save} setSave={setSave} squad={squad} setPage={setPage} notify={notify} />}
      {page==='admin' && <Admin save={save} setSave={setSave} notify={notify} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Home({save,uniqueOwned,setPage}) {
  const next = save.unlockedSlots < SQUAD_LIMIT ? save.unlockedSlots + 1 : null;
  const req = next ? SLOT_RULES[next] : null;
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">COLLECT • BUILD • SURVIVE</div>
          <h1>Build fewer.<br/><span>Build stronger.</span></h1>
          <p>Shonen Siege is built around a simple idea: a smaller, stronger roster should carry you deeper into Infinite Mode.</p>
          <div className="hero-actions">
            <button className="primary" onClick={()=>setPage('infinite')}>PLAY INFINITE <span>→</span></button>
            <button className="secondary" onClick={()=>setPage('collection')}>OPEN COLLECTION</button>
          </div>
          <div className="hero-notes">
            <span><b>5</b> squad cards max</span>
            <span><b>{DEPLOY_LIMIT}</b> field placements max</span>
            <span><b>♾</b> endless waves</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="orb orb-a"></div><div className="orb orb-b"></div>
          <div className="hero-shield">⚔</div>
          <div className="hero-ribbon">GEMS NEVER STOP<br/><strong>WAVE REWARDS</strong></div>
        </div>
      </section>

      <section className="stat-grid">
        <Stat label="Best cleared wave" value={save.waveBest} icon="🏆" />
        <Stat label="Collection" value={`${uniqueOwned}/${CHARACTERS.length}`} icon="🎴" />
        <Stat label="Squad capacity" value={`${save.unlockedSlots}/${SQUAD_LIMIT}`} icon="👥" />
        <Stat label="Gems" value={save.gems.toLocaleString()} icon="💎" />
      </section>

      {req && (
        <section className="unlock-card">
          <div>
            <div className="eyebrow">NEXT SQUAD SLOT</div>
            <h2>Unlock card slot {next}</h2>
            <p>Reach Wave {req.wave} and spend {req.gems.toLocaleString()} gems. This permanently expands your squad.</p>
          </div>
          <div className="unlock-chip">WAVE {req.wave} • 💎 {req.gems}</div>
        </section>
      )}

      <section className="feature-grid">
        <Feature title="Cash stays in the run" body="Cash is only for deploying and upgrading during Infinite Mode. It never replaces gems." icon="💰"/>
        <Feature title="Gems survive a loss" body="Every cleared wave pays gems immediately. Lose later and you still keep everything already earned." icon="💎"/>
        <Feature title="Bosses every 4 waves" body="Ground enemies only: fast, tank, regen, shield, armored and rotating boss types." icon="👑"/>
      </section>
    </main>
  );
}

function Stat({label,value,icon}) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function Feature({title,body,icon}) {
  return <div className="feature-card"><div className="feature-icon">{icon}</div><div><h3>{title}</h3><p>{body}</p></div></div>;
}

function Collection({save,squad,toggleSquad,setSave,notify}) {
  const [filter,setFilter] = useState('All');
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('rarity');
  const filtered = useMemo(() => {
    let list = CHARACTERS.filter(c => (filter==='All'||c.rarity===filter) && `${c.name} ${c.anime}`.toLowerCase().includes(query.toLowerCase()));
    if (sort==='rarity') list.sort((a,b)=>rarityRank(b.rarity)-rarityRank(a.rarity));
    if (sort==='owned') list.sort((a,b)=>(save.owned[b.id]||0)-(save.owned[a.id]||0));
    if (sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
    return list;
  },[filter,query,sort,save.owned]);

  const uploadImage = (id,file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max/Math.max(img.width,img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width*scale));
        canvas.height = Math.max(1, Math.round(img.height*scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const data = canvas.toDataURL('image/webp',0.78);
        setSave(s=>({...s,cardImages:{...s.cardImages,[id]:data}}));
        notify('Character image saved to this browser.');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const sellDuplicate = (id) => {
    const count = Number(save.owned[id]||0);
    if (count < 2) return notify('You need at least 2 copies before selling one.');
    const c = getChar(id);
    const value = {Common:8,Uncommon:12,Rare:20,Epic:35,Legendary:60,Mythic:100}[c.rarity];
    setSave(s=>({...s,gems:s.gems+value,owned:{...s.owned,[id]:count-1}}));
    notify(`Duplicate sold for ${value} gems.`);
  };

  const unlockSlot = () => {
    const next = save.unlockedSlots + 1;
    const req = SLOT_RULES[next];
    if (!req) return notify('All 5 squad slots are unlocked.');
    if (save.waveBest < req.wave) return notify(`Reach Wave ${req.wave} first.`);
    if (save.gems < req.gems) return notify(`You need ${req.gems} gems.`);
    setSave(s=>({...s,gems:s.gems-req.gems,unlockedSlots:next}));
    notify(`Squad slot ${next} unlocked.`);
  };

  return (
    <main className="page">
      <div className="page-head">
        <div><div className="eyebrow">ROSTER ARCHIVE</div><h1>Collection</h1><p>See every fighter, track duplicates, add artwork and build a five-card squad.</p></div>
        <div className="squad-pill">Squad {squad.length}/{save.unlockedSlots}</div>
      </div>

      <div className="collection-layout">
        <section className="panel">
          <div className="toolbar">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search character or anime..." />
            <select value={filter} onChange={e=>setFilter(e.target.value)}>
              <option>All</option>{RARITIES.map(r=><option key={r}>{r}</option>)}
            </select>
            <select value={sort} onChange={e=>setSort(e.target.value)}>
              <option value="rarity">Sort by rarity</option>
              <option value="owned">Sort by owned</option>
              <option value="name">Sort by name</option>
            </select>
          </div>

          <div className="card-grid">
            {filtered.map(c => {
              const owned = save.owned[c.id] || 0;
              const isSelected = squad.includes(c.id);
              return (
                <div className={`char-card ${c.rarity.toLowerCase()} ${isSelected?'selected':''} ${owned===0?'locked':''}`} key={c.id}>
                  <div className="char-art">
                    {save.cardImages[c.id] ? <img src={save.cardImages[c.id]} alt={c.name}/> : <div className="char-placeholder"><span>{getIcon(c)}</span><small>{c.anime}</small></div>}
                    <div className="rarity-badge">{c.rarity}</div>
                    {owned===0 && <div className="locked-overlay">LOCKED</div>}
                  </div>
                  <div className="char-body">
                    <div className="char-title"><h3>{c.name}</h3><span>{owned}×</span></div>
                    <p>{c.anime}</p>
                    <div className="ability-row">{c.abilities.map(a=><span key={a}>{a}</span>)}</div>
                    <div className="card-footer">
                      <button className={isSelected?'selected-btn':''} disabled={owned===0} onClick={()=>toggleSquad(c.id)}>{isSelected?'REMOVE':'ADD TO SQUAD'}</button>
                      {owned>1 && <button className="sell-btn" onClick={()=>sellDuplicate(c.id)}>SELL DUPLICATE</button>}
                    </div>
                    <label className="upload-btn">{save.cardImages[c.id]?'CHANGE IMAGE':'ADD CHARACTER IMAGE'}<input type="file" accept="image/*" onChange={e=>uploadImage(c.id,e.target.files?.[0])}/></label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="panel squad-side">
          <div className="eyebrow">ACTIVE SQUAD</div>
          <h2>Five-card strategy</h2>
          <p className="muted">Your squad is a roster of different cards. Field copies are limited by rarity.</p>
          <div className="squad-list">
            {Array.from({length:SQUAD_LIMIT}).map((_,i)=>{
              const id = squad[i];
              const c = id ? getChar(id) : null;
              const locked = i >= save.unlockedSlots;
              return <div className={`squad-row ${locked?'locked-row':''}`} key={i}>
                <div className="slot-number">0{i+1}</div>
                <div className="slot-avatar" style={{borderColor:c?RARITY_COLOR[c.rarity]:'#2b3040'}}>{locked?<span>🔒</span>:c&&save.cardImages[c.id]?<img src={save.cardImages[c.id]} alt=""/>:c?<span>{getIcon(c)}</span>:<span>+</span>}</div>
                <div className="slot-text">{locked?<><b>Locked</b><small>Expand at wave {SLOT_RULES[i+1]?.wave||'—'}</small></>:c?<><b>{c.name}</b><small>{c.rarity} • max {COPY_LIMIT[c.rarity]} copies</small></>:<><b>Open slot</b><small>Choose a card</small></>}</div>
              </div>
            })}
          </div>
          {save.unlockedSlots < SQUAD_LIMIT && <button className="secondary wide" onClick={unlockSlot}>UNLOCK NEXT SLOT</button>}
          <div className="rule-box">
            <b>Field copy limits</b>
            <div>{RARITIES.map(r=><span key={r} style={{color:RARITY_COLOR[r]}}>{r}: {COPY_LIMIT[r]}</span>)}</div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Summon({save,setSave,notify}) {
  const [pack,setPack] = useState(null);
  const [reveal,setReveal] = useState([]);
  const [opening,setOpening] = useState(false);

  const open = () => {
    if (opening) return;
    if (save.gems < PACK_COST) return notify(`You need ${PACK_COST} gems.`);
    setOpening(true);
    setTimeout(() => {
      const result = openPack(save.pity);
      const owned = {...save.owned};
      result.results.forEach(c=>owned[c.id]=(owned[c.id]||0)+1);
      setSave(s=>({...s,gems:s.gems-PACK_COST,owned,pity:result.nextPity}));
      setPack(result.results);
      setReveal([]);
      setOpening(false);
    }, 650);
  };

  return (
    <main className="page">
      <div className="page-head">
        <div><div className="eyebrow">SUMMON LAB</div><h1>Shonen Pack</h1><p>Five cards per pack. Duplicates stay in your collection and can be traded back for gems.</p></div>
        <div className="big-gem">💎 {save.gems.toLocaleString()}</div>
      </div>

      <div className="summon-layout">
        <section className="panel summon-stage">
          <div className="summon-copy"><div className="eyebrow">5 CARD CAPSULE</div><h2>OPEN THE GATE.</h2><p>Base rates are weighted by rarity. Pity counters are shared across packs and guarantee the next higher threshold.</p></div>
          <div className="pack-visual"><div className="pack-glow"></div><div className="pack-mark">🎴</div><div className="pack-name">SHONEN<br/><b>SIEGE</b></div></div>
          <button className="primary pack-button" disabled={opening} onClick={open}>{opening?'OPENING...':`OPEN PACK — 💎 ${PACK_COST}`}</button>
          {pack && <div className="reveal-wrap"><div className="reveal-head"><div className="eyebrow">LATEST PACK</div><button className="text-btn" onClick={()=>setReveal([0,1,2,3,4])}>REVEAL ALL</button></div><div className="reveal-grid">{pack.map((c,i)=><button key={`${c.id}-${i}`} className={`reveal-card ${reveal.includes(i)?'revealed':''}`} onClick={()=>setReveal(v=>v.includes(i)?v:v.concat(i))}>{reveal.includes(i)?<><span className="mini-rarity" style={{color:RARITY_COLOR[c.rarity]}}>{c.rarity}</span><strong>{c.name}</strong><small>{c.anime}</small>{save.cardImages[c.id]&&<img src={save.cardImages[c.id]} alt=""/>}</>:<b>?</b>}</button>)}</div></div>}
        </section>
        <aside className="panel pity-side">
          <div className="eyebrow">PITY TRACKER</div>
          {['Rare','Epic','Legendary','Mythic'].map(r=><div className="pity-row" key={r}><div><span style={{color:RARITY_COLOR[r]}}>{r}</span><b>{save.pity[r]}/{PITY[r]}</b></div><div className="progress"><i style={{width:`${Math.min(100,save.pity[r]/PITY[r]*100)}%`,background:RARITY_COLOR[r]}}/></div></div>)}
          <div className="drop-rate-box"><div className="eyebrow">BASE RATES</div>{RARITIES.map(r=><div className="drop-line" key={r}><span><i style={{background:RARITY_COLOR[r]}}></i>{r}</span><b>{BASE_DROP_RATES[r]}%</b></div>)}</div>
          <div className="rule-box"><b>Duplicate sell values</b><div>{RARITIES.map(r=><span key={r}>{r}: 💎 {[8,12,20,35,60,100][rarityRank(r)]}</span>)}</div></div>
        </aside>
      </div>
    </main>
  );
}

const RUN_IDLE = {status:'idle', wave:0, cash:0, hp:100, enemies:[], units:[], gemsEarned:0, message:'', messageKind:'normal', nextCountdown:0};

function Infinite({save,setSave,squad,setPage,notify}) {
  const [run,setRun] = useState(RUN_IDLE);
  const [autoNext,setAutoNext] = useState(true);
  const [speed,setSpeed] = useState(1.35);
  const [placementMode,setPlacementMode] = useState(null);
  const timerRef = useRef(null);
  const autoRef = useRef(null);
  const runRef = useRef(run);
  runRef.current = run;

  const activeSquad = squad.slice(0,save.unlockedSlots).map(getChar).filter(Boolean);

  const startRun = (continueRun) => {
    const startWave = continueRun ? Math.max(1, save.waveBest + 1) : 1;
    const startCash = Math.round(850 + Math.max(0,startWave-1)*32);
    setRun({status:save.waveBest>0 || startWave>1?'warning':'warning', wave:startWave, cash:startCash, hp:100, enemies:[], units:[], gemsEarned:0, message:`WAVE ${startWave}${startWave%4===0?' • BOSS INCOMING':''}`, messageKind:startWave%4===0?'boss':'normal', nextCountdown:0});
  };

  const beginWave = (wave) => {
    const count = Math.min(45, 7 + Math.floor(wave*1.45));
    let counter = Date.now();
    const enemies = Array.from({length:count},(_,i)=>enemyFor(wave,i,count,`${wave}-${counter}-${i}`));
    setRun(r=>({...r,status:'active',enemies, message:wave%4===0?`⚠️ BOSS INCOMING — ${enemies[enemies.length-1].name.toUpperCase()}`:`WAVE ${wave} STARTED`,messageKind:wave%4===0?'boss':'normal',nextCountdown:0}));
  };

  useEffect(() => {
    if (run.status !== 'warning') return;
    const t = setTimeout(() => beginWave(run.wave), 1400);
    return () => clearTimeout(t);
  }, [run.status,run.wave]);

  useEffect(() => {
    if (run.status !== 'cleared' || !autoNext) return;
    autoRef.current = setTimeout(() => {
      setRun(r => {
        if (r.status !== 'cleared') return r;
        const next = r.wave + 1;
        return {...r,status:'warning',wave:next,message:`NEXT WAVE ${next}${next%4===0?' • BOSS INCOMING':''}`,messageKind:next%4===0?'boss':'normal'};
      });
    }, 2100);
    return ()=>clearTimeout(autoRef.current);
  }, [run.status,run.wave,autoNext]);

  useEffect(() => {
    if (run.status !== 'active') return;
    timerRef.current = setInterval(() => {
      const dt = 0.05 * speed;
      setRun(current => {
        if (current.status !== 'active') return current;
        let cash = current.cash;
        let hp = current.hp;
        const enemies = current.enemies.map(e => ({...e, progress:e.progress + e.speed*dt}));

        // Enemy regeneration
        enemies.forEach(e => {
          if (e.regen > 0) e.hp = Math.min(e.maxHp, e.hp + e.regen*dt*2.2);
        });

        // Remove escaped enemies
        let remaining = [];
        for (const e of enemies) {
          if (e.progress >= 1) hp -= e.damage;
          else remaining.push(e);
        }

        // Units attack. Units never depend on nested React state updates.
        const units = current.units.map(u => ({...u, cooldown:Math.max(0,u.cooldown-dt*1000)}));
        for (const u of units) {
          if (u.cooldown > 0) continue;
          const upos = {x:u.x,y:u.y};
          const candidates = remaining.filter(e => {
            const p = pathPosition(e.progress);
            return e.hp > 0 && distancePct(upos.x,upos.y,p.x,p.y) <= u.rangePct;
          }).sort((a,b)=>b.progress-a.progress);
          const target = candidates[0];
          if (!target) continue;
          let damage = u.damage;
          const shieldHit = Math.min(target.shield, damage);
          target.shield -= shieldHit;
          damage -= shieldHit;
          if (damage > 0) damage *= (1-target.armor);
          target.hp -= damage;
          u.cooldown = u.attackSpeed;
          if (target.hp <= 0) cash += target.reward;
        }

        remaining = remaining.filter(e => e.hp > 0 && e.progress < 1);

        if (hp <= 0) {
          return {...current,status:'gameover',hp:0,enemies:remaining,units,gemsEarned:current.gemsEarned,message:`RUN LOST ON WAVE ${current.wave}`};
        }
        if (remaining.length===0) {
          const reward = gemReward(current.wave);
          const newBest = Math.max(save.waveBest,current.wave);
          setSave(s=>({...s,gems:s.gems+reward,waveBest:newBest}));
          return {...current,status:'cleared',enemies:[],units,cash,gemsEarned:current.gemsEarned+reward,message:`WAVE ${current.wave} CLEARED • +💎 ${reward}`,messageKind:'clear'};
        }
        return {...current,hp:Math.max(0,hp),enemies:remaining,units,cash};
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [run.status,speed,save.waveBest,setSave]);

  // Place units using a map click.
  const place = (event) => {
    if (!placementMode) return;
    if (!['active','warning','cleared'].includes(run.status)) return notify('Start an Infinite run first.');
    const card = getChar(placementMode);
    if (!card) return;
    if (run.units.length >= DEPLOY_LIMIT) return notify(`Placement limit reached: ${DEPLOY_LIMIT}.`);
    const same = run.units.filter(u=>u.card.id===card.id).length;
    if (same >= COPY_LIMIT[card.rarity]) return notify(`${card.name} can only have ${COPY_LIMIT[card.rarity]} copies on the field.`);
    if (run.units.some(u=>distancePct(u.x,u.y,(event.offsetX/event.currentTarget.clientWidth)*100,(event.offsetY/event.currentTarget.clientHeight)*100)<6)) return notify('Too close to another unit.');
    const x = Math.max(5,Math.min(95,event.offsetX/event.currentTarget.clientWidth*100));
    const y = Math.max(6,Math.min(94,event.offsetY/event.currentTarget.clientHeight*100));
    const pathDist = PATH.reduce((best,p)=>Math.min(best,distancePct(x,y,p[0],p[1])),Infinity);
    if (pathDist < 8) return notify('Place units beside the road, not on it.');
    if (run.cash < card.cost) return notify(`Need ${card.cost} cash to deploy ${card.name}.`);
    const unit = {
      card,
      level:1,
      x,y,
      damage:card.baseDamage,
      rangePct:Math.max(11,card.range/12),
      attackSpeed:card.attackSpeed,
      cooldown:120,
    };
    setRun(r=>({...r,cash:r.cash-card.cost,units:[...r.units,unit]}));
    setPlacementMode(null);
  };

  const upgrade = (index) => {
    setRun(r => {
      const u = r.units[index];
      if (!u) return r;
      const max = UPGRADE_LIMIT[u.card.rarity];
      if (u.level >= max) { notify(`${u.card.name} is maxed at Lv.${max}.`); return r; }
      const cost = Math.round((90 + u.level*55 + rarityRank(u.card.rarity)*25) * (1 + r.wave*0.018));
      if (r.cash < cost) { notify('Not enough cash for that upgrade.'); return r; }
      return {...r,cash:r.cash-cost,units:r.units.map((x,i)=>i!==index?x:{...x,level:x.level+1,damage:Math.round(x.damage*1.30),rangePct:x.rangePct+0.9,attackSpeed:Math.max(220,x.attackSpeed-38)})};
    });
  };

  const sellUnit = (index) => {
    setRun(r=>{
      const u=r.units[index];
      if (!u) return r;
      const refund=Math.floor(getChar(u.card.id).cost*0.55);
      return {...r,cash:r.cash+refund,units:r.units.filter((_,i)=>i!==index)};
    });
    notify('Unit sold for 55% of its deploy cost.');
  };

  const nextWave = () => {
    if (run.status==='cleared') setRun(r=>({...r,status:'warning',wave:r.wave+1,message:`WAVE ${r.wave+1}${(r.wave+1)%4===0?' • BOSS INCOMING':''}`,messageKind:(r.wave+1)%4===0?'boss':'normal'}));
    else notify('Finish the current wave first.');
  };

  const quit = () => {
    setPlacementMode(null);
    setRun(r=>({...r,status:'idle',wave:0,cash:0,hp:100,enemies:[],units:[],message:'RUN QUIT • CLEARED WAVE GEMS KEPT',messageKind:'normal'}));
  };

  const restart = () => {
    setPlacementMode(null);
    setRun({status:'warning',wave:1,cash:850,hp:100,enemies:[],units:[],gemsEarned:0,message:'WAVE 1',messageKind:'normal',nextCountdown:0});
  };

  const continueRun = () => startRun(true);
  const [selectedUnit,setSelectedUnit] = useState(null);

  useEffect(()=>{ if (selectedUnit !== null && !run.units[selectedUnit]) setSelectedUnit(null); },[run.units,selectedUnit]);

  const selectedUnitData = selectedUnit === null ? null : run.units[selectedUnit];

  return (
    <main className="page">
      <div className="page-head run-page-head">
        <div><div className="eyebrow">INFINITE MODE</div><h1>Endless Siege</h1><p>Cash is run-only. Gems are permanent. Clear every wave to get gems you keep even if you lose.</p></div>
        <div className="run-top-stats">
          <span>🏆 Best <b>{save.waveBest}</b></span>
          <span>💎 Gems <b>{save.gems}</b></span>
          <span>📍 Field <b>{run.units.length}/{DEPLOY_LIMIT}</b></span>
        </div>
      </div>

      <div className="run-controls">
        <div className="control-left">
          <button className={`toggle ${autoNext?'on':''}`} onClick={()=>setAutoNext(v=>!v)}>⏭ Auto Next Wave: {autoNext?'ON':'OFF'}</button>
          <button className="toggle" onClick={()=>setSpeed(s=>s===1.35?1.75:s===1.75?2.25:1.35)}>⚡ Speed {speed}x</button>
          {run.status==='cleared' && !autoNext && <button className="primary small" onClick={nextWave}>NEXT WAVE</button>}
        </div>
        <div className="control-right">
          {run.status!=='idle' && <button className="danger small" onClick={quit}>QUIT RUN</button>}
        </div>
      </div>

      <div className="battle-layout">
        <section className="battlefield-panel panel">
          <div className="battle-info">
            <div><span>Wave</span><b>{run.wave || '—'}</b></div>
            <div><span>Cash</span><b>💰 {Math.floor(run.cash)}</b></div>
            <div><span>Core</span><b className={run.hp<35?'danger-text':''}>❤ {Math.max(0,Math.ceil(run.hp))}%</b></div>
            <div><span>Enemies</span><b>{run.enemies.length}</b></div>
          </div>

          <div className={`map ${placementMode?'placing':''}`} onClick={place}>
            <svg className="road-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={PATH.map(([x,y])=>`${x},${y}`).join(' ')} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={PATH.map(([x,y])=>`${x},${y}`).join(' ')} fill="none" stroke="#50596b" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={PATH.map(([x,y])=>`${x},${y}`).join(' ')} fill="none" stroke="#697386" strokeWidth="1.2" strokeDasharray="2 3" strokeLinejoin="round"/>
            </svg>
            <div className="gate">SPAWN</div>
            <div className="core">🏯</div>
            {run.enemies.map(e=>{
              const p=pathPosition(e.progress);
              return <div key={e.id} className={`enemy-token ${e.type}`} style={{left:`${p.x}%`,top:`${p.y}%`}}>
                <div className="enemy-icon">{e.type==='boss'?'👹':e.type==='fast'?'🐺':e.type==='tank'?'🗿':e.type==='regen'?'🧟':e.type==='shield'?'🛡️':e.type==='armored'?'🛡️':'👾'}</div>
                <div className="enemy-health"><i style={{width:`${Math.max(0,(e.hp/e.maxHp)*100)}%`}}/></div>
                {e.type==='boss' && <span className="boss-tag">{e.name}</span>}
              </div>
            })}
            {run.units.map((u,i)=><button key={`${u.card.id}-${i}`} className={`placed-unit ${selectedUnit===i?'selected':''}`} style={{left:`${u.x}%`,top:`${u.y}%`,borderColor:RARITY_COLOR[u.card.rarity]}} onClick={e=>{e.stopPropagation();setSelectedUnit(i);}} title={`${u.card.name} Lv.${u.level}`}> 
              {save.cardImages[u.card.id]?<img src={save.cardImages[u.card.id]} alt=""/>:<span>{getIcon(u.card)}</span>}
              <small>Lv.{u.level}/{UPGRADE_LIMIT[u.card.rarity]}</small>
            </button>)}
            {selectedUnitData && <div className="range-ring" style={{left:`${selectedUnitData.x}%`,top:`${selectedUnitData.y}%`,width:`${selectedUnitData.rangePct*2}%`,height:`${selectedUnitData.rangePct*2}%`,borderColor:RARITY_COLOR[selectedUnitData.card.rarity]}}/>}

            {run.status==='warning' && <div className={`wave-banner ${run.messageKind==='boss'?'boss':''}`}>{run.message}</div>}
            {run.status==='active' && run.messageKind==='clear' && <div className="wave-banner clear">{run.message}</div>}
            {run.status==='cleared' && <div className="wave-banner clear">{run.message}</div>}
            {run.status==='gameover' && <div className="run-overlay"><h2>RUN OVER</h2><p>Wave {run.wave} ended before it was cleared.</p><div className="overlay-reward">💎 +{run.gemsEarned} kept from cleared waves</div><button className="primary" onClick={continueRun}>CONTINUE FROM WAVE {Math.max(1,save.waveBest+1)}</button><button className="secondary" onClick={restart}>RESTART FROM WAVE 1</button><button className="text-btn" onClick={()=>setPage('home')}>BACK HOME</button></div>}
            {run.status==='idle' && <div className="run-overlay"><h2>{save.waveBest>0?'READY TO PUSH FURTHER':'FIRST RUN'}</h2><p>{save.waveBest>0?`Highest cleared wave: ${save.waveBest}`:'Clear a wave to start earning permanent gems.'}</p><div className="overlay-row">{save.waveBest>0 && <button className="primary" onClick={continueRun}>CONTINUE — WAVE {save.waveBest+1}</button>}<button className="secondary" onClick={restart}>RESTART — WAVE 1</button></div></div>}
          </div>

          {selectedUnitData && <div className="selected-unit-panel">
            <div className="selected-unit-head"><div><div className="eyebrow">SELECTED UNIT</div><h3>{selectedUnitData.card.name}</h3><span>{selectedUnitData.card.rarity} • Level {selectedUnitData.level}/{UPGRADE_LIMIT[selectedUnitData.card.rarity]}</span></div><button className="text-btn" onClick={()=>setSelectedUnit(null)}>CLOSE</button></div>
            <div className="selected-actions">
              <button className="primary" onClick={()=>upgrade(selectedUnit)}>UPGRADE — 💰 {Math.round((90 + selectedUnitData.level*55 + rarityRank(selectedUnitData.card.rarity)*25)*(1 + run.wave*0.018))}</button>
              <button className="danger" onClick={()=>{sellUnit(selectedUnit);setSelectedUnit(null);}}>SELL</button>
            </div>
          </div>}
        </section>

        <aside className="panel squad-deploy-panel">
          <div className="side-head"><div><div className="eyebrow">DEPLOYMENT</div><h2>Your squad</h2><p className="muted">{activeSquad.length}/{save.unlockedSlots} cards • {DEPLOY_LIMIT} field placements max</p></div></div>
          <div className="deploy-list">
            {activeSquad.map(c=>{
              const copies=run.units.filter(u=>u.card.id===c.id).length;
              const available=save.cardImages[c.id];
              const disabled=run.cash<c.cost||copies>=COPY_LIMIT[c.rarity]||run.units.length>=DEPLOY_LIMIT||!['active','warning','cleared'].includes(run.status);
              return <div className="deploy-card" key={c.id}>
                <div className="deploy-avatar" style={{borderColor:RARITY_COLOR[c.rarity]}}>{available?<img src={available} alt=""/>:<span>{getIcon(c)}</span>}</div>
                <div className="deploy-details"><b>{c.name}</b><small>{c.rarity} • {copies}/{COPY_LIMIT[c.rarity]} copies</small><span>Deploy 💰 {c.cost}</span></div>
                <button disabled={disabled} className={placementMode===c.id?'placing-btn':''} onClick={()=>setPlacementMode(v=>v===c.id?null:c.id)}>{placementMode===c.id?'CLICK MAP':'PLACE'}</button>
              </div>
            })}
          </div>
          <button className="secondary wide" onClick={()=>setPage('collection')}>CHANGE SQUAD</button>
          <div className="run-rules">
            <b>Upgrade limits</b>
            {RARITIES.map(r=><span key={r} style={{color:RARITY_COLOR[r]}}>{r} • Lv.{UPGRADE_LIMIT[r]} • {COPY_LIMIT[r]} copies</span>)}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Admin({save,setSave,notify}) {
  const [gemAmount,setGemAmount] = useState('1000');
  const [cardId,setCardId] = useState(CHARACTERS[0].id);
  const [copies,setCopies] = useState('1');

  const add = () => {
    const n=Math.max(0,Number(gemAmount)||0);
    setSave(s=>({...s,gems:s.gems+n}));
    notify(`Added ${n} gems.`);
  };
  const give = () => {
    const n=Math.max(1,Number(copies)||1);
    setSave(s=>({...s,owned:{...s.owned,[cardId]:(s.owned[cardId]||0)+n}}));
    notify(`Added ${n} ${getChar(cardId).name} card(s).`);
  };
  const setBest = () => {
    const w=Math.max(0,Math.floor(Number(document.getElementById('admin-best-wave')?.value || 0)));
    setSave(s=>({...s,waveBest:w}));
    notify(`Best cleared wave set to ${w}.`);
  };
  const reset = () => {
    if (!window.confirm('Reset the local prototype save? This clears gems, cards, progress and images on this browser.')) return;
    setSave(freshSave());
    localStorage.removeItem('shonen-siege-v3-squad');
    notify('Local save reset.');
  };
  const unlockAll = () => {
    setSave(s=>({...s,unlockedSlots:5}));
    notify('All 5 squad slots unlocked.');
  };

  return <main className="page">
    <div className="page-head"><div><div className="eyebrow">LOCAL PROTOTYPE</div><h1>Admin Control</h1><p>These controls live in this browser only. They are for development, testing and balancing.</p></div><span className="admin-badge">⚠️ Prototype admin</span></div>
    <div className="admin-grid">
      <section className="panel admin-panel"><h2>Economy</h2><label>Give gems<input value={gemAmount} onChange={e=>setGemAmount(e.target.value)}/></label><button className="primary" onClick={add}>ADD GEMS</button><div className="admin-stat">Current: 💎 {save.gems.toLocaleString()}</div></section>
      <section className="panel admin-panel"><h2>Cards</h2><label>Character<select value={cardId} onChange={e=>setCardId(e.target.value)}>{CHARACTERS.map(c=><option value={c.id} key={c.id}>{c.name} — {c.rarity}</option>)}</select></label><label>Copies<input value={copies} onChange={e=>setCopies(e.target.value)}/></label><button className="primary" onClick={give}>GIVE CARD(S)</button></section>
      <section className="panel admin-panel"><h2>Progress</h2><label>Set best cleared wave<input id="admin-best-wave" type="number" min="0" defaultValue={save.waveBest}/></label><button className="secondary" onClick={setBest}>SET BEST WAVE</button><button className="secondary" onClick={unlockAll}>UNLOCK ALL 5 SLOTS</button><button className="danger" onClick={reset}>RESET LOCAL SAVE</button></section>
    </div>
    <section className="panel admin-panel image-admin"><h2>Character artwork</h2><p className="muted">Add or replace art for any character. Images are resized in the browser before saving.</p><div className="admin-art-grid">{CHARACTERS.map(c=><div className="admin-art-card" key={c.id}><div className="admin-art-preview">{save.cardImages[c.id]?<img src={save.cardImages[c.id]} alt=""/>:<span>{getIcon(c)}</span>}</div><b>{c.name}</b><label className="upload-btn">UPLOAD IMAGE<input type="file" accept="image/*" onChange={e=>{
      const file=e.target.files?.[0]; if(!file)return;
      const reader=new FileReader(); reader.onload=()=>{const img=new Image();img.onload=()=>{const max=512;const scale=Math.min(1,max/Math.max(img.width,img.height));const can=document.createElement('canvas');can.width=Math.max(1,Math.round(img.width*scale));can.height=Math.max(1,Math.round(img.height*scale));can.getContext('2d').drawImage(img,0,0,can.width,can.height);setSave(s=>({...s,cardImages:{...s.cardImages,[c.id]:can.toDataURL('image/webp',.78)}}));notify('Artwork saved.');};img.src=String(reader.result)};reader.readAsDataURL(file);
    }}/></label></div>)}</div></section>
    <div className="admin-note">For the future online version, move admin controls to a real authenticated server with roles and audit logs. This prototype intentionally keeps them local.</div>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
