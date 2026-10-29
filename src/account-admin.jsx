import React, { useEffect, useMemo, useState } from 'react';
import { isBackendConfigured, signIn, signUp, signOut, getProfile, rpc, tableRequest, uploadGameArt, requestPasswordReset, updatePassword, resendSignupConfirmation, requestEmailCode, verifyEmailCode, signInWithGoogle, getPendingAuthCallbackType, clearPendingAuthCallbackType } from './backend.js';
import { DEFAULT_COMBAT_BALANCE } from './game-config.js';

const RARITIES = ['Common','Uncommon','Rare','Epic','Legendary','Mythic'];
const RARITY_COLORS = {Common:'#9da5b5',Uncommon:'#58d39a',Rare:'#53c9ff',Epic:'#a879ff',Legendary:'#ffbf5e',Mythic:'#ff6588'};
const emptyCharacter = () => ({id:'',name:'',anime:'Naruto',rarity:'Common',cost:180,base_damage:22,range:110,attack_speed:680,role:'attack',income_per_wave:0,buff_percent:0,abilities:[],art_url:'',enabled:true});
const MAX_LEVEL = {Common:3,Uncommon:3,Rare:5,Epic:6,Legendary:7,Mythic:9};
const rarityIndex = rarity => ['Common','Uncommon','Rare','Epic','Legendary','Mythic'].indexOf(rarity);
const levelLabel = level => level===1?'Base':`Upgrade ${level-1}`;
const clone = value => JSON.parse(JSON.stringify(value));
const makeCombatDefaults = () => clone(DEFAULT_COMBAT_BALANCE);
function normalizedChar(c) { return c ? {...c,baseDamage:Number(c.baseDamage ?? c.base_damage ?? 22),range:Number(c.range ?? 110),attackSpeed:Number(c.attackSpeed ?? c.attack_speed ?? 680),incomePerWave:Number(c.incomePerWave ?? c.income_per_wave ?? 0),buffPercent:Number(c.buffPercent ?? c.buff_percent ?? 0),abilities:Array.isArray(c.abilities)?c.abilities:[]} : null; }
function defaultLevelRows(c, gameBalance) {
  if (!c) return []; const max=MAX_LEVEL[c.rarity]||1, rank=Math.max(0,rarityIndex(c.rarity));
  return Array.from({length:max},(_,i)=>{const level=i+1,step=i;let damage=c.baseDamage;for(let n=0;n<step;n++)damage=Math.round(damage*1.3);return {level,damage:c.role==='money'?0:damage,range:c.role==='money'?0:Math.max(11,c.range/12)+.9*step,attackSpeed:c.role==='money'?0:Math.max(220,c.attackSpeed-38*step),income:c.role==='money'?Math.round(c.incomePerWave*(1+step*Number(gameBalance?.incomeUpgradeMultiplier??.25))):0,buffPercent:c.role==='support'?Number(c.buffPercent||.13)*(1+step*.1):0,upgradeCost:level===1?0:Math.round(90+(level-1)*55+rank*25)};});
}
function defaultMoves(c) { return (c?.abilities||[]).slice(0,3).map((name,i)=>({name,unlockLevel:[2,4,6][i]||2,damageMultiplier:[1.5,2.1,2.8][i]||1.5,cooldownSeconds:[6,10,15][i]||6,splashRadius:[0,1.3,2.6][i]||0})); }
function defaultWaveStatsForConfig(enemy,wave,config,gameBalance) { const saved=config?.enemyWaves?.[enemy?.id]?.[String(wave)]; if(saved) return {...saved}; const boss=String(enemy?.id||'').startsWith('boss-'); return {hp:boss?Number(enemy.hp||0)+Number(wave)*Number(enemy.hp_per_wave||0):Number(enemy?.hp||78)*(1+Number(wave)*Number(gameBalance?.enemyHealthPerWave??.065)),speed:Number(enemy?.speed||.03)*(1+Number(wave)*.01),damage:Number(enemy?.base_damage||34),armor:Number(enemy?.armor||0),shield:Number(enemy?.shield||0),regen:Number(enemy?.regen||0)}; }
const asArray = value => Array.isArray(value) ? value : [];
const errText = e => e?.message || String(e);

export function AccountPage({ session, profile, accountLoading, onAuthenticated, onSignedOut, onSaveUpdated, currentSave, localSaveBackup, saveImported, requiredGate = false }) {
  const [mode,setMode] = useState('login');
  const [username,setUsername] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [newPassword,setNewPassword] = useState('');
  const [emailCode,setEmailCode] = useState('');
  const [codeRequested,setCodeRequested] = useState(false);
  const [passwordRecovery,setPasswordRecovery] = useState(() => getPendingAuthCallbackType()==='recovery');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [canResendConfirmation,setCanResendConfirmation] = useState(false);
  const [importBusy,setImportBusy] = useState(false);
  const [importMessage,setImportMessage] = useState('');
  const [showImport,setShowImport] = useState(false);

  const clearFeedback = () => { setMessage(''); setError(''); };
  const changeMode = next => { setMode(next); setCodeRequested(false); setEmailCode(''); setPassword(''); clearFeedback(); setCanResendConfirmation(false); };

  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (passwordRecovery) {
        if (!session?.access_token) throw new Error('This password-reset link is missing or expired. Request a new reset email and open the newest link.');
        if (newPassword.length < 8) throw new Error('Use at least 8 characters for your new password.');
        await updatePassword(session,newPassword);
        clearPendingAuthCallbackType();
        setPasswordRecovery(false); setMode('login'); setPassword(''); setNewPassword('');
        await onSignedOut();
        setMessage('Password updated. Please sign in with your new password.');
      } else if (mode==='reset') {
        if (!email.trim()) throw new Error('Enter the email address used for your account.');
        await requestPasswordReset(email.trim());
        setMessage('If an account exists for that email, a password-reset email has been sent. Check your inbox and spam folder.');
      } else if (mode==='code' && !codeRequested) {
        if (!email.trim()) throw new Error('Enter the email address used for your account.');
        await requestEmailCode(email.trim());
        setCodeRequested(true);
        setMessage('A sign-in code has been requested. Check your email, then enter the code below. Your Supabase email template must display the one-time token.');
      } else if (mode==='code' && codeRequested) {
        if (!emailCode.trim()) throw new Error('Enter the code from your email.');
        const result = await verifyEmailCode(email.trim(),emailCode.trim());
        await onAuthenticated(result);
      } else if (mode==='signup') {
        const cleanEmail=email.trim().toLowerCase();
        const result = await signUp(cleanEmail,password,username.trim());
        if (result?.access_token) {
          await onAuthenticated(result,{isNewAccount:true});
          setMessage('Account created and signed in.');
        } else {
          try { localStorage.setItem('shonen-siege-pending-local-save-import-v1','1'); } catch {}
          setMessage('Account created. Check your email and confirm your account before signing in. The confirmation link should return to Shonen Siege, not localhost.');
          setCanResendConfirmation(true);
          setMode('login');
        }
      } else {
        const result = await signIn(email.trim().toLowerCase(),password);
        await onAuthenticated(result);
      }
    } catch (e2) { setError(errText(e2)); }
    finally { setBusy(false); }
  };

  const startGoogle = () => {
    setError(''); setMessage('');
    try { signInWithGoogle(); } catch (e) { setError(errText(e)); }
  };
  const resendConfirmation = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await resendSignupConfirmation(email.trim().toLowerCase()); setMessage('If this account still needs confirmation, a new verification email has been sent. Open the newest email link.'); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };
  const importLegacySave = async () => {
    if (!session?.access_token || !localSaveBackup) return;
    const ok = window.confirm('Import this browser\'s older save into your account? This is a one-time import and can replace the current cloud save for this account. Continue only if this device contains your old progress.');
    if (!ok) return;
    setImportBusy(true); setImportMessage('');
    try {
      const result=await rpc(session,'import_my_local_save',{p_save:localSaveBackup});
      onSaveUpdated(result); setImportMessage('Your old browser save has been imported into this account.');
      try { localStorage.removeItem('shonen-siege-pending-local-save-import-v1'); } catch {}
      setShowImport(false);
    } catch(e) { setImportMessage(`Import failed: ${errText(e)}. Check that the player save-import migration has been run in Supabase.`); }
    finally { setImportBusy(false); }
  };

  if (!isBackendConfigured()) return <main className="page account-page">
    <div className="page-head"><div><div className="eyebrow">PLAYER ID</div><h1>Account setup</h1><p>Secure accounts are not available until the Supabase connection is configured.</p></div></div>
    <section className="panel setup-panel"><h2>Account service unavailable</h2><p className="muted">Please contact the game owner. Do not enter your password on an unconfigured account page.</p></section>
  </main>;
  if (accountLoading) return <main className="page"><section className="panel"><p>Checking your secure account session…</p></section></main>;

  // A recovery link deliberately takes priority over the ordinary signed-in profile view.
  if (passwordRecovery) return <main className="page account-page">
    <div className="page-head"><div><div className="eyebrow">ACCOUNT SECURITY</div><h1>Choose a new password</h1><p>Use a unique password you do not use on other websites.</p></div></div>
    <section className="panel auth-panel"><form onSubmit={submit} className="auth-form">
      <label>New password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" /></label>
      <label>Confirm new password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete="new-password" placeholder="Enter it again" /></label>
      <button className="primary" disabled={busy||newPassword!==password}>{busy?'UPDATING…':'UPDATE PASSWORD'}</button>
    </form>
    {message&&<p className="inline-success">{message}</p>}{error&&<p className="inline-error">{error}</p>}
    <div className="auth-links"><button type="button" className="text-action" onClick={()=>{clearPendingAuthCallbackType();setPasswordRecovery(false);changeMode('reset');}}>Request a fresh reset email</button><button type="button" className="text-action" onClick={()=>{clearPendingAuthCallbackType();setPasswordRecovery(false);changeMode('login');}}>Back to sign in</button></div>
    <p className="muted auth-note">For safety, only use a recent reset email. Older links may expire after you request a new one.</p></section>
  </main>;

  if (session && profile) return <main className="page account-page">
    <div className="page-head"><div><div className="eyebrow">PLAYER ID</div><h1>Your Account</h1><p>Your game progress is tied to this signed-in account.</p></div><span className={`account-role ${profile.role==='admin'?'is-admin':''}`}>{profile.role==='admin'?'OWNER / ADMIN':'PLAYER'}</span></div>
    <section className="panel account-profile">
      <div className="account-avatar">{(profile.username||profile.email||'P').slice(0,1).toUpperCase()}</div>
      <div className="account-profile-main"><h2>{profile.username || 'Player'}</h2><p>{profile.email}</p>
        <div className={`account-verification ${profile.auth_email_confirmed_at?'verified':'unverified'}`}><span>{profile.auth_email_confirmed_at?'✓ Email verified':'! Email not verified'}</span>{!profile.auth_email_confirmed_at&&<button className="text-action" type="button" disabled={busy} onClick={resendConfirmation}>Resend verification email</button>}</div>
        <div className="account-stats"><span>💎 <b>{Number(currentSave?.gems ?? 0).toLocaleString()}</b> gems</span><span>🏆 <b>{Number(currentSave?.waveBest ?? 0)}</b> best wave</span><span>🎴 <b>{Object.values(currentSave?.owned || {}).filter(n=>Number(n)>0).length}</b> owned unit types</span></div>
      </div>
      <button className="secondary" onClick={onSignedOut}>SIGN OUT</button>
    </section>
    {message&&<p className="inline-success">{message}</p>}{error&&<p className="inline-error">{error}</p>}
    {!saveImported && <section className="panel import-save-panel"><div className="eyebrow">OLD DEVICE SAVE</div><h2>Keep your previous progress</h2><p className="muted">If you played before accounts were introduced, your old progress may still be saved in this browser. Import only from the device that holds that progress. This is a one-time import and replaces this account's cloud save with that local snapshot.</p><button className="secondary" disabled={importBusy||!localSaveBackup} onClick={()=>setShowImport(v=>!v)}>{showImport?'CANCEL':'CHECK FOR OLD SAVE'}</button>{showImport&&<button className="primary" disabled={importBusy||!localSaveBackup} onClick={importLegacySave}>{importBusy?'IMPORTING…':'IMPORT THIS DEVICE SAVE'}</button>}{importMessage&&<p className={importMessage.startsWith('Import failed')?'inline-error':'inline-success'}>{importMessage}</p>}</section>}
    {profile.role==='admin' && <section className="panel admin-access-card"><div><div className="eyebrow">PRIVILEGED ACCESS</div><h2>Admin Dashboard enabled</h2><p>Manage players, characters, enemy settings and artwork. Admin permissions are checked by Supabase.</p></div><span className="admin-lock">🔐</span></section>}
    <section className="panel account-security-note"><h2>Protect your account</h2><p>Use a unique password and keep access to your email inbox. Google sign-in and email one-time-code sign-in are available from the sign-in screen. Full two-factor authentication is not enabled by this update yet.</p></section>
  </main>;

  const formTitle = mode==='signup' ? 'Create your account' : mode==='reset' ? 'Reset your password' : mode==='code' ? 'Sign in with a code' : 'Sign in';
  const formIntro = requiredGate ? 'Create an account or sign in before playing. Your previous browser save can be imported after you sign in.' : 'Use your account to access saved progress and cloud features.';
  return <main className="page account-page">
    <div className="page-head"><div><div className="eyebrow">PLAYER ID</div><h1>{formTitle}</h1><p>{formIntro}</p></div></div>
    <section className="panel auth-panel">
      {!['reset','code'].includes(mode) && <div className="auth-tabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>changeMode('login')}>SIGN IN</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>changeMode('signup')}>CREATE ACCOUNT</button></div>}
      <form onSubmit={submit} className="auth-form">
        {mode==='signup' && <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} minLength={2} maxLength={24} required placeholder="Your player name" autoComplete="nickname" /></label>}
        {!(mode==='reset' && passwordRecovery) && <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>}
        {mode==='login' || mode==='signup' ? <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="At least 8 characters" /></label> : null}
        {mode==='code' && codeRequested && <label>Email sign-in code<input inputMode="numeric" autoComplete="one-time-code" value={emailCode} onChange={e=>setEmailCode(e.target.value)} required minLength={6} maxLength={12} placeholder="Enter the code from your email" /></label>}
        {mode==='reset' && <p className="muted">Enter your account email. For privacy, this page does not reveal whether that email has an account.</p>}
        <button className="primary" disabled={busy}>{busy?'PLEASE WAIT…':mode==='signup'?'CREATE ACCOUNT':mode==='reset'?'SEND RESET EMAIL':mode==='code'?(codeRequested?'VERIFY CODE':'SEND SIGN-IN CODE'):'SIGN IN'}</button>
      </form>
      {mode==='login' && <div className="auth-links"><button type="button" className="text-action" onClick={()=>changeMode('reset')}>Forgot password?</button><button type="button" className="text-action" onClick={()=>changeMode('code')}>Sign in with an email code</button></div>}
      {mode==='reset' && <div className="auth-links"><button type="button" className="text-action" onClick={()=>changeMode('login')}>Back to sign in</button></div>}
      {mode==='code' && <div className="auth-links"><button type="button" className="text-action" onClick={()=>changeMode('login')}>Back to password sign in</button>{codeRequested&&<button type="button" className="text-action" disabled={busy} onClick={async()=>{setBusy(true);setError('');setMessage('');try{await requestEmailCode(email.trim());setMessage('A new code has been requested. Use the newest email.');}catch(e){setError(errText(e));}finally{setBusy(false);}}}>Send a new code</button>}</div>}
      <div className="auth-divider"><span>OR</span></div>
      <button type="button" className="google-signin" disabled={busy} onClick={startGoogle}><span className="google-g">G</span> Continue with Google</button>
      {canResendConfirmation && <button type="button" className="secondary resend-confirm" disabled={busy} onClick={resendConfirmation}>RESEND VERIFICATION EMAIL</button>}
      {message&&<p className="inline-success">{message}</p>}{error&&<p className="inline-error">{error}</p>}
      <p className="muted auth-note">Never share your password or sign-in code. Shonen Siege staff will never ask you to send either. Email-code sign-in requires the game owner to configure the email template to display the one-time token.</p>
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
  const [combatConfig,setCombatConfig] = useState(makeCombatDefaults);
  const [balanceCharacterId,setBalanceCharacterId] = useState('');
  const [selectedWave,setSelectedWave] = useState(1);
  const [waveDraft,setWaveDraft] = useState({hp:78,speed:.032,damage:34,armor:0,shield:0,regen:0});
  const [enemyMetaForm,setEnemyMetaForm] = useState({movementType:'ground',minUnitLevel:1,spawnFromWave:1,spawnUntilWave:'',spawnChance:10,customSpawn:true,characterId:''});
  const [sourceCharacterId,setSourceCharacterId] = useState('naruto');
  const [isNewEnemy,setIsNewEnemy] = useState(false);
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
      const [p,s,c,en,settings] = await Promise.all([
        tableRequest(session,'profiles','select=id,email,username,role,created_at&order=created_at.desc'),
        tableRequest(session,'player_saves','select=user_id,gems,wave_best,unlocked_slots,owned&order=updated_at.desc'),
        tableRequest(session,'game_characters','select=*&order=name.asc'),
        tableRequest(session,'game_enemies','select=*&order=id.asc'),
        tableRequest(session,'game_settings','select=key,value'),
      ]);
      const savedCombat=asArray(settings).find(row=>row.key==='combat_balance')?.value;
      const loadedCombat=makeCombatDefaults();
      if (savedCombat && typeof savedCombat==='object') {
        loadedCombat.characters={...loadedCombat.characters,...(savedCombat.characters||{})};
        loadedCombat.enemyWaves={...loadedCombat.enemyWaves,...(savedCombat.enemyWaves||{})};
        loadedCombat.enemyMeta={...loadedCombat.enemyMeta,...(savedCombat.enemyMeta||{})};
        loadedCombat.version=savedCombat.version||1;
      }
      setCombatConfig(loadedCombat);
      setPlayers(asArray(p)); setSaves(asArray(s)); setDbCharacters(asArray(c)); setDbEnemies(asArray(en));
      if (!balanceCharacterId && asArray(c).length) setBalanceCharacterId(asArray(c)[0].id);
      if (!selectedEnemy && asArray(en).length) setSelectedEnemy(asArray(en)[0].id);
      const loadedEnemy=asArray(en).find(x=>x.id===selectedEnemy) || asArray(en)[0];
      if (loadedEnemy) {
        const loadedMeta = loadedCombat.enemyMeta[loadedEnemy.id] || {};
        setEnemyMetaForm({movementType:'ground',minUnitLevel:1,spawnFromWave:1,spawnUntilWave:'',customSpawn:false,characterId:'',...loadedMeta,spawnChance:Math.round(Number(loadedMeta.spawnChance ?? 0.1)*100)});
        const w=loadedCombat.enemyWaves[loadedEnemy.id]?.[String(selectedWave)];
        setWaveDraft(w || {hp:Number(loadedEnemy.hp||78)*(1+selectedWave*Number(gameBalance?.enemyHealthPerWave??.065)),speed:Number(loadedEnemy.speed||.03)*(1+selectedWave*.01),damage:Number(loadedEnemy.base_damage||34),armor:Number(loadedEnemy.armor||0),shield:Number(loadedEnemy.shield||0),regen:Number(loadedEnemy.regen||0)});
      }
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
  const balanceCharacters = (dbCharacters.length ? dbCharacters : characters).map(normalizedChar);
  const balanceCharacter = normalizedChar(balanceCharacters.find(c=>c?.id===balanceCharacterId) || balanceCharacters[0]);
  const charBalanceEntry = balanceCharacter ? (combatConfig.characters?.[balanceCharacter.id] || {}) : {};
  const levelRows = balanceCharacter ? defaultLevelRows(balanceCharacter,gameBalance).map(row=>{const saved=Array.isArray(charBalanceEntry.levels)?charBalanceEntry.levels.find(x=>Number(x.level)===row.level):charBalanceEntry.levels?.[String(row.level)];return {...row,...(saved||{}),level:row.level};}) : [];
  const moveRows = balanceCharacter ? (Array.isArray(charBalanceEntry.moves)?charBalanceEntry.moves:defaultMoves(balanceCharacter)) : [];
  const selectedEnemyWaveOverrides = combatConfig.enemyWaves?.[selectedEnemy] || {};
  const allEnemyTypes = dbEnemies.filter(row=>row.enabled!==false);
  const defaultWaveStats = (enemy,wave) => { const saved=combatConfig.enemyWaves?.[enemy?.id]?.[String(wave)]; if(saved) return {...saved}; const boss=String(enemy?.id||'').startsWith('boss-'); return {hp:boss?Number(enemy.hp||0)+Number(wave)*Number(enemy.hp_per_wave||0):Number(enemy?.hp||78)*(1+Number(wave)*Number(gameBalance?.enemyHealthPerWave??.065)),speed:Number(enemy?.speed||.03)*(1+Number(wave)*.01),damage:Number(enemy?.base_damage||34),armor:Number(enemy?.armor||0),shield:Number(enemy?.shield||0),regen:Number(enemy?.regen||0)}; };
  const persistCombatConfig = async (nextConfig, successMessage='Balancing settings saved and published.') => {
    await tableRequest(session,'game_settings','on_conflict=key',{method:'POST',body:[{key:'combat_balance',value:nextConfig}],prefer:'resolution=merge-duplicates,return=minimal'});
    setCombatConfig(nextConfig); await onConfigChanged(); if(successMessage) notify(successMessage);
  };
  const updateLevelField = (level,field,value) => { if(!balanceCharacter) return; const raw=Number(value); let numeric=Number.isFinite(raw)?raw:0; if(field==='buffPercent') numeric=Math.max(0,Math.min(3,numeric)/100); else if(field==='damage') numeric=Math.max(0,Math.min(10000000,numeric)); else if(field==='range') numeric=Math.max(0,Math.min(100,numeric)); else if(field==='attackSpeed') numeric=Math.max(220,Math.min(10000,numeric)); else if(field==='upgradeCost'||field==='income') numeric=Math.max(0,Math.min(100000000,numeric)); const rows=levelRows.map(row=>row.level===level?{...row,[field]:numeric}:row); setCombatConfig(prev=>({...prev,characters:{...(prev.characters||{}),[balanceCharacter.id]:{...(prev.characters?.[balanceCharacter.id]||{}),levels:rows}}})); };
  const updateMoveField = (index,field,value) => { if(!balanceCharacter) return; const maxLevel=MAX_LEVEL[balanceCharacter.rarity]||9; let converted=field==='name'?value:Number(value); if(field==='unlockLevel') converted=Math.max(2,Math.min(maxLevel,Number(value)||2)); if(field==='damageMultiplier') converted=Math.max(.1,Math.min(100,Number.isFinite(Number(value))?Number(value):1)); if(field==='cooldownSeconds') converted=Math.max(0,Math.min(120,Number(value)||0)); if(field==='splashRadius') converted=Math.max(0,Math.min(20,Number(value)||0)); const nextMoves=moveRows.map((move,i)=>i===index?{...move,[field]:converted}:move); setCombatConfig(prev=>({...prev,characters:{...(prev.characters||{}),[balanceCharacter.id]:{...(prev.characters?.[balanceCharacter.id]||{}),moves:nextMoves}}})); };
  const loadEnemyForm = (enemyId, rows=dbEnemies, config=combatConfig) => { const row=rows.find(x=>x.id===enemyId); if(!row) return; setSelectedEnemy(enemyId); setEnemyForm({...row}); const meta=config.enemyMeta?.[enemyId]||{}; setEnemyMetaForm({movementType:'ground',minUnitLevel:1,spawnFromWave:1,spawnUntilWave:'',customSpawn:false,characterId:'',...meta,spawnChance:Math.round(Number(meta.spawnChance??0.1)*100)}); setWaveDraft(defaultWaveStatsForConfig(row,selectedWave,config,gameBalance)); };

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
        rows.push({id,name:({normal:'Normal',fast:'Fast',tank:'Tank',regen:'Regenerator',shield:'Shielded',armored:'Armoured',flying:'Flyer','strong-1':'Strong Enemy 1','strong-2':'Strong Enemy 2'})[id]||id.charAt(0).toUpperCase()+id.slice(1),hp:Number(v.hp||0),hp_per_wave:0,speed:Number(v.speed||0),base_damage:Number(v.damage||34),armor:Number(v.armor||0),shield:Number(v.shield||0),regen:Number(v.regen||0),art_url:existingEnemiesById[id]?.art_url||null,enabled:existingEnemiesById[id]?.enabled ?? true});
      }
      for (const b of (enemyBalance.bosses||[])) { const id=`boss-${String(b.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`; rows.push({id,name:b.name,hp:Number(b.hp||0),hp_per_wave:Number(b.hpPerWave||0),speed:Number(b.speed||0),base_damage:Number(b.damage||100),armor:Number(b.armor||0),shield:Number(b.shield||0),regen:Number(b.regen||0),art_url:existingEnemiesById[id]?.art_url||null,enabled:existingEnemiesById[id]?.enabled ?? true}); }
      await tableRequest(session,'game_characters','on_conflict=id',{method:'POST',body:charRows,prefer:'resolution=merge-duplicates,return=minimal'});
      await tableRequest(session,'game_enemies','on_conflict=id',{method:'POST',body:rows,prefer:'resolution=merge-duplicates,return=minimal'});
      await tableRequest(session,'game_settings','on_conflict=key',{method:'POST',body:[{key:'game_balance',value:gameBalance},{key:'combat_balance',value:combatConfig}],prefer:'resolution=merge-duplicates,return=minimal'});
      await load(); await onConfigChanged(); notify('Default roster, flying enemies, strong enemies and balance settings published.');
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
      if (!/^[a-z0-9-]+$/.test(String(enemyForm.id||''))) throw new Error('Enemy ID must use lowercase letters, numbers and hyphens only.');
      const characterSource=balanceCharacters.find(c=>c.id===enemyMetaForm.characterId) || dbCharacters.find(c=>c.id===enemyMetaForm.characterId);
      const row={id:enemyForm.id,name:enemyForm.name,hp:Number(enemyForm.hp),hp_per_wave:Number(enemyForm.hp_per_wave||0),speed:Number(enemyForm.speed),base_damage:Number(enemyForm.base_damage),armor:Number(enemyForm.armor||0),shield:Number(enemyForm.shield||0),regen:Number(enemyForm.regen||0),art_url:enemyForm.art_url||characterSource?.art_url||null,enabled:Boolean(enemyForm.enabled)};
      const exists=dbEnemies.some(x=>x.id===row.id);
      await tableRequest(session,'game_enemies',exists?`id=eq.${encodeURIComponent(row.id)}`:'',{method:exists?'PATCH':'POST',body:row,prefer:'return=minimal'});
      const priorMeta=combatConfig.enemyMeta?.[row.id]||{};
      const meta={...priorMeta,movementType:enemyMetaForm.movementType||'ground',minUnitLevel:Math.max(1,Number(enemyMetaForm.minUnitLevel||1)),spawnFromWave:Math.max(1,Number(enemyMetaForm.spawnFromWave||1)),spawnUntilWave:enemyMetaForm.spawnUntilWave===''?null:Math.max(1,Number(enemyMetaForm.spawnUntilWave)),spawnChance:Math.max(0,Math.min(1,Number(enemyMetaForm.spawnChance||0)/100)),customSpawn:Boolean(enemyMetaForm.customSpawn),characterId:enemyMetaForm.characterId||null};
      const next={...combatConfig,enemyMeta:{...(combatConfig.enemyMeta||{}),[row.id]:meta}};
      await tableRequest(session,'game_settings','on_conflict=key',{method:'POST',body:[{key:'combat_balance',value:next}],prefer:'resolution=merge-duplicates,return=minimal'});
      setCombatConfig(next); setIsNewEnemy(false); await load(); await onConfigChanged(); notify(`${row.name} saved. Refresh the game to test the new enemy behaviour.`);
    } catch(e2) { notify(`Enemy save failed: ${errText(e2)}`); }
    finally { setBusy(false); }
  };
  const createEnemyDraft = () => {
    const id=`new-enemy-${Date.now().toString(36)}`; setIsNewEnemy(true); setSelectedEnemy(id); setEnemyForm({id,name:'New Enemy',hp:180,hp_per_wave:0,speed:.026,base_damage:34,armor:0,shield:0,regen:0,art_url:'',enabled:true}); setEnemyMetaForm({movementType:'ground',minUnitLevel:1,spawnFromWave:1,spawnUntilWave:'',spawnChance:10,customSpawn:true,characterId:''}); setWaveDraft({hp:180,speed:.026,damage:34,armor:0,shield:0,regen:0});
  };
  const createCharacterEnemy = () => {
    const c=balanceCharacters.find(x=>x.id===sourceCharacterId); if(!c) return notify('Choose a character first.');
    const id=`char-enemy-${c.id}`; if(dbEnemies.some(x=>x.id===id)) { loadEnemyForm(id); setTab('enemies'); return notify('That character already has an enemy version.'); }
    setIsNewEnemy(true); setSelectedEnemy(id); setEnemyForm({id,name:c.name,hp:Math.max(200,Math.round(Number(c.baseDamage||30)*20)),hp_per_wave:0,speed:.023,base_damage:34,armor:.1,shield:0,regen:0,art_url:c.art_url||'',enabled:true}); setEnemyMetaForm({movementType:'ground',minUnitLevel:1,spawnFromWave:10,spawnUntilWave:'',spawnChance:8,customSpawn:true,characterId:c.id}); setWaveDraft({hp:Math.max(200,Math.round(Number(c.baseDamage||30)*20)),speed:.023,damage:34,armor:.1,shield:0,regen:0}); setTab('enemies'); notify(`${c.name} is ready as an enemy. Review stats and save it.`);
  };
  const saveCharacterBalance = async () => {
    if(!balanceCharacter) return notify('Choose a character.'); setBusy(true);
    try { await persistCombatConfig(combatConfig,`${balanceCharacter.name} upgrade levels and moves saved.`); }
    catch(e) { notify(`Balancing save failed: ${errText(e)}`); }
    finally { setBusy(false); }
  };
  const resetCharacterBalance = () => {
    if(!balanceCharacter) return;
    setCombatConfig(prev=>{const next={...prev,characters:{...(prev.characters||{})}}; delete next.characters[balanceCharacter.id]; return next;});
    notify('Defaults loaded in the editor. Click SAVE BALANCE to publish the reset.');
  };
  const addWaveOverride = async () => {
    if(!selectedDbEnemy) return notify('Select and save an enemy first.'); setBusy(true);
    try { const override={hp:Math.max(1,Number(waveDraft.hp)),speed:Math.max(0,Number(waveDraft.speed)),damage:Math.max(0,Number(waveDraft.damage)),armor:Math.max(0,Math.min(.95,Number(waveDraft.armor))),shield:Math.max(0,Number(waveDraft.shield)),regen:Math.max(0,Number(waveDraft.regen))}; const next={...combatConfig,enemyWaves:{...(combatConfig.enemyWaves||{}),[selectedEnemy]:{...(combatConfig.enemyWaves?.[selectedEnemy]||{}),[String(selectedWave)]:override}}}; await persistCombatConfig(next,`Wave ${selectedWave} stats saved for ${enemyForm.name}.`); }
    catch(e) { notify(`Wave override failed: ${errText(e)}`); }
    finally { setBusy(false); }
  };
  const removeWaveOverride = async wave => {
    if(!selectedEnemy) return; setBusy(true);
    try { const waves={...(combatConfig.enemyWaves?.[selectedEnemy]||{})}; delete waves[String(wave)]; const all={...(combatConfig.enemyWaves||{})}; if(Object.keys(waves).length) all[selectedEnemy]=waves; else delete all[selectedEnemy]; const next={...combatConfig,enemyWaves:all}; await persistCombatConfig(next,`Wave ${wave} override removed.`); setWaveDraft(defaultWaveStatsForConfig(selectedDbEnemy,selectedWave,next,gameBalance)); }
    catch(e) { notify(`Could not remove override: ${errText(e)}`); }
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
      { [['players','Players & Gems'],['characters','Characters & Art'],['balancing','Upgrade & Move Balance'],['enemies','Enemies & Bosses']].map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>) }
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
    {tab==='balancing' && <section className="panel admin-section balance-editor">
      <div className="section-head"><div><div className="eyebrow">COMBAT BALANCE LAB</div><h2>Every level, every move</h2><p className="muted">Level 1 is the base card. Level 2 is Upgrade 1, Level 3 is Upgrade 2, and so on. These values are used directly by combat.</p></div><span>{balanceCharacters.length} characters available</span></div>
      <div className="editor-toolbar"><label className="balance-character-select">Character<select value={balanceCharacter?.id||''} onChange={e=>setBalanceCharacterId(e.target.value)}>{balanceCharacters.map(c=><option key={c.id} value={c.id}>{c.name} · {c.rarity}</option>)}</select></label><button className="secondary" onClick={resetCharacterBalance} disabled={!balanceCharacter}>RESET SELECTED TO DEFAULTS</button></div>
      {balanceCharacter && <>
        <div className="balance-summary"><div><span>CHARACTER</span><b>{balanceCharacter.name}</b></div><div><span>RARITY</span><b>{balanceCharacter.rarity}</b></div><div><span>MAX LEVEL</span><b>{MAX_LEVEL[balanceCharacter.rarity]||1}</b></div><div><span>ROLE</span><b>{balanceCharacter.role||'attack'}</b></div></div>
        <label className="check-field balance-air-toggle"><input type="checkbox" checked={charBalanceEntry.canHitAir===undefined ? Number(balanceCharacter.range||0)>=115 : charBalanceEntry.canHitAir!==false} onChange={e=>setCombatConfig(prev=>({...prev,characters:{...(prev.characters||{}),[balanceCharacter.id]:{...(prev.characters?.[balanceCharacter.id]||{}),canHitAir:e.target.checked}}}))}/> This character can attack flying enemies <small>By default, characters with base range 115+ can hit flyers. Change this per character.</small></label>
        <h3 className="balance-subtitle">Stats by level</h3>
        <div className="stat-table-wrap balance-table-wrap"><table className="level-stats-table editor-level-table"><thead><tr><th>LEVEL / STAGE</th><th>Damage</th><th>Field range</th><th>SPA (ms)</th><th>Upgrade cost</th><th>Income / wave</th><th>Support buff %</th></tr></thead><tbody>{levelRows.map(row=><tr key={row.level}><td><b>Level {row.level}</b><small>{levelLabel(row.level)}</small></td><td><input aria-label={`${balanceCharacter.name} ${levelLabel(row.level)} damage`} type="number" min="0" step="0.1" disabled={balanceCharacter.role==='money'} value={row.damage} onChange={e=>updateLevelField(row.level,'damage',e.target.value)}/></td><td><input aria-label={`${balanceCharacter.name} ${levelLabel(row.level)} range`} type="number" min="0" step="0.1" disabled={balanceCharacter.role==='money'} value={row.range} onChange={e=>updateLevelField(row.level,'range',e.target.value)}/></td><td><input aria-label={`${balanceCharacter.name} ${levelLabel(row.level)} attack interval`} type="number" min="220" max="10000" step="1" disabled={balanceCharacter.role==='money'} value={row.attackSpeed} onChange={e=>updateLevelField(row.level,'attackSpeed',e.target.value)}/></td><td><input aria-label={`${balanceCharacter.name} ${levelLabel(row.level)} upgrade cost`} type="number" min="0" step="1" disabled={row.level===1} value={row.upgradeCost} onChange={e=>updateLevelField(row.level,'upgradeCost',e.target.value)}/></td><td><input aria-label={`${balanceCharacter.name} ${levelLabel(row.level)} income`} type="number" min="0" step="1" disabled={balanceCharacter.role!=='money'} value={row.income} onChange={e=>updateLevelField(row.level,'income',e.target.value)}/></td><td><input aria-label={`${balanceCharacter.name} ${levelLabel(row.level)} support buff percent`} type="number" min="0" max="300" step="0.5" disabled={balanceCharacter.role!=='support'} value={(Number(row.buffPercent||0)*100).toFixed(1)} onChange={e=>updateLevelField(row.level,'buffPercent',e.target.value)}/></td></tr>)}</tbody></table></div>
        <h3 className="balance-subtitle">Moves / special techniques</h3>
        {moveRows.length ? <div className="balance-moves-grid">{moveRows.map((move,index)=><div className="balance-move-card" key={`${balanceCharacter.id}-move-${index}`}><div className="balance-move-title"><span>MOVE {index+1}</span><b>{move.name||`Technique ${index+1}`}</b></div><div className="admin-form-grid"><label>Move name<input value={move.name||''} onChange={e=>updateMoveField(index,'name',e.target.value)}/></label><label>Unlock at level<input type="number" min="2" max={MAX_LEVEL[balanceCharacter.rarity]||9} value={move.unlockLevel??[2,4,6][index]} onChange={e=>updateMoveField(index,'unlockLevel',e.target.value)}/></label><label>Damage multiplier (×)<input type="number" min="0.1" max="100" step="0.1" value={move.damageMultiplier??1} onChange={e=>updateMoveField(index,'damageMultiplier',e.target.value)}/></label><label>Cooldown (seconds)<input type="number" min="0" max="120" step="0.5" value={move.cooldownSeconds??0} onChange={e=>updateMoveField(index,'cooldownSeconds',e.target.value)}/></label><label>Splash radius (0 = single target)<input type="number" min="0" max="20" step="0.1" value={move.splashRadius??0} onChange={e=>updateMoveField(index,'splashRadius',e.target.value)}/></label></div><small className="muted">When unlocked and off cooldown, this technique replaces one normal attack. Splash applies to enemies near the target.</small></div>)}</div> : <p className="muted">This character has no moves configured yet. Add at least one ability in Characters & Art, then return here.</p>}
        <div className="balance-save-row"><button className="primary" onClick={saveCharacterBalance} disabled={busy}>{busy?'SAVING…':'SAVE BALANCE CHANGES'}</button><span className="muted">Changes are saved to Supabase and used after the game refreshes.</span></div>
      </>}
    </section>}
    {tab==='enemies' && <section className="panel admin-section">
      <div className="section-head"><div><div className="eyebrow">ENEMY DATABASE</div><h2>Enemy and boss stats</h2><p className="muted">Create flyers, upgrade-gated enemies, and character-based enemies. Tune exact stats for individual waves below.</p></div><span>{dbEnemies.length} enemy profiles</span></div>
      <div className="editor-toolbar"><select value={selectedEnemy} onChange={e=>loadEnemyForm(e.target.value)}><option value="">Choose enemy…</option>{dbEnemies.map(en=><option key={en.id} value={en.id}>{en.name}{en.id.startsWith('boss-')?' · BOSS':''}</option>)}</select><button className="secondary" onClick={createEnemyDraft}>+ NEW ENEMY</button></div>
      <div className="character-enemy-creator"><label>Use a character as an enemy<select value={sourceCharacterId} onChange={e=>setSourceCharacterId(e.target.value)}>{balanceCharacters.map(c=><option key={c.id} value={c.id}>{c.name} · {c.rarity}</option>)}</select></label><button className="secondary" onClick={createCharacterEnemy}>CREATE CHARACTER ENEMY</button></div>
      <form className="admin-form-grid" onSubmit={saveEnemy}>
        <label>Enemy ID<input value={enemyForm.id} disabled /></label><label>Name<input value={enemyForm.name} onChange={e=>setEnemyForm(v=>({...v,name:e.target.value}))} required /></label>
        <label>Base HP<input type="number" min="0" step="1" value={enemyForm.hp} onChange={e=>setEnemyForm(v=>({...v,hp:e.target.value}))} /></label>
        <label>HP added per wave (boss)<input type="number" min="0" value={enemyForm.hp_per_wave} onChange={e=>setEnemyForm(v=>({...v,hp_per_wave:e.target.value}))} /></label>
        <label>Speed<input type="number" min="0" step="0.001" value={enemyForm.speed} onChange={e=>setEnemyForm(v=>({...v,speed:e.target.value}))} /></label>
        <label>Core damage<input type="number" min="0" value={enemyForm.base_damage} onChange={e=>setEnemyForm(v=>({...v,base_damage:e.target.value}))} /></label>
        <label>Armour (0–0.95)<input type="number" min="0" max="0.95" step="0.01" value={enemyForm.armor} onChange={e=>setEnemyForm(v=>({...v,armor:e.target.value}))} /></label>
        <label>Shield HP<input type="number" min="0" value={enemyForm.shield} onChange={e=>setEnemyForm(v=>({...v,shield:e.target.value}))} /></label>
        <label>HP regeneration<input type="number" min="0" step="0.1" value={enemyForm.regen} onChange={e=>setEnemyForm(v=>({...v,regen:e.target.value}))} /></label>
        <label>Movement type<select value={enemyMetaForm.movementType||'ground'} onChange={e=>setEnemyMetaForm(v=>({...v,movementType:e.target.value}))}><option value="ground">Ground</option><option value="flying">Flying</option></select></label>
        <label>Minimum unit level needed to damage<input type="number" min="1" max="9" step="1" value={enemyMetaForm.minUnitLevel||1} onChange={e=>setEnemyMetaForm(v=>({...v,minUnitLevel:e.target.value}))}/><small>Example: 2 means base units cannot hurt it until upgraded once.</small></label>
        <label>Start spawning at wave<input type="number" min="1" max="10000" value={enemyMetaForm.spawnFromWave||1} onChange={e=>setEnemyMetaForm(v=>({...v,spawnFromWave:e.target.value}))}/></label>
        <label>Stop spawning after wave (optional)<input type="number" min="1" value={enemyMetaForm.spawnUntilWave??''} onChange={e=>setEnemyMetaForm(v=>({...v,spawnUntilWave:e.target.value}))} placeholder="No end wave"/></label>
        <label>Spawn chance per enemy (%)<input type="number" min="0" max="100" step="1" value={enemyMetaForm.spawnChance??10} onChange={e=>setEnemyMetaForm(v=>({...v,spawnChance:e.target.value}))}/></label>
        <label>Character appearance (optional)<select value={enemyMetaForm.characterId||''} onChange={e=>{const cid=e.target.value;const source=dbCharacters.find(c=>c.id===cid);setEnemyMetaForm(v=>({...v,characterId:cid}));if(source?.art_url)setEnemyForm(v=>({...v,art_url:source.art_url}));}}><option value="">Use enemy art</option>{balanceCharacters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="check-field span-2"><input type="checkbox" checked={Boolean(enemyMetaForm.customSpawn)} onChange={e=>setEnemyMetaForm(v=>({...v,customSpawn:e.target.checked}))}/> Use this enemy in wave spawns according to its spawn settings</label>
        <label className="span-2">Artwork URL<input value={enemyForm.art_url||''} onChange={e=>setEnemyForm(v=>({...v,art_url:e.target.value}))} placeholder="Upload below or paste a public URL" /></label>
        <label className="file-upload-field span-2">Upload enemy/boss image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={e=>artUpload(e.target.files?.[0],'enemy')} disabled={uploading||!enemyForm.id} /><small>Upload using this row's enemy ID, then click Save.</small></label>
        <label className="check-field span-2"><input type="checkbox" checked={Boolean(enemyForm.enabled)} onChange={e=>setEnemyForm(v=>({...v,enabled:e.target.checked}))}/> Enemy is enabled</label>
        {enemyForm.art_url && <div className="art-preview span-2"><img src={enemyForm.art_url} alt="Enemy preview"/><span>Image preview</span></div>}
        <button className="primary span-2" disabled={busy||uploading||!enemyForm.id}>{busy?'SAVING…':dbEnemies.some(x=>x.id===enemyForm.id)?'SAVE ENEMY / BOSS':'CREATE ENEMY'}</button>
      </form>
      <div className="wave-balance-editor">
        <div className="section-head"><div><div className="eyebrow">WAVE-SPECIFIC OVERRIDES</div><h3>Stats for one exact wave</h3><p className="muted">Save an override to use these exact values on that wave. Other waves continue using the normal scaling formula.</p></div></div>
        <div className="wave-pick-row"><label>Wave number<input type="number" min="1" max="10000" value={selectedWave} onChange={e=>{const wave=Math.max(1,Number(e.target.value)||1);setSelectedWave(wave);if(selectedDbEnemy)setWaveDraft(defaultWaveStatsForConfig(selectedDbEnemy,wave,combatConfig,gameBalance));}}/></label><span className="muted">{selectedEnemyWaveOverrides[String(selectedWave)]?'Override exists for this wave':'No override saved for this wave'}</span><button className="primary" disabled={busy||!selectedDbEnemy} onClick={addWaveOverride}>SAVE WAVE STATS</button></div>
        <div className="admin-form-grid wave-stats-grid"><label>HP<input type="number" min="1" step="1" value={waveDraft.hp??0} onChange={e=>setWaveDraft(v=>({...v,hp:e.target.value}))}/></label><label>Speed<input type="number" min="0" step="0.001" value={waveDraft.speed??0} onChange={e=>setWaveDraft(v=>({...v,speed:e.target.value}))}/></label><label>Core damage<input type="number" min="0" step="1" value={waveDraft.damage??0} onChange={e=>setWaveDraft(v=>({...v,damage:e.target.value}))}/></label><label>Armour (0–0.95)<input type="number" min="0" max="0.95" step="0.01" value={waveDraft.armor??0} onChange={e=>setWaveDraft(v=>({...v,armor:e.target.value}))}/></label><label>Shield HP<input type="number" min="0" step="1" value={waveDraft.shield??0} onChange={e=>setWaveDraft(v=>({...v,shield:e.target.value}))}/></label><label>Regeneration<input type="number" min="0" step="0.1" value={waveDraft.regen??0} onChange={e=>setWaveDraft(v=>({...v,regen:e.target.value}))}/></label></div>
        <div className="wave-override-list">{Object.entries(selectedEnemyWaveOverrides).sort((a,b)=>Number(a[0])-Number(b[0])).map(([wave,stats])=><div className="wave-override-row" key={wave}><button className="wave-label" onClick={()=>{setSelectedWave(Number(wave));setWaveDraft({...stats});}}>WAVE {wave}</button><span>HP {Number(stats.hp).toLocaleString()}</span><span>SPD {Number(stats.speed).toFixed(3)}</span><span>ARM {Number(stats.armor||0).toFixed(2)}</span><button className="danger small" disabled={busy} onClick={()=>removeWaveOverride(wave)}>REMOVE</button></div>)}</div>
      </div>
    </section>}
    <section className="panel admin-log-note"><div className="eyebrow">SECURITY NOTE</div><p>For the first setup, sign up with your own email, then use Supabase SQL Editor once to change your profile role to <code>admin</code>. The browser signup form cannot grant itself admin access. Never place the Supabase service-role key in frontend code.</p></section>
  </main>;
}
