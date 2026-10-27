import React, { useEffect, useMemo, useState } from 'react';
import { isBackendConfigured, signIn, signUp, signOut, getProfile, rpc, tableRequest, uploadGameArt } from './backend.js';

const RARITIES = ['Common','Uncommon','Rare','Epic','Legendary','Mythic'];
const RARITY_COLORS = {Common:'#9da5b5',Uncommon:'#58d39a',Rare:'#53c9ff',Epic:'#a879ff',Legendary:'#ffbf5e',Mythic:'#ff6588'};
const emptyCharacter = () => ({id:'',name:'',anime:'Naruto',rarity:'Common',cost:180,base_damage:22,range:110,attack_speed:680,role:'attack',income_per_wave:0,buff_percent:0,abilities:[],art_url:'',enabled:true});
const asArray = value => Array.isArray(value) ? value : [];
const errText = e => e?.message || String(e);

export function AccountPage({ session, profile, accountLoading, onAuthenticated, onSignedOut, onSaveUpdated, currentSave, localSaveBackup, saveImported }) {
  const [mode,setMode] = useState('login');
  const [username,setUsername] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [importBusy,setImportBusy] = useState(false);
  const [importMessage,setImportMessage] = useState('');

  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (mode==='signup') {
        const result = await signUp(email.trim(),password,username.trim() || email.split('@')[0]);
        if (result?.access_token) {
          await onAuthenticated(result);
          setMessage('Account created and signed in.');
        } else {
          setMessage('Account created. Check your email to confirm it, then return here and sign in.');
          setMode('login');
        }
      } else {
        const result = await signIn(email.trim(),password);
        await onAuthenticated(result);
        setMessage('Signed in successfully.');
      }
    } catch (e2) { setError(errText(e2)); }
    finally { setBusy(false); }
  };

  if (!isBackendConfigured()) return <main className="page account-page">
    <div className="page-head"><div><div className="eyebrow">PLAYER ID</div><h1>Account setup</h1><p>Accounts and secure admin controls need a connected backend. Your local game still works while this is unconfigured.</p></div></div>
    <section className="panel setup-panel">
      <h2>Connect Supabase first</h2>
      <ol>
        <li>Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase Dashboard</a>.</li>
        <li>Open SQL Editor and run the supplied <code>supabase/setup.sql</code> file.</li>
        <li>Open Project Settings → API and copy the Project URL and publishable/anon key.</li>
        <li>Paste both values into <code>src/backend-config.js</code>. Never put a service-role key in browser code.</li>
        <li>Upload and deploy these V3.4 files, then create your owner account here.</li>
      </ol>
      <p className="muted">The admin menu stays unavailable until the backend is configured and your account is explicitly promoted to admin in Supabase.</p>
    </section>
  </main>;

  if (accountLoading) return <main className="page"><section className="panel"><p>Checking account session…</p></section></main>;

  if (session && profile) return <main className="page account-page">
    <div className="page-head"><div><div className="eyebrow">PLAYER ID</div><h1>Your Account</h1><p>Your account is connected to Shonen Siege cloud services.</p></div><span className={`account-role ${profile.role==='admin'?'is-admin':''}`}>{profile.role==='admin'?'OWNER / ADMIN':'PLAYER'}</span></div>
    <section className="panel account-profile">
      <div className="account-avatar">{(profile.username||profile.email||'P').slice(0,1).toUpperCase()}</div>
      <div className="account-profile-main"><h2>{profile.username || 'Player'}</h2><p>{profile.email}</p><div className="account-stats"><span>💎 <b>{Number(currentSave?.gems ?? 0).toLocaleString()}</b> gems</span><span>🏆 <b>{Number(currentSave?.waveBest ?? 0)}</b> best wave</span><span>🎴 <b>{Object.values(currentSave?.owned || {}).filter(n=>Number(n)>0).length}</b> owned unit types</span></div></div>
      <button className="secondary" onClick={onSignedOut}>SIGN OUT</button>
    </section>
    {!saveImported && profile.role==='admin' && <section className="panel import-save-panel"><div className="eyebrow">ONE-TIME SAVE MIGRATION</div><h2>Import your existing browser save</h2><p className="muted">Your earlier V3 save is stored only in this browser. The one-time migration is owner-only because browser data can be edited by players. It copies your gems, wave record, unlocked slots, squad and owned cards; local image data is not migrated.</p><button className="secondary" disabled={importBusy||!localSaveBackup} onClick={async()=>{setImportBusy(true);setImportMessage('');try{const result=await rpc(session,'import_my_local_save',{p_save:localSaveBackup});onSaveUpdated(result);setImportMessage('Your browser save was imported into this account.');}catch(e){setImportMessage(`Import failed: ${errText(e)}`);}finally{setImportBusy(false);}}}>{importBusy?'IMPORTING…':'IMPORT THIS DEVICE SAVE'}</button>{importMessage&&<p className={importMessage.startsWith('Import failed')?'inline-error':'inline-success'}>{importMessage}</p>}</section>}
    {profile.role==='admin' ? <section className="panel admin-access-card"><div><div className="eyebrow">PRIVILEGED ACCESS</div><h2>Admin Dashboard enabled</h2><p>Manage players, characters, enemy settings and artwork. Changes apply to all clients after they reload the published configuration.</p></div><span className="admin-lock">🔐</span></section> : <section className="panel"><h2>Welcome to Shonen Siege</h2><p className="muted">Your role is Player. The private admin dashboard is only visible to accounts granted the admin role by the project owner.</p></section>}
  </main>;

  return <main className="page account-page">
    <div className="page-head"><div><div className="eyebrow">PLAYER ID</div><h1>{mode==='login'?'Sign in':'Create your account'}</h1><p>Use an account to keep a player identity and access cloud features.</p></div></div>
    <section className="panel auth-panel">
      <div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMessage('');setError('');}}>SIGN IN</button><button className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setMessage('');setError('');}}>CREATE ACCOUNT</button></div>
      <form onSubmit={submit} className="auth-form">
        {mode==='signup' && <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} minLength={2} maxLength={24} required placeholder="Your player name" /></label>}
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="At least 8 characters" /></label>
        <button className="primary" disabled={busy}>{busy?'PLEASE WAIT…':mode==='login'?'SIGN IN':'CREATE ACCOUNT'}</button>
      </form>
      {message && <p className="inline-success">{message}</p>}{error && <p className="inline-error">{error}</p>}
      <p className="muted auth-note">Never share your password. The game owner will never ask for it. Admin privileges are assigned privately in the database, not through this form.</p>
    </section>
  </main>;
}

export function AdminPage({session,profile,characters,gameBalance,enemyBalance,onConfigChanged,notify}) {
  const [tab,setTab] = useState('players');
  const [players,setPlayers] = useState([]);
  const [saves,setSaves] = useState([]);
  const [dbCharacters,setDbCharacters] = useState([]);
  const [dbEnemies,setDbEnemies] = useState([]);
  const [search,setSearch] = useState('');
  const [selectedCharacter,setSelectedCharacter] = useState('');
  const [selectedEnemy,setSelectedEnemy] = useState('normal');
  const [charForm,setCharForm] = useState(emptyCharacter());
  const [enemyForm,setEnemyForm] = useState({id:'normal',name:'Normal',hp:78,hp_per_wave:0,speed:.032,base_damage:34,armor:0,shield:0,regen:0,art_url:'',enabled:true});
  const [selectedPlayer,setSelectedPlayer] = useState('');
  const [gemAmount,setGemAmount] = useState('500');
  const [giveCharacter,setGiveCharacter] = useState('naruto');
  const [giveQuantity,setGiveQuantity] = useState('1');
  const [uploading,setUploading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [loadError,setLoadError] = useState('');

  const load = async () => {
    if (!session || profile?.role!=='admin') return;
    setLoadError('');
    try {
      const [p,s,c,en] = await Promise.all([
        tableRequest(session,'profiles','select=id,email,username,role,created_at&order=created_at.desc'),
        tableRequest(session,'player_saves','select=user_id,gems,wave_best,unlocked_slots,owned&order=updated_at.desc'),
        tableRequest(session,'game_characters','select=*&order=name.asc'),
        tableRequest(session,'game_enemies','select=*&order=id.asc'),
      ]);
      setPlayers(asArray(p)); setSaves(asArray(s)); setDbCharacters(asArray(c)); setDbEnemies(asArray(en));
      if (!selectedCharacter && asArray(c).length) { setSelectedCharacter(c[0].id); setCharForm({...emptyCharacter(),...c[0]}); }
      if (selectedCharacter && asArray(c).some(x=>x.id===selectedCharacter)) setCharForm({...emptyCharacter(),...asArray(c).find(x=>x.id===selectedCharacter)});
      if (selectedEnemy && asArray(en).some(x=>x.id===selectedEnemy)) setEnemyForm({...asArray(en).find(x=>x.id===selectedEnemy)});
      if (!selectedPlayer && asArray(p).length) setSelectedPlayer(p[0].id);
    } catch (e) { setLoadError(errText(e)); }
  };
  useEffect(()=>{load();},[session?.access_token,profile?.role]);

  const saveByUser = useMemo(()=>Object.fromEntries(saves.map(s=>[s.user_id,s])),[saves]);
  const filteredPlayers = players.filter(p=>`${p.username||''} ${p.email||''} ${p.id}`.toLowerCase().includes(search.toLowerCase()));
  const selectedPlayerRow = players.find(p=>p.id===selectedPlayer);
  const selectedDbChar = dbCharacters.find(c=>c.id===selectedCharacter);
  const selectedDbEnemy = dbEnemies.find(e=>e.id===selectedEnemy);

  if (profile?.role!=='admin') return <main className="page"><section className="panel"><h1>Access denied</h1><p>Admin permissions are checked against the backend profile. This account does not have admin access.</p></section></main>;

  const seedCatalog = async () => {
    setBusy(true);
    try {
      const [existingRows, existingEnemyRows] = await Promise.all([
        tableRequest(session,'game_characters','select=id,art_url,enabled'),
        tableRequest(session,'game_enemies','select=id,art_url,enabled'),
      ]);
      const existingById = Object.fromEntries(asArray(existingRows).map(row=>[row.id,row]));
      const existingEnemiesById = Object.fromEntries(asArray(existingEnemyRows).map(row=>[row.id,row]));
      const charRows = characters.map(c=>({
        id:c.id,name:c.name,anime:c.anime||'Unknown',rarity:c.rarity||'Common',cost:Number(c.cost||0),base_damage:Number(c.baseDamage||0),range:Number(c.range||0),attack_speed:Number(c.attackSpeed||0),role:c.role||'attack',income_per_wave:Number(c.incomePerWave||0),buff_percent:Number(c.buffPercent||0),abilities:c.abilities||[],art_url:existingById[c.id]?.art_url||c.art_url||null,enabled:existingById[c.id]?.enabled ?? c.enabled ?? true,
      }));
      const rows=[];
      for (const [id,v] of Object.entries(enemyBalance)) {
        if (id==='bosses' || !v || typeof v!=='object') continue;
        rows.push({id,name:id==='regen'?'Regenerator':id.charAt(0).toUpperCase()+id.slice(1),hp:Number(v.hp||0),hp_per_wave:0,speed:Number(v.speed||0),base_damage:Number(v.damage||34),armor:Number(v.armor||0),shield:Number(v.shield||0),regen:Number(v.regen||0),art_url:existingEnemiesById[id]?.art_url||null,enabled:existingEnemiesById[id]?.enabled ?? true});
      }
      for (const b of (enemyBalance.bosses||[])) { const id=`boss-${String(b.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`; rows.push({id,name:b.name,hp:Number(b.hp||0),hp_per_wave:Number(b.hpPerWave||0),speed:Number(b.speed||0),base_damage:Number(b.damage||100),armor:Number(b.armor||0),shield:Number(b.shield||0),regen:Number(b.regen||0),art_url:existingEnemiesById[id]?.art_url||null,enabled:existingEnemiesById[id]?.enabled ?? true}); }
      await tableRequest(session,'game_characters','on_conflict=id',{method:'POST',body:charRows,prefer:'resolution=merge-duplicates,return=minimal'});
      await tableRequest(session,'game_enemies','on_conflict=id',{method:'POST',body:rows,prefer:'resolution=merge-duplicates,return=minimal'});
      await tableRequest(session,'game_settings','on_conflict=key',{method:'POST',body:[{key:'game_balance',value:gameBalance}],prefer:'resolution=merge-duplicates,return=minimal'});
      await load(); await onConfigChanged(); notify('Default roster and balance settings published.');
    } catch(e) { notify(`Publish failed: ${errText(e)}`); }
    finally { setBusy(false); }
  };

  const adjustGems = async delta => {
    if (!selectedPlayer) return notify('Choose a player first.');
    setBusy(true);
    try { const result=await rpc(session,'admin_adjust_gems',{p_user_id:selectedPlayer,p_delta:Number(delta)}); notify(`Updated gems. Player now has ${Number(result.gems).toLocaleString()} gems.`); await load(); }
    catch(e) { notify(`Gem update failed: ${errText(e)}`); }
    finally { setBusy(false); }
  };
  const giveSelectedCharacter = async () => {
    if (!selectedPlayer) return notify('Choose a player first.');
    setBusy(true);
    try { await rpc(session,'admin_give_character',{p_user_id:selectedPlayer,p_character_id:giveCharacter,p_quantity:Number(giveQuantity)}); notify('Character added to player inventory.'); }
    catch(e) { notify(`Give character failed: ${errText(e)}`); }
    finally { setBusy(false); }
  };
  const saveCharacter = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const row={id:charForm.id,name:charForm.name,anime:charForm.anime,rarity:charForm.rarity,cost:Number(charForm.cost),base_damage:charForm.role==='money'?0:Number(charForm.base_damage),range:charForm.role==='money'?0:Number(charForm.range),attack_speed:charForm.role==='money'?0:Number(charForm.attack_speed),role:charForm.role,income_per_wave:Number(charForm.income_per_wave||0),buff_percent:Number(charForm.buff_percent||0),abilities:typeof charForm.abilities==='string'?charForm.abilities.split(',').map(x=>x.trim()).filter(Boolean):charForm.abilities||[],art_url:charForm.art_url||null,enabled:Boolean(charForm.enabled)};
      await tableRequest(session,'game_characters',`id=eq.${encodeURIComponent(charForm.id)}`,{method:'PATCH',body:row,prefer:'return=minimal'});
      await load(); await onConfigChanged(); notify(`${row.name} saved. Reload the game for the published stats to apply.`);
    } catch(e2) { notify(`Character save failed: ${errText(e2)}`); }
    finally { setBusy(false); }
  };
  const createCharacter = () => { const c=emptyCharacter(); c.id=`new-character-${Date.now()}`; c.name='New Character'; setCharForm(c); setSelectedCharacter(c.id); };
  const insertCharacter = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const row={id:charForm.id,name:charForm.name,anime:charForm.anime,rarity:charForm.rarity,cost:Number(charForm.cost),base_damage:charForm.role==='money'?0:Number(charForm.base_damage),range:charForm.role==='money'?0:Number(charForm.range),attack_speed:charForm.role==='money'?0:Number(charForm.attack_speed),role:charForm.role,income_per_wave:Number(charForm.income_per_wave||0),buff_percent:Number(charForm.buff_percent||0),abilities:typeof charForm.abilities==='string'?charForm.abilities.split(',').map(x=>x.trim()).filter(Boolean):charForm.abilities||[],art_url:charForm.art_url||null,enabled:Boolean(charForm.enabled)};
      await tableRequest(session,'game_characters','',{method:'POST',body:row,prefer:'return=minimal'}); await load(); await onConfigChanged(); notify('Character added to published roster.');
    } catch(e2) { notify(`Add failed: ${errText(e2)}`); }
    finally { setBusy(false); }
  };
  const saveEnemy = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const row={id:enemyForm.id,name:enemyForm.name,hp:Number(enemyForm.hp),hp_per_wave:Number(enemyForm.hp_per_wave||0),speed:Number(enemyForm.speed),base_damage:Number(enemyForm.base_damage),armor:Number(enemyForm.armor||0),shield:Number(enemyForm.shield||0),regen:Number(enemyForm.regen||0),art_url:enemyForm.art_url||null,enabled:Boolean(enemyForm.enabled)};
      await tableRequest(session,'game_enemies',`id=eq.${encodeURIComponent(enemyForm.id)}`,{method:'PATCH',body:row,prefer:'return=minimal'}); await load(); await onConfigChanged(); notify(`${row.name} saved. Reload the game for settings to apply.`);
    } catch(e2) { notify(`Enemy save failed: ${errText(e2)}`); }
    finally { setBusy(false); }
  };
  const artUpload = async (file, kind) => {
    const id=kind==='character'?charForm.id:enemyForm.id;
    if (!file || !id) return;
    if (file.size > 5 * 1024 * 1024) { notify('Artwork must be 5 MB or smaller.'); return; }
    setUploading(true);
    try {
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const url=await uploadGameArt(session,`${kind==='character'?'characters':'enemies'}/${id}/${Date.now()}-${safe}`,file);
      if (kind==='character') setCharForm(v=>({...v,art_url:url})); else setEnemyForm(v=>({...v,art_url:url}));
      notify('Image uploaded. Click Save to publish its URL.');
    } catch(e) { notify(`Image upload failed: ${errText(e)}`); }
    finally { setUploading(false); }
  };

  return <main className="page admin-page">
    <div className="page-head"><div><div className="eyebrow">OWNER CONSOLE</div><h1>Admin Dashboard</h1><p>Private controls for accounts, character balancing, enemies and artwork.</p></div><span className="account-role is-admin">OWNER / ADMIN</span></div>
    <div className="admin-warning"><b>Owner controls</b><span>Edits are saved to Supabase. All players receive published character/enemy config when they refresh. Admin RPCs are protected by the database role; never put a service-role key in this app.</span></div>
    {loadError && <div className="inline-error">Could not load admin data: {loadError}</div>}
    <section className="panel admin-toolbar"><button className="primary" onClick={seedCatalog} disabled={busy}>{busy?'PUBLISHING…':'PUBLISH / REFRESH DEFAULT ROSTER'}</button><button className="secondary" onClick={load} disabled={busy}>REFRESH ADMIN DATA</button><span className="muted">First-time setup: publish the built-in roster before summoning.</span></section>
    <div className="admin-tabs">
      { [['players','Players & Gems'],['characters','Characters & Art'],['enemies','Enemies & Bosses']].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>) }
    </div>
    {tab==='players' && <section className="panel admin-section">
      <div className="section-head"><div><div className="eyebrow">PLAYER ACCOUNTS</div><h2>Manage player saves</h2></div><span>{players.length} accounts</span></div>
      <input className="admin-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search username, email or player ID" />
      <div className="player-admin-list">{filteredPlayers.map(p=>{const s=saveByUser[p.id]||{};return <button key={p.id} className={`player-admin-row ${selectedPlayer===p.id?'selected':''}`} onClick={()=>setSelectedPlayer(p.id)}><span className="player-dot">{(p.username||p.email||'P').slice(0,1).toUpperCase()}</span><span className="player-main"><b>{p.username||'Player'}</b><small>{p.email||p.id}</small></span><span className="player-values"><b>💎 {Number(s.gems||0).toLocaleString()}</b><small>Best wave {s.wave_best||0}</small></span><span className={`mini-role ${p.role==='admin'?'admin':''}`}>{p.role}</span></button>})}</div>
      <div className="player-actions"><div><div className="eyebrow">SELECTED PLAYER</div><h3>{selectedPlayerRow?.username||selectedPlayerRow?.email||'Choose a player'}</h3><small>{selectedPlayerRow?.email||selectedPlayer||'No player selected'}</small></div><div className="player-gem-action"><input value={gemAmount} onChange={e=>setGemAmount(e.target.value)} type="number" min="1" max="10000000"/><button className="secondary" disabled={busy||!selectedPlayer} onClick={()=>adjustGems(Math.abs(Number(gemAmount)))}>+ GIVE GEMS</button><button className="danger" disabled={busy||!selectedPlayer} onClick={()=>adjustGems(-Math.abs(Number(gemAmount)))}>- REMOVE GEMS</button></div><div className="player-card-action"><select value={giveCharacter} onChange={e=>setGiveCharacter(e.target.value)}>{(dbCharacters.length?dbCharacters:characters).map(c=><option key={c.id} value={c.id}>{c.name} · {c.rarity}</option>)}</select><input value={giveQuantity} onChange={e=>setGiveQuantity(e.target.value)} type="number" min="1" max="1000"/><button className="primary" disabled={busy||!selectedPlayer} onClick={giveSelectedCharacter}>GIVE CHARACTER</button></div></div>
      <p className="muted">Gem/card grants update the cloud save. The player must sign in to that same account to receive it in the game.</p>
    </section>}
    {tab==='characters' && <section className="panel admin-section">
      <div className="section-head"><div><div className="eyebrow">CHARACTER DATABASE</div><h2>Stats, rarity and artwork</h2></div><span>{dbCharacters.length} published characters</span></div>
      <div className="editor-toolbar"><select value={selectedCharacter} onChange={e=>{const c=dbCharacters.find(x=>x.id===e.target.value);setSelectedCharacter(e.target.value);setCharForm({...emptyCharacter(),...(c||{id:e.target.value})});}}><option value="">Choose character…</option>{dbCharacters.map(c=><option key={c.id} value={c.id}>{c.name} · {c.rarity}</option>)}</select><button className="secondary" onClick={createCharacter}>+ NEW CHARACTER</button></div>
      <form className="admin-form-grid" onSubmit={dbCharacters.some(c=>c.id===charForm.id)?saveCharacter:insertCharacter}>
        <label>Character ID<input value={charForm.id} onChange={e=>setCharForm(v=>({...v,id:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')}))} required pattern="[a-z0-9-]+" /></label>
        <label>Name<input value={charForm.name} onChange={e=>setCharForm(v=>({...v,name:e.target.value}))} required /></label>
        <label>Anime / verse<input value={charForm.anime} onChange={e=>setCharForm(v=>({...v,anime:e.target.value}))} required /></label>
        <label>Rarity<select value={charForm.rarity} onChange={e=>setCharForm(v=>({...v,rarity:e.target.value}))}>{RARITIES.map(r=><option key={r}>{r}</option>)}</select></label>
        <label>Deploy cost<input type="number" min="0" value={charForm.cost} onChange={e=>setCharForm(v=>({...v,cost:e.target.value}))} /></label>
        <label>Base damage<input type="number" min="0" step="0.1" value={charForm.role==='money'?0:charForm.base_damage} disabled={charForm.role==='money'} onChange={e=>setCharForm(v=>({...v,base_damage:e.target.value}))} /></label>
        <label>Range<input type="number" min="0" step="0.1" value={charForm.role==='money'?0:charForm.range} disabled={charForm.role==='money'} onChange={e=>setCharForm(v=>({...v,range:e.target.value}))} /></label>
        <label>SPA interval (ms)<input type="number" min="0" value={charForm.role==='money'?0:charForm.attack_speed} disabled={charForm.role==='money'} onChange={e=>setCharForm(v=>({...v,attack_speed:e.target.value}))} /></label>
        <label>Role<select value={charForm.role} onChange={e=>setCharForm(v=>({...v,role:e.target.value}))}><option value="attack">Attack</option><option value="money">Money / income only</option><option value="support">Support / buff</option></select></label>
        <label>Income per wave<input type="number" min="0" value={charForm.income_per_wave} onChange={e=>setCharForm(v=>({...v,income_per_wave:e.target.value}))} disabled={charForm.role!=='money'} /></label>
        <label>Support buff (decimal)<input type="number" min="0" max="3" step="0.01" value={charForm.buff_percent} onChange={e=>setCharForm(v=>({...v,buff_percent:e.target.value}))} disabled={charForm.role!=='support'} /></label>
        <label className="span-2">Abilities (comma separated)<input value={Array.isArray(charForm.abilities)?charForm.abilities.join(', '):charForm.abilities||''} onChange={e=>setCharForm(v=>({...v,abilities:e.target.value}))} /></label>
        <label className="span-2">Artwork URL<input value={charForm.art_url||''} onChange={e=>setCharForm(v=>({...v,art_url:e.target.value}))} placeholder="Upload below or paste a public URL" /></label>
        <label className="file-upload-field span-2">Upload character image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={e=>artUpload(e.target.files?.[0],'character')} disabled={uploading||!charForm.id} /><small>Images are publicly viewable for the game; only admins can upload or change them. Save the character after upload.</small></label>
        <label className="check-field span-2"><input type="checkbox" checked={Boolean(charForm.enabled)} onChange={e=>setCharForm(v=>({...v,enabled:e.target.checked}))}/> Character is enabled in the game</label>
        {charForm.art_url && <div className="art-preview span-2"><img src={charForm.art_url} alt="Character preview"/><span>Image preview</span></div>}
        <button className="primary span-2" disabled={busy||uploading}>{busy?'SAVING…':dbCharacters.some(c=>c.id===charForm.id)?'SAVE CHARACTER':'ADD CHARACTER'}</button>
      </form>
    </section>}
    {tab==='enemies' && <section className="panel admin-section">
      <div className="section-head"><div><div className="eyebrow">ENEMY DATABASE</div><h2>Enemy and boss stats</h2></div><span>{dbEnemies.length} enemy profiles</span></div>
      <div className="editor-toolbar"><select value={selectedEnemy} onChange={e=>{const en=dbEnemies.find(x=>x.id===e.target.value);setSelectedEnemy(e.target.value);setEnemyForm(en?{...en}:{id:e.target.value,name:e.target.value,hp:78,hp_per_wave:0,speed:.03,base_damage:34,armor:0,shield:0,regen:0,art_url:'',enabled:true});}}><option value="">Choose enemy…</option>{dbEnemies.map(en=><option key={en.id} value={en.id}>{en.name}{en.id.startsWith('boss-')?' · BOSS':''}</option>)}</select></div>
      <form className="admin-form-grid" onSubmit={saveEnemy}>
        <label>Enemy ID<input value={enemyForm.id} disabled /></label><label>Name<input value={enemyForm.name} onChange={e=>setEnemyForm(v=>({...v,name:e.target.value}))} required /></label>
        <label>Base HP<input type="number" min="0" step="1" value={enemyForm.hp} onChange={e=>setEnemyForm(v=>({...v,hp:e.target.value}))} /></label>
        <label>HP added per wave (boss)<input type="number" min="0" value={enemyForm.hp_per_wave} onChange={e=>setEnemyForm(v=>({...v,hp_per_wave:e.target.value}))} /></label>
        <label>Speed<input type="number" min="0" step="0.001" value={enemyForm.speed} onChange={e=>setEnemyForm(v=>({...v,speed:e.target.value}))} /></label>
        <label>Core damage<input type="number" min="0" value={enemyForm.base_damage} onChange={e=>setEnemyForm(v=>({...v,base_damage:e.target.value}))} /></label>
        <label>Armour (0–0.95)<input type="number" min="0" max="0.95" step="0.01" value={enemyForm.armor} onChange={e=>setEnemyForm(v=>({...v,armor:e.target.value}))} /></label>
        <label>Shield HP<input type="number" min="0" value={enemyForm.shield} onChange={e=>setEnemyForm(v=>({...v,shield:e.target.value}))} /></label>
        <label>HP regeneration<input type="number" min="0" step="0.1" value={enemyForm.regen} onChange={e=>setEnemyForm(v=>({...v,regen:e.target.value}))} /></label>
        <label className="span-2">Artwork URL<input value={enemyForm.art_url||''} onChange={e=>setEnemyForm(v=>({...v,art_url:e.target.value}))} placeholder="Upload below or paste a public URL" /></label>
        <label className="file-upload-field span-2">Upload enemy/boss image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={e=>artUpload(e.target.files?.[0],'enemy')} disabled={uploading||!enemyForm.id} /><small>Upload using this row's enemy ID, then click Save.</small></label>
        <label className="check-field span-2"><input type="checkbox" checked={Boolean(enemyForm.enabled)} onChange={e=>setEnemyForm(v=>({...v,enabled:e.target.checked}))}/> Enemy is enabled</label>
        {enemyForm.art_url && <div className="art-preview span-2"><img src={enemyForm.art_url} alt="Enemy preview"/><span>Image preview</span></div>}
        <button className="primary span-2" disabled={busy||uploading||!enemyForm.id}>SAVE ENEMY / BOSS</button>
      </form>
    </section>}
    <section className="panel admin-log-note"><div className="eyebrow">SECURITY NOTE</div><p>For the first setup, sign up with your own email, then use Supabase SQL Editor once to change your profile role to <code>admin</code>. The browser signup form cannot grant itself admin access. Never place the Supabase service-role key in frontend code.</p></section>
  </main>;
}
