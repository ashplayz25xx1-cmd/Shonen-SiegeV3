import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { GAME_BALANCE as BASE_GAME_BALANCE, ENEMY_BALANCE as BASE_ENEMY_BALANCE, CHARACTER_OVERRIDES as BASE_CHARACTER_OVERRIDES, CHARACTER_ART as BASE_CHARACTER_ART, ENEMY_ART as BASE_ENEMY_ART, ROSTER_ADDITIONS, DEFAULT_COMBAT_BALANCE as BASE_COMBAT_BALANCE } from './game-config.js';
import { AccountPage, AdminPage } from './account-admin.jsx';
import { isBackendConfigured, restoreSession, getProfile, rpc, fetchPublicConfig, signOut, getPendingAuthCallbackType, clearPendingAuthCallbackType } from './backend.js';

let GAME_BALANCE = { ...BASE_GAME_BALANCE, rarityDefaults: { ...BASE_GAME_BALANCE.rarityDefaults } };
let ENEMY_BALANCE = JSON.parse(JSON.stringify(BASE_ENEMY_BALANCE));
let COMBAT_BALANCE = JSON.parse(JSON.stringify(BASE_COMBAT_BALANCE));
let ENEMY_NAMES = {};
const DEFAULT_ENEMY_NAMES = {normal:'Normal',fast:'Fast',tank:'Tank',regen:'Regenerator',shield:'Shielded',armored:'Armoured',flying:'Flyer','strong-1':'Strong Enemy 1','strong-2':'Strong Enemy 2'};
let CHARACTER_ART = { ...BASE_CHARACTER_ART };
let ENEMY_ART = { ...BASE_ENEMY_ART };
let REMOTE_CHARACTER_ART = {};
let REMOTE_ENEMY_ART = {};


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
const SINGLE_COST = 100;
const FIVE_COST = 450;
const TEN_COST = 900;
const SLOT_RULES = {
  4: { wave: 10, gems: 250 },
  5: { wave: 25, gems: 500 },
};
const BASE_DROP_RATES = { Common: 45, Uncommon: 25, Rare: 16, Epic: 9, Legendary: 4, Mythic: 1 };
const PITY = { Rare: 10, Epic: 25, Legendary: 50, Mythic: 100 };

const CORE_CHARACTERS = [
  {id:'naruto', name:'Naruto Uzumaki', anime:'Naruto', rarity:'Rare', cost:250, baseDamage:34, range:115, attackSpeed:650, abilities:['Shadow Clone','Rasengan','Rasenshuriken']},
  {id:'ichigo', name:'Ichigo Kurosaki', anime:'Bleach', rarity:'Legendary', cost:450, baseDamage:48, range:125, attackSpeed:700, abilities:['Zangetsu Slash','Getsuga Tensho','Bankai']},
  {id:'goku', name:'Son Goku', anime:'Dragon Ball', rarity:'Mythic', cost:650, baseDamage:75, range:145, attackSpeed:800, abilities:['Ki Blast','Kamehameha','Ultra Instinct']},
  {id:'luffy', name:'Monkey D. Luffy', anime:'One Piece', rarity:'Epic', cost:375, baseDamage:43, range:110, attackSpeed:590, abilities:['Gum-Gum Pistol','Gear Second','Gear Fifth']},
  {id:'gojo', name:'Satoru Gojo', anime:'Jujutsu Kaisen', rarity:'Legendary', cost:500, baseDamage:52, range:155, attackSpeed:950, abilities:['Blue','Red','Unlimited Void']},
  {id:'denji', name:'Denji', anime:'Chainsaw Man', rarity:'Epic', cost:320, baseDamage:46, range:105, attackSpeed:520, abilities:['Chainsaw Slash','Rev Up','Full Devil']},
  {id:'deku', name:'Izuku Midoriya', anime:'My Hero Academia', rarity:'Rare', cost:280, baseDamage:37, range:120, attackSpeed:610, abilities:['Delaware Smash','Blackwhip','Full Cowl']},
  {id:'killua', name:'Killua Zoldyck', anime:'Hunter x Hunter', rarity:'Rare', cost:230, baseDamage:29, range:108, attackSpeed:390, abilities:['Godspeed','Lightning Palm','Whirlwind']},
  {id:'tanjiro', name:'Tanjiro Kamado', anime:'Demon Slayer', rarity:'Common', cost:180, baseDamage:24, range:112, attackSpeed:570, abilities:['Water Wheel','Hinokami Kagura','Sun Halo Dragon']},
  {id:'asta', name:'Asta', anime:'Black Clover', rarity:'Epic', cost:340, baseDamage:45, range:105, attackSpeed:620, abilities:['Demon Slash','Black Form','Black Divider']},
  {id:'saitama', name:'Saitama', anime:'One Punch Man', rarity:'Mythic', cost:800, baseDamage:110, range:105, attackSpeed:1100, abilities:['Normal Punch','Serious Series','Serious Punch']},
  {id:'gon', name:'Gon Freecss', anime:'Hunter x Hunter', rarity:'Common', cost:190, baseDamage:27, range:95, attackSpeed:600, abilities:['Rock','Scissors','Jajanken']},

  {id:'sasuke', name:'Sasuke Uchiha', anime:'Naruto', rarity:'Epic', cost:380, baseDamage:44, range:120, attackSpeed:610, abilities:['Chidori','Amaterasu','Susanoo']},
  {id:'kakashi', name:'Kakashi Hatake', anime:'Naruto', rarity:'Legendary', cost:470, baseDamage:50, range:135, attackSpeed:720, abilities:['Lightning Blade','Kamui','Copy Ninja']},
  {id:'vegeta', name:'Vegeta', anime:'Dragon Ball', rarity:'Legendary', cost:490, baseDamage:53, range:125, attackSpeed:740, abilities:['Galick Gun','Final Flash','Ultra Ego']},
  {id:'gohan', name:'Son Gohan', anime:'Dragon Ball', rarity:'Epic', cost:370, baseDamage:42, range:118, attackSpeed:620, abilities:['Masenko','Beast Rush','Special Beam']},
  {id:'rukia', name:'Rukia Kuchiki', anime:'Bleach', rarity:'Rare', cost:260, baseDamage:32, range:130, attackSpeed:670, abilities:['Sode no Shirayuki','Frost Bloom','Hakka no Togame']},
  {id:'byakuya', name:'Byakuya Kuchiki', anime:'Bleach', rarity:'Epic', cost:390, baseDamage:45, range:145, attackSpeed:760, abilities:['Senbonzakura','Bankai','Petal Storm']},
  {id:'zoro', name:'Roronoa Zoro', anime:'One Piece', rarity:'Legendary', cost:460, baseDamage:52, range:105, attackSpeed:580, abilities:['Three Sword Style','Asura','King of Hell']},
  {id:'sanji', name:'Sanji', anime:'One Piece', rarity:'Rare', cost:270, baseDamage:34, range:100, attackSpeed:430, abilities:['Diable Jambe','Sky Walk','Ifrit Jambe']},
  {id:'nami', name:'Nami', anime:'One Piece', rarity:'Epic', role:'money', incomePerWave:420, cost:350, baseDamage:0, range:0, attackSpeed:0, abilities:['Weather Forecast','Clima-Tact','Zeus']},
  {id:'megumi', name:'Megumi Fushiguro', anime:'Jujutsu Kaisen', rarity:'Rare', cost:275, baseDamage:33, range:125, attackSpeed:650, abilities:['Divine Dogs','Nue','Chimera Shadow']},
  {id:'yuji', name:'Yuji Itadori', anime:'Jujutsu Kaisen', rarity:'Common', cost:190, baseDamage:25, range:95, attackSpeed:500, abilities:['Divergent Fist','Black Flash','Cursed Energy']},
  {id:'sukuna', name:'Ryomen Sukuna', anime:'Jujutsu Kaisen', rarity:'Mythic', cost:790, baseDamage:98, range:135, attackSpeed:900, abilities:['Dismantle','Cleave','Malevolent Shrine']},
  {id:'power', name:'Power', anime:'Chainsaw Man', rarity:'Rare', cost:255, baseDamage:33, range:100, attackSpeed:540, abilities:['Blood Hammer','Blood Spear','Blood Fiend']},
  {id:'makima', name:'Makima', anime:'Chainsaw Man', rarity:'Legendary', cost:520, baseDamage:55, range:155, attackSpeed:900, abilities:['Control','Crush','Contract']},
  {id:'bakugo', name:'Katsuki Bakugo', anime:'My Hero Academia', rarity:'Epic', cost:365, baseDamage:42, range:125, attackSpeed:540, abilities:['AP Shot','Howitzer Impact','Cluster']},
  {id:'todoroki', name:'Shoto Todoroki', anime:'My Hero Academia', rarity:'Rare', cost:285, baseDamage:35, range:145, attackSpeed:750, abilities:['Ice Wall','Flashfire','Phosphor']},
  {id:'allmight', name:'All Might', anime:'My Hero Academia', rarity:'Legendary', cost:480, baseDamage:55, range:110, attackSpeed:780, abilities:['Detroit Smash','United States','Symbol of Peace']},
  {id:'hisoka', name:'Hisoka', anime:'Hunter x Hunter', rarity:'Epic', cost:350, baseDamage:40, range:120, attackSpeed:600, abilities:['Bungee Gum','Texture Surprise','Trickster']},
  {id:'kurapika', name:'Kurapika', anime:'Hunter x Hunter', rarity:'Rare', cost:280, baseDamage:34, range:125, attackSpeed:650, abilities:['Dowsing Chain','Judgment Chain','Emperor Time']},
  {id:'zenitsu', name:'Zenitsu Agatsuma', anime:'Demon Slayer', rarity:'Rare', cost:265, baseDamage:35, range:95, attackSpeed:390, abilities:['Thunderclap','Sixfold','Godspeed']},
  {id:'inosuke', name:'Inosuke Hashibira', anime:'Demon Slayer', rarity:'Common', cost:185, baseDamage:26, range:95, attackSpeed:470, abilities:['Beast Breathing','Fang Rush','Spatial Awareness']},
  {id:'rengoku', name:'Kyojuro Rengoku', anime:'Demon Slayer', rarity:'Legendary', cost:465, baseDamage:51, range:115, attackSpeed:600, abilities:['Flame Tiger','Purgatory','Flame Breathing']},
  {id:'yami', name:'Yami Sukehiro', anime:'Black Clover', rarity:'Legendary', cost:475, baseDamage:54, range:120, attackSpeed:700, abilities:['Dark Cloaked','Dimension Slash','Death Thrust']},
  {id:'yuno', name:'Yuno', anime:'Black Clover', rarity:'Epic', cost:375, baseDamage:43, range:150, attackSpeed:740, abilities:['Wind Blade','Spirit Dive','Star Magic']},
  {id:'genos', name:'Genos', anime:'One Punch Man', rarity:'Epic', cost:355, baseDamage:41, range:150, attackSpeed:650, abilities:['Incinerate','Machine Gun Blows','Core Burst']},
  {id:'garou', name:'Garou', anime:'One Punch Man', rarity:'Legendary', cost:495, baseDamage:56, range:105, attackSpeed:480, abilities:['Flowing Water','Monster Calamity','Cosmic Fist']},
  {id:'yuuta', name:'Yuta Okkotsu', anime:'Jujutsu Kaisen', rarity:'Legendary', cost:485, baseDamage:50, range:130, attackSpeed:690, abilities:['Rika','Copy','True Mutual Love']},
  {id:'shanks', name:'Shanks', anime:'One Piece', rarity:'Mythic', cost:760, baseDamage:92, range:130, attackSpeed:800, abilities:['Divine Departure','Conqueror Haki','Observation Kill']},
  {id:'trunks', name:'Future Trunks', anime:'Dragon Ball', rarity:'Epic', cost:390, baseDamage:45, range:115, attackSpeed:570, abilities:['Burning Attack','Sword Slash','Final Hope']},
  {id:'obito', name:'Obito Uchiha', anime:'Naruto', rarity:'Mythic', cost:770, baseDamage:94, range:140, attackSpeed:850, abilities:['Kamui','Fire Style','Ten Tails']},
  {id:'kenpachi', name:'Kenpachi Zaraki', anime:'Bleach', rarity:'Legendary', cost:490, baseDamage:57, range:100, attackSpeed:720, abilities:['Nozarashi','Battle Instinct','Meteor Strike']},
  {id:'chopper', name:'Tony Tony Chopper', anime:'One Piece', rarity:'Common', cost:180, baseDamage:24, range:95, attackSpeed:520, abilities:['Guard Point','Heavy Point','Monster Point']},
  {id:'shikamaru', name:'Shikamaru Nara', anime:'Naruto', rarity:'Rare', cost:250, baseDamage:30, range:155, attackSpeed:820, abilities:['Shadow Possession','Shadow Stitch','Shadow Strangle']},
  {id:'bulma', name:'Bulma', anime:'Dragon Ball', rarity:'Mythic', role:'money', incomePerWave:750, cost:650, baseDamage:0, range:0, attackSpeed:0, abilities:['Capsule Corporation','Bulma’s Invention','Super Dragon Radar']},
  {id:'ramen-guy', name:'Ramen Guy (Teuchi)', anime:'Naruto', rarity:'Legendary', role:'money', incomePerWave:560, cost:520, baseDamage:0, range:0, attackSpeed:0, abilities:['Warm Bowl','Village Discount','Hidden Leaf Feast']},
];

function buildRosterCharacter(entry, index) {
  const stats = GAME_BALANCE.rarityDefaults[entry.rarity] || GAME_BALANCE.rarityDefaults.Rare;
  const firstName = entry.name.split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, '');
  return {
    ...entry,
    cost: stats.cost + (index % 4) * 12,
    baseDamage: entry.role === 'money' ? 0 : stats.damage + (index % 4) * 3,
    range: entry.role === 'money' ? 0 : stats.range + (index % 5) * 4,
    attackSpeed: entry.role === 'money' ? 0 : stats.attackSpeed + (index % 5) * 20,
    abilities: entry.abilities || [`${firstName} Technique`, `${firstName} Awakening`, `${firstName} Ultimate`],
  };
}

const DEFAULT_CHARACTERS = [...CORE_CHARACTERS, ...ROSTER_ADDITIONS.map(buildRosterCharacter)]
  .map(character => ({ ...character, ...(BASE_CHARACTER_OVERRIDES[character.id] || {}) }));
let CHARACTERS = DEFAULT_CHARACTERS.slice();

// Image paths are stored in src/game-config.js as paths relative to public/.
const publicAsset = (path) => `${import.meta.env.BASE_URL}${String(path || '').replace(/^\/+/, '')}`;
const characterImage = (save, id) => REMOTE_CHARACTER_ART[id] || save.cardImages?.[id] || (CHARACTER_ART[id] ? (String(CHARACTER_ART[id]).startsWith('http') ? CHARACTER_ART[id] : publicAsset(CHARACTER_ART[id])) : '');
const enemyImage = (type, name='') => {
  const bossId = type === 'boss' && name ? `boss-${String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}` : '';
  const configId = bossId || type;
  const remote = (bossId && REMOTE_ENEMY_ART[bossId]) || REMOTE_ENEMY_ART[type];
  if (remote) return remote;
  // Character-based enemies reuse that character's artwork, while keeping independent enemy stats.
  const characterId = COMBAT_BALANCE.enemyMeta?.[configId]?.characterId;
  if (characterId) {
    const charRemote = REMOTE_CHARACTER_ART[characterId];
    if (charRemote) return charRemote;
    const charPath = CHARACTER_ART[characterId];
    if (charPath) return String(charPath).startsWith('http') ? charPath : publicAsset(charPath);
  }
  const path = ENEMY_ART[type];
  return path ? (String(path).startsWith('http') ? path : publicAsset(path)) : '';
};
const unitIncome = (unit) => unit?.card?.role === 'money'
  ? Number(characterLevelStats(unit.card, unit.level || 1).income || 0)
  : 0;

function defaultCharacterLevelStats(card, level) {
  const lv = Math.max(1, Math.min(Number(level) || 1, UPGRADE_LIMIT[card?.rarity] || 1));
  const step = lv - 1;
  const rank = Math.max(0, rarityRank(card?.rarity));
  if (card?.role === 'money') {
    return { level:lv, damage:0, range:0, attackSpeed:0, income:Math.round(Number(card.incomePerWave || 0) * (1 + step * GAME_BALANCE.incomeUpgradeMultiplier)), buffPercent:0, upgradeCost:lv === 1 ? 0 : Math.round(90 + (lv - 1) * 55 + rank * 25) };
  }
  let damage = Number(card?.baseDamage || 0);
  for (let n=0;n<step;n++) damage=Math.round(damage*1.3);
  return {
    level:lv,
    damage,
    range:Math.max(11, Number(card?.range || 0) / 12) + 0.9 * step,
    attackSpeed:Math.max(220, Number(card?.attackSpeed || 680) - 38 * step),
    income:0,
    buffPercent:card?.role === 'support' ? Number(card?.buffPercent || 0.13) * (1 + step * 0.1) : 0,
    upgradeCost:lv === 1 ? 0 : Math.round(90 + (lv - 1) * 55 + rank * 25),
  };
}
function characterLevelStats(card, level) {
  const lv = Math.max(1, Math.min(Number(level) || 1, UPGRADE_LIMIT[card?.rarity] || 1));
  const fallback = defaultCharacterLevelStats(card, lv);
  const rows = COMBAT_BALANCE.characters?.[card?.id]?.levels;
  const custom = Array.isArray(rows) ? rows.find(row => Number(row.level) === lv) : rows?.[String(lv)];
  if (!custom || typeof custom !== 'object') return fallback;
  return { ...fallback, ...custom, level:lv };
}
function characterMoves(card) {
  const saved = COMBAT_BALANCE.characters?.[card?.id]?.moves;
  if (Array.isArray(saved) && saved.length) return saved;
  return (card?.abilities || []).slice(0,3).map((name,index)=>({
    name,
    unlockLevel:[2,4,6][index] || 2,
    damageMultiplier:[1.5,2.1,2.8][index] || 1.5,
    cooldownSeconds:[6,10,15][index] || 6,
    splashRadius:[0,1.3,2.6][index] || 0,
  }));
}
function characterCanHitAir(card) {
  const configured = COMBAT_BALANCE.characters?.[card?.id]?.canHitAir;
  // Default rule: longer-range characters can target flyers; other characters can be enabled in Admin.
  return configured === undefined ? Number(card?.range || 0) >= 115 : configured !== false;
}
function levelStageLabel(level) { return level === 1 ? 'Base' : `Upgrade ${level-1}`; }

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
    'Dragon Ball':'KI', 'Bleach':'魂', 'Naruto':'忍', 'Jujutsu Kaisen':'呪',
    'One Piece':'海', 'Chainsaw Man':'刃', 'My Hero Academia':'PLUS',
    'Hunter x Hunter':'H×H', 'Demon Slayer':'炎', 'Black Clover':'♣', 'One Punch Man':'拳',
    'Attack on Titan':'AOT', 'Solo Leveling':'SL', 'Spy x Family':'S×F', 'Mob Psycho 100':'MP',
    'Tokyo Revengers':'TR', 'Mashle':'M', 'Food Wars':'FW', 'Frieren: Beyond Journey’s End':'FR',
    'JoJo’s Bizarre Adventure':'JJ', 'Fairy Tail':'FT', 'Fate':'FATE', 'Death Note':'DN',
    'That Time I Got Reincarnated as a Slime':'SLIME', 'The Misfit of Demon King Academy':'MISFIT',
  };
  return map[char.anime] || char.name.split(/\s+/).map(p=>p[0]).join('').slice(0,3).toUpperCase() || '✦';
}

function gemReward(wave) {
  if (wave <= 4) return 5;
  return Math.floor(5 + wave * 0.9);
}

function cashReward(wave, type='normal') {
  const base = {normal:24, fast:28, tank:40, regen:34, shield:36, armored:42, flying:32, 'strong-1':70, 'strong-2':135, boss:260}[type] || 24;
  return Math.round(base * (1 + wave * 0.045) * GAME_BALANCE.enemyCashMultiplier);
}

function enemyFor(wave, index, total, id) {
  const bossWave = wave % GAME_BALANCE.bossEveryWaves === 0;
  const exactFor = (type, base, boss=false) => {
    const meta = COMBAT_BALANCE.enemyMeta?.[type] || {};
    const override = COMBAT_BALANCE.enemyWaves?.[type]?.[String(wave)] || {};
    const scaledHp = boss ? Number(base.hp || 0) + wave * Number(base.hpPerWave || 0)
      : Number(base.hp || 0) * (1 + wave * GAME_BALANCE.enemyHealthPerWave) * (1 + Math.max(0, index-total*0.5) * 0.01);
    const hp = Math.max(1, Math.round(override.hp != null ? Number(override.hp) : scaledHp));
    const speed = Math.max(0, Number(override.speed != null ? override.speed : (Number(base.speed || 0) * (1 + wave * 0.01))));
    const shield = Math.max(0, Number(override.shield != null ? override.shield : (Number(base.shield || 0) + (!boss && type==='shield' ? wave*2 : boss ? wave*20 : 0))));
    return {
      id, type:boss ? 'boss' : type, enemyConfigId:type, name:ENEMY_NAMES[type] || base.name || DEFAULT_ENEMY_NAMES[type] || type,
      progress:-0.035*(index+1), hp, maxHp:hp, speed,
      damage:Math.max(0,Number(override.damage != null ? override.damage : (base.damage ?? 34))),
      armor:Math.max(0,Math.min(.95,Number(override.armor != null ? override.armor : (base.armor || 0)))),
      shield, regen:Math.max(0,Number(override.regen != null ? override.regen : (base.regen || 0))),
      reward:cashReward(wave,boss?'boss':type),
      movementType:meta.movementType || 'ground',
      minUnitLevel:Math.max(1,Number(meta.minUnitLevel || 1)),
      characterId:meta.characterId || null,
    };
  };
  if (bossWave && index === total - 1) {
    const bosses = ENEMY_BALANCE.bosses || BASE_ENEMY_BALANCE.bosses;
    const b = bosses[(Math.floor(wave / GAME_BALANCE.bossEveryWaves) - 1) % bosses.length];
    const type = `boss-${String(b.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;
    return exactFor(type, { ...b, damage:b.damage ?? 100 }, true);
  }

  const roll = (index + wave) % 19;
  let type = 'normal';
  if (wave >= 6 && roll < 2) type = 'fast';
  else if (wave >= 10 && roll < 4) type = 'tank';
  else if (wave >= 14 && roll < 6) type = 'regen';
  else if (wave >= 18 && roll < 8) type = 'shield';
  else if (wave >= 22 && roll < 10) type = 'armored';

  // Added enemy classes can enter the roster at a chosen wave and spawn chance.
  const customCandidates = Object.keys(ENEMY_BALANCE).filter(enemyId => {
    if (enemyId === 'bosses' || ['normal','fast','tank','regen','shield','armored'].includes(enemyId)) return false;
    const stats = ENEMY_BALANCE[enemyId];
    const meta = COMBAT_BALANCE.enemyMeta?.[enemyId] || {};
    return stats && stats.enabled !== false && meta.customSpawn === true && wave >= Number(meta.spawnFromWave || 1)
      && (meta.spawnUntilWave == null || wave <= Number(meta.spawnUntilWave))
      && Math.random() < Math.max(0,Math.min(1,Number(meta.spawnChance ?? 0.1)));
  });
  if (customCandidates.length) type = customCandidates[Math.floor(Math.random()*customCandidates.length)];
  let st = ENEMY_BALANCE[type] || ENEMY_BALANCE.normal;
  if (st?.enabled === false) { type='normal'; st=ENEMY_BALANCE.normal; }
  return exactFor(type, st, false);
}

const PATH = [
  [4,50], [9,50], [14,47], [19,42], [25,39], [31,40], [37,44],
  [42,50], [47,56], [53,60], [59,61], [65,58], [70,53], [74,47],
  [79,43], [84,42], [89,45], [93,51], [97,53],
];
const PATH_SEGMENTS = PATH.slice(0,-1).map((p,i)=>Math.hypot(PATH[i+1][0]-p[0],PATH[i+1][1]-p[1]));
const PATH_TOTAL_LENGTH = PATH_SEGMENTS.reduce((sum,n)=>sum+n,0);

function pathPosition(progress) {
  // Move enemies at a consistent rate along the route. Negative progress keeps the spawn queue spaced out.
  if (progress < 0) {
    const a = PATH[0], b = PATH[1];
    const len = PATH_SEGMENTS[0] || 1;
    const distance = progress * PATH_TOTAL_LENGTH;
    return {x:a[0] + (b[0]-a[0]) / len * distance, y:a[1] + (b[1]-a[1]) / len * distance};
  }
  const distance = Math.min(1, progress) * PATH_TOTAL_LENGTH;
  let elapsed = 0;
  for (let i=0;i<PATH_SEGMENTS.length;i++) {
    const segment = PATH_SEGMENTS[i];
    if (distance <= elapsed + segment || i === PATH_SEGMENTS.length - 1) {
      const t = Math.max(0, Math.min(1, (distance-elapsed) / (segment || 1)));
      const a=PATH[i], b=PATH[i+1];
      return {x:a[0] + (b[0]-a[0])*t, y:a[1] + (b[1]-a[1])*t};
    }
    elapsed += segment;
  }
  return PATH[PATH.length-1];
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

function openPack(pity, count=5, pool=CHARACTERS) {
  const nextPity = {...pity};
  const results = [];
  for (let i=0;i<count;i++) {
    const rarity = rollRarity(nextPity);
    const rarityPool = pool.filter(c => c.rarity === rarity);
    const candidates = rarityPool.length ? rarityPool : pool;
    results.push(candidates[Math.floor(Math.random()*candidates.length)] || CHARACTERS[0]);
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

function stableHash(value) {
  let hash = 2166136261;
  for (const ch of String(value)) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function getRotatingVerse(now, verses) {
  if (!verses.length) return 'Naruto';
  const slotLength = GAME_BALANCE.verseBannerMinutes * 60 * 1000;
  const slot = Math.floor(now / slotLength);
  let index = stableHash(`verse-${slot}`) % verses.length;
  if (slot > 0 && verses.length > 1) {
    const previousIndex = stableHash(`verse-${slot-1}`) % verses.length;
    if (index === previousIndex) index = (index + 1 + (stableHash(`fallback-${slot}`) % (verses.length - 1))) % verses.length;
  }
  return verses[index];
}

function mapDbCharacter(row, base = {}) {
  return {
    ...base,
    id: row.id,
    name: row.name || base.name || row.id,
    anime: row.anime || base.anime || 'Unknown',
    rarity: row.rarity || base.rarity || 'Common',
    cost: Number(row.cost ?? base.cost ?? 180),
    baseDamage: Number(row.base_damage ?? base.baseDamage ?? 22),
    range: Number(row.range ?? base.range ?? 110),
    attackSpeed: Number(row.attack_speed ?? base.attackSpeed ?? 680),
    role: row.role || base.role || 'attack',
    incomePerWave: Number(row.income_per_wave ?? base.incomePerWave ?? 0),
    buffPercent: Number(row.buff_percent ?? base.buffPercent ?? 0),
    abilities: Array.isArray(row.abilities) ? row.abilities : (base.abilities || []),
    enabled: row.enabled !== false,
  };
}

function applyRemoteConfig({characters=[], enemies=[], settings=[]}) {
  if (Array.isArray(settings)) {
    const row = settings.find(s => s.key === 'game_balance');
    if (row?.value && typeof row.value === 'object') {
      GAME_BALANCE = { ...GAME_BALANCE, ...row.value, rarityDefaults: { ...GAME_BALANCE.rarityDefaults, ...(row.value.rarityDefaults || {}) } };
    }
    const combatRow = settings.find(s => s.key === 'combat_balance');
    if (combatRow?.value && typeof combatRow.value === 'object') {
      const remoteCombat = combatRow.value;
      COMBAT_BALANCE = {
        ...BASE_COMBAT_BALANCE,
        ...remoteCombat,
        characters: { ...(BASE_COMBAT_BALANCE.characters || {}), ...(remoteCombat.characters || {}) },
        enemyWaves: { ...(BASE_COMBAT_BALANCE.enemyWaves || {}), ...(remoteCombat.enemyWaves || {}) },
        enemyMeta: { ...(BASE_COMBAT_BALANCE.enemyMeta || {}), ...(remoteCombat.enemyMeta || {}) },
      };
    }
  }
  if (Array.isArray(characters) && characters.length) {
    const map = new Map(characters.map(c => [c.id, c]));
    const baseIds = new Set(DEFAULT_CHARACTERS.map(c => c.id));
    const merged = DEFAULT_CHARACTERS.filter(c => !map.has(c.id) || map.get(c.id).enabled !== false).map(c => map.has(c.id) ? mapDbCharacter(map.get(c.id), c) : c);
    characters.filter(c => !baseIds.has(c.id) && c.enabled !== false).forEach(c => merged.push(mapDbCharacter(c)));
    CHARACTERS = merged.length ? merged : DEFAULT_CHARACTERS.slice();
    REMOTE_CHARACTER_ART = Object.fromEntries(characters.filter(c => c.art_url).map(c => [c.id,c.art_url]));
  }
  if (Array.isArray(enemies) && enemies.length) {
    const next = JSON.parse(JSON.stringify(ENEMY_BALANCE));
    const art = {};
    ENEMY_NAMES = Object.fromEntries(enemies.map(row => [row.id, row.name || row.id]));
    for (const row of enemies) {
      if (row.art_url) art[row.id] = row.art_url;
      if (row.id.startsWith('boss-')) {
        const name = row.name || row.id.replace(/^boss-/,'');
        const idx = (next.bosses || []).findIndex(x => x.name.toLowerCase() === name.toLowerCase());
        if (row.enabled === false) { if (idx >= 0) next.bosses.splice(idx, 1); continue; }
        const b = { name, hp:Number(row.hp||0), hpPerWave:Number(row.hp_per_wave||0), speed:Number(row.speed||0), damage:Number(row.base_damage||100), armor:Number(row.armor||0), shield:Number(row.shield||0), regen:Number(row.regen||0) };
        if (idx >= 0) next.bosses[idx] = b; else next.bosses.push(b);
      } else {
        next[row.id] = { ...(next[row.id] || {}), hp:Number(row.hp||0), speed:Number(row.speed||0), damage:Number(row.base_damage||0), armor:Number(row.armor||0), shield:Number(row.shield||0), regen:Number(row.regen||0), enabled: row.enabled !== false };
      }
    }
    if (!next.bosses || !next.bosses.length) next.bosses = JSON.parse(JSON.stringify(BASE_ENEMY_BALANCE.bosses));
    ENEMY_BALANCE = next;
    REMOTE_ENEMY_ART = art;
  }
}

async function loadPublishedConfig() {
  if (!isBackendConfigured()) return false;
  const remote = await fetchPublicConfig();
  if ((remote.characters || []).length || (remote.enemies || []).length || (remote.settings || []).length) {
    applyRemoteConfig(remote);
    return true;
  }
  return false;
}

function App() {
  const [save, setSave] = useState(loadSave);
  const [localSaveBackup] = useState(() => { try { const rawSaved=localStorage.getItem('shonen-siege-v3-local-backup'); const raw=localStorage.getItem('shonen-siege-v3'); const base=rawSaved ? normalizeSave(JSON.parse(rawSaved)) : (raw ? normalizeSave(JSON.parse(raw)) : loadSave()); const localSquad=JSON.parse(localStorage.getItem('shonen-siege-v3-squad')||'null'); const snapshot={...base,squad:Array.isArray(base.squad)?base.squad:(Array.isArray(localSquad)?localSquad.filter(id=>getChar(id)).slice(0,SQUAD_LIMIT):STARTERS)}; if(!rawSaved) localStorage.setItem('shonen-siege-v3-local-backup',JSON.stringify(snapshot)); return snapshot; } catch { return {...loadSave(),squad:STARTERS}; } });
  const [localSquadBackup] = useState(() => { try { const raw=JSON.parse(localStorage.getItem('shonen-siege-v3-squad')||'null'); return Array.isArray(raw)?raw.filter(id=>getChar(id)).slice(0,SQUAD_LIMIT):STARTERS; } catch { return STARTERS; } });
  const [saveImported, setSaveImported] = useState(false);
  const [page, setPage] = useState('home');
  const [squad, setSquad] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('shonen-siege-v3-squad') || 'null');
      if (Array.isArray(raw)) return raw.filter(id => getChar(id)).slice(0,SQUAD_LIMIT);
    } catch {}
    return STARTERS;
  });
  const [toast, setToast] = useState('');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [configRevision, setConfigRevision] = useState(0);

  useEffect(() => { localStorage.setItem('shonen-siege-v3', JSON.stringify(save)); }, [save]);
  useEffect(() => { localStorage.setItem('shonen-siege-v3-squad', JSON.stringify(squad)); }, [squad]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const changed = await loadPublishedConfig();
        if (alive && changed) setConfigRevision(v => v + 1);
      } catch (e) { console.warn('Published config could not be loaded:', e); }
      try {
        const restored = await restoreSession();
        const authCallbackType = getPendingAuthCallbackType();
        if (authCallbackType && alive) setPage('account');
        if (authCallbackType && authCallbackType !== 'recovery') clearPendingAuthCallbackType();
        if (restored && alive) await onAuthenticated(restored);
      } catch (e) { console.warn('Account session could not be restored:', e); }
      finally { if (alive) setAccountLoading(false); }
    })();
    if (!isBackendConfigured()) setAccountLoading(false);
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(()=>setToast(''), 2600);
    return ()=>clearTimeout(t);
  }, [toast]);

  const notify = (m) => setToast(m);
  const addGems = (amount) => setSave(s => ({...s, gems: Math.max(0, s.gems + amount)}));
  const uniqueOwned = CHARACTERS.filter(c => (save.owned[c.id] || 0) > 0).length;

  const toggleSquad = async (id) => {
    if ((save.owned[id] || 0) < 1) return notify('You do not own that card yet.');
    let next;
    if (squad.includes(id)) {
      if (squad.length <= 1) return notify('Keep at least one fighter in your squad.');
      next = squad.filter(x=>x!==id);
    } else {
      if (squad.length >= SQUAD_LIMIT) return notify('Squad limit is 5 different cards.');
      next = [...squad,id];
    }
    if (session) {
      try { await rpc(session,'save_squad',{p_squad:next}); }
      catch(e) { return notify(`Could not save cloud squad: ${e.message}`); }
    }
    setSquad(next);
  };

  const onAuthenticated = async (newSession, options = {}) => {
    const p = await getProfile(newSession);
    let cloudSave = await rpc(newSession,'get_my_save',{});
    let pendingImport = false;
    try { pendingImport = localStorage.getItem('shonen-siege-pending-local-save-import-v1') === '1'; } catch {}
    const createdRecently = p?.auth_created_at && (Date.now() - Date.parse(p.auth_created_at)) < 5 * 60 * 1000;
    const starterOwned = { naruto: 1, deku: 1, tanjiro: 1 };
    const localOwned = localSaveBackup?.owned || {};
    const hasLegacyProgress = Boolean(localSaveBackup && (
      Number(localSaveBackup.gems ?? 250) !== 250 || Number(localSaveBackup.waveBest ?? 0) > 0 || Number(localSaveBackup.unlockedSlots ?? 3) > 3 ||
      Object.entries(localOwned).some(([id,count]) => Number(count) !== Number(starterOwned[id] || 0)) ||
      Object.values(localSaveBackup.pity || {}).some(value => Number(value) > 0) ||
      JSON.stringify(localSaveBackup.squad || ['naruto','deku','tanjiro']) !== JSON.stringify(['naruto','deku','tanjiro'])
    ));
    // Auto-import only after signup or when this browser explicitly has a pending import. A recently created account on a different device must not import that device's unrelated/default save.
    if (!cloudSave?.saveImported && localSaveBackup && (options.isNewAccount || pendingImport || (createdRecently && hasLegacyProgress))) {
      try {
        cloudSave = await rpc(newSession, 'import_my_local_save', { p_save: localSaveBackup });
        try { localStorage.removeItem('shonen-siege-pending-local-save-import-v1'); } catch {}
      } catch (e) {
        console.warn('Local save import was not completed:', e);
        notify('Account connected. Open Account to import your old device save if needed.');
      }
    }
    setSession(newSession); setProfile(p); setSaveImported(Boolean(cloudSave?.saveImported));
    if (cloudSave) {
      setSave(normalizeSave(cloudSave));
      if (Array.isArray(cloudSave.squad) && cloudSave.squad.length) setSquad(cloudSave.squad.filter(id=>getChar(id)).slice(0,SQUAD_LIMIT));
    }
    if (!pendingImport && !options.isNewAccount && !createdRecently) notify('Account connected.');
  };
  const onSignedOut = async () => {
    try { await signOut(session); } catch (e) { console.warn(e); }
    setSession(null); setProfile(null); setSaveImported(false); setSave(localSaveBackup); setSquad(localSquadBackup);
    setPage('home'); notify('Signed out.');
  };
  const onConfigChanged = async () => { const changed=await loadPublishedConfig(); if (changed) setConfigRevision(v=>v+1); };
  const onSaveUpdated = cloudSave => { if (cloudSave) { setSave(normalizeSave(cloudSave)); setSaveImported(Boolean(cloudSave.saveImported)); } };
  const navigateToPage = (nextPage) => {
    if (nextPage === 'admin' && (!session?.access_token || profile?.role !== 'admin')) {
      setPage('account');
      notify(session?.access_token ? 'Admin access is restricted to the owner/admin account.' : 'Sign in with the owner/admin account to access Admin.');
      return;
    }
    setPage(nextPage);
  };

  // Protected-route guard: Admin never renders for signed-out or non-admin profiles,
  // even if another component attempts to navigate to that view.
  useEffect(() => {
    if (page === 'admin' && (!session?.access_token || profile?.role !== 'admin')) setPage('account');
  }, [page, session?.access_token, profile?.role]);

  // Enforce account-first access: do not briefly expose gameplay while the session is loading,
  // and do not render the game when the backend account is missing.
  if (isBackendConfigured() && accountLoading) return <div className="app"><header className="topbar"><div className="brand"><span className="brand-mark">⚔</span><span>SHONEN <b>SIEGE</b></span></div></header><main className="page"><section className="panel"><h1>Checking your account…</h1><p className="muted">Your game loads after your account session is checked.</p></section></main></div>;
  if (isBackendConfigured() && (!session?.access_token || !profile)) return <div className="app"><header className="topbar"><div className="brand"><span className="brand-mark">⚔</span><span>SHONEN <b>SIEGE</b></span></div><span className="account-required-label">ACCOUNT REQUIRED</span></header><AccountPage session={session} profile={profile} accountLoading={accountLoading} currentSave={save} localSaveBackup={localSaveBackup} saveImported={saveImported} onAuthenticated={onAuthenticated} onSignedOut={onSignedOut} onSaveUpdated={onSaveUpdated} requiredGate /></div>;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={()=>navigateToPage('home')}><span className="brand-mark">⚔</span><span>SHONEN <b>SIEGE</b></span></button>
        <nav>
          {[
            ['home','Home','⌂'],
            ['collection','Collection','▦'],
            ['summon','Summon','✦'],
            ['infinite','Infinite','∞'],
            ['account','Account','◉'],
            ...(profile?.role==='admin' ? [['admin','Admin','⚙']] : []),
          ].map(([key,label,icon])=>
            <button key={key} onClick={()=>navigateToPage(key)} className={page===key?'active':''}><span>{icon}</span>{label}</button>
          )}
        </nav>
        <div className="wallet"><span>💎</span>{save.gems.toLocaleString()}</div>
      </header>

      {page==='home' && <Home key={`home-${configRevision}`} save={save} uniqueOwned={uniqueOwned} setPage={setPage} />}
      {page==='collection' && <Collection key={`collection-${configRevision}`} save={save} squad={squad} toggleSquad={toggleSquad} setSave={setSave} notify={notify} session={session} />}
      {page==='summon' && <Summon key={`summon-${configRevision}`} save={save} setSave={setSave} notify={notify} session={session} />}
      {page==='infinite' && <Infinite key={`infinite-${configRevision}`} save={save} setSave={setSave} squad={squad} setPage={setPage} notify={notify} session={session} />}
      {page==='account' && <AccountPage session={session} profile={profile} accountLoading={accountLoading} currentSave={save} localSaveBackup={localSaveBackup} saveImported={saveImported} onAuthenticated={onAuthenticated} onSignedOut={onSignedOut} onSaveUpdated={onSaveUpdated} />}
      {page==='admin' && session?.access_token && profile?.role==='admin' && <AdminPage session={session} profile={profile} characters={CHARACTERS} gameBalance={GAME_BALANCE} enemyBalance={ENEMY_BALANCE} onConfigChanged={onConfigChanged} notify={notify} />}
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
          <h1>Choose your team.<br/><span>Push further.</span></h1>
          <p>Build a squad that fits your strategy, strengthen your best fighters, and see how far you can survive in Infinite Mode.</p>
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
        <Feature title="Cash stays in the run" body="Cash is only for deploying and upgrading during Infinite Mode. Money-role units add bonus cash after each cleared wave." icon="💰"/>
        <Feature title="Gems survive a loss" body="Every cleared wave pays gems immediately. Lose later and you still keep everything already earned." icon="💎"/>
        <Feature title="Bosses every 4 waves" body="Bosses appear every 4 waves. Three normal enemies reaching the core end the run; a boss breaching it is fatal." icon="👑"/>
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

function Collection({save,squad,toggleSquad,setSave,notify,session}) {
  const [filter,setFilter] = useState('All');
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('rarity');
  const [verse,setVerse] = useState('All Verses');
  const [detailId,setDetailId] = useState(null);
  const detailCharacter = detailId ? getChar(detailId) : null;
  const filtered = useMemo(() => {
    let list = CHARACTERS.filter(c => (filter==='All'||c.rarity===filter) && (verse==='All Verses'||c.anime===verse) && `${c.name} ${c.anime}`.toLowerCase().includes(query.toLowerCase()));
    if (sort==='rarity') list.sort((a,b)=>rarityRank(b.rarity)-rarityRank(a.rarity));
    if (sort==='owned') list.sort((a,b)=>(save.owned[b.id]||0)-(save.owned[a.id]||0));
    if (sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
    return list;
  },[filter,query,sort,verse,save.owned]);

  const sellDuplicate = async (id) => {
    const count = Number(save.owned[id]||0);
    if (count < 2) return notify('You need at least 2 copies before selling one.');
    if (session) {
      try { const result=await rpc(session,'sell_duplicate',{p_character_id:id}); setSave(normalizeSave(result.save)); notify(`Duplicate sold for ${result.gems_awarded} gems.`); }
      catch(e) { notify(`Could not sell duplicate: ${e.message}`); }
      return;
    }
    const c = getChar(id);
    const value = {Common:8,Uncommon:12,Rare:20,Epic:35,Legendary:60,Mythic:100}[c.rarity];
    setSave(s=>({...s,gems:s.gems+value,owned:{...s.owned,[id]:count-1}}));
    notify(`Duplicate sold for ${value} gems.`);
  };

  const unlockSlot = async () => {
    const next = save.unlockedSlots + 1;
    const req = SLOT_RULES[next];
    if (!req) return notify('All 5 squad slots are unlocked.');
    if (save.waveBest < req.wave) return notify(`Reach Wave ${req.wave} first.`);
    if (save.gems < req.gems) return notify(`You need ${req.gems} gems.`);
    if (session) {
      try { setSave(normalizeSave(await rpc(session,'unlock_squad_slot',{}))); notify(`Squad slot ${next} unlocked.`); }
      catch(e) { notify(`Could not unlock slot: ${e.message}`); }
      return;
    }
    setSave(s=>({...s,gems:s.gems-req.gems,unlockedSlots:next}));
    notify(`Squad slot ${next} unlocked.`);
  };

  return (
    <main className="page">
      <div className="page-head">
        <div><div className="eyebrow">ROSTER ARCHIVE</div><h1>Collection</h1><p>Browse fighters by anime verse, track duplicates, and build a five-card squad.</p></div>
        <div className="squad-pill">Squad {squad.length}/{save.unlockedSlots}</div>
      </div>

      <div className="collection-layout">
        <section className="panel">
          <div className="toolbar">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search character or anime..." />
            <select value={verse} onChange={e=>setVerse(e.target.value)}>
              <option>All Verses</option>{[...new Set(CHARACTERS.map(c=>c.anime))].sort().map(v=><option key={v}>{v}</option>)}
            </select>
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
                    {characterImage(save,c.id) ? <img src={characterImage(save,c.id)} alt={c.name}/> : <div className="char-placeholder"><span>{getIcon(c)}</span><small>{c.anime}</small></div>}
                    <div className="rarity-badge">{c.rarity}</div>
                    {owned===0 && <div className="locked-overlay">LOCKED</div>}
                  </div>
                  <div className="char-body">
                    <div className="char-title"><h3>{c.name}</h3><span>{owned}×</span></div>
                    <p>{c.anime}</p>
                    {c.role === 'money' && <div className="role-badge">💰 INCOME ONLY · +{c.incomePerWave} / WAVE</div>}
                    {c.role === 'support' && <div className="role-badge support-role-badge">✦ SUPPORT · +{Math.round((c.buffPercent||0.13)*100)}% NEARBY DAMAGE</div>}
                    <div className="ability-row">{c.abilities.map(a=><span key={a}>{a}</span>)}</div>
                    <div className="card-footer card-footer-wrap">
                      <button className="details-btn" onClick={()=>setDetailId(c.id)}>VIEW STATS</button>
                      <button className={isSelected?'selected-btn':''} disabled={owned===0} onClick={()=>toggleSquad(c.id)}>{isSelected?'REMOVE':'ADD TO SQUAD'}</button>
                      {owned>1 && <button className="sell-btn" onClick={()=>sellDuplicate(c.id)}>SELL DUPLICATE</button>}
                    </div>

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
                <div className="slot-avatar" style={{borderColor:c?RARITY_COLOR[c.rarity]:'#2b3040'}}>{locked?<span>🔒</span>:c&&characterImage(save,c.id)?<img src={characterImage(save,c.id)} alt=""/>:c?<span>{getIcon(c)}</span>:<span>+</span>}</div>
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
      {detailCharacter && (() => {
        const c = detailCharacter;
        const maxLevel = UPGRADE_LIMIT[c.rarity];
        const levels = Array.from({length:maxLevel},(_,i)=>characterLevelStats(c,i+1));
        const moves = characterMoves(c);
        const maxStats = levels[levels.length-1] || characterLevelStats(c,1);
        const baseStats = levels[0] || characterLevelStats(c,1);
        return <div className="stat-modal-backdrop" onClick={()=>setDetailId(null)}>
          <section className="stat-modal" role="dialog" aria-modal="true" aria-label={`${c.name} statistics`} onClick={e=>e.stopPropagation()}>
            <button className="stat-modal-close" onClick={()=>setDetailId(null)} aria-label="Close stats">×</button>
            <div className="eyebrow">CHARACTER DOSSIER · FULL UPGRADE PATH</div>
            <div className="stat-modal-title"><span className="stat-modal-mark" style={{borderColor:RARITY_COLOR[c.rarity],color:RARITY_COLOR[c.rarity]}}>{characterImage(save,c.id)?<img src={characterImage(save,c.id)} alt=""/>:getIcon(c)}</span><div><h2>{c.name}</h2><p>{c.anime} · <b style={{color:RARITY_COLOR[c.rarity]}}>{c.rarity}</b></p><small>{c.role==='money'?'Income unit':c.role==='support'?'Support unit':'Damage unit'} · {maxLevel} total levels</small></div></div>
            <div className="stat-table-wrap"><table className="level-stats-table"><thead><tr><th>LEVEL</th><th>DMG</th><th>RANGE</th><th>SPA</th><th>DPS</th><th>INCOME / WAVE</th><th>SUPPORT BUFF</th><th>UPGRADE COST</th></tr></thead><tbody>
              {levels.map((st,i)=><tr key={st.level}><td><b>{st.level}</b><small>{levelStageLabel(st.level)}</small></td><td>{c.role==='money'?'—':Number(st.damage).toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>{c.role==='money'?'—':Number(st.range).toFixed(1)}</td><td>{c.role==='money'?'—':(Number(st.attackSpeed)/1000).toFixed(2)+'s'}</td><td>{c.role==='money'?'—':Math.round(Number(st.damage)/(Math.max(1,Number(st.attackSpeed))/1000)).toLocaleString()}</td><td>{c.role==='money'?'💰 '+Number(st.income||0).toLocaleString():'—'}</td><td>{c.role==='support'?(Number(st.buffPercent||0)*100).toFixed(1)+'%':'—'}</td><td>{st.level===1?'—':'💰 '+Number(st.upgradeCost||0).toLocaleString()}</td></tr>)}
            </tbody></table></div>
            <div className="stat-modal-bottom"><div><span className="eyebrow">DEPLOY COST</span><strong>💰 {c.cost}</strong></div><div><span className="eyebrow">BASE DPS</span><strong>{c.role==='money'?'—':Math.round(Number(baseStats.damage)/(Math.max(1,Number(baseStats.attackSpeed))/1000))}</strong></div><div><span className="eyebrow">MAX DPS</span><strong>{c.role==='money'?'—':Math.round(Number(maxStats.damage)/(Math.max(1,Number(maxStats.attackSpeed))/1000))}</strong></div></div>
            {c.role==='support' && <p className="stat-footnote">Support aura: nearby damage units gain +{Math.round((c.buffPercent||0.13)*100)}% damage, up to the global support cap.</p>}
            <div className="stat-ability-list"><span className="eyebrow">MOVES & TECHNIQUES</span>{moves.map((move,index)=><div className="stat-move-row" key={`${move.name}-${index}`}><div><b>{move.name}</b><small>Unlocks at Level {Number(move.unlockLevel||[2,4,6][index]||2)} · {Number(move.unlockLevel||[2,4,6][index]||2)<=maxLevel?'Available for this rarity':'Above this rarity’s current cap'}</small></div><span>×{Number(move.damageMultiplier||1).toFixed(2)} damage</span><span>{Number(move.cooldownSeconds||0).toFixed(1)}s cooldown</span><span>{Number(move.splashRadius||0).toFixed(1)} splash</span></div>)}</div>
            <p className="stat-footnote">Damage and range show the exact level values used by the battle system. SPA means seconds per attack. Moves trigger automatically when unlocked and off cooldown.</p>
          </section>
        </div>;
      })()}
    </main>
  );
}

function Summon({save,setSave,notify,session}) {
  const [pack, setPack] = useState(null);
  const [packBanner, setPackBanner] = useState('ALL-UNIT BANNER');
  const [reveal, setReveal] = useState([]);
  const [opening, setOpening] = useState(false);
  const [bestReveal, setBestReveal] = useState(false);
  const [showBannerRoster, setShowBannerRoster] = useState(false);
  const [bannerMode, setBannerMode] = useState('all');
  const [clock, setClock] = useState(Date.now());
  const [skipBest, setSkipBest] = useState(()=>localStorage.getItem('shonen-siege-skip-best')==='true');
  const [sequentialReveal, setSequentialReveal] = useState(()=>localStorage.getItem('shonen-siege-sequential-reveal')!=='false');
  const [sequenceActive, setSequenceActive] = useState(false);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const verses = useMemo(() => [...new Set(CHARACTERS.map(c=>c.anime))].sort(), []);
  const activeVerse = getRotatingVerse(clock, verses);
  const rotationMs = GAME_BALANCE.verseBannerMinutes * 60 * 1000;
  const remainingMs = rotationMs - (clock % rotationMs);
  const remainingLabel = `${Math.floor(remainingMs/60000)}:${String(Math.floor((remainingMs%60000)/1000)).padStart(2,'0')}`;
  const bannerPool = bannerMode === 'all' ? CHARACTERS : CHARACTERS.filter(c=>c.anime===activeVerse);
  const pending = !!pack && (reveal.length < pack.length || (sequenceActive && sequenceIndex === pack.length - 1));
  const open = (count) => {
    if (opening || pending) return;
    const cost = count===1 ? SINGLE_COST : count===5 ? FIVE_COST : TEN_COST;
    if (save.gems < cost) return notify(`You need ${cost} gems.`);
    const pool = bannerMode==='all' ? CHARACTERS : CHARACTERS.filter(c=>c.anime===activeVerse);
    const bannerLabel = bannerMode==='all' ? 'ALL-UNIT BANNER' : `${activeVerse.toUpperCase()} VERSE BANNER`;
    setOpening(true);
    setTimeout(async () => {
      try {
        let results, nextSave;
        if (session) {
          const serverResult = await rpc(session,'perform_summon',{p_count:count,p_verse:bannerMode==='verse'?activeVerse:null});
          results = (serverResult.cards||[]).map(row=>getChar(row.id)||row);
          nextSave = normalizeSave(serverResult.save);
        } else {
          const result = openPack(save.pity,count,pool);
          results = result.results;
          const owned = {...save.owned};
          results.forEach(c=>owned[c.id]=(owned[c.id]||0)+1);
          nextSave = {...save,gems:save.gems-cost,owned,pity:result.nextPity};
        }
        setSave(nextSave);
        setPack(results);
        setPackBanner(bannerLabel);
        setReveal([]); setSequenceIndex(0); setSequenceActive(false);
        setBestReveal(false); setShowBannerRoster(false);
      } catch (e) { notify(`Summon failed: ${e.message}`); }
      finally { setOpening(false); }
    }, 150);
  };
  const startSequentialReveal = () => { if (!pack?.length) return; setBestReveal(false); setSequenceIndex(0); setReveal([0]); setSequenceActive(true); };
  const advanceSequentialReveal = () => {
    if (!pack?.length) return;
    if (sequenceIndex < pack.length - 1) {
      const next = sequenceIndex + 1;
      setSequenceIndex(next);
      setReveal(v=>v.includes(next)?v:[...v,next]);
    } else {
      setSequenceActive(false);
      setReveal(pack.map((_,i)=>i));
    }
  };
  const revealAll = () => {
    if (!pack) return;
    if (skipBest) { if (sequentialReveal) startSequentialReveal(); else setReveal(pack.map((_,i)=>i)); return; }
    setBestReveal(true);
  };
  const showRest = () => { setBestReveal(false); if (sequentialReveal) startSequentialReveal(); else setReveal(pack.map((_,i)=>i)); };
  const bestCard = pack?.reduce((best,c,i)=>best===null||rarityRank(c.rarity)>rarityRank(pack[best].rarity)?i:best,null);

  return (
    <main className="page">
      <div className="page-head">
        <div><div className="eyebrow">SUMMON LAB</div><h1>Shonen Summoning</h1><p>Summon 1 for 100 gems, 5 for 450, or 10 for 900. Reveal your cards before summoning again.</p></div>
        <div className="big-gem">💎 {save.gems.toLocaleString()}</div>
      </div>
      <div className="banner-selector" role="tablist" aria-label="Summon banners">
        <button role="tab" aria-selected={bannerMode==='all'} className={bannerMode==='all'?'banner-option active':'banner-option'} disabled={pending||opening} onClick={()=>{setBannerMode('all');setShowBannerRoster(false);}}>
          <span className="eyebrow">PERMANENT BANNER</span><strong>ALL-UNIT BANNER</strong><small>Every character · {CHARACTERS.length} units</small>
        </button>
        <button role="tab" aria-selected={bannerMode==='verse'} className={bannerMode==='verse'?'banner-option verse-option active':'banner-option verse-option'} disabled={pending||opening} onClick={()=>{setBannerMode('verse');setShowBannerRoster(false);}}>
          <span className="eyebrow">ROTATING BANNER</span><strong>{activeVerse.toUpperCase()}</strong><small>{bannerPool.length} units · changes in {remainingLabel}</small>
        </button>
      </div>
      <div className="summon-layout">
        <section className="panel summon-stage">
          <div className="summon-copy"><div className="eyebrow">{bannerMode==='all'?'ALL-UNIT BANNER':`${activeVerse.toUpperCase()} VERSE BANNER`}</div><h2>OPEN THE GATE.</h2><p>{bannerMode==='all'?'Summon from the full roster of all anime verses.':'Summon only characters from the featured verse. This verse rotates every 45 minutes.'} Duplicates are kept, and higher rarities have lower base rates.</p></div>
          <div className="pack-visual"><div className="pack-glow"></div><div className="pack-mark">🎴</div><div className="pack-name">SHONEN<br/><b>SIEGE</b></div></div>
          <div className="summon-buttons">
            <button className="secondary" disabled={opening||pending} onClick={()=>open(1)}>{opening?'SUMMONING...':'SUMMON 1 — 💎 100'}</button>
            <button className="secondary" disabled={opening||pending} onClick={()=>open(5)}>{opening?'SUMMONING...':'SUMMON 5 — 💎 450'}</button>
            <button className="primary pack-button" disabled={opening||pending} onClick={()=>open(10)}>{opening?'SUMMONING...':'SUMMON 10 — 💎 900'}</button>
          </div>
          <div className="banner-roster-actions"><button className="text-btn" onClick={()=>setShowBannerRoster(v=>!v)}>{showBannerRoster?'HIDE BANNER ROSTER':'VIEW CHARACTERS IN THIS BANNER'} ({bannerPool.length})</button></div>
          {showBannerRoster && <div className="banner-roster"><div className="eyebrow">AVAILABLE CHARACTERS · {bannerMode==='all'?'ALL VERSES':activeVerse}</div><div className="banner-pool-grid">{bannerPool.map(c=><div key={c.id} className="banner-pool-card"><span style={{color:RARITY_COLOR[c.rarity]}}>{c.rarity}</span><b>{c.name}</b><small>{c.anime}</small></div>)}</div></div>}
          <div className="reveal-settings">
            <label className="skip-setting"><input type="checkbox" checked={skipBest} onChange={e=>{setSkipBest(e.target.checked);localStorage.setItem('shonen-siege-skip-best',String(e.target.checked));}}/> Skip featured best-card reveal</label>
            <label className="skip-setting sequential-setting"><input type="checkbox" checked={sequentialReveal} onChange={e=>{setSequentialReveal(e.target.checked);localStorage.setItem('shonen-siege-sequential-reveal',String(e.target.checked));}}/> Reveal cards one by one with a Next button</label>
          </div>
          {pack && <div className="reveal-wrap">
            <div className="reveal-head"><div><div className="eyebrow">LATEST SUMMON · {packBanner}</div><small>{pending?'Reveal every card before summoning again.':'All cards revealed.'}</small></div><button className="text-btn" disabled={!pending||sequenceActive} onClick={revealAll}>{sequentialReveal?'START REVEAL':'REVEAL ALL'}</button></div>
            {sequenceActive && pack[sequenceIndex] && <div className="sequence-reveal-card">
              <div className="sequence-progress"><span>SUMMON REVEAL</span><b>{sequenceIndex+1}/{pack.length}</b></div>
              <div className={`sequence-card-art ${String(pack[sequenceIndex].rarity).toLowerCase()}`}>{characterImage(save,pack[sequenceIndex].id)?<img src={characterImage(save,pack[sequenceIndex].id)} alt={pack[sequenceIndex].name}/>:<strong>{getIcon(pack[sequenceIndex])}</strong>}</div>
              <div className="sequence-card-info"><span className="mini-rarity" style={{color:RARITY_COLOR[pack[sequenceIndex].rarity]}}>{pack[sequenceIndex].rarity}</span><h2>{pack[sequenceIndex].name}</h2><p>{pack[sequenceIndex].anime}</p><small>Edition #{1258 + sequenceIndex}</small></div>
              <div className="sequence-dots">{pack.map((c,i)=><span key={`${c.id}-dot-${i}`} className={i<=sequenceIndex?'done':''} style={{'--dot-color':RARITY_COLOR[c.rarity]}}/>)}</div>
              <button className="primary sequence-next" onClick={advanceSequentialReveal}>{sequenceIndex < pack.length-1 ? `NEXT CARD · ${sequenceIndex+2}/${pack.length}` : 'FINISH REVEAL'}</button>
            </div>}
            {!sequenceActive && <div className="reveal-grid" style={{gridTemplateColumns:`repeat(${pack.length===1?1:5}, minmax(0,1fr))`}}>{pack.map((c,i)=><button key={`${c.id}-${i}`} className={`reveal-card ${reveal.includes(i)?'revealed':''}`} onClick={()=>setReveal(v=>v.includes(i)?v:v.concat(i))}>{reveal.includes(i)?<><span className="mini-rarity" style={{color:RARITY_COLOR[c.rarity]}}>{c.rarity}</span><strong>{c.name}</strong><small>{c.anime}</small>{characterImage(save,c.id)&&<img src={characterImage(save,c.id)} alt=""/>}</>:<b>?</b>}</button>)}</div>}
          </div>}
          {bestReveal && pack && <div className="best-reveal-backdrop"><section className="best-reveal-modal"><div className="eyebrow">HIGHLIGHT CARD</div><div className={`best-card-art ${pack[bestCard].rarity.toLowerCase()}`}>{characterImage(save,pack[bestCard].id)?<img src={characterImage(save,pack[bestCard].id)} alt=""/>:<strong>{getIcon(pack[bestCard])}</strong>}</div><span className="mini-rarity" style={{color:RARITY_COLOR[pack[bestCard].rarity]}}>{pack[bestCard].rarity}</span><h2>{pack[bestCard].name}</h2><p>{pack[bestCard].anime}</p><button className="primary" onClick={showRest}>SHOW THE REST</button></section></div>}
        </section>
        <aside className="panel pity-side"><div className="eyebrow">PITY TRACKER</div>
          {['Rare','Epic','Legendary','Mythic'].map(r=><div className="pity-row" key={r}><div><span style={{color:RARITY_COLOR[r]}}>{r}</span><b>{save.pity[r]}/{PITY[r]}</b></div><div className="progress"><i style={{width:`${Math.min(100,save.pity[r]/PITY[r]*100)}%`,background:RARITY_COLOR[r]}}/></div></div>)}
          <div className="drop-rate-box"><div className="eyebrow">BASE RATES</div>{RARITIES.map(r=><div className="drop-line" key={r}><span><i style={{background:RARITY_COLOR[r]}}></i>{r}</span><b>{BASE_DROP_RATES[r]}%</b></div>)}</div>
          <div className="rule-box"><b>Duplicate sell values</b><div>{RARITIES.map(r=><span key={r}>{r}: 💎 {[8,12,20,35,60,100][rarityRank(r)]}</span>)}</div></div>
        </aside>
      </div>
    </main>
  );
}

const RUN_IDLE = {status:'idle', wave:0, cash:0, hp:100, enemies:[], units:[], gemsEarned:0, serverRunId:null, message:'', messageKind:'normal', nextCountdown:0};

function Infinite({save,setSave,squad,setPage,notify,session}) {
  const [run,setRun] = useState(RUN_IDLE);
  const [autoNext,setAutoNext] = useState(true);
  const [speed,setSpeed] = useState(1);
  const [placementMode,setPlacementMode] = useState(null);
  const timerRef = useRef(null);
  const autoRef = useRef(null);
  const runRef = useRef(run);
  runRef.current = run;

  const activeSquad = squad.slice(0,save.unlockedSlots).map(getChar).filter(Boolean);

  const startRun = async (continueRun) => {
    let startWave = continueRun ? Math.max(1, save.waveBest + 1) : 1;
    let serverRunId = null;
    if (session) {
      try {
        const cloudRun = await rpc(session,'start_infinite_run',{p_continue:Boolean(continueRun)});
        startWave = Number(cloudRun?.start_wave || startWave);
        serverRunId = cloudRun?.run_id || null;
        if (!serverRunId) throw new Error('The backend did not create a run session.');
      } catch (e) {
        notify(`Could not start your cloud run: ${e.message}`);
        return;
      }
    }
    const startCash = Math.round(GAME_BALANCE.startingCash + Math.max(0,startWave-1)*GAME_BALANCE.continueCashPerClearedWave);
    setRun({status:'warning', wave:startWave, cash:startCash, hp:100, enemies:[], units:[], gemsEarned:0, serverRunId, message:`WAVE ${startWave}${startWave%GAME_BALANCE.bossEveryWaves===0?' • BOSS INCOMING':''}`, messageKind:startWave%GAME_BALANCE.bossEveryWaves===0?'boss':'normal', nextCountdown:0});
  };

  const beginWave = (wave) => {
    const count = Math.min(50, GAME_BALANCE.earlyEnemyBaseCount + Math.floor(wave*GAME_BALANCE.enemiesPerWave));
    let counter = Date.now();
    const enemies = Array.from({length:count},(_,i)=>enemyFor(wave,i,count,`${wave}-${counter}-${i}`));
    setRun(r=>({...r,status:'active',enemies, message:wave%GAME_BALANCE.bossEveryWaves===0?`⚠️ BOSS INCOMING — ${enemies[enemies.length-1].name.toUpperCase()}`:`WAVE ${wave} STARTED`,messageKind:wave%GAME_BALANCE.bossEveryWaves===0?'boss':'normal',nextCountdown:0}));
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
        return {...r,status:'warning',wave:next,message:`NEXT WAVE ${next}${next%GAME_BALANCE.bossEveryWaves===0?' • BOSS INCOMING':''}`,messageKind:next%GAME_BALANCE.bossEveryWaves===0?'boss':'normal'};
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
          if (e.progress >= 1) {
            if (e.type === 'boss') hp = 0; // A boss reaching the core immediately ends the run.
            else hp -= e.damage;            // Three normal leaks exceed the 100 HP core.
          } else remaining.push(e);
        }

        // Units attack. Units never depend on nested React state updates.
        const units = current.units.map(u => ({...u, cooldown:Math.max(0,u.cooldown-dt*1000), moveCooldowns:(u.moveCooldowns||characterMoves(u.card).map(()=>0)).map(n=>Math.max(0,Number(n||0)-dt))}));
        for (const u of units) {
          if (u.card.role === 'money') continue;
          if (u.cooldown > 0) continue;
          const upos = {x:u.x,y:u.y};
          const candidates = remaining.filter(e => {
            const p = pathPosition(e.progress);
            if (e.minUnitLevel > u.level) return false;
            if (e.movementType === 'flying' && !characterCanHitAir(u.card)) return false;
            return e.hp > 0 && distancePct(upos.x,upos.y,p.x,p.y) <= u.rangePct;
          }).sort((a,b)=>b.progress-a.progress);
          const target = candidates[0];
          if (!target) continue;
          const supportBonus = units.filter(support => support !== u && support.card.role === 'support' && distancePct(support.x,support.y,u.x,u.y) <= support.rangePct)
            .reduce((sum,support) => sum + Math.max(0,Number(characterLevelStats(support.card,support.level).buffPercent ?? support.card.buffPercent ?? 0.13)), 0);
          const moves = characterMoves(u.card);
          let moveIndex = -1;
          for (let mi=moves.length-1;mi>=0;mi--) {
            const move=moves[mi];
            if (u.level >= Number(move.unlockLevel||[2,4,6][mi]||2) && Number(u.moveCooldowns?.[mi]||0)<=0) { moveIndex=mi; break; }
          }
          const move = moveIndex>=0 ? moves[moveIndex] : null;
          const rawDamage = Number(u.damage||0) * (move ? Number(move.damageMultiplier||1) : 1) * (1 + Math.min(GAME_BALANCE.supportDamageBonusCap, supportBonus));
          const targetPos = pathPosition(target.progress);
          const targets = move && Number(move.splashRadius||0)>0
            ? remaining.filter(e=>e.hp>0 && e.minUnitLevel<=u.level && !(e.movementType==='flying'&&!characterCanHitAir(u.card)) && distancePct(targetPos.x,targetPos.y,pathPosition(e.progress).x,pathPosition(e.progress).y)<=Number(move.splashRadius||0))
            : [target];
          for (const hitTarget of targets) {
            if (hitTarget.hp<=0) continue;
            let damage=rawDamage;
            const shieldHit=Math.min(Math.max(0,Number(hitTarget.shield||0)),damage);
            hitTarget.shield-=shieldHit; damage-=shieldHit;
            if (damage>0) damage*=1-Number(hitTarget.armor||0);
            hitTarget.hp-=damage;
            if (hitTarget.hp<=0) cash+=Number(hitTarget.reward||0);
          }
          u.cooldown = u.attackSpeed;
          if (move) { u.moveCooldowns[moveIndex]=Math.max(0,Number(move.cooldownSeconds||0)); u.lastMove=move.name; }
        }

        remaining = remaining.filter(e => e.hp > 0 && e.progress < 1);

        if (hp <= 0) {
          return {...current,status:'gameover',hp:0,enemies:remaining,units,gemsEarned:current.gemsEarned,message:`RUN LOST ON WAVE ${current.wave}`};
        }
        if (remaining.length===0) {
          const reward = gemReward(current.wave);
          const newBest = Math.max(save.waveBest,current.wave);
          if (session) {
            if (current.serverRunId) {
              rpc(session,'claim_wave_reward',{p_run_id:current.serverRunId,p_wave:current.wave})
                .then(result=>setSave(normalizeSave(result.save)))
                .catch(e=>notify(`Cloud wave reward failed: ${e.message}`));
            } else {
              notify('This run was not started with a cloud run session, so its wave reward was not synced. Start a fresh run while signed in.');
            }
          } else {
            setSave(s=>({...s,gems:s.gems+reward,waveBest:newBest}));
          }
          const waveStipend = GAME_BALANCE.waveCashBase + current.wave * GAME_BALANCE.waveCashPerWave;
          const incomeBonus = units.reduce((sum,u)=>sum + unitIncome(u),0);
          const cashRewardTotal = waveStipend + incomeBonus;
          return {...current,status:'cleared',enemies:[],units,cash:cash+cashRewardTotal,gemsEarned:current.gemsEarned+reward,message:`WAVE ${current.wave} CLEARED • +💎 ${reward} • +💰 ${cashRewardTotal}`,messageKind:'clear'};
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
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    const x = Math.max(5,Math.min(95,rawX));
    const y = Math.max(6,Math.min(94,rawY));
    if (run.units.some(u=>distancePct(x,y,u.x,u.y)<7)) return notify('Too close to another unit.');
    // Measure distance to every road segment, not just its corners.
    const pathDist = PATH.slice(0,-1).reduce((best,a,i)=>{
      const b=PATH[i+1], dx=b[0]-a[0], dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
      return Math.min(best,distancePct(x,y,a[0]+t*dx,a[1]+t*dy));
    },Infinity);
    if (pathDist < 8) return notify('Place units beside the road, not on it.');
    if (run.cash < card.cost) return notify(`Need ${card.cost} cash to deploy ${card.name}.`);
    const baseStats = characterLevelStats(card,1);
    const unit = {
      card, level:1, x,y,
      damage:Number(baseStats.damage||0),
      rangePct:Number(baseStats.range||0),
      attackSpeed:Number(baseStats.attackSpeed||0),
      cooldown:card.role === 'money' ? 0 : 120,
      moveCooldowns:characterMoves(card).map(()=>0),
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
      const nextStats = characterLevelStats(u.card,u.level+1);
      const cost = Math.max(0,Number(nextStats.upgradeCost||0));
      if (r.cash < cost) { notify(`Not enough cash. ${u.card.name}'s next upgrade costs ${cost}.`); return r; }
      return {...r,cash:r.cash-cost,units:r.units.map((x,i)=>{
        if (i !== index) return x;
        return {...x,level:x.level+1,damage:Number(nextStats.damage||0),rangePct:Number(nextStats.range||0),attackSpeed:Number(nextStats.attackSpeed||0),moveCooldowns:(x.moveCooldowns||characterMoves(x.card).map(()=>0))};
      })};
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
    if (run.status==='cleared') setRun(r=>({...r,status:'warning',wave:r.wave+1,message:`WAVE ${r.wave+1}${(r.wave+1)%GAME_BALANCE.bossEveryWaves===0?' • BOSS INCOMING':''}`,messageKind:(r.wave+1)%GAME_BALANCE.bossEveryWaves===0?'boss':'normal'}));
    else notify('Finish the current wave first.');
  };

  const quit = () => {
    setPlacementMode(null);
    if (session && run.serverRunId) rpc(session,'finish_infinite_run',{p_run_id:run.serverRunId}).catch(e=>console.warn('Could not close cloud run:',e));
    setRun({...RUN_IDLE,message:'RUN QUIT • CLEARED WAVE GEMS KEPT',messageKind:'normal'});
  };

  const restart = () => {
    setPlacementMode(null);
    void startRun(false);
  };

  useEffect(() => {
    if (session && run.status==='gameover' && run.serverRunId) {
      rpc(session,'finish_infinite_run',{p_run_id:run.serverRunId}).catch(e=>console.warn('Could not close cloud run:',e));
    }
  }, [session?.access_token,run.status,run.serverRunId]);

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
          <button className="toggle" onClick={()=>setSpeed(s=>s===1?1.5:s===1.5?2:1)}>⚡ Speed {speed}x</button>
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
            <div><span>Core</span><b className={run.hp<35?'danger-text':''}>❤ {Math.max(0,Math.ceil(run.hp))}/100</b></div>
            <div><span>Enemies</span><b>{run.enemies.length}</b></div>
          </div>

          <div className={`map ${placementMode?'placing':''}`} onClick={place}>
            <svg className="terrain-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="hillBack" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#42624c"/><stop offset="100%" stopColor="#263e35"/></linearGradient>
                <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#314e3f"/><stop offset="100%" stopColor="#20382f"/></linearGradient>
              </defs>
              <path d="M0 0H100V19C90 23 85 11 76 14S62 28 52 22 36 9 25 16 10 27 0 20Z" fill="url(#hillBack)"/>
              <path d="M0 100V82C10 78 14 69 24 75S39 91 51 82 66 70 77 79 92 93 100 84V100Z" fill="url(#hillFront)"/>
              <path d="M0 28C9 22 14 24 20 30S31 41 42 31 57 21 64 29 76 41 88 31 96 29 100 32" fill="none" stroke="#708b66" strokeWidth="0.55" opacity="0.75"/>
              <path d="M0 74C12 66 20 73 28 79S44 87 56 78 70 67 81 76 94 83 100 79" fill="none" stroke="#6b8b62" strokeWidth="0.7" opacity="0.7"/>
              <g fill="#1c342b" opacity="0.72"><circle cx="8" cy="15" r="2.5"/><circle cx="12" cy="17" r="1.9"/><circle cx="29" cy="25" r="2.2"/><circle cx="34" cy="22" r="1.8"/><circle cx="68" cy="15" r="2.4"/><circle cx="72" cy="18" r="2"/><circle cx="92" cy="23" r="2.5"/><circle cx="18" cy="88" r="2.5"/><circle cx="23" cy="90" r="1.8"/><circle cx="60" cy="89" r="2.5"/><circle cx="65" cy="86" r="1.7"/><circle cx="87" cy="89" r="2.4"/></g>
              <g fill="#a4b783" opacity="0.65"><circle cx="7" cy="13" r="0.6"/><circle cx="28" cy="23" r="0.6"/><circle cx="69" cy="13" r="0.7"/><circle cx="91" cy="21" r="0.6"/><circle cx="19" cy="86" r="0.6"/><circle cx="61" cy="87" r="0.6"/></g>
            </svg>
            <svg className="road-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={PATH.map(([x,y])=>`${x},${y}`).join(' ')} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={PATH.map(([x,y])=>`${x},${y}`).join(' ')} fill="none" stroke="#50596b" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={PATH.map(([x,y])=>`${x},${y}`).join(' ')} fill="none" stroke="#697386" strokeWidth="1.2" strokeDasharray="2 3" strokeLinejoin="round"/>
            </svg>
            <div className="gate">SPAWN</div>
            <div className="core">🏯</div>
            {run.enemies.map(e=>{
              const p=pathPosition(e.progress);
              return <div key={e.id} className={`enemy-token ${e.type} ${e.movementType==='flying'?'is-flying':''} ${e.type==='boss'||e.type==='strong-2'?'is-heavy':''}`} style={{left:`${p.x}%`,top:`${p.y}%`}}>
                <div className="enemy-icon" aria-label={`${e.type} enemy`}>{enemyImage(e.type,e.name) ? <img src={enemyImage(e.type,e.name)} alt=""/> : ({boss:'♛',fast:'↯',tank:'⬟',regen:'✚',shield:'⬡',armored:'▣',normal:'◆',flying:'✦','strong-1':'⬢','strong-2':'♜'})[e.type] || '◆'}</div>
                <div className="enemy-health"><i style={{width:`${Math.max(0,(e.hp/e.maxHp)*100)}%`}}/></div>
                {e.type==='boss' && <span className="boss-tag">{e.name}</span>}
                {(!['normal','fast','tank','regen','shield','armored','flying','strong-1','strong-2','boss'].includes(e.type)) && <span className="enemy-name-tag">{e.name}</span>}
              </div>
            })}
            {run.units.map((u,i)=><button key={`${u.card.id}-${i}`} className={`placed-unit ${selectedUnit===i?'selected':''}`} style={{left:`${u.x}%`,top:`${u.y}%`,borderColor:RARITY_COLOR[u.card.rarity]}} onClick={e=>{e.stopPropagation();setSelectedUnit(i);}} title={`${u.card.name} Lv.${u.level}`}> 
              {characterImage(save,u.card.id)?<img src={characterImage(save,u.card.id)} alt=""/>:<span>{getIcon(u.card)}</span>}
              <small>{u.card.role==='money'?`Lv.${u.level} 💰`:`Lv.${u.level}/${UPGRADE_LIMIT[u.card.rarity]}`}</small>
            </button>)}
            {selectedUnitData && selectedUnitData.card.role !== 'money' && <div className={`range-ring ${selectedUnitData.card.role==='support'?'support-range-ring':''}`} style={{left:`${selectedUnitData.x}%`,top:`${selectedUnitData.y}%`,width:`${selectedUnitData.rangePct*2}%`,height:`${selectedUnitData.rangePct*2}%`,borderColor:RARITY_COLOR[selectedUnitData.card.rarity]}}/>}

            {run.status==='warning' && <div className={`wave-banner ${run.messageKind==='boss'?'boss':''}`}>{run.message}</div>}
            {run.status==='active' && run.messageKind==='clear' && <div className="wave-banner clear">{run.message}</div>}
            {run.status==='cleared' && <div className="wave-banner clear">{run.message}</div>}
            {run.status==='gameover' && <div className="run-overlay"><h2>RUN OVER</h2><p>Wave {run.wave} ended before it was cleared.</p><div className="overlay-reward">💎 +{run.gemsEarned} kept from cleared waves</div><button className="primary" onClick={continueRun}>CONTINUE FROM WAVE {Math.max(1,save.waveBest+1)}</button><button className="secondary" onClick={restart}>RESTART FROM WAVE 1</button><button className="text-btn" onClick={()=>setPage('home')}>BACK HOME</button></div>}
            {run.status==='idle' && <div className="run-overlay"><h2>{save.waveBest>0?'READY TO PUSH FURTHER':'FIRST RUN'}</h2><p>{save.waveBest>0?`Highest cleared wave: ${save.waveBest}`:'Clear a wave to start earning permanent gems.'}</p><div className="overlay-row">{save.waveBest>0 && <button className="primary" onClick={continueRun}>CONTINUE — WAVE {save.waveBest+1}</button>}<button className="secondary" onClick={restart}>RESTART — WAVE 1</button></div></div>}
          </div>

          {selectedUnitData && <div className="selected-unit-panel">
            <div className="selected-unit-head"><div><div className="eyebrow">SELECTED UNIT</div><h3>{selectedUnitData.card.name}</h3><span>{selectedUnitData.card.rarity} • Level {selectedUnitData.level}/{UPGRADE_LIMIT[selectedUnitData.card.rarity]}</span></div><button className="text-btn" onClick={()=>setSelectedUnit(null)}>CLOSE</button></div>
            <div className="unit-stat-preview">
              {selectedUnitData.card.role === 'money' ? <div><span>CURRENT INCOME</span><b>💰 {unitIncome(selectedUnitData)} / WAVE</b><small>Level {selectedUnitData.level} · income-only unit</small></div> : <div><span>CURRENT</span><b>DMG {Math.round(selectedUnitData.damage)}</b><small>RANGE {selectedUnitData.rangePct.toFixed(1)} · SPA {(selectedUnitData.attackSpeed/1000).toFixed(2)}s</small>{selectedUnitData.lastMove&&<em>Last technique: {selectedUnitData.lastMove}</em>}</div>}
              {selectedUnitData.level < UPGRADE_LIMIT[selectedUnitData.card.rarity] && (()=>{const next=characterLevelStats(selectedUnitData.card,selectedUnitData.level+1);const move=characterMoves(selectedUnitData.card).find(m=>Number(m.unlockLevel)===selectedUnitData.level+1);return <div><span>NEXT LEVEL · {levelStageLabel(selectedUnitData.level+1)}</span><b>{selectedUnitData.card.role==='money'?`💰 ${Math.round(next.income)} / WAVE`:`DMG ${Math.round(next.damage)} · RANGE ${Number(next.range).toFixed(1)}`}</b><small>{selectedUnitData.card.role==='money'?`+💰 ${Math.round(next.income-unitIncome(selectedUnitData))} / wave`:`SPA ${(Number(next.attackSpeed)/1000).toFixed(2)}s · DPS ${Math.round(Number(next.damage)/(Math.max(1,Number(next.attackSpeed))/1000))}`}</small>{move&&<em>Technique unlock: {move.name}</em>}{selectedUnitData.card.role==='support'&&<em>Support buff: {(Number(next.buffPercent||0)*100).toFixed(1)}%</em>}</div>})()}
            </div>
            <div className="selected-actions">
              <button className="primary" disabled={selectedUnitData.level >= UPGRADE_LIMIT[selectedUnitData.card.rarity]} onClick={()=>upgrade(selectedUnit)}>UPGRADE — 💰 {selectedUnitData.level>=UPGRADE_LIMIT[selectedUnitData.card.rarity]?'MAX':Math.round(characterLevelStats(selectedUnitData.card,selectedUnitData.level+1).upgradeCost||0)}</button>
              <button className="danger" onClick={()=>{sellUnit(selectedUnit);setSelectedUnit(null);}}>SELL</button>
            </div>
          </div>}
        </section>

        <aside className="panel squad-deploy-panel">
          <div className="side-head"><div><div className="eyebrow">DEPLOYMENT</div><h2>Your squad</h2><p className="muted">{activeSquad.length}/{save.unlockedSlots} cards • {DEPLOY_LIMIT} field placements max</p></div></div>
          <div className="deploy-list">
            {activeSquad.map(c=>{
              const copies=run.units.filter(u=>u.card.id===c.id).length;
              const available=characterImage(save,c.id);
              const disabled=run.cash<c.cost||copies>=COPY_LIMIT[c.rarity]||run.units.length>=DEPLOY_LIMIT||!['active','warning','cleared'].includes(run.status);
              return <div className="deploy-card" key={c.id}>
                <div className="deploy-avatar" style={{borderColor:RARITY_COLOR[c.rarity]}}>{available?<img src={available} alt=""/>:<span>{getIcon(c)}</span>}</div>
                <div className="deploy-details"><b>{c.name}</b><small>{c.rarity} • {copies}/{COPY_LIMIT[c.rarity]} copies{c.role==='money'?' • Income only':c.role==='support'?' • Support':''}</small><span>Deploy 💰 {c.cost}{c.role==='money'?` · +${c.incomePerWave}/wave`:c.role==='support'?` · +${Math.round((c.buffPercent||0.13)*100)}% aura`:''}</span></div>
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



// Mount the React app into index.html's #root element.
createRoot(document.getElementById('root')).render(<App />);
