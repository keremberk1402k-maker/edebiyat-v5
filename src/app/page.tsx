"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, set, push, onValue, off, get } from "firebase/database";

// ─── FIREBASE ───────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBYSeseAvQmVRLwT-0jHbstPzk68hvGo_I",
  authDomain: "edebiyat-efsaneleri.firebaseapp.com",
  databaseURL: "https://edebiyat-efsaneleri-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "edebiyat-efsaneleri",
  storageBucket: "edebiyat-efsaneleri.firebasestorage.app",
  messagingSenderId: "808627245441",
  appId: "1:808627245441:web:08308f5da0c8b077c9d880",
  measurementId: "G-HTGY2ZFJ1L",
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db  = getDatabase(app);
const SAVE_KEY = "edb_v47_ultra_fix";

// ─── TİPLER ─────────────────────────────────────────────────────────────────
type Item = { id:string; name:string; type:"wep"|"arm"|"acc"|"joker"; val:number; cost:number; icon:string; jokerId?:string };
type Region = { id:string; name:string; x:number; y:number; type:string; bg:string; unlockC:string; levels:Level[] };
type Level  = { id:string; t:string; hp:number; en:string; ico:string; diff:string; isBoss?:boolean };
type Q      = { q:string; o:string[]; a:number; topic:string };
type Player = {
  name:string; pass:string; hp:number; maxHp:number; gold:number; xp:number; maxXp:number; lvl:number;
  inventory:Item[]; equipped:{wep:Item|null;arm:Item|null}; jokers:{[k:string]:number};
  mistakes:string[]; score:number; unlockedRegions:string[]; regionProgress:{[k:string]:number};
  unlockedCostumes:string[]; currentCostume:string; tutorialSeen:boolean; arenaRulesSeen?:boolean;
  arenaScore?:number; arenaGames?:number;
  battleWins?:number; battleLoses?:number; totalBattles?:number;
  friends?:string[]; classCode?:string;
  badges?:string[];
};
type FriendReq = { from:string; to:string; status:"pending"|"accepted"; ts:number };
type ClassRoom = { code:string; name:string; owner:string; members:string[]; createdAt:number };
type Clan = {
  tag:string; name:string; leader:string; createdAt:number;
  members:{[name:string]:{role:"leader"|"officer"|"member"; joinedAt:number}};
};
type DuelReq = { from:string; to:string; status:"pending"|"accepted"|"declined"; ts:number; matchId?:string };
type BattleState = {
  active:boolean; region?:Region; level?:Level; enemyHp:number; maxEnemyHp:number;
  qs:Q[]; qIdx:number; timer:number; combo:number; log:string|null;
  wait:boolean; dmgText:{val:number;c:string}|null; shaking:boolean;
};
// Tüm sayısal - Firebase null yazamaz
type MatchState = {
  hostHp:number; guestHp:number; qIdx:number; qs:Q[];
  started:boolean; questionStartTime:number;
  hostAnswerCorrect:number; hostAnswerTime:number;   // -1=yok 0=yanlış 1=doğru
  guestAnswerCorrect:number; guestAnswerTime:number;
  resolving:boolean; log:string;
};
type MatchData = { id:string; players:{host:string;guest:string}; state:MatchState; createdAt:number };
type PvPState  = { matchId:string|null; matchData:MatchData|null; side:"host"|"guest"|null };


// ─── LİG SİSTEMİ ────────────────────────────────────────────────────────────
const LEAGUES = [
  { name:"Bronz",     icon:"🥉", min:0,    max:499,  color:"#cd7f32", bg:"rgba(205,127,50,0.15)" },
  { name:"Gümüş",    icon:"🥈", min:500,  max:1499, color:"#c0c0c0", bg:"rgba(192,192,192,0.15)" },
  { name:"Altın",    icon:"🥇", min:1500, max:2999, color:"#ffd700", bg:"rgba(255,215,0,0.15)" },
  { name:"Platin",   icon:"💎", min:3000, max:5999, color:"#00eaff", bg:"rgba(0,234,255,0.15)" },
  { name:"Elmas",    icon:"💠", min:6000, max:9999, color:"#b9f2ff", bg:"rgba(185,242,255,0.2)" },
  { name:"Efsane",   icon:"👑", min:10000,max:Infinity,color:"#fc0", bg:"rgba(255,200,0,0.2)" },
];
const getLeague = (score:number) => LEAGUES.find(l=>score>=l.min&&score<=l.max) || LEAGUES[0];

// ─── İÇERİK ─────────────────────────────────────────────────────────────────
const ITEMS: {[k:string]:Item} = {
  w1:{id:"w1",name:"Paslı Kalem",type:"wep",val:20,cost:50,icon:"✏️"},
  w2:{id:"w2",name:"Dolma Kalem",type:"wep",val:45,cost:250,icon:"✒️"},
  w3:{id:"w3",name:"Efsanevi Asa",type:"wep",val:120,cost:1500,icon:"🪄"},
  a1:{id:"a1",name:"Eski Defter",type:"arm",val:50,cost:50,icon:"📓"},
  a2:{id:"a2",name:"Ansiklopedi",type:"arm",val:250,cost:500,icon:"📚"},
  a3:{id:"a3",name:"Çelik Zırh",type:"arm",val:600,cost:2000,icon:"🛡️"},
  j1:{id:"j1",name:"Can İksiri",type:"joker",val:0,cost:100,icon:"🧪",jokerId:"heal"},
  j2:{id:"j2",name:"%50 Şans",type:"joker",val:0,cost:100,icon:"½",jokerId:"5050"},
  j3:{id:"j3",name:"Pas Geç",type:"joker",val:0,cost:150,icon:"⏩",jokerId:"skip"},
};
const COSTUMES:{[k:string]:{n:string;i:string}} = {
  default:{n:"Öğrenci",i:"🧑‍🎓"}, prince:{n:"Prens",i:"🤴"},
  divan:{n:"Divan Şairi",i:"👳"}, halk:{n:"Ozan",i:"🎸"}, king:{n:"Kral",i:"👑"},
};
const REGIONS:Region[] = [
  {id:"tut",name:"Başlangıç",x:20,y:80,type:"iletisim",bg:"https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1000",unlockC:"default",
   levels:[{id:"l1",t:"Tanışma",hp:50,en:"Çırak",ico:"👶",diff:"Kolay"},{id:"l2",t:"Söz Savaşı",hp:80,en:"Kalfa",ico:"👦",diff:"Orta",isBoss:true}]},
  {id:"r1",name:"İletişim Vadisi",x:40,y:60,type:"iletisim",bg:"https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1000",unlockC:"prince",
   levels:[{id:"l3",t:"Kodlar",hp:150,en:"Hatip",ico:"🗣️",diff:"Orta"},{id:"b1",t:"Büyük İletişimci",hp:300,en:"Uzman",ico:"📡",diff:"Zor",isBoss:true}]},
  {id:"r2",name:"Hikaye Ormanı",x:60,y:40,type:"hikaye",bg:"https://images.unsplash.com/photo-1448375240586-dfd8d395ea6c?w=1000",unlockC:"halk",
   levels:[{id:"l4",t:"Olay Örgüsü",hp:250,en:"Yazar",ico:"📝",diff:"Zor"},{id:"b2",t:"Dede Korkut",hp:500,en:"Bilge",ico:"👴",diff:"Boss",isBoss:true}]},
  {id:"r3",name:"Arena",x:80,y:20,type:"all",bg:"https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1000",unlockC:"king",
   levels:[{id:"b4",t:"SON SAVAŞ",hp:1200,en:"Cehalet",ico:"🐲",diff:"Final",isBoss:true}]},
];
// Sorular artık Firebase'den yükleniyor - DEFAULT_QUESTIONS sadece ilk yüklemede kullanılır
const DEFAULT_QUESTIONS:Q[] = [
  {q:"İletişimi başlatan öğe?",o:["Alıcı","Kanal","Gönderici","Dönüt"],a:2,topic:"iletisim"},
  {q:"Sözlü iletişim türü?",o:["Mektup","Panel","Dilekçe","Roman"],a:1,topic:"iletisim"},
  {q:"Kitle iletişim aracı örneği?",o:["Radyo","Mektup","Günlük","Roman"],a:0,topic:"iletisim"},
  {q:"İletişimde geri bildirime ne denir?",o:["Dönüt","Kanal","Gönderi","Alıcı"],a:0,topic:"iletisim"},
  {q:"İletişim modelinde kanal ne işe yarar?",o:["Mesajı taşıma","Alıcıyı seçme","Şifreleme","Yazma"],a:0,topic:"iletisim"},
  {q:"Olay hikâyesi temsilcisi kimdir?",o:["Sait Faik","Ömer Seyfettin","Memduh Şevket","Nurullah Ataç"],a:1,topic:"hikaye"},
  {q:"İlk yerli roman hangisidir?",o:["Taaşşuk-ı Talat","İntibah","Eylül","Cezmi"],a:0,topic:"hikaye"},
  {q:"Çalıkuşu romanının yazarı?",o:["Reşat Nuri","Halide Edip","Yakup Kadri","Refik Halit"],a:1,topic:"hikaye"},
  {q:"Dede Korkut hikâyeleri kaç tane?",o:["12","10","14","8"],a:0,topic:"hikaye"},
  {q:"Olay örgüsü en çok hangi türde önemlidir?",o:["Roman","Şiir","Makale","Deneme"],a:0,topic:"hikaye"},
  {q:"Divan edebiyatında nazım birimi nedir?",o:["Dörtlük","Beyit","Bent","Kıta"],a:1,topic:"siir"},
  {q:"Halk şiirinde 11'li ölçü hangi türde kullanılır?",o:["Koşma","Mani","Semai","Destan"],a:0,topic:"siir"},
  {q:"Sessiz Gemi şiiri kime aittir?",o:["Yahya Kemal","Ahmet Haşim","Necip Fazıl","Akif Ersoy"],a:0,topic:"siir"},
  {q:"Garip akımının kurucusu kimdir?",o:["Orhan Veli","Cemal Süreya","Edip Cansever","Turgut Uyar"],a:0,topic:"siir"},
  {q:"İkinci Yeni hareketinden biri kimdir?",o:["Cemal Süreya","Orhan Veli","Oktay Rifat","Melih Cevdet"],a:0,topic:"siir"},
  {q:"İlk tarihi roman hangisidir?",o:["Cezmi","İntibah","Vatan","Eylül"],a:0,topic:"genel"},
  {q:"Milli Edebiyat hareketinin öncüsü kimdir?",o:["Ziya Gökalp","Namık Kemal","Fuzuli","Baki"],a:0,topic:"genel"},
  {q:"Beş Hececilerden biri kimdir?",o:["Faruk Nafiz","Orhan Veli","Cemal Süreya","Nazım Hikmet"],a:0,topic:"genel"},
  {q:"Vatan şairi olarak bilinen kimdir?",o:["Namık Kemal","Ziya Paşa","Şinasi","Tevfik Fikret"],a:0,topic:"genel"},
  {q:"İstiklal Marşı'nın vezni nedir?",o:["Hece","Aruz","Serbest","Syllabic"],a:1,topic:"genel"},
  {q:"Beş Hececiler akımı hangi alandır?",o:["Şiir","Roman","Tiyatro","Deneme"],a:0,topic:"siir"},
  {q:"İlk yerli roman yazarlarından biri?",o:["Şemsettin Sami","Halide Edip","Yakup Kadri","Refik Halit"],a:0,topic:"hikaye"},
  {q:"Edebi türlerden hangisi düzyazıdır?",o:["Roman","Şiir","Şarkı","Mani"],a:0,topic:"genel"},
  {q:"Servet-i Fünun döneminde öne çıkan tür?",o:["Şiir","Roman","Tiyatro","Masal"],a:0,topic:"siir"},
  {q:"Halk edebiyatında temel ölçü hangisidir?",o:["Hece","Aruz","Serbest","Klasik"],a:0,topic:"siir"},
  {q:"Hikaye türlerinden hangisi durum hikayesidir?",o:["Maupassant","Çehov","Olay","Klasik"],a:1,topic:"hikaye"},
  {q:"Roman türünde karakter gelişimi en çok nerede görülür?",o:["Roman","Şiir","Makale","Mektup"],a:0,topic:"hikaye"},
  {q:"Divan edebiyatında kafiye sistemi genellikle nasıldır?",o:["Beyitlere dayalı","Serbest","Hece","Ritim"],a:0,topic:"siir"},
  {q:"Kurgu dışı türler arasında hangisi vardır?",o:["Deneme","Roman","Masal","Şiir"],a:0,topic:"genel"},
  {q:"Edebi akımlar arasında gerçekçi akımın öncüsü kimdir?",o:["Namık Kemal","Zola","Orhan Veli","Cahit Sıtkı"],a:1,topic:"genel"},
  {q:"Divan ve Halk edebiyatı arasındaki temel fark nedir?",o:["Dil","Renk","Ses","Matbaa"],a:0,topic:"genel"},
  {q:"Toplumcu gerçekçi şiirin önde gelen ismi kimdir?",o:["Nazım Hikmet","Ahmet Haşim","Yahya Kemal","Tanpınar"],a:0,topic:"siir"},
];

// ─── STİLLER ────────────────────────────────────────────────────────────────
const S = {
  glass:{ background:"rgba(16,20,24,0.88)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"16px", boxShadow:"0 18px 40px rgba(0,0,0,0.5)", color:"white" },
  btn:{ background:"linear-gradient(135deg,#00c6ff,#0072ff)", border:"none", color:"white", padding:"12px 15px", borderRadius:"12px", cursor:"pointer", fontWeight:"700", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:"8px", transition:"0.18s", boxShadow:"0 6px 18px rgba(0,114,255,0.18)", textTransform:"uppercase" as const, fontSize:"14px" },
  btnDanger:  { background:"linear-gradient(135deg,#ff416c,#ff4b2b)", boxShadow:"0 6px 15px rgba(255,75,43,0.28)" },
  btnSuccess: { background:"linear-gradient(135deg,#11998e,#38ef7d)", boxShadow:"0 6px 15px rgba(56,239,125,0.28)" },
  btnGold:    { background:"linear-gradient(135deg,#f7971e,#ffd200)", boxShadow:"0 6px 15px rgba(255,210,0,0.28)", color:"#000" },
  neon:(c:string)=>({ color:c, textShadow:`0 0 10px ${c}, 0 0 18px ${c}` }),
  bar:{ height:"12px", background:"#222", borderRadius:"6px", overflow:"hidden", marginTop:"8px", border:"1px solid rgba(255,255,255,0.12)" },
};

const ARENA_BG = "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1000";

// ─── ROZET SİSTEMİ ──────────────────────────────────────────────────────────
const BADGES:{[id:string]:{icon:string;name:string;desc:string;check:(p:Player)=>boolean}} = {
  ilk_adim:   { icon:"👶", name:"İlk Adım",      desc:"İlk savaşını kazandın",           check:p=>(p.battleWins||0)>=1 },
  savasci:    { icon:"⚔️", name:"Savaşçı",        desc:"10 savaş kazandın",               check:p=>(p.battleWins||0)>=10 },
  efsane_s:   { icon:"🏆", name:"Efsane Savaşçı", desc:"50 savaş kazandın",               check:p=>(p.battleWins||0)>=50 },
  arena_acemi:{ icon:"🥉", name:"Arena Acemisi",  desc:"İlk arena maçını oynadın",        check:p=>(p.arenaGames||0)>=1 },
  arena_usta: { icon:"🥇", name:"Arena Ustası",   desc:"50 arena maçı oynadın",           check:p=>(p.arenaGames||0)>=50 },
  zengin:     { icon:"💰", name:"Zengin",          desc:"1000 altın biriktirdin",          check:p=>p.gold>=1000 },
  koleksiyoner:{ icon:"👑",name:"Koleksiyoner",   desc:"3 kostüm açtın",                  check:p=>p.unlockedCostumes.length>=3 },
  lig_gumus:  { icon:"🥈", name:"Gümüş Ligci",    desc:"Gümüş Lig'e ulaştın",            check:p=>(p.arenaScore||0)>=500 },
  lig_altin:  { icon:"🥇", name:"Altın Ligci",    desc:"Altın Lig'e ulaştın",             check:p=>(p.arenaScore||0)>=1500 },
  lig_efsane: { icon:"👑", name:"Efsane",          desc:"Efsane Lig'e ulaştın",           check:p=>(p.arenaScore||0)>=10000 },
  level10:    { icon:"⚡", name:"Güçlü",           desc:"Seviye 10'a ulaştın",             check:p=>p.lvl>=10 },
  sosyal:     { icon:"🤝", name:"Sosyal",          desc:"3 arkadaş edindin",               check:p=>(p.friends||[]).length>=3 },
};

const checkAndAwardBadges = (p:Player):Player => {
  const current = p.badges||[];
  const newBadges = Object.keys(BADGES).filter(id=>!current.includes(id)&&BADGES[id].check(p));
  if(newBadges.length===0) return p;
  return {...p, badges:[...current,...newBadges]};
};
const shuffle = <T,>(a:T[]) => a.slice().sort(()=>Math.random()-0.5);
const isAdmin = (name:string) => ["ADMIN","ADMIN2"].includes(name);

// ─── BILEŞEN ────────────────────────────────────────────────────────────────
export default function Game() {
  const [screen,    setScreen]    = useState<"auth"|"menu"|"battle"|"map"|"shop"|"inv"|"arena"|"admin"|"profile"|"social"|"classroom">("auth");
  const [platform,  setPlatform]  = useState<"mobile"|"pc"|null>(null);
  const [player,    setPlayer]    = useState<Player|null>(null);
  const [auth,      setAuth]      = useState({ user:"", pass:"", reg:false });
  const [battle,    setBattle]    = useState<BattleState>({ active:false, enemyHp:0, maxEnemyHp:0, qs:[], qIdx:0, timer:20, combo:0, log:null, wait:false, dmgText:null, shaking:false });
  const [modal,     setModal]     = useState<Region|"wardrobe"|null>(null);
  const [notif,     setNotif]     = useState<string|null>(null);
  const [botMatch,  setBotMatch]  = useState(false);
  const [turn,      setTurn]      = useState<"p1"|"p2">("p1");
  const [mounted,   setMounted]   = useState(false);
  const [lastAns,   setLastAns]   = useState<{idx:number|null;correct:boolean|null;chosen:number|null}>({idx:null,correct:null,chosen:null});
  const [showAnswer, setShowAnswer] = useState<{correctIdx:number;chosenIdx:number;correct:boolean}|null>(null);
  const [leaderboard, setLeaderboard] = useState<{name:string;score:number;lvl:number;games?:number}[]>([]);

  const [gameLocked,    setGameLocked]    = useState(false);
  // Admin panel states
  const [adminUsers,    setAdminUsers]    = useState<{[k:string]:{ score:number; lvl:number; name?:string; arenaScore?:number; arenaGames?:number }}>({});
  const [adminQuestion, setAdminQuestion] = useState({ q:"", o:["","","",""], a:0, topic:"genel" });
  const [adminTab,      setAdminTab]      = useState<"users"|"questions"|"clans"|"system">("users");
  const [allQuestions,   setAllQuestions]   = useState<(Q&{fbKey?:string})[]>([]);
  const [editingQ,       setEditingQ]       = useState<(Q&{fbKey?:string})|null>(null);
  const [customQs,       setCustomQs]       = useState<Q[]>([]); // artık kullanılmıyor, allQuestions var

  // Profil / Sosyal / Sınıf state'leri
  const [viewProfile,   setViewProfile]   = useState<string|null>(null); // hangi oyuncunun profili
  const [friends,       setFriends]       = useState<{name:string;score:number;lvl:number;arenaScore:number;costume:string;online?:boolean}[]>([]);
  const [friendReqs,    setFriendReqs]    = useState<FriendReq[]>([]);
  const [friendInput,   setFriendInput]   = useState("");
  const [socialTab,     setSocialTab]     = useState<"friends"|"requests"|"classroom">("friends");
  const [classroom,     setClassroom]     = useState<ClassRoom|null>(null);
  const [classInput,    setClassInput]    = useState("");
  const [classNameInput,setClassNameInput]= useState("");
  const [classMembers,  setClassMembers]  = useState<{name:string;score:number;lvl:number;arenaScore:number}[]>([]);
  const [clan,          setClan]          = useState<Clan|null>(null);
  const [clanMembers,   setClanMembers]   = useState<{name:string;score:number;lvl:number;arenaScore:number;role:string}[]>([]);
  const [clanNameInput, setClanNameInput] = useState("");
  const [clanTagInput,  setClanTagInput]  = useState("");
  const [duelReqs,      setDuelReqs]      = useState<DuelReq[]>([]);

  // Arena state - temiz ve bağımsız
  const [arenaScreen,   setArenaScreen]   = useState<"menu"|"rules"|"searching"|"battle"|"ligmap">("menu");
  const [arenaLeftTab,  setArenaLeftTab]  = useState<'siralama'|'liglar'>('siralama');
  const [searchTime,  setSearchTime]  = useState(50);
  const [pvp,         setPvp]         = useState<PvPState>({ matchId:null, matchData:null, side:null });

  const confettiRef = useRef<HTMLCanvasElement|null>(null);
  const pvpRef      = useRef(pvp); // closure sorununu önlemek için ref
  useEffect(() => { pvpRef.current = pvp; }, [pvp]);

  // ── Yardımcılar ──────────────────────────────────────────────────────────
  const notify = (m:string) => { setNotif(m); setTimeout(()=>setNotif(null),3000); };
  const playSound = (t:"click"|"win"|"correct"|"wrong") => {
    if (typeof window==="undefined") return;
    // Web Audio API ile ses üret - dış bağlantı gerekmez
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if(t==="correct") {
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime+0.1);
        osc.frequency.setValueAtTime(784, ctx.currentTime+0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.5);
        osc.start(); osc.stop(ctx.currentTime+0.5);
      } else if(t==="wrong") {
        osc.type="sawtooth";
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.setValueAtTime(150, ctx.currentTime+0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.4);
        osc.start(); osc.stop(ctx.currentTime+0.4);
      } else if(t==="win") {
        const notes=[523,659,784,1047];
        notes.forEach((freq,i)=>{
          const o=ctx.createOscillator(); const g=ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value=freq;
          g.gain.setValueAtTime(0.25, ctx.currentTime+i*0.12);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+i*0.12+0.4);
          o.start(ctx.currentTime+i*0.12); o.stop(ctx.currentTime+i*0.12+0.4);
        });
      } else if(t==="click") {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.08);
        osc.start(); osc.stop(ctx.currentTime+0.08);
      }
    } catch(e){}
  };
  const getStats = (p:Player) => {
    let atk=25+p.lvl*10, hp=120+p.lvl*30;
    if(p.equipped.wep) atk+=p.equipped.wep.val;
    if(p.equipped.arm) hp+=p.equipped.arm.val;
    return {atk,maxHp:hp};
  };
  const launchConfetti = async () => {
    if (typeof window==="undefined") return;
    try { const m:any=await import("canvas-confetti"); (m.default||m)({particleCount:120,spread:140,origin:{y:0.6}}); } catch(e){}
  };
  const save = (p:Player) => {
    p.regionProgress = p.regionProgress||{};
    REGIONS.forEach(r=>{ if(p.regionProgress[r.id]===undefined) p.regionProgress[r.id]=0; });
    const withBadges = checkAndAwardBadges(p);
    const newBadges = (withBadges.badges||[]).filter(b=>!(p.badges||[]).includes(b));
    newBadges.forEach(b=>{ setTimeout(()=>notify(`🏅 Yeni Rozet: ${BADGES[b].icon} ${BADGES[b].name}!`),500); });
    if(!isAdmin(withBadges.name)) { try { localStorage.setItem(SAVE_KEY+withBadges.name,JSON.stringify(withBadges)); } catch(e){} }
    update(ref(db,"users/"+withBadges.name),{
      score:withBadges.score, lvl:withBadges.lvl, name:withBadges.name,
      arenaScore:withBadges.arenaScore||0, arenaGames:withBadges.arenaGames||0,
      costume:withBadges.currentCostume, battleWins:withBadges.battleWins||0,
      badges:(withBadges.badges||[]).join(","),
      friends:(withBadges.friends||[]).join(","),
      classCode:withBadges.classCode||""
    }).catch(()=>{});
    setPlayer({...withBadges});
    loadLeaderboard();
  };

  // ── ARKADAŞ SİSTEMİ ────────────────────────────────────────────────────
  const loadFriends = async () => {
    if(!player) return;
    const fList = player.friends||[];
    if(fList.length===0){ setFriends([]); return; }
    const results = await Promise.all(fList.map(async n=>{
      const snap = await get(ref(db,"users/"+n));
      const d = snap.val()||{};
      return { name:n, score:d.score||0, lvl:d.lvl||1, arenaScore:d.arenaScore||0, costume:d.costume||"default" };
    }));
    setFriends(results);
  };

  const loadFriendRequests = async () => {
    if(!player) return;
    const snap = await get(ref(db,"friendRequests/"+player.name));
    if(!snap.exists()){ setFriendReqs([]); return; }
    const reqs = Object.values(snap.val()) as FriendReq[];
    setFriendReqs(reqs.filter(r=>r.status==="pending"));
  };

  const sendFriendRequest = async () => {
    if(!player||!friendInput.trim()) return;
    const target = friendInput.trim();
    if(target===player.name){ notify("Kendine istek gönderemezsin!"); return; }
    if((player.friends||[]).includes(target)){ notify("Zaten arkadaşsınız!"); return; }
    const snap = await get(ref(db,"users/"+target));
    if(!snap.exists()){ notify("Kullanıcı bulunamadı!"); return; }
    const reqId = player.name+"_to_"+target;
    await set(ref(db,"friendRequests/"+target+"/"+reqId),{ from:player.name, to:target, status:"pending", ts:Date.now() });
    notify("✅ Arkadaşlık isteği gönderildi!");
    setFriendInput("");
  };

  const acceptFriendRequest = async (req:FriendReq) => {
    if(!player) return;
    const myFriends = [...new Set([...(player.friends||[]), req.from])];
    const theirSnap = await get(ref(db,"users/"+req.from));
    const theirFriends = [...new Set([...((theirSnap.val()||{}).friends||[]), player.name])];
    await update(ref(db,"users/"+player.name),{ friends:myFriends.join(",") });
    await update(ref(db,"users/"+req.from),{ friends:theirFriends.join(",") });
    await set(ref(db,"friendRequests/"+player.name+"/"+req.from+"_to_"+player.name),null);
    const np = {...player, friends:myFriends};
    save(np);
    notify("🤝 Arkadaşlık kabul edildi!");
    loadFriendRequests(); loadFriends();
  };

  const removeFriend = async (name:string) => {
    if(!player) return;
    const myFriends = (player.friends||[]).filter(f=>f!==name);
    save({...player, friends:myFriends});
    setTimeout(loadFriends, 300);
    notify("Arkadaşlık kaldırıldı");
  };

  // ── SINIF SİSTEMİ ──────────────────────────────────────────────────────
  const createClass = async () => {
    if(!player||!classNameInput.trim()) return;
    const code = Math.random().toString(36).substring(2,8).toUpperCase();
    const cls:ClassRoom = { code, name:classNameInput.trim(), owner:player.name, members:[player.name], createdAt:Date.now() };
    await set(ref(db,"classes/"+code), cls);
    const np = {...player, classCode:code};
    save(np);
    setClassroom(cls); setClassNameInput("");
    notify("✅ Sınıf oluşturuldu! Kod: "+code);
    loadClassMembers(code);
  };

  const joinClass = async () => {
    if(!player||!classInput.trim()) return;
    const code = classInput.trim().toUpperCase();
    const snap = await get(ref(db,"classes/"+code));
    if(!snap.exists()){ notify("Sınıf bulunamadı!"); return; }
    const cls = snap.val() as ClassRoom;
    if(cls.members.includes(player.name)){ notify("Zaten bu sınıftasın!"); return; }
    const newMembers = [...cls.members, player.name];
    await update(ref(db,"classes/"+code),{ members:newMembers });
    const np = {...player, classCode:code};
    save(np);
    setClassroom({...cls,members:newMembers}); setClassInput("");
    notify("✅ Sınıfa katıldın!");
    loadClassMembers(code);
  };

  const loadClassMembers = async (code:string) => {
    const snap = await get(ref(db,"classes/"+code));
    if(!snap.exists()) return;
    const cls = snap.val() as ClassRoom;
    setClassroom(cls);
    const members = await Promise.all(cls.members.map(async n=>{
      const s = await get(ref(db,"users/"+n));
      const d = s.val()||{};
      return { name:n, score:d.score||0, lvl:d.lvl||1, arenaScore:d.arenaScore||0 };
    }));
    setClassMembers(members.sort((a,b)=>b.arenaScore-a.arenaScore));
  };
  // Admin: tüm kullanıcıları yükle
  const loadAdminUsers = async () => {
    try {
      const snap = await get(ref(db,"users"));
      if(snap.exists()) setAdminUsers(snap.val());
    } catch(e){}
  };

  // Admin: Firebase'e özel soru ekle
  const addCustomQuestion = async () => {
    if(!adminQuestion.q.trim()||adminQuestion.o.some(o=>!o.trim())) return notify("Tüm alanları doldur!");
    try {
      const newQ = { ...adminQuestion, id: Date.now().toString() };
      await push(ref(db,"customQuestions"), newQ);
      setCustomQs(prev=>[...prev, newQ as Q]);
      setAdminQuestion({ q:"", o:["","","",""], a:0, topic:"genel" });
      notify("✅ Soru eklendi!");
    } catch(e){ notify("Hata: "+String(e)); }
  };

  // Tüm soruları Firebase'den yükle
  const loadCustomQuestions = async () => {
    try {
      const snap = await get(ref(db,"questions"));
      if(snap.exists()) {
        const obj = snap.val();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qs = Object.entries(obj).map(([k,v]:any)=>({...(v as Q),fbKey:k})) as (Q&{fbKey:string})[];
        setAllQuestions(qs);
        setCustomQs(qs); // eski uyumluluk
      } else {
        // İlk kez - default soruları Firebase'e yükle
        const updates:any = {};
        DEFAULT_QUESTIONS.forEach((q,i) => {
          updates["q"+i] = q;
        });
        await set(ref(db,"questions"), updates);
        setAllQuestions(DEFAULT_QUESTIONS);
        setCustomQs(DEFAULT_QUESTIONS);
      }
    } catch(e){ setAllQuestions(DEFAULT_QUESTIONS); setCustomQs(DEFAULT_QUESTIONS); }
  };

  // Admin: kullanıcı sıfırla
  const resetUser = async (name:string) => {
    if(!confirm(`${name} sıfırlansın mı?`)) return;
    try {
      await set(ref(db,`users/${name}`), null);
      localStorage.removeItem(SAVE_KEY+name);
      notify(`${name} sıfırlandı!`);
      loadAdminUsers();
    } catch(e){}
  };

  const loadLeaderboard = async () => {
    try {
      const snap = await get(ref(db,"users"));
      if(snap.exists()) {
        const u = snap.val();
        const ADMINS=["ADMIN","ADMIN2"];
        setLeaderboard(
          Object.keys(u)
            .filter(k=>!ADMINS.includes(k) && (u[k].arenaScore||0)>0)
            .map(k=>({name:k,score:u[k].arenaScore||0,lvl:u[k].lvl||1,games:u[k].arenaGames||0}))
            .sort((a,b)=>b.score-a.score)
            .slice(0,200)
        );
      }
    } catch(e){}
  };

  const createClan = async () => {
    if(!player||!clanNameInput.trim()||!clanTagInput.trim()) return;
    const tag = clanTagInput.trim().toUpperCase().slice(0,5);
    const snap = await get(ref(db,"clans/"+tag));
    if(snap.exists()){ notify("Bu etiket zaten alınmış!"); return; }
    const newClan:Clan = { tag, name:clanNameInput.trim(), leader:player.name, createdAt:Date.now(), members:{ [player.name]:{role:"leader",joinedAt:Date.now()} } };
    await set(ref(db,"clans/"+tag), newClan);
    save({...player, classCode:tag});
    setClan(newClan); setClanNameInput(""); setClanTagInput("");
    notify("🏰 Klan oluşturuldu! Etiket: #"+tag);
    loadClanMembers(tag);
  };

  const joinClan = async () => {
    if(!player||!classInput.trim()) return;
    const tag = classInput.trim().toUpperCase();
    const snap = await get(ref(db,"clans/"+tag));
    if(!snap.exists()){ notify("Klan bulunamadı!"); return; }
    const c = snap.val() as Clan;
    if(c.members[player.name]){ notify("Zaten bu klansın!"); return; }
    const newMembers = {...c.members, [player.name]:{role:"member" as const,joinedAt:Date.now()}};
    await update(ref(db,"clans/"+tag),{ members:newMembers });
    save({...player, classCode:tag});
    setClan({...c,members:newMembers}); setClassInput("");
    notify("✅ Klana katıldın! #"+tag);
    loadClanMembers(tag);
  };

  const loadClanMembers = async (tag:string) => {
    const snap = await get(ref(db,"clans/"+tag));
    if(!snap.exists()) return;
    const c = snap.val() as Clan;
    setClan(c);
    const members = await Promise.all(Object.keys(c.members).map(async n=>{
      const s = await get(ref(db,"users/"+n));
      const d = s.val()||{};
      return { name:n, score:d.score||0, lvl:d.lvl||1, arenaScore:d.arenaScore||0, role:c.members[n].role };
    }));
    setClanMembers(members.sort((a,b)=>b.arenaScore-a.arenaScore));
  };

  const updateMemberRole = async (targetName:string, newRole:"officer"|"member") => {
    if(!clan||!player) return;
    await update(ref(db,"clans/"+clan.tag+"/members/"+targetName),{ role:newRole });
    notify(`✅ ${targetName} artık ${newRole==="officer"?"Subay":"Üye"}`);
    loadClanMembers(clan.tag);
  };

  const kickFromClan = async (targetName:string) => {
    if(!clan||!player||!confirm(`${targetName} klandan çıkarılsın mı?`)) return;
    const newMembers = {...clan.members};
    delete newMembers[targetName];
    await update(ref(db,"clans/"+clan.tag),{ members:newMembers });
    await update(ref(db,"users/"+targetName),{ clanTag:"" });
    notify(`${targetName} klandan çıkarıldı`);
    loadClanMembers(clan.tag);
  };

  const leaveClan = async () => {
    if(!clan||!player||!confirm("Klandan ayrılmak istediğine emin misin?")) return;
    const newMembers = {...clan.members};
    delete newMembers[player.name];
    await update(ref(db,"clans/"+clan.tag),{ members:newMembers });
    save({...player, classCode:""});
    setClan(null); setClanMembers([]);
    notify("Klandan ayrıldın.");
  };

  const sendDuelRequest = async (targetName:string) => {
    if(!player) return;
    const reqId = player.name+"_duel_"+targetName;
    await set(ref(db,"duelRequests/"+targetName+"/"+reqId),{ from:player.name, to:targetName, status:"pending", ts:Date.now() });
    notify(`⚔️ ${targetName} adlı oyuncuya duello isteği gönderildi!`);
  };

  const loadDuelRequests = async () => {
    if(!player) return;
    const snap = await get(ref(db,"duelRequests/"+player.name));
    if(!snap.exists()){ setDuelReqs([]); return; }
    const reqs = Object.values(snap.val()) as DuelReq[];
    setDuelReqs(reqs.filter((r:DuelReq)=>r.status==="pending"));
  };

  const acceptDuel = async (req:DuelReq) => {
    if(!player) return;
    await set(ref(db,"duelRequests/"+player.name+"/"+req.from+"_duel_"+player.name),null);
    setDuelReqs(d=>d.filter(r=>r.from!==req.from));
    notify(`⚔️ ${req.from} ile duello başlıyor!`);
    findMatchWith(req.from);
  };

  const findMatchWith = async (opponentName:string) => {
    if(!player) return;
    try {
      const qs = shuffle(allQuestions.length>0?allQuestions:DEFAULT_QUESTIONS).slice(0,30);
      const nr = push(ref(db,"matches"));
      const mid = nr.key!;
      const initState:MatchState = {
        hostHp:getStats(player).maxHp, guestHp:getStats(player).maxHp,
        qIdx:0, qs, started:true, questionStartTime:Date.now(),
        hostAnswerCorrect:-1, hostAnswerTime:0,
        guestAnswerCorrect:-1, guestAnswerTime:0,
        resolving:false, log:"",
      };
      await set(nr,{ id:mid, players:{host:player.name,guest:opponentName}, state:initState, createdAt:Date.now() });
      onValue(ref(db,"matches/"+mid),(snap)=>{
        const val:MatchData|null = snap.val();
        if(!val) return;
        setPvp(prev=>({...prev,matchData:val}));
      });
      setPvp({ matchId:mid, matchData:null, side:"host" });
      setArenaScreen("battle");
      setScreen("arena");
    } catch(e){ notify("Duello başlatılamadı!"); }
  };

  // Tam ekran + yatay yön kilidi
  const enterFullscreen = async () => {
    try {
      const el = document.documentElement as any;
      if(el.requestFullscreen) await el.requestFullscreen();
      else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else if(el.mozRequestFullScreen) await el.mozRequestFullScreen();
    } catch(e){}
  };
  const lockLandscape = async () => {
    try {
      const scr = window.screen as any;
      if(scr.orientation?.lock) await scr.orientation.lock("landscape");
    } catch(e){}
  };
  const activateMobile = async () => {
    await enterFullscreen();
    await lockLandscape();
  };

  useEffect(() => {
    setMounted(true); loadLeaderboard(); loadCustomQuestions();
    // Platform yükle
    const saved = localStorage.getItem("edb_platform");
    if(saved==="mobile"||saved==="pc") setPlatform(saved as "mobile"|"pc");
    // Oyun kilidi dinle
    const lockRef = ref(db,"settings/gameLocked");
    onValue(lockRef,(snap)=>{ setGameLocked(!!snap.val()); });
    return ()=>off(lockRef);
  }, []);

  // Mobil seçilince otomatik tam ekran + yatay
  useEffect(()=>{
    if(platform==="mobile") activateMobile();
  },[platform]);

  // ── AUTH ─────────────────────────────────────────────────────────────────
  const handleAuth = () => {
    if(!auth.user||!auth.pass) return notify("Boş bırakma!");
    const key = SAVE_KEY+auth.user;
    if(isAdmin(auth.user) && auth.pass==="1234") {
      const ap:Player={name:auth.user,pass:"1234",hp:9999,maxHp:9999,gold:99999,xp:0,maxXp:100,lvl:99,inventory:[],equipped:{wep:null,arm:null},jokers:{heal:99,"5050":99,skip:99},mistakes:[],score:1000+Math.floor(Math.random()*500),unlockedRegions:["tut","r1","r2","r3"],regionProgress:{tut:2,r1:2,r2:2,r3:1},unlockedCostumes:Object.keys(COSTUMES),currentCostume:"king",tutorialSeen:true,arenaRulesSeen:true};
      update(ref(db,"users/"+auth.user),{score:ap.score,lvl:ap.lvl,name:auth.user}).catch(()=>{});
      setPlayer(ap); setScreen("menu"); loadLeaderboard(); return;
    }
    if(auth.reg) {
      if(localStorage.getItem(key)) return notify("Kullanıcı zaten var!");
      const np:Player={name:auth.user,pass:auth.pass,hp:100,maxHp:100,gold:0,xp:0,maxXp:100,lvl:1,inventory:[],equipped:{wep:null,arm:null},jokers:{heal:1,"5050":1,skip:1},mistakes:[],score:0,unlockedRegions:["tut"],regionProgress:{tut:0},unlockedCostumes:["default"],currentCostume:"default",tutorialSeen:false,arenaRulesSeen:false};
      localStorage.setItem(key,JSON.stringify(np));
      update(ref(db,"users/"+auth.user),{score:0,lvl:1,name:auth.user}).catch(()=>{});
      setAuth({...auth,reg:false}); notify("Kayıt Oldun!");
    } else {
      const d=localStorage.getItem(key);
      if(!d) return notify("Kullanıcı yok!");
      const p=JSON.parse(d);
      if(p.pass!==auth.pass) return notify("Şifre yanlış!");
      update(ref(db,"users/"+auth.user),{score:p.score||0,lvl:p.lvl||1,name:auth.user}).catch(()=>{});
      setPlayer(p); setScreen("menu"); loadLeaderboard();
    }
  };

  // ── NORMAL SAVAŞ ─────────────────────────────────────────────────────────
  const startBattle = (r:Region,l:Level) => {
    playSound("click"); setModal(null); setBotMatch(false); setTurn("p1");
    let pool=allQuestions.length>0?allQuestions:DEFAULT_QUESTIONS.slice();
    if(r.type!=="all") pool=allQuestions.length>0?allQuestions:DEFAULT_QUESTIONS.filter(q=>q.topic===r.type||q.topic==="genel");
    setBattle({active:true,region:r,level:l,enemyHp:l.hp,maxEnemyHp:l.hp,qs:shuffle(pool).slice(0,15),qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});
    setScreen("battle");
  };
  const handleMove = (correct:boolean, chosenIdx:number) => {
    if(!battle.active||showAnswer) return;
    const nb={...battle};
    const pStats=getStats(player!);
    const answeredIdx=nb.qIdx;
    const correctIdx=nb.qs[nb.qIdx].a;

    // Ses
    playSound(correct?"correct":"wrong");

    // Cevabı göster - 1.4 saniye bekle sonra devam et
    setShowAnswer({correctIdx, chosenIdx, correct});

    setTimeout(()=>{
      setShowAnswer(null);
      const dmg=pStats.atk;
      const botDmg=Math.floor(pStats.atk*0.8);

      nb.dmgText=correct?{val:dmg,c:"#0f6"}:{val:20,c:"#f05"};

      if(correct) {
        // Oyuncu doğru yaptı - düşmana hasar
        nb.enemyHp-=dmg; nb.log=`✅ DOĞRU! ${dmg} Hasar!`; nb.combo=(nb.combo||0)+1;
        if(nb.enemyHp<=0) {
          playSound("win"); notify("🏆 ZAFER! +100 Altın"); launchConfetti();
          const np={...player!}; np.gold+=100; np.xp+=30; np.score+=50; np.hp=pStats.maxHp;
          if(np.xp>=np.maxXp){np.lvl++;np.xp=0;np.maxXp=Math.floor(np.maxXp*1.2);notify("SEVİYE ATLADIN!");}
          if(nb.region&&nb.level){np.regionProgress=np.regionProgress||{};const ci=nb.region.levels.findIndex(x=>x.id===nb.level?.id);if(ci>=0){const cp=np.regionProgress[nb.region.id]??0;np.regionProgress[nb.region.id]=Math.max(cp,ci+1);}}
          if(nb.level?.isBoss&&nb.region){const rg=nb.region;np.unlockedRegions=np.unlockedRegions||["tut"];np.unlockedCostumes=np.unlockedCostumes||["default"];if(rg.unlockC&&!np.unlockedCostumes.includes(rg.unlockC))np.unlockedCostumes.push(rg.unlockC);if(rg.levels.length>0)np.regionProgress[rg.id]=rg.levels.length;const ri=REGIONS.findIndex(r=>r.id===rg.id);if(ri!==-1&&ri<REGIONS.length-1){const nr=REGIONS[ri+1].id;if(nr==="r3"){if(np.regionProgress["r2"]>=REGIONS.find(r=>r.id==="r2")!.levels.length&&!np.unlockedRegions.includes(nr))np.unlockedRegions.push(nr);}else if(!np.unlockedRegions.includes(nr))np.unlockedRegions.push(nr);}}
          save(np); setScreen("menu"); return;
        }
        // Bot sırası - bot cevaplar (doğru sonra bot)
        if(botMatch) {
          const botCorrect=Math.random()>0.4;
          if(botCorrect){
            const np={...player!}; np.hp=Math.max(0,np.hp-botDmg); setPlayer(np);
            nb.log=`✅ DOĞRU! ${dmg} Hasar! | 🤖 BOT DA DOĞRU: -${botDmg} Can`;
            if(np.hp<=0){np.hp=pStats.maxHp;
          const isBotArena2=nb.level?.id==="pvp-bot";
          if(isBotArena2){np.arenaScore=Math.max(0,(np.arenaScore||0)-30);np.arenaGames=(np.arenaGames||0)+1;notify("😔 Bota yenildin... -30 Arena Puan");}
          else notify("YENİLDİN...");
          save(np);setBattle({active:false,enemyHp:0,maxEnemyHp:0,qs:[],qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});setScreen("menu");return;}
          } else {
            nb.log=`✅ DOĞRU! ${dmg} Hasar! | 🤖 Bot Iskaladı`;
          }
        }
      } else {
        // Oyuncu yanlış yaptı - kendine hasar
        const np={...player!}; np.hp=Math.max(0,np.hp-20); setPlayer(np);
        nb.log=`❌ YANLIŞ! -20 Can`; nb.combo=0;
        if(np.hp<=0){np.hp=pStats.maxHp;
          const isBotArena2=nb.level?.id==="pvp-bot";
          if(isBotArena2){np.arenaScore=Math.max(0,(np.arenaScore||0)-30);np.arenaGames=(np.arenaGames||0)+1;notify("😔 Bota yenildin... -30 Arena Puan");}
          else notify("YENİLDİN...");
          save(np);setBattle({active:false,enemyHp:0,maxEnemyHp:0,qs:[],qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});setScreen("menu");return;}
        // Bot sırası - yanlış yapınca da bot cevaplar
        if(botMatch) {
          const botCorrect=Math.random()>0.4;
          if(botCorrect){
            nb.enemyHp=Math.max(0,nb.enemyHp-botDmg);
            nb.log=`❌ YANLIŞ! -20 Can | 🤖 Bot Doğru: -${botDmg} Düşman Can`;
            if(nb.enemyHp<=0){
              playSound("win");launchConfetti();
              const np2={...player!};np2.gold+=100;np2.xp+=30;np2.score+=50;np2.hp=pStats.maxHp;
              const oldAS=np2.arenaScore||0; const newAS=oldAS+100;
              const ol=getLeague(oldAS); const nl=getLeague(newAS);
              if(nl.name!==ol.name) notify(`🎉 TERFİ! ${nl.icon} ${nl.name} Ligine çıktın!`);
              else notify("🏆 BOT YENİLDİ! +100 Arena Puan");
              np2.arenaScore=newAS; np2.arenaGames=(np2.arenaGames||0)+1;
              save(np2);setScreen("menu");return;
            }
          } else {
            nb.log=`❌ YANLIŞ! -20 Can | 🤖 Bot da Iskaladı`;
          }
        }
      }

      nb.qIdx=(nb.qIdx+1)%nb.qs.length;
      setBattle({...nb});
      setLastAns({idx:answeredIdx,correct,chosen:chosenIdx});
      setTimeout(()=>setLastAns({idx:null,correct:null,chosen:null}),300);
    }, 1400);
  };
  const useJoker = (id:"heal"|"5050"|"skip") => {
    if(!battle.active||!player) return;
    const np={...player}; if(!np.jokers)np.jokers={heal:0,"5050":0,skip:0};
    if((np.jokers[id]??0)<=0) return; np.jokers[id]--;
    if(id==="heal"){const st=getStats(np);np.hp=Math.min(np.hp+80,st.maxHp);notify("❤️ Can basıldı!");save(np);}
    else if(id==="skip"){notify("⏩ Soru geçildi!");setBattle(b=>({...b,qIdx:(b.qIdx+1)%b.qs.length}));save(np);}
    else if(id==="5050"){notify("½ Joker aktif!");save(np);}
  };

  // Bot savaş tetikleyicisi - kaldırıldı, handleMove içine taşındı

  // ── MARKET / ÇANTA ───────────────────────────────────────────────────────
  const buyItem = (it:Item) => {
    if(!player) return;
    const np={...player}; if(!np.jokers)np.jokers={heal:0,"5050":0,skip:0};
    if(isAdmin(np.name)){
      if(it.type==="joker"&&it.jokerId){np.jokers[it.jokerId]=(np.jokers[it.jokerId]||0)+1;save(np);notify("ADMIN: Joker eklendi!");}
      else if(!np.inventory.some(x=>x.id===it.id)){np.inventory.push(it);save(np);notify("ADMIN: Ürün eklendi!");}
      return;
    }
    if(np.gold<it.cost) return notify("Yeterli altın yok!");
    if(it.type==="joker"&&it.jokerId){np.gold-=it.cost;np.jokers[it.jokerId]=(np.jokers[it.jokerId]||0)+1;save(np);notify("Joker satın alındı!");return;}
    if(np.inventory.some(x=>x.id===it.id)) return notify("Bu item zaten sende var!");
    np.gold-=it.cost; np.inventory.push(it); save(np); notify("Satın alındı!");
  };
  const equipItem = (it:Item) => {
    if(!player) return;
    const np={...player}; np.inventory=np.inventory.filter(x=>x.id!==it.id);
    if(it.type==="wep"){if(np.equipped.wep)np.inventory.push(np.equipped.wep);np.equipped.wep=it;save(np);notify("⚔️ Silah kuşanıldı!");}
    else if(it.type==="arm"){if(np.equipped.arm)np.inventory.push(np.equipped.arm);np.equipped.arm=it;save(np);notify("🛡️ Zırh kuşanıldı!");}
  };
  const sellItem = (it:Item) => {
    if(!player) return;
    const np={...player}; np.inventory=np.inventory.filter(x=>x.id!==it.id);
    np.gold+=Math.floor(it.cost/2); save(np); notify(`💰 ${it.name} satıldı! +${Math.floor(it.cost/2)} Altın`);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ARENA — temiz sıfırdan
  // ═══════════════════════════════════════════════════════════════════════

  // Arena'ya giriş
  const challengeFriend = (name:string) => {
    notify(`⚔️ ${name} meydan okuma özelliği yakında!`);
  };

  const goToArena = () => {
    if(!player) return;
    const r2Progress = player.regionProgress["r2"]??0;
    const r2Levels   = REGIONS.find(r=>r.id==="r2")!.levels.length;
    if(!isAdmin(player.name) && r2Progress<r2Levels) {
      notify("Arena için Hikaye Ormanı bitmeli!"); return;
    }
    setArenaScreen(player.arenaRulesSeen ? "menu" : "rules");
    setScreen("arena");
  };

  // PvP listener temizleyici
  const cleanupPvP = useCallback(async (matchId:string|null, deleteFb=false) => {
    if(!matchId) return;
    try {
      off(ref(db,`matches/${matchId}`));
      if(deleteFb) await set(ref(db,`matches/${matchId}`),null);
    } catch(e){}
  },[]);

  // ── Eşleştirme bul ──────────────────────────────────────────────────────
  const startBotMatch = () => {
    if(!player) return;
    const qs = shuffle(allQuestions.length>0?allQuestions:DEFAULT_QUESTIONS).slice(0,25);
    setBotMatch(true); setTurn("p1");
    setPvp({ matchId:null, matchData:null, side:"host" });
    setArenaScreen("battle");
    // Arena battle state'ini sıfırla - useEffect halleder
    notify("🤖 Bot ile eşleşildi!");
  };

  const findMatch = async () => {
    if(!player) return notify("Önce giriş yapmalısın!");
    // Admin direkt bot ile eşleşsin
    if(isAdmin(player.name)) {
      startBotMatch();
      return;
    }
    try {
      const qs  = shuffle(allQuestions.length>0?allQuestions:DEFAULT_QUESTIONS).slice(0,30);
      const nr  = push(ref(db,"matches"));
      const mid = nr.key!;
      const initState:MatchState = {
        hostHp: getStats(player).maxHp, guestHp:0,
        qIdx:0, qs, started:false, questionStartTime:0,
        hostAnswerCorrect:-1, hostAnswerTime:0,
        guestAnswerCorrect:-1, guestAnswerTime:0,
        resolving:false, log:"",
      };
      await set(nr,{ id:mid, players:{host:player.name,guest:""}, state:initState, createdAt:Date.now() });

      // Maçı dinle
      onValue(ref(db,`matches/${mid}`),(snap)=>{
        const val:MatchData|null = snap.val();
        if(!val) return;
        setPvp(prev=>({...prev,matchData:val}));
        // Guest geldi ve henüz started değilse host başlatsın
        if(val.players.guest && val.players.guest!=="" && !val.state.started) {
          update(ref(db,`matches/${mid}/state`),{
            guestHp: getStats(player).maxHp,
            started: true,
            questionStartTime: Date.now(),
            hostAnswerCorrect:-1, hostAnswerTime:0,
            guestAnswerCorrect:-1, guestAnswerTime:0,
            resolving:false,
          });
          notify("🎮 Rakip geldi! Savaş başlıyor!");
        }
      });

      setPvp({ matchId:mid, matchData:null, side:"host" });
      setArenaScreen("searching");
      setSearchTime(isAdmin(player?.name||"")?5:15);
    } catch(e) {
      notify("Maç oluşturulamadı: "+String(e));
    }
  };

  // ── Arama iptali ────────────────────────────────────────────────────────
  const cancelSearch = async () => {
    const mid = pvpRef.current.matchId;
    await cleanupPvP(mid, true);
    setPvp({ matchId:null, matchData:null, side:null });
    setArenaScreen("menu");
    setSearchTime(isAdmin(player?.name||"")?5:15);
  };

  // ── 50 sn sayacı + açık maç arama ──────────────────────────────────────
  useEffect(()=>{
    if(arenaScreen!=="searching" || !player) return;
    setSearchTime(isAdmin(player?.name||"")?5:15);

    const ticker = setInterval(()=>{
      setSearchTime(prev=>{
        if(prev<=1){
          clearInterval(ticker);
          clearInterval(checker);
          // Bot maçı başlat
          const mid=pvpRef.current.matchId;
          if(mid) set(ref(db,`matches/${mid}`),null).catch(()=>{});
          setPvp({matchId:null,matchData:null,side:null});
          startBotArenaMatch();
          return 0;
        }
        return prev-1;
      });
    },1000);

    const checker = setInterval(async()=>{
      const currentPvp = pvpRef.current;
      if(!player) return;
      try {
        const snap = await get(ref(db,"matches"));
        const all  = snap.val()||{};
        for(const k of Object.keys(all)){
          const m:MatchData = all[k];
          if(k===currentPvp.matchId) continue;
          if(m?.players && (!m.players.guest||m.players.guest==="") && m.players.host!==player.name){
            // Dengeli eşleştirme: host'un puanına bak
            const hostData = (await get(ref(db,`users/${m.players.host}`))).val();
            const hostScore = hostData?.arenaScore||0;
            const myScore   = player.arenaScore||0;
            const myLeagueIdx   = LEAGUES.findIndex(l=>myScore>=l.min&&myScore<=l.max);
            const hostLeagueIdx = LEAGUES.findIndex(l=>hostScore>=l.min&&hostScore<=l.max);
            const isLastTwo = myLeagueIdx>=LEAGUES.length-2 || hostLeagueIdx>=LEAGUES.length-2;
            if(!isLastTwo && Math.abs(myLeagueIdx-hostLeagueIdx)>1) continue; // 1 lig farktan fazla - geç
            // Maça katıl
            const guestHp = getStats(player).maxHp;
            await update(ref(db,`matches/${k}/players`),{guest:player.name});
            await update(ref(db,`matches/${k}/state`),{
              guestHp, started:true, questionStartTime:Date.now(),
              hostAnswerCorrect:-1, hostAnswerTime:0,
              guestAnswerCorrect:-1, guestAnswerTime:0, resolving:false,
            });
            clearInterval(ticker);
            clearInterval(checker);
            // Eski maçı sil
            if(currentPvp.matchId) await set(ref(db,`matches/${currentPvp.matchId}`),null);
            // Yeni maçı dinle
            onValue(ref(db,`matches/${k}`),(s2)=>{
              const v=s2.val(); if(!v) return;
              setPvp(prev=>({...prev,matchData:v}));
            });
            setPvp({matchId:k,matchData:null,side:"guest"});
            notify("🎮 Rakip bulundu! Savaş başlıyor...");
            break;
          }
        }
      } catch(e){}
    },3000);

    return ()=>{ clearInterval(ticker); clearInterval(checker); };
  },[arenaScreen]);

  // Maç başlayınca battle'a geç
  useEffect(()=>{
    if(!pvp.matchData||!player||!pvp.side) return;
    const m=pvp.matchData;
    if(!m.state?.started) return;
    const isHost=pvp.side==="host";
    setArenaScreen("battle");
    setScreen("battle");
    setBotMatch(false);
    setTurn("p1");
    const enemyHp = isHost?m.state.guestHp:m.state.hostHp;
    const myHp    = isHost?m.state.hostHp:m.state.guestHp;
    const myAns   = isHost?m.state.hostAnswerCorrect:m.state.guestAnswerCorrect;
    setBattle({
      active:true,
      region:{id:"pvp",name:"PvP Arena",x:0,y:0,type:"all",bg:ARENA_BG,unlockC:"king",levels:[]},
      level:{id:"pvp",t:"PvP",hp:0,en:isHost?(m.players.guest||"Rakip"):m.players.host,ico:"🤼",diff:"PvP"},
      enemyHp, maxEnemyHp:getStats(player).maxHp,
      qs:m.state.qs, qIdx:m.state.qIdx,
      timer:Math.max(0,20-Math.floor((Date.now()-(m.state.questionStartTime||Date.now()))/1000)),
      combo:0, log:m.state.log||null,
      wait:myAns!==-1,
      dmgText:null, shaking:false,
    });
    setPlayer(prev=>prev?{...prev,hp:myHp}:prev);
  },[pvp.matchData,pvp.side]);

  // ── PvP cevap gönder (eş zamanlı) ───────────────────────────────────────
  const pvpAnswer = async (idx:number) => {
    const {matchId,matchData,side}=pvpRef.current;
    if(!matchId||!matchData||!player||!side) return;
    const st=matchData.state;
    if(!st.started||st.resolving) return;
    const myAns = side==="host"?st.hostAnswerCorrect:st.guestAnswerCorrect;
    if(myAns!==-1) return notify("Zaten cevapladın!");
    const cv = idx===st.qs[st.qIdx].a ? 1 : 0;
    const now = Date.now();
    await update(ref(db,`matches/${matchId}`),
      side==="host"
        ? {"state/hostAnswerCorrect":cv,"state/hostAnswerTime":now}
        : {"state/guestAnswerCorrect":cv,"state/guestAnswerTime":now}
    );
    // 1.5 sn bekle, ikisi de cevapladıysa host hesaplasın
    setTimeout(async()=>{
      const {matchId:mid,side:s}=pvpRef.current;
      if(!mid) return;
      const snap=await get(ref(db,`matches/${mid}`));
      const cur:MatchData=snap.val();
      if(!cur?.state||cur.state.resolving) return;
      const hc=cur.state.hostAnswerCorrect??-1;
      const gc=cur.state.guestAnswerCorrect??-1;
      const bothDone=hc!==-1&&gc!==-1;
      const elapsed=Date.now()-(cur.state.questionStartTime||Date.now());
      if(!bothDone&&elapsed<20000) return;
      if(s==="host"){
        await update(ref(db,`matches/${mid}/state`),{resolving:true});
        await pvpResolve(cur);
      }
    },1500);
  };

  // ── PvP tur hesapla ──────────────────────────────────────────────────────
  const pvpResolve = async (cur:MatchData) => {
    const {matchId}=pvpRef.current;
    if(!matchId||!player) return;
    const pStats=getStats(player);
    const upd:Record<string,number|boolean|string>={};
    const hc=cur.state.hostAnswerCorrect??-1;
    const gc=cur.state.guestAnswerCorrect??-1;
    const ht=cur.state.hostAnswerTime||0;
    const gt=cur.state.guestAnswerTime||0;
    let log="";
    if(hc===-1&&gc===-1){log="⏰ Süre doldu!";}
    else if(hc===1&&gc===1){
      if(ht<=gt){upd["state/guestHp"]=Math.max(0,cur.state.guestHp-pStats.atk);log=`⚡ ${cur.players.host} daha hızlı! ${pStats.atk} hasar!`;}
      else{upd["state/hostHp"]=Math.max(0,cur.state.hostHp-pStats.atk);log=`⚡ ${cur.players.guest} daha hızlı! ${pStats.atk} hasar!`;}
    } else if(hc===1){upd["state/guestHp"]=Math.max(0,cur.state.guestHp-pStats.atk);log=`✅ ${cur.players.host} doğru! ${pStats.atk} hasar!`;}
    else if(gc===1){upd["state/hostHp"]=Math.max(0,cur.state.hostHp-pStats.atk);log=`✅ ${cur.players.guest} doğru! ${pStats.atk} hasar!`;}
    else{upd["state/hostHp"]=Math.max(0,cur.state.hostHp-20);upd["state/guestHp"]=Math.max(0,cur.state.guestHp-20);log="❌ İkisi de yanlış! 20'şer hasar.";}
    upd["state/qIdx"]=(cur.state.qIdx+1)%cur.state.qs.length;
    upd["state/hostAnswerCorrect"]=-1; upd["state/hostAnswerTime"]=0;
    upd["state/guestAnswerCorrect"]=-1; upd["state/guestAnswerTime"]=0;
    upd["state/resolving"]=false; upd["state/questionStartTime"]=Date.now();
    upd["state/log"]=log;
    await update(ref(db,`matches/${matchId}`),upd);
    // Zafer kontrolü
    const newHostHp = Number(upd["state/hostHp"] ?? cur.state.hostHp);
    const newGuestHp= Number(upd["state/guestHp"] ?? cur.state.guestHp);
    // Terk kontrolü - log'da terk varsa anında bitir
    const terkVar = log.includes("terk etti");
    if(terkVar) {
      const terkEden = log.includes(cur.players.host+"terk") ? cur.players.host : cur.players.guest;
    }
    if(newHostHp<=0||newGuestHp<=0||terkVar){
      const winner = terkVar
        ? (log.includes("Host") ? cur.players.guest : cur.players.host)
        : (newGuestHp<=0?cur.players.host:cur.players.guest);
      if(winner===player.name){const oldScore=player.arenaScore||0;
          const newScore=oldScore+200;
          const oldLeague=getLeague(oldScore);
          const newLeague=getLeague(newScore);
          const promoted=newLeague.name!==oldLeague.name;
          if(promoted) notify(`🎉 TERFİ! ${newLeague.icon} ${newLeague.name} Ligine çıktın!`);
          else notify("🏆 KAZANDIN! +200 Arena Puan");
          launchConfetti();
          save({...player,gold:player.gold+500,score:player.score+200,arenaScore:newScore,arenaGames:(player.arenaGames||0)+1});}
      else {
        const loseScore=Math.max(0,(player.arenaScore||0)-50);
        notify("😔 Mağlup oldun... -50 Arena Puan");
        save({...player,arenaScore:loseScore,arenaGames:(player.arenaGames||0)+1});
      }
      if(log.includes("terk") && winner===player.name) {
        notify("🏳️ Rakip terk etti! Zafer senindir! 🏆");
        launchConfetti();
      }
      setTimeout(async()=>{
        await set(ref(db,`matches/${matchId}`),null);
        setPvp({matchId:null,matchData:null,side:null});
        setArenaScreen("menu"); setScreen("arena");
      },3000);
    }
  };

  // ── Soru süresi dolduğunda host tetikler ────────────────────────────────
  useEffect(()=>{
    const {matchId,matchData,side}=pvp;
    if(!matchId||!matchData||side!=="host") return;
    const st=matchData.state;
    if(!st.started||st.resolving) return;
    const rem=20000-(Date.now()-(st.questionStartTime||Date.now()));
    if(rem<=0){
      update(ref(db,`matches/${matchId}/state`),{resolving:true}).then(()=>pvpResolve(matchData));
      return;
    }
    const t=setTimeout(async()=>{
      const snap=await get(ref(db,`matches/${matchId}`));
      const cur=snap.val();
      if(!cur?.state||cur.state.resolving) return;
      await update(ref(db,`matches/${matchId}/state`),{resolving:true});
      await pvpResolve(cur);
    },rem);
    return ()=>clearTimeout(t);
  },[pvp.matchData?.state?.qIdx,pvp.matchData?.state?.questionStartTime]);

  // ── Bot arena maçı ──────────────────────────────────────────────────────
  const startBotArenaMatch = () => {
    if(!player) return;
    const stats=getStats(player);
    setBotMatch(true); setTurn("p1");
    notify("🤖 Bot ile eşleştin! Kazanırsan +100 Arena Puan alırsın.");
    setBattle({
      active:true,
      region:{id:"arena",name:"ARENA",x:0,y:0,type:"all",bg:ARENA_BG,unlockC:"king",levels:[]},
      level:{id:"pvp-bot",t:"Bot Arena",hp:stats.maxHp,en:"🤖 Bot Rakip",ico:"🤖",diff:"Arena"},
      enemyHp:stats.maxHp, maxEnemyHp:stats.maxHp,
      qs:shuffle(allQuestions.length>0?allQuestions:DEFAULT_QUESTIONS).slice(0,25), qIdx:0, timer:20, combo:0,
      log:"🤖 Bot ile savaş başlıyor!", wait:false, dmgText:null, shaking:false,
    });
    setScreen("battle");
  };

  // ── Maçtan ayrıl ────────────────────────────────────────────────────────
  const leaveMatch = async () => {
    const {matchId,matchData,side}=pvpRef.current;
    if(matchId && matchData && player) {
      // Rakibi kazandır - can sıfırla
      const isHost=side==="host";
      try {
        const terkLog = isHost
          ? `🏳️ Host terk etti! ${matchData.players?.guest||"Rakip"} KAZANDI!`
          : `🏳️ Guest terk etti! ${matchData.players?.host||"Rakip"} KAZANDI!`;
        await update(ref(db,`matches/${matchId}/state`),{
          ...(isHost ? {hostHp:0} : {guestHp:0}),
          log: terkLog,
          resolving: true,
        });
        // Host resolve'u tetikle
        const snap2 = await get(ref(db,`matches/${matchId}`));
        const cur2 = snap2.val();
        if(cur2 && isHost===false) {
          // Guest terk etti, host resolve eder - bekle
        }
        // -100 puan ceza
        const loseScore=Math.max(0,(player.arenaScore||0)-100);
        save({...player,arenaScore:loseScore,arenaGames:(player.arenaGames||0)+1});
        notify("Maçtan ayrıldın. -100 Arena Puan (terk cezası)");
      } catch(e){}
    }
    await cleanupPvP(matchId, true);
    setPvp({matchId:null,matchData:null,side:null});
    setBattle({active:false,enemyHp:0,maxEnemyHp:0,qs:[],qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});
    setArenaScreen("menu"); setScreen("arena");
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  const isMobile = platform === "mobile";
  const globalStyles=`
    *, *::before, *::after { -webkit-tap-highlight-color: transparent; box-sizing: border-box; -webkit-text-size-adjust: 100%; }
    html { height: 100%; overscroll-behavior: none; }
    body { height: 100%; margin: 0; overscroll-behavior: none; -webkit-overflow-scrolling: touch; }
    input, button, select, textarea { font-family: inherit; font-size: inherit; }
    button { touch-action: manipulation; cursor: pointer; }
    input { -webkit-appearance: none; appearance: none; border-radius: 0; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 4px; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 4px; }
    @keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
    @keyframes float{0%{transform:translateX(-50%) translateY(0);opacity:1}100%{transform:translateX(-50%) translateY(-60px);opacity:0}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes popIn{0%{transform:scale(0.7);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
    @keyframes shakeX{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
    @keyframes glowGreen{0%,100%{box-shadow:0 0 10px #0f6}50%{box-shadow:0 0 30px #0f6,0 0 60px #0f6}}
    @keyframes glowRed{0%,100%{box-shadow:0 0 10px #f05}50%{box-shadow:0 0 30px #f05,0 0 60px #f05}}
    @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .floating-dmg{position:absolute;left:50%;font-size:${isMobile?"44px":"72px"};font-weight:800;text-shadow:0 0 30px black;animation:float 1.2s forwards;pointer-events:none}
    .ans-reveal-correct{animation:glowGreen 0.6s ease infinite,popIn 0.3s ease!important}
    .ans-reveal-wrong{animation:glowRed 0.4s ease,shakeX 0.4s ease!important}
    .screen-enter{animation:slideUp 0.25s ease,fadeIn 0.25s ease}
    /* Mobil buton dokunma alanı büyütme */
    ${isMobile ? "button{min-height:44px;}" : ""}
  `;

  if(!mounted) return <div style={{height:"100vh",background:"#000"}}/>;

  // Platform seçimi
  if(!platform) return (
    <div style={{height:"100vh",background:"radial-gradient(circle at center,#1a1a2e,#000)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Segoe UI,sans-serif",color:"white",padding:"20px"}}>
      <style>{`@keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}`}</style>
      <div style={{textAlign:"center",marginBottom:"40px"}}>
        <div style={{fontSize:"60px",marginBottom:"16px"}}>📚</div>
        <h1 style={{fontSize:"clamp(28px,8vw,48px)",fontWeight:"800",margin:"0 0 8px",color:"#00eaff",textShadow:"0 0 20px #00eaff"}}>EDEBİYAT EFSANELERİ</h1>
        <p style={{color:"#aaa",fontSize:"clamp(14px,3vw,18px)",margin:0}}>Lütfen platformunuzu seçin</p>
      </div>
      <div style={{display:"flex",gap:"20px",flexWrap:"wrap",justifyContent:"center"}}>
        <button
          onClick={()=>{ localStorage.setItem("edb_platform","mobile"); setPlatform("mobile"); activateMobile(); }}
          style={{background:"linear-gradient(135deg,#f7971e,#ffd200)",border:"none",color:"#000",padding:"24px 40px",borderRadius:"20px",cursor:"pointer",fontWeight:"800",fontSize:"clamp(16px,4vw,22px)",display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",boxShadow:"0 10px 30px rgba(255,200,0,0.3)",minWidth:"160px",transition:"transform 0.2s"}}
          onMouseOver={e=>(e.currentTarget.style.transform="scale(1.05)")}
          onMouseOut={e=>(e.currentTarget.style.transform="scale(1)")}>
          <span style={{fontSize:"clamp(36px,10vw,52px)"}}>📱</span>
          MOBİL
        </button>
        <button
          onClick={()=>{ localStorage.setItem("edb_platform","pc"); setPlatform("pc"); }}
          style={{background:"linear-gradient(135deg,#00c6ff,#0072ff)",border:"none",color:"white",padding:"24px 40px",borderRadius:"20px",cursor:"pointer",fontWeight:"800",fontSize:"clamp(16px,4vw,22px)",display:"flex",flexDirection:"column",alignItems:"center",gap:"10px",boxShadow:"0 10px 30px rgba(0,114,255,0.3)",minWidth:"160px",transition:"transform 0.2s"}}
          onMouseOver={e=>(e.currentTarget.style.transform="scale(1.05)")}
          onMouseOut={e=>(e.currentTarget.style.transform="scale(1)")}>
          <span style={{fontSize:"clamp(36px,10vw,52px)"}}>🖥️</span>
          BİLGİSAYAR
        </button>
      </div>
      <p style={{color:"#555",fontSize:"12px",marginTop:"30px"}}>Bu seçim daha sonra ayarlardan değiştirilebilir</p>
    </div>
  );

  // Bakım modu kontrolü - admin değilse engelle
  if(gameLocked && player && !isAdmin(player.name)) return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0a0f",color:"white",padding:"40px",textAlign:"center"}}>
      <style>{globalStyles}</style>
      <div style={{fontSize:"80px",marginBottom:"20px"}}>🔧</div>
      <h1 style={{...S.neon("#f05"),fontSize:"32px"}}>BAKIM MODU</h1>
      <p style={{color:"#aaa",fontSize:"16px",maxWidth:"400px"}}>Oyun şu an bakımda. Yakında geri döneceğiz!</p>
      <button style={{...S.btn,...S.btnDanger,marginTop:"20px"}} onClick={()=>{setPlayer(null);setScreen("auth");}}>ÇIKIŞ YAP</button>
    </div>
  );

  // ── AUTH ekranı ──────────────────────────────────────────────────────────
  if(screen==="auth") return (
    <div style={{minHeight:"100vh",background:"radial-gradient(circle at center,#1a1a2e,#000)",display:"flex",justifyContent:"center",alignItems:"center",fontFamily:"Segoe UI,sans-serif",padding:"20px",boxSizing:"border-box"}}>
      <style>{globalStyles}</style>
      <div style={{...S.glass,padding:isMobile?"28px 20px":"40px",width:"100%",maxWidth:"420px",textAlign:"center"}}>
        <div style={{fontSize:isMobile?"40px":"52px",marginBottom:"8px"}}>📚</div>
        <h1 style={{...S.neon("#00eaff"),fontSize:isMobile?"28px":"40px",marginBottom:"6px",lineHeight:1.2}}>EDEBİYAT<br/>EFSANELERİ</h1>
        <p style={{color:"#666",fontSize:"12px",marginBottom:"24px"}}>
          Platform: {platform==="mobile"?"📱 Mobil":"🖥️ PC"} •
          <span style={{cursor:"pointer",color:"#0072ff",marginLeft:"4px"}} onClick={()=>{ localStorage.removeItem("edb_platform"); setPlatform(null); }}>Değiştir</span>
        </p>
        <input style={{width:"100%",padding:isMobile?"14px":"12px",marginBottom:"12px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box",fontSize:isMobile?"16px":"14px"}}
          placeholder="Kullanıcı Adı" value={auth.user}
          onChange={e=>setAuth({...auth,user:e.target.value})}
          onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
        <input type="password"
          style={{width:"100%",padding:isMobile?"14px":"12px",marginBottom:"20px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box",fontSize:isMobile?"16px":"14px"}}
          placeholder="Şifre" value={auth.pass}
          onChange={e=>setAuth({...auth,pass:e.target.value})}
          onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
        <button style={{...S.btn,...S.btnSuccess,width:"100%",fontSize:isMobile?"17px":"16px",padding:isMobile?"16px":"13px"}} onClick={handleAuth}>
          {auth.reg?"KAYIT OL":"GİRİŞ YAP"}
        </button>
        <p style={{marginTop:"16px",cursor:"pointer",color:"#aaa",fontSize:"14px"}} onClick={()=>setAuth({...auth,reg:!auth.reg})}>
          {auth.reg?"Zaten hesabın var mı? Giriş Yap":"Hesabın yok mu? Kayıt Ol"}
        </p>
        {notif&&<div style={{color:"#f05",marginTop:"12px",fontWeight:"bold",fontSize:"14px"}}>{notif}</div>}
      </div>
    </div>
  );

  return (
    <div style={{height:"100vh",background:"radial-gradient(circle at center,#1a1a2e,#000)",color:"white",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",overflow:"hidden",display:"flex",flexDirection:"column",fontSize:isMobile?"15px":"14px"}}>
      <style>{globalStyles}</style>
      <canvas ref={confettiRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}/>

      {/* ── HEADER ── */}
      {screen!=="battle"&&screen!=="arena"&&(
        <div style={{background:"rgba(0,0,0,0.75)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:isMobile?"10px 14px":"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,zIndex:100}}>
          <div style={{display:"flex",gap:isMobile?"10px":"16px",alignItems:"center"}}>
            <span style={{fontSize:isMobile?"28px":"32px",lineHeight:1}}>{COSTUMES[player!.currentCostume].i}</span>
            <div>
              <div style={{fontWeight:"800",fontSize:isMobile?"13px":"15px",color:"#fff",lineHeight:1.2}}>{player?.name}</div>
              <div style={{display:"flex",gap:isMobile?"8px":"12px",fontSize:isMobile?"13px":"15px",marginTop:"3px",fontWeight:"700",flexWrap:"wrap"}}>
                <span style={S.neon("#fc0")}>⚡ {player?.lvl}</span>
                <span style={S.neon("#0f6")}>❤️ {player?.hp}</span>
                <span style={S.neon("#00eaff")}>💰 {player?.gold}</span>
                {(()=>{const lg=getLeague(player?.arenaScore||0);return <span style={{color:lg.color,fontWeight:"800"}}>{lg.icon} {player?.arenaScore||0}</span>;})()}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
            {isMobile&&(
              <button style={{...S.btn,background:"rgba(255,255,255,0.06)",fontSize:"14px",padding:"7px 10px",minHeight:"36px"}}
                onClick={activateMobile} title="Tam ekran">⛶</button>
            )}
            <button style={{...S.btn,background:"rgba(255,255,255,0.08)",fontSize:"11px",padding:"7px 10px",minHeight:"36px"}}
              onClick={()=>{ localStorage.removeItem("edb_platform"); setPlatform(null); }}>
              {isMobile?"🖥️":"📱"}
            </button>
            <button style={{...S.btn,...S.btnDanger,fontSize:"11px",padding:"7px 12px",minHeight:"36px"}} onClick={()=>{setPlayer(null);setScreen("auth");}}>ÇIKIŞ</button>
          </div>
        </div>
      )}

      {notif&&<div style={{position:"fixed",top:isMobile?"60px":"80px",left:"50%",transform:"translateX(-50%)",background:"#0f6",padding:isMobile?"10px 18px":"12px 22px",borderRadius:"12px",color:"#000",zIndex:9999,fontWeight:"700",boxShadow:"0 0 20px #0f6",whiteSpace:"nowrap",fontSize:isMobile?"13px":"14px"}}>{notif}</div>}

      {/* ── MENU ── */}
      {screen==="menu"&&(
        <div style={{flex:1,overflowY:"auto",padding:isMobile?"12px":"20px"}}>
          {isMobile ? (
            /* MOBİL: dikey layout */
            <div style={{display:"flex",flexDirection:"column",gap:"12px",maxWidth:"480px",margin:"0 auto"}}>
              {/* Karakter kartı - yatay, kompakt */}
              <div style={{...S.glass,padding:"14px 18px",display:"flex",alignItems:"center",gap:"14px"}}>
                <div style={{fontSize:"52px",cursor:"pointer",animation:"pulse 2s infinite",flexShrink:0}} onClick={()=>setModal("wardrobe")}>{COSTUMES[player!.currentCostume].i}</div>
                <div style={{flex:1}}>
                  <div style={{...S.neon("#fff"),fontSize:"18px",fontWeight:"800",marginBottom:"2px"}}>{player?.name}</div>
                  <div style={{color:"#aaa",fontSize:"12px",marginBottom:"6px"}}>{COSTUMES[player!.currentCostume].n}</div>
                  <div style={{display:"flex",gap:"12px",fontSize:"13px"}}>
                    <span>⚔️ <span style={{color:"#f05",fontWeight:"700"}}>{getStats(player!).atk}</span></span>
                    <span>🛡️ <span style={{color:"#0f6",fontWeight:"700"}}>{getStats(player!).maxHp}</span></span>
                    <span>⭐ <span style={{color:"#fc0",fontWeight:"700"}}>{player?.xp}/{player?.maxXp}</span></span>
                  </div>
                </div>
              </div>
              {/* Admin */}
              {isAdmin(player!.name)&&(
                <div onClick={()=>{loadAdminUsers();setScreen("admin");}}
                  style={{...S.glass,padding:"10px 16px",display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",border:"1px solid #f05",background:"rgba(30,0,0,0.84)"}}>
                  <span style={{fontSize:"20px"}}>🔧</span>
                  <span style={{...S.neon("#f05"),fontSize:"13px",fontWeight:"800"}}>ADMİN PANELİ</span>
                </div>
              )}
              {/* Grid butonlar */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                {[{id:"map",t:"MACERA",i:"🗺️",c:"#fc0"},{id:"arena",t:"ARENA",i:"⚔️",c:"#f05"},{id:"shop",t:"MARKET",i:"🛒",c:"#0f6"},{id:"inv",t:"ÇANTA",i:"🎒",c:"#00eaff"}].map(m=>(
                  <div key={m.id} onClick={()=>{playSound("click");if(m.id==="arena")goToArena();else setScreen(m.id as "map"|"shop"|"inv");}}
                    style={{...S.glass,height:"110px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",border:`1px solid ${m.c}`,background:"rgba(20,20,30,0.9)",gap:"6px"}}>
                    <div style={{fontSize:"36px"}}>{m.i}</div>
                    <div style={{...S.neon(m.c),fontSize:"13px",fontWeight:"800"}}>{m.t}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* PC: yatay layout */
            <div style={{display:"flex",flexDirection:"row",alignItems:"flex-start",justifyContent:"center",gap:"28px",height:"100%",alignContent:"center",flexWrap:"wrap",paddingTop:"20px"}}>
              <div style={{...S.glass,padding:"36px",textAlign:"center",width:"340px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                <div style={{fontSize:"96px",cursor:"pointer",animation:"pulse 2s infinite"}} onClick={()=>setModal("wardrobe")}>{COSTUMES[player!.currentCostume].i}</div>
                <h2 style={{...S.neon("#fff"),fontSize:"28px",margin:"8px 0"}}>{player?.name}</h2>
                <div style={{color:"#aaa",marginBottom:"18px"}}>{COSTUMES[player!.currentCostume].n}</div>
                <div style={{background:"rgba(255,255,255,0.04)",padding:"14px",borderRadius:"12px",textAlign:"left"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span>⚔️ Saldırı</span><span style={{color:"#f05",fontWeight:"700"}}>{getStats(player!).atk}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span>🛡️ Can</span><span style={{color:"#0f6",fontWeight:"700"}}>{getStats(player!).maxHp}</span></div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",width:"580px"}}>
                {isAdmin(player!.name)&&(
                  <div onClick={()=>{loadAdminUsers();setScreen("admin");}}
                    style={{...S.glass,padding:"12px 20px",display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",border:"1px solid #f05",background:"rgba(30,0,0,0.84)",gridColumn:"1/-1",justifyContent:"center"}}>
                    <span style={{fontSize:"20px"}}>🔧</span>
                    <span style={{...S.neon("#f05"),fontSize:"14px",fontWeight:"800"}}>ADMİN PANELİ</span>
                  </div>
                )}
                {[{id:"map",t:"MACERA",i:"🗺️",c:"#fc0"},{id:"arena",t:"ARENA",i:"⚔️",c:"#f05"},{id:"shop",t:"MARKET",i:"🛒",c:"#0f6"},{id:"inv",t:"ÇANTA",i:"🎒",c:"#00eaff"},{id:"social",t:"SOSYAL",i:"🤝",c:"#b44fff"},{id:"profile",t:"PROFİL",i:"👤",c:"#00eaff"}].map(m=>(
                  <div key={m.id} onClick={()=>{playSound("click");if(m.id==="arena")goToArena();else if(m.id==="profile"){setViewProfile(player!.name);setScreen("profile");}else setScreen(m.id as "map"|"shop"|"inv"|"social");}}
                    style={{...S.glass,height:"190px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",border:`1px solid ${m.c}`,background:"rgba(20,20,30,0.84)",position:"relative"}}>
                    {m.id==="social"&&friendReqs.length>0&&<div style={{position:"absolute",top:"10px",right:"10px",background:"#f05",borderRadius:"50%",width:"22px",height:"22px",fontSize:"12px",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"800"}}>{friendReqs.length}</div>}
                    <div style={{fontSize:"60px",marginBottom:"10px"}}>{m.i}</div>
                    <div style={{...S.neon(m.c),fontSize:"18px",fontWeight:"800"}}>{m.t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ARENA EKRANI — tamamen yeniden yazıldı
      ══════════════════════════════════════════════════════════════════ */}
      {screen==="arena"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",background:`linear-gradient(rgba(0,0,0,0.7),rgba(0,0,0,0.9)),url(${ARENA_BG}) center/cover`,overflow:"hidden"}}>

          {/* ── ARENA HEADER ── */}
          <div style={{...S.glass,margin:"16px 16px 0",padding:"14px 22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <h2 style={{...S.neon("#f05"),margin:0,fontSize:"22px"}}>⚔️ ARENA</h2>
            <div style={{display:"flex",gap:"12px",fontSize:"16px",fontWeight:"700"}}>
              <span style={S.neon("#0f6")}>❤️ {player?.hp}</span>
              <span style={S.neon("#00eaff")}>💰 {player?.gold}</span>
              <span style={S.neon("#fc0")}>⚡ {player?.lvl}</span>
            </div>
            <button style={{...S.btn,...S.btnDanger,padding:"8px 16px",fontSize:"13px"}}
              onClick={()=>{ if(arenaScreen==="searching") cancelSearch(); else setScreen("menu"); }}>
              {arenaScreen==="searching"?"❌ İPTAL":"← GERİ"}
            </button>
          </div>

          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>

            {/* ── KURALLAR ── */}
            {arenaScreen==="rules"&&(
              <div style={{...S.glass,padding:"36px",width:"600px",maxHeight:"80vh",overflowY:"auto"}}>
                <h1 style={{...S.neon("#fc0"),fontSize:"28px",marginBottom:"24px",textAlign:"center"}}>📜 ARENA KURALLARI</h1>

                <div style={{marginBottom:"18px",padding:"16px",background:"rgba(0,255,100,0.06)",borderRadius:"12px",border:"1px solid rgba(0,255,100,0.2)"}}>
                  <h3 style={{color:"#0f6",marginTop:0}}>⚔️ SAVAŞ SİSTEMİ</h3>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• Her soru için <strong style={{color:"#fff"}}>20 saniye</strong> süreniz var</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• İki oyuncu <strong style={{color:"#fff"}}>aynı anda</strong> cevap verir (sıra yok!)</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• Doğru cevap → Rakibe hasar (saldırı gücünüz kadar)</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• Yanlış cevap → Kendinize 20 hasar</p>
                </div>

                <div style={{marginBottom:"18px",padding:"16px",background:"rgba(0,180,255,0.06)",borderRadius:"12px",border:"1px solid rgba(0,180,255,0.2)"}}>
                  <h3 style={{color:"#00eaff",marginTop:0}}>🎯 ÖZEL DURUMLAR</h3>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• İkisi de doğru → <strong style={{color:"#fff"}}>Hızlı cevaplayan</strong> hasar verir</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• İkisi de yanlış → <strong style={{color:"#f05"}}>İkisi de 20 hasar</strong> alır</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• Biri doğru diğeri yanlış → Doğru bilen hasar verir</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• Süre biterse → Cevap verilmemiş sayılır</p>
                </div>

                <div style={{marginBottom:"28px",padding:"16px",background:"rgba(255,0,85,0.08)",borderRadius:"12px",border:"1px solid rgba(255,0,85,0.2)"}}>
                  <h3 style={{color:"#f05",marginTop:0}}>🤖 BOT EŞLEŞMESİ</h3>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• 15 saniye içinde rakip bulunamazsa bot ile eşleşirsin</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• Bot %60 doğrulukla rastgele cevap verir</p>
                  <p style={{margin:"6px 0",color:"#ccc"}}>• Bot gücü senin gücünün %80'i kadardır</p>
                </div>

                <button style={{...S.btn,...S.btnSuccess,width:"100%",padding:"16px",fontSize:"17px"}}
                  onClick={()=>{ save({...player!,arenaRulesSeen:true}); setArenaScreen("menu"); }}>
                  ✅ ANLAŞILDI — ARENA'YA GİR
                </button>
              </div>
            )}

            {/* ── ARENA MENU ── */}
            {arenaScreen==="menu"&&(
              <div style={{display:"flex",gap:isMobile?"12px":"24px",alignItems:"flex-start",flexWrap:"wrap",justifyContent:"center",width:"100%",maxWidth:"900px",padding:isMobile?"0 8px":"0"}}>

                {/* Sol: Sıralama + Lig Haritası */}
                <div style={{...S.glass,padding:isMobile?"14px":"20px",width:isMobile?"100%":"340px",minWidth:isMobile?"0":"300px"}}>
                  {/* Sekme */}
                  <div style={{display:"flex",gap:"6px",marginBottom:"16px"}}>
                    {(["siralama","liglar"] as const).map(t=>(
                      <button key={t} style={{...S.btn,flex:1,fontSize:"12px",padding:"8px",
                        background:(arenaLeftTab||"siralama")===t?"linear-gradient(135deg,#f7971e,#ffd200)":"rgba(255,255,255,0.08)",
                        color:(arenaLeftTab||"siralama")===t?"#000":"white"}}
                        onClick={()=>setArenaLeftTab(t)}>
                        {t==="siralama"?"🏆 SIRALAMA":"⚔️ LİGLER"}
                      </button>
                    ))}
                  </div>

                  {/* SIRALAMA */}
                  {(arenaLeftTab||"siralama")==="siralama"&&(
                    <>
                      {player && (()=>{
                        const myScore=player.arenaScore||0;
                        const league=getLeague(myScore);
                        const myRank=leaderboard.findIndex(u=>u.name===player.name);
                        return(
                          <>
                            <div style={{textAlign:"center",marginBottom:"10px",padding:"10px",borderRadius:"10px",background:league.bg,border:`2px solid ${league.color}`}}>
                              <span style={{fontSize:"24px"}}>{league.icon}</span>
                              <span style={{color:league.color,fontWeight:"800",fontSize:"16px",marginLeft:"8px"}}>{league.name} Ligi</span>
                              <div style={{color:"#aaa",fontSize:"12px",marginTop:"2px"}}>{myScore} puan • {player.arenaGames||0} maç</div>
                            </div>
                            {myRank>=0&&(
                              <div style={{padding:"7px 12px",marginBottom:"10px",borderRadius:"8px",background:"rgba(0,114,255,0.15)",border:"1px solid #0072ff",fontSize:"12px",textAlign:"center"}}>
                                📍 Sıran: <strong style={{color:"#fc0"}}>#{myRank+1}</strong>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div style={{maxHeight:"320px",overflowY:"auto"}}>
                        {leaderboard.length>0 ? leaderboard.map((u,i)=>{
                          const lg=getLeague(u.score);
                          const isMe=u.name===player?.name;
                          return(
                            <div key={u.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",marginBottom:"4px",borderRadius:"8px",
                              background:isMe?"rgba(0,114,255,0.25)":i===0?"rgba(255,215,0,0.12)":i===1?"rgba(192,192,192,0.1)":i===2?"rgba(205,127,50,0.1)":"rgba(255,255,255,0.04)",
                              border:isMe?"2px solid #0072ff":i<3?"1px solid rgba(255,215,0,0.2)":"1px solid transparent"}}>
                              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                                <span style={{fontSize:"16px",minWidth:"20px"}}>{i===0?"👑":i===1?"🥈":i===2?"🥉":lg.icon}</span>
                                <div>
                                  <div style={{fontSize:"12px",fontWeight:"800",color:isMe?"#00eaff":"#fff"}}>{i+1}. {u.name}{isMe?" ◀":""}</div>
                                  <div style={{fontSize:"10px",color:lg.color}}>{lg.name} • Lv.{u.lvl}</div>
                                </div>
                              </div>
                              <span style={{color:"#fc0",fontWeight:"800",fontSize:"13px"}}>{u.score}🏆</span>
                            </div>
                          );
                        }):(
                          <div style={{textAlign:"center",color:"#aaa",padding:"24px",fontSize:"13px"}}>
                            <div style={{fontSize:"36px",marginBottom:"8px"}}>🏟️</div>
                            Henüz kimse oynamadı!
                          </div>
                        )}
                      </div>
                      <button style={{...S.btn,width:"100%",marginTop:"10px",padding:"8px",fontSize:"12px",background:"rgba(255,255,255,0.08)"}} onClick={loadLeaderboard}>🔄 YENİLE</button>
                    </>
                  )}

                  {/* LİGLER HARİTASI */}
                  {(arenaLeftTab||"siralama")==="liglar"&&(
                    <div style={{maxHeight:"420px",overflowY:"auto"}}>
                      {[...LEAGUES].reverse().map((league)=>{
                        const myScore=player?.arenaScore||0;
                        const isCurrent=myScore>=league.min&&myScore<=league.max;
                        const isUnlocked=myScore>=league.min;
                        const pct=isCurrent?Math.min(100,((myScore-league.min)/Math.max(1,league.max===Infinity?2000:league.max-league.min))*100):isUnlocked?100:0;
                        const nextL=LEAGUES[LEAGUES.indexOf(league)+1];
                        return(
                          <div key={league.name} style={{padding:"12px",marginBottom:"10px",borderRadius:"12px",
                            border:`2px solid ${isCurrent?league.color:"rgba(255,255,255,0.07)"}`,
                            background:isCurrent?league.bg:"rgba(255,255,255,0.03)",
                            opacity:isUnlocked?1:0.4,
                            transform:isCurrent?"scale(1.02)":"scale(1)",
                            transition:"all 0.3s"}}>
                            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                              <span style={{fontSize:"30px",filter:isUnlocked?"":"grayscale(100%)"}}>{isUnlocked?league.icon:"🔒"}</span>
                              <div style={{flex:1}}>
                                <div style={{display:"flex",justifyContent:"space-between"}}>
                                  <span style={{fontWeight:"800",color:isCurrent?league.color:"#fff",fontSize:"14px"}}>
                                    {league.name}
                                    {isCurrent&&<span style={{marginLeft:"6px",fontSize:"10px",background:league.color,color:"#000",padding:"1px 6px",borderRadius:"8px"}}>SEN</span>}
                                  </span>
                                  <span style={{fontSize:"11px",color:"#666"}}>{league.min}{league.max===Infinity?"+":" - "+league.max}</span>
                                </div>
                                {isCurrent&&(
                                  <>
                                    <div style={{...S.bar,marginTop:"6px"}}>
                                      <div style={{width:pct+"%",height:"100%",background:`linear-gradient(90deg,${league.color},#fff)`,transition:"width 0.5s"}}/>
                                    </div>
                                    <div style={{fontSize:"10px",color:"#aaa",marginTop:"3px"}}>
                                      {myScore} puan
                                      {nextL&&league.max!==Infinity&&<span style={{color:league.color}}> • {league.max-myScore} puan kaldı → {nextL.name}</span>}
                                      {league.max===Infinity&&<span style={{color:"#fc0"}}> • Zirvedesin! 👑</span>}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"7px"}}>
                              {league.name==="Bronz"&&<span style={{padding:"2px 7px",borderRadius:"6px",fontSize:"10px",background:"rgba(205,127,50,0.2)",color:"#cd7f32"}}>🥉 Başlangıç</span>}
                              {league.name==="Gümüş"&&<span style={{padding:"2px 7px",borderRadius:"6px",fontSize:"10px",background:"rgba(192,192,192,0.2)",color:"#c0c0c0"}}>🥈 Gümüş Rozet</span>}
                              {league.name==="Altın"&&<span style={{padding:"2px 7px",borderRadius:"6px",fontSize:"10px",background:"rgba(255,215,0,0.2)",color:"#ffd700"}}>🥇 +500 Altın</span>}
                              {league.name==="Platin"&&<span style={{padding:"2px 7px",borderRadius:"6px",fontSize:"10px",background:"rgba(0,234,255,0.2)",color:"#00eaff"}}>💎 +1000 Altın</span>}
                              {league.name==="Elmas"&&<span style={{padding:"2px 7px",borderRadius:"6px",fontSize:"10px",background:"rgba(185,242,255,0.2)",color:"#b9f2ff"}}>💠 +2000 Altın</span>}
                              {league.name==="Efsane"&&<span style={{padding:"2px 7px",borderRadius:"6px",fontSize:"10px",background:"rgba(255,200,0,0.2)",color:"#fc0"}}>👑 EFSANE +5000</span>}
                              <span style={{padding:"2px 7px",borderRadius:"6px",fontSize:"10px",background:"rgba(0,255,100,0.1)",color:"#0f6"}}>+{[50,75,100,150,200,300][LEAGUES.indexOf(league)]}/galibiyet</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sağ: Butonlar */}
                <div style={{...S.glass,padding:isMobile?"16px":"32px",width:isMobile?"100%":"340px",minWidth:isMobile?"0":"300px",display:"flex",flexDirection:"column",gap:"12px",alignItems:"stretch"}}>
                  <h2 style={{...S.neon("#f05"),margin:"0 0 8px",textAlign:"center",fontSize:"26px"}}>⚔️ ARENA</h2>
                  {(()=>{
                    const myScore=player?.arenaScore||0;
                    const league=getLeague(myScore);
                    return(
                      <div style={{textAlign:"center",padding:"10px",borderRadius:"10px",background:league.bg,border:`1px solid ${league.color}`,marginBottom:"6px"}}>
                        <span style={{fontSize:"22px"}}>{league.icon}</span>
                        <span style={{color:league.color,fontWeight:"800",marginLeft:"6px"}}>{league.name}</span>
                        <span style={{color:"#aaa",fontSize:"12px",marginLeft:"6px"}}>{myScore}🏆</span>
                      </div>
                    );
                  })()}
                  <p style={{color:"#aaa",textAlign:"center",margin:"0",fontSize:"13px",lineHeight:"1.6"}}>
                    Gerçek oyunculara karşı savaş!<br/>
                    15 sn'de rakip bulunamazsa bot ile eşleş.
                  </p>
                  <button style={{...S.btn,...S.btnDanger,padding:"18px",fontSize:"18px",width:"100%"}} onClick={findMatch}>
                    🎮 EŞLEŞTİRME BUL
                  </button>
                  <button style={{...S.btn,padding:"12px",fontSize:"14px",width:"100%",background:"rgba(255,255,255,0.08)"}} onClick={()=>setArenaScreen("rules")}>
                    📜 KURALLARI GÖR
                  </button>
                  <button style={{...S.btn,...S.btnSuccess,padding:"12px",fontSize:"14px",width:"100%"}} onClick={()=>setScreen("menu")}>
                    ← ANA MENÜYE DÖN
                  </button>
                </div>

              </div>
            )}

            {/* ── RAKİP ARANYOR ── */}
                        {arenaScreen==="ligmap"&&(
              <div style={{flex:1,overflowY:"auto",padding:"0 16px 24px"}}>
                <h2 style={{...S.neon("#fc0"),textAlign:"center",margin:"16px 0"}}>⚔️ ARENA LİGLERİ</h2>
                {(()=>{
                  const myScore=player?.arenaScore||0;
                  const myLeague=getLeague(myScore);
                  return(
                    <div style={{textAlign:"center",marginBottom:"20px",padding:"12px",borderRadius:"12px",background:myLeague.bg,border:`2px solid ${myLeague.color}`}}>
                      <div style={{fontSize:"36px"}}>{myLeague.icon}</div>
                      <div style={{color:myLeague.color,fontWeight:"800",fontSize:"18px"}}>{myLeague.name} Ligi</div>
                      <div style={{color:"#aaa",fontSize:"13px"}}>{myScore} Arena Puan • {player?.arenaGames||0} Maç</div>
                    </div>
                  );
                })()}

                {/* Liglar - aşağıdan yukarı */}
                {[...LEAGUES].reverse().map((league,ri)=>{
                  const myScore=player?.arenaScore||0;
                  const isCurrent=myScore>=league.min&&myScore<=league.max;
                  const isUnlocked=myScore>=league.min;
                  const progress=isCurrent?Math.min(100,((myScore-league.min)/Math.max(1,league.max===Infinity?league.min+2000:league.max-league.min))*100):isUnlocked?100:0;
                  const nextLeague=LEAGUES[LEAGUES.indexOf(league)+1];
                  return(
                    <div key={league.name} style={{...S.glass,padding:"16px",marginBottom:"12px",
                      border:`2px solid ${isCurrent?league.color:"rgba(255,255,255,0.08)"}`,
                      background:isCurrent?league.bg:"rgba(16,20,24,0.6)",
                      opacity:isUnlocked?1:0.45,
                      transform:isCurrent?"scale(1.02)":"scale(1)",
                      transition:"all 0.3s ease"
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                        <div style={{fontSize:"40px",filter:isUnlocked?"":"grayscale(100%)"}}>{league.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div style={{fontWeight:"800",fontSize:"16px",color:isCurrent?league.color:"#fff"}}>
                              {league.name} Ligi
                              {isCurrent&&<span style={{marginLeft:"8px",fontSize:"12px",background:league.color,color:"#000",padding:"2px 8px",borderRadius:"10px"}}>◀ Şu an burada</span>}
                            </div>
                            <div style={{fontSize:"12px",color:"#aaa"}}>{league.min}{league.max===Infinity?"+":" - "+league.max} 🏆</div>
                          </div>
                          {isCurrent&&(
                            <>
                              <div style={{...S.bar,width:"100%",marginTop:"8px"}}>
                                <div style={{width:progress+"%",height:"100%",background:`linear-gradient(90deg,${league.color},#fff)`,transition:"width 0.5s ease"}}/>
                              </div>
                              <div style={{fontSize:"11px",color:"#aaa",marginTop:"4px"}}>
                                {(player?.arenaScore||0)} / {league.max===Infinity?"MAX":league.max} puan
                                {nextLeague&&league.max!==Infinity&&<span style={{color:league.color,marginLeft:"6px"}}>→ {nextLeague.name}: {league.max-myScore} puan kaldı</span>}
                              </div>
                            </>
                          )}
                        </div>
                        {!isUnlocked&&<div style={{fontSize:"24px"}}>🔒</div>}
                      </div>
                      {/* Ödüller */}
                      <div style={{marginTop:"10px",display:"flex",gap:"8px",flexWrap:"wrap"}}>
                        {league.name==="Bronz"&&<span style={{padding:"3px 10px",borderRadius:"8px",fontSize:"11px",background:"rgba(205,127,50,0.2)",color:"#cd7f32"}}>🥉 Başlangıç Kalkanı</span>}
                        {league.name==="Gümüş"&&<span style={{padding:"3px 10px",borderRadius:"8px",fontSize:"11px",background:"rgba(192,192,192,0.2)",color:"#c0c0c0"}}>🥈 Gümüş Kostüm Rozeti</span>}
                        {league.name==="Altın"&&<span style={{padding:"3px 10px",borderRadius:"8px",fontSize:"11px",background:"rgba(255,215,0,0.2)",color:"#ffd700"}}>🥇 Altın Çerçeve +500 Altın</span>}
                        {league.name==="Platin"&&<span style={{padding:"3px 10px",borderRadius:"8px",fontSize:"11px",background:"rgba(0,234,255,0.2)",color:"#00eaff"}}>💎 Platin Başlık +1000 Altın</span>}
                        {league.name==="Elmas"&&<span style={{padding:"3px 10px",borderRadius:"8px",fontSize:"11px",background:"rgba(185,242,255,0.2)",color:"#b9f2ff"}}>💠 Elmas Efekt +2000 Altın</span>}
                        {league.name==="Efsane"&&<span style={{padding:"3px 10px",borderRadius:"8px",fontSize:"11px",background:"rgba(255,200,0,0.2)",color:"#fc0"}}>👑 EFSANE UNVANI +5000 Altın</span>}
                        <span style={{padding:"3px 10px",borderRadius:"8px",fontSize:"11px",background:"rgba(0,255,100,0.1)",color:"#0f6"}}>+{[50,75,100,150,200,300][LEAGUES.indexOf(league)]} puan/galibiyet</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{height:"20px"}}/>
              </div>
            )}

            {arenaScreen==="searching"&&(
              <div style={{...S.glass,padding:"48px",width:"420px",textAlign:"center"}}>
                <div style={{fontSize:"72px",marginBottom:"16px",animation:"spin 2s linear infinite",display:"inline-block"}}>⚔️</div>
                <h2 style={{...S.neon("#f05"),fontSize:"26px",marginBottom:"12px"}}>RAKİP ARANIYOR</h2>
                <div style={{fontSize:"56px",fontWeight:"800",color:"#00eaff",marginBottom:"8px"}}>{searchTime}s</div>
                <div style={{...S.bar,marginBottom:"24px"}}>
                  <div style={{width:`${(searchTime/15)*100}%`,height:"100%",background:"linear-gradient(90deg,#f05,#00eaff)",transition:"width 1s linear"}}/>
                </div>
                <p style={{color:"#aaa",marginBottom:"28px",fontSize:"14px"}}>
                  {searchTime>0?"Aktif oyuncu aranıyor...":"Bot ile eşleşiliyor..."}
                </p>
                <button
                  style={{...S.btn,...S.btnDanger,width:"100%",padding:"16px",fontSize:"16px"}}
                  onClick={cancelSearch}
                >
                  ❌ ARAMAYII İPTAL ET
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── BATTLE EKRANI ── */}
      {screen==="battle"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",background:`linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.9)),url(${battle.region?.bg||""}) center/cover`}}>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-around",position:"relative",flexWrap:isMobile?"wrap":"nowrap",gap:isMobile?"4px":"0",padding:isMobile?"8px 4px":"0"}}>
            {battle.dmgText&&<div className="floating-dmg" style={{top:"38%",color:battle.dmgText.c}}>{battle.dmgText.val}</div>}

            {/* Düşman */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:isMobile?"64px":"120px",filter:"drop-shadow(0 0 20px #f05)"}}>{battle.level?.ico}</div>
              <div style={{...S.glass,padding:"10px 20px",marginTop:"10px",display:"inline-block",minWidth:"160px"}}>
                <div style={{fontWeight:"800",fontSize:"16px"}}>{battle.level?.en}</div>
                {(()=>{
                  // PvP modunda Firebase'den gerçek HP al
                  const pvpHp = pvp.matchId&&pvp.matchData ? (pvp.side==="host"?pvp.matchData.state.guestHp:pvp.matchData.state.hostHp) : null;
                  const pvpMaxHp = pvp.matchId&&pvp.matchData ? (pvp.side==="host"?getStats(player!).maxHp:getStats(player!).maxHp) : null;
                  const dispHp = pvpHp!==null ? pvpHp : battle.enemyHp;
                  const dispMax = pvpMaxHp!==null ? pvpMaxHp : battle.maxEnemyHp;
                  const pct = dispMax>0 ? dispHp/dispMax : 0;
                  const leagueIcon = pvp.matchId ? getLeague(0).icon : null;
                  return (<>
                    {pvp.matchId&&pvp.matchData&&(
                      <div style={{fontSize:"11px",color:"#fc0",marginBottom:"4px"}}>
                        {getLeague(0).icon} Arena Rakibi
                      </div>
                    )}
                    <div style={{...S.bar,width:isMobile?"120px":"160px"}}>
                      <div style={{width:`${Math.max(0,pct*100)}%`,height:"100%",
                        background: pct>0.5?"linear-gradient(90deg,#f05,#ff8)":pct>0.25?"linear-gradient(90deg,#f80,#fc0)":"linear-gradient(90deg,#f00,#f55)",
                        transition:"width 0.5s ease"
                      }}/>
                    </div>
                    <div style={{fontSize:"13px",color:"#aaa",marginTop:"4px",fontWeight:"700"}}>
                      {Math.max(0,dispHp)} / {dispMax}
                      {pct<0.25&&<span style={{color:"#f05",marginLeft:"6px"}}>⚠️</span>}
                    </div>
                  </>);
                })()}
              </div>
            </div>

            {/* Orta log */}
            <div style={{textAlign:"center",minWidth:"220px"}}>
              {battle.log&&(
                <div style={{marginBottom:"16px",fontSize:"18px",fontWeight:"800",
                  color: battle.log.startsWith("✅")||battle.log.startsWith("🎯")?"#0f6":battle.log.startsWith("❌")?"#f05":"#fc0",
                  padding:"10px 16px",borderRadius:"10px",
                  background: battle.log.startsWith("✅")||battle.log.startsWith("🎯")?"rgba(0,255,100,0.1)":battle.log.startsWith("❌")?"rgba(255,0,80,0.1)":"rgba(255,200,0,0.1)",
                  border: `1px solid ${battle.log.startsWith("✅")||battle.log.startsWith("🎯")?"#0f6":battle.log.startsWith("❌")?"#f05":"#fc0"}`,
                  animation:"popIn 0.3s ease"
                }}>{battle.log}</div>
              )}
              {battle.combo>1&&!pvp.matchId&&(
                <div style={{fontSize:"22px",fontWeight:"800",color:"#fc0",marginBottom:"8px",animation:"pulse 0.5s ease"}}>
                  🔥 {battle.combo}x KOMBO!
                </div>
              )}
              {pvp.matchId ? (
                <div>
                  <div style={{...S.neon("#00eaff"),fontSize:"20px",fontWeight:"800"}}>⚡ EŞ ZAMANLI</div>
                  {(()=>{
                    const isHost=pvp.side==="host";
                    const myAns=pvp.matchData?.state?(isHost?pvp.matchData.state.hostAnswerCorrect:pvp.matchData.state.guestAnswerCorrect):-1;
                    return myAns!==-1
                      ? <div style={{color:"#fc0",marginTop:"8px",fontSize:"13px"}}>⏳ Rakip bekleniyor...</div>
                      : <div style={{color:"#0f6",marginTop:"8px",fontSize:"13px",animation:"pulse 1s infinite"}}>🎯 Hızlı cevapla!</div>;
                  })()}
                </div>
              ) : botMatch&&turn!=="p1" ? (
                <div style={{...S.neon("#f05"),fontSize:"24px",animation:"pulse 1s infinite"}}>BOT DÜŞÜNÜYOR...</div>
              ) : (
                <div style={{...S.neon("#0f6"),fontSize:"28px"}}>SENİN SIRAN</div>
              )}
            </div>

            {/* Oyuncu */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:isMobile?"64px":"120px",filter:"drop-shadow(0 0 20px #00eaff)"}}>{COSTUMES[player!.currentCostume].i}</div>
              <div style={{...S.glass,padding:"10px 20px",marginTop:"10px",display:"inline-block",minWidth:"160px"}}>
                <div style={{fontWeight:"800",fontSize:"16px"}}>{player?.name}</div>
                <div style={{fontSize:"11px",color:getLeague(player?.arenaScore||0).color,marginBottom:"4px"}}>
                  {getLeague(player?.arenaScore||0).icon} {getLeague(player?.arenaScore||0).name}
                </div>
                <div style={{...S.bar,width:isMobile?"120px":"160px"}}>
                  <div style={{width:`${Math.max(0,(player!.hp/getStats(player!).maxHp)*100)}%`,height:"100%",
                    background: player!.hp/getStats(player!).maxHp>0.5?"linear-gradient(90deg,#0f6,#00eaff)":
                      player!.hp/getStats(player!).maxHp>0.25?"linear-gradient(90deg,#fc0,#f80)":"linear-gradient(90deg,#f00,#f55)",
                    transition:"width 0.4s ease"
                  }}/>
                </div>
                <div style={{fontSize:"13px",color:"#aaa",marginTop:"4px",fontWeight:"700"}}>
                  {Math.max(0,player!.hp)} / {getStats(player!).maxHp}
                  {player!.hp/getStats(player!).maxHp<0.25&&<span style={{color:"#f05",marginLeft:"6px"}}>⚠️</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Soru kutusu */}
          <div style={{...S.glass,margin:isMobile?"8px":"22px",padding:isMobile?"14px":"22px",border:"1px solid #00eaff",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            {pvp.matchId&&pvp.matchData?.state?.started ? (
              <>
                {/* PvP durum göstergesi */}
                <div style={{display:"flex",justifyContent:"center",gap:"12px",marginBottom:"14px"}}>
                  {(()=>{
                    const isHost=pvp.side==="host";
                    const my =isHost?pvp.matchData.state.hostAnswerCorrect:pvp.matchData.state.guestAnswerCorrect;
                    const opp=isHost?pvp.matchData.state.guestAnswerCorrect:pvp.matchData.state.hostAnswerCorrect;
                    return(<>
                      <div style={{padding:"5px 12px",borderRadius:"8px",fontSize:"12px",fontWeight:"700",background:my!==-1?"rgba(0,255,100,0.15)":"rgba(255,255,255,0.06)",border:`1px solid ${my!==-1?"#0f6":"#444"}`}}>
                        {my!==-1?"✅ Sen cevapladın":"⏳ Bekliyor..."}
                      </div>
                      <div style={{padding:"5px 12px",borderRadius:"8px",fontSize:"12px",fontWeight:"700",background:opp!==-1?"rgba(255,100,0,0.15)":"rgba(255,255,255,0.06)",border:`1px solid ${opp!==-1?"#f60":"#444"}`}}>
                        {opp!==-1?"✅ Rakip cevapladı":"⏳ Rakip bekliyor..."}
                      </div>
                    </>);
                  })()}
                </div>

                <div style={{textAlign:"center",marginBottom:"18px",fontSize:"20px",fontWeight:"800"}}>
                  {pvp.matchData.state.qs[pvp.matchData.state.qIdx].q}
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                  {pvp.matchData.state.qs[pvp.matchData.state.qIdx].o.map((o,i)=>{
                    const isHost=pvp.side==="host";
                    const myAns=isHost?pvp.matchData!.state.hostAnswerCorrect:pvp.matchData!.state.guestAnswerCorrect;
                    const correctIdx=pvp.matchData!.state.qs[pvp.matchData!.state.qIdx].a;
                    const isMyAnswer=myAns!==1&&myAns!==0 ? false : false; // henüz cevap yok gösterme
                    const showPvpResult=pvp.matchData!.state.resolving||pvp.matchData!.state.log!=="";
                    // Sadece resolving bitince (log gelince) doğruyu göster
                    const justResolved=!pvp.matchData!.state.resolving && pvp.matchData!.state.log!=="";
                    const disabled=myAns!==-1||pvp.matchData!.state.resolving;
                    const isCorrectBtn=i===correctIdx;
                    const isMyChosen=myAns!==-1 && false; // idx bilgisi yok PvP'de
                    let bg="linear-gradient(135deg,#00c6ff,#0072ff)";
                    let brd="none";
                    let sc="scale(1)";
                    if(myAns!==-1 && isCorrectBtn){ bg="linear-gradient(135deg,#11998e,#38ef7d)"; brd="2px solid #0f6"; sc="scale(1.04)"; }
                    return(
                      <button key={i}
                        style={{...S.btn,padding:isMobile?"10px":"14px",fontSize:isMobile?13:15,width:"100%",textTransform:"none",outline:isAdmin(player!.name)&&pvp.matchData?.state&&i===pvp.matchData.state.qs[pvp.matchData.state.qIdx]?.a?"3px solid #0f6":"none",
                          background:bg, border:brd, transform:sc,
                          transition:"all 0.25s ease",
                          opacity:disabled&&!isCorrectBtn?0.45:1,
                          cursor:disabled?"not-allowed":"pointer",
                          boxShadow:myAns!==-1&&isCorrectBtn?"0 0 20px rgba(0,255,100,0.6)":""
                        }}
                        onClick={()=>{ if(myAns===-1&&!pvp.matchData!.state.resolving){ playSound(i===correctIdx?"correct":"wrong"); pvpAnswer(i); } }}
                        disabled={disabled}
                      >
                        {myAns!==-1 && isCorrectBtn && <span style={{marginRight:"6px"}}>✅</span>}
                        {o}
                      </button>
                    );
                  })}
                </div>

                {pvp.matchData.state.resolving&&(
                  <div style={{textAlign:"center",marginTop:"14px",color:"#fc0",fontWeight:"700",animation:"pulse 1s infinite"}}>⚡ Sonuç hesaplanıyor...</div>
                )}

                <div style={{display:"flex",justifyContent:"center",marginTop:"16px"}}>
                  <button style={{...S.btn,background:"#444",fontSize:"13px"}} onClick={leaveMatch}>MAÇTAN AYRIL</button>
                </div>
              </>
            ) : (
              <>
                <div style={{textAlign:"center",marginBottom:isMobile?"12px":"18px",fontSize:isMobile?"16px":"22px",fontWeight:"800",color:"#fff"}}>
                  {battle.qs[battle.qIdx]?.q||"Yükleniyor..."}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
                  {battle.qs[battle.qIdx]?.o.map((o,i)=>{
                    const isCorrect = i === battle.qs[battle.qIdx].a;
                    const isChosen  = showAnswer?.chosenIdx === i;
                    let bg = "linear-gradient(135deg,#00c6ff,#0072ff)";
                    let border = "none";
                    let scale = "scale(1)";
                    if(showAnswer) {
                      if(isCorrect) { bg="linear-gradient(135deg,#11998e,#38ef7d)"; border="2px solid #0f6"; scale="scale(1.04)"; }
                      else if(isChosen && !isCorrect) { bg="linear-gradient(135deg,#ff416c,#ff4b2b)"; border="2px solid #f05"; }
                    }
                    const disabled = !!showAnswer;
                    return(
                      <button key={i}
                        style={{...S.btn,padding:isMobile?"10px":"14px",fontSize:isMobile?13:15,width:"100%",textTransform:"none",outline:isAdmin(player!.name)&&pvp.matchData?.state&&i===pvp.matchData.state.qs[pvp.matchData.state.qIdx]?.a?"3px solid #0f6":"none",
                          background:bg, border, transform:scale,
                          transition:"all 0.25s ease",
                          opacity:disabled&&!isCorrect&&!isChosen?0.5:1,
                          cursor:disabled?"not-allowed":"pointer",
                          boxShadow: isCorrect&&showAnswer?"0 0 20px rgba(0,255,100,0.6)":isChosen&&!isCorrect&&showAnswer?"0 0 20px rgba(255,0,80,0.6)":"",
                        }}
                        onClick={()=>{ if(!showAnswer) handleMove(i===battle.qs[battle.qIdx].a, i); }}
                        disabled={disabled}
                      >
                        {showAnswer && isCorrect && <span style={{marginRight:"6px"}}>✅</span>}
                        {showAnswer && isChosen && !isCorrect && <span style={{marginRight:"6px"}}>❌</span>}
                        {o}
                      </button>
                    );
                  })}
                </div>
                {showAnswer && (
                  <div style={{textAlign:"center",marginTop:"14px",padding:"10px",borderRadius:"10px",
                    background:showAnswer.correct?"rgba(0,255,100,0.12)":"rgba(255,0,80,0.12)",
                    border:`1px solid ${showAnswer.correct?"#0f6":"#f05"}`,
                    fontSize:"17px",fontWeight:"800",
                    color:showAnswer.correct?"#0f6":"#f05",
                    animation:"pulse 0.5s ease"
                  }}>
                    {showAnswer.correct ? "🎯 DOĞRU! Harika!" : `❌ YANLIŞ! Doğru: ${battle.qs[battle.qIdx]?.o[showAnswer.correctIdx]}`}
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"center",gap:"12px",marginTop:"18px",flexWrap:"wrap"}}>
                  {Object.keys(player!.jokers).map(k=>(
                    <button key={k} style={{...S.btn,background:"#444",fontSize:"13px",opacity:player!.jokers[k]===0?0.5:1}}
                      onClick={()=>useJoker(k as "heal"|"5050"|"skip")} disabled={player!.jokers[k]===0}>
                      {k==="heal"?"❤️":k==="skip"?"⏩":"½"} ({player!.jokers[k]})
                    </button>
                  ))}
                  <button style={{...S.btn,...S.btnDanger}} onClick={()=>{setScreen("menu");setBattle({active:false,enemyHp:0,maxEnemyHp:0,qs:[],qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});}}>PES ET</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ADMİN PANELİ ── */}
      {screen==="admin"&&isAdmin(player!.name)&&(
        <div style={{flex:1,overflowY:"auto",padding:isMobile?"10px":"20px",background:"rgba(10,0,0,0.95)"}}>

          {/* Sticky başlık + tablar */}
          <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(10,0,0,0.97)",paddingBottom:"10px",marginBottom:"12px",borderBottom:"1px solid rgba(255,0,80,0.3)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <h1 style={{...S.neon("#f05"),margin:0,fontSize:isMobile?"18px":"24px"}}>🔧 ADMİN PANELİ</h1>
              <button style={{...S.btn,...S.btnDanger,fontSize:"12px",padding:"8px 12px"}} onClick={()=>setScreen("menu")}>← GERİ</button>
            </div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {(["users","questions","clans","system"] as const).map(tab=>(
                <button key={tab} style={{...S.btn,flex:1,background:adminTab===tab?"#f05":"rgba(255,255,255,0.08)",fontSize:isMobile?"10px":"11px",padding:isMobile?"7px 3px":"7px 8px",minWidth:"60px"}}
                  onClick={()=>{ setAdminTab(tab); if(tab==="users") loadAdminUsers(); }}>
                  {tab==="users"?"👥 Kişiler":tab==="questions"?"📝 Sorular":tab==="clans"?"🏰 Klanlar":"⚙️ Sistem"}
                </button>
              ))}
            </div>
          </div>

          {/* KULLANICILAR */}
          {adminTab==="users"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"12px"}}>
                <h2 style={{color:"#fc0",margin:0}}>👥 Tüm Kullanıcılar ({Object.keys(adminUsers).length})</h2>
                <button style={{...S.btn,background:"rgba(255,255,255,0.1)",fontSize:"12px"}} onClick={loadAdminUsers}>🔄 Yenile</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
                {Object.keys(adminUsers).filter(k=>!isAdmin(k)).map(k=>{
                  const u=adminUsers[k];
                  const league=getLeague(u.arenaScore||0);
                  return(
                    <div key={k} style={{...S.glass,padding:"14px",border:"1px solid rgba(255,0,80,0.2)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                        <div>
                          <div style={{fontWeight:"800",fontSize:"16px"}}>{k}</div>
                          <div style={{fontSize:"12px",color:league.color}}>{league.icon} {league.name} • {u.arenaScore||0} puan</div>
                        </div>
                        <button style={{...S.btn,...S.btnDanger,padding:"4px 10px",fontSize:"11px"}} onClick={()=>resetUser(k)}>Sıfırla</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px",fontSize:"12px",color:"#aaa"}}>
                        <span>⚡ Level: <strong style={{color:"#fc0"}}>{u.lvl||1}</strong></span>
                        <span>🏆 Skor: <strong style={{color:"#0f6"}}>{u.score||0}</strong></span>
                        <span>⚔️ Arena: <strong style={{color:"#00eaff"}}>{u.arenaGames||0} maç</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SORULAR */}
          {adminTab==="questions"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
                <h2 style={{color:"#fc0",margin:0}}>📝 Soru Yönetimi ({allQuestions.length} soru)</h2>
                <button style={{...S.btn,...S.btnSuccess,fontSize:"13px"}} onClick={()=>setEditingQ({q:"",o:["","","",""],a:0,topic:"genel"})}>
                  ➕ YENİ SORU
                </button>
              </div>

              {editingQ&&(
                <div style={{...S.glass,padding:"20px",marginBottom:"20px",border:"1px solid rgba(0,234,255,0.5)"}}>
                  <h3 style={{color:"#00eaff",margin:"0 0 14px"}}>{editingQ.fbKey?"✏️ Soru Düzenle":"➕ Yeni Soru Ekle"}</h3>
                  <input style={{width:"100%",padding:"10px",marginBottom:"10px",borderRadius:"8px",border:"1px solid #444",background:"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box",fontSize:"14px"}}
                    placeholder="Soru metni..." value={editingQ.q}
                    onChange={e=>setEditingQ(p=>p?{...p,q:e.target.value}:null)}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
                    {editingQ.o.map((opt,i)=>(
                      <div key={i} style={{position:"relative"}}>
                        <input style={{width:"100%",padding:"8px 34px 8px 10px",borderRadius:"8px",border:`2px solid ${editingQ.a===i?"#0f6":"#444"}`,background:editingQ.a===i?"rgba(0,255,100,0.08)":"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box"}}
                          placeholder={"Şık "+(i+1)} value={opt}
                          onChange={e=>setEditingQ(p=>p?{...p,o:p.o.map((x,j)=>j===i?e.target.value:x)}:null)}/>
                        <button style={{position:"absolute",right:"6px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:"16px",color:editingQ.a===i?"#0f6":"#555"}}
                          onClick={()=>setEditingQ(p=>p?{...p,a:i}:null)}>
                          {editingQ.a===i?"✅":"○"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                    <select style={{padding:"9px",borderRadius:"8px",border:"1px solid #444",background:"#111",color:"white"}}
                      value={editingQ.topic} onChange={e=>setEditingQ(p=>p?{...p,topic:e.target.value}:null)}>
                      <option value="genel">Genel</option>
                      <option value="iletisim">İletişim</option>
                      <option value="hikaye">Hikaye</option>
                      <option value="siir">Şiir</option>
                    </select>
                    <button style={{...S.btn,...S.btnSuccess,flex:1}} onClick={async()=>{
                      if(!editingQ||!editingQ.q.trim()||editingQ.o.some(o=>!o.trim())){notify("Tüm alanları doldur!");return;}
                      try {
                        const {fbKey,...qData}=editingQ;
                        if(fbKey){
                          await set(ref(db,"questions/"+fbKey),qData);
                          notify("✅ Soru güncellendi!");
                        } else {
                          await set(ref(db,"questions/q"+Date.now()),qData);
                          notify("✅ Soru eklendi!");
                        }
                        setEditingQ(null); loadCustomQuestions();
                      } catch(e){notify("Hata!");}
                    }}>
                      {editingQ.fbKey?"💾 KAYDET":"➕ EKLE"}
                    </button>
                    <button style={{...S.btn,background:"#444"}} onClick={()=>setEditingQ(null)}>İPTAL</button>
                  </div>
                </div>
              )}

              <div style={{maxHeight:"550px",overflowY:"auto"}}>
                {allQuestions.map((q,i)=>(
                  <div key={(q as Q&{fbKey?:string}).fbKey||i} style={{...S.glass,padding:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.08)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px"}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:"700",fontSize:"13px",color:"#fc0",marginBottom:"6px"}}>{i+1}. {q.q}</div>
                        <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                          {q.o.map((o,j)=>(
                            <span key={j} style={{padding:"2px 8px",borderRadius:"6px",fontSize:"11px",
                              background:j===q.a?"rgba(0,255,100,0.2)":"rgba(255,255,255,0.04)",
                              border:j===q.a?"1px solid #0f6":"1px solid #333"}}>
                              {j===q.a?"✅ ":""}{o}
                            </span>
                          ))}
                        </div>
                        <div style={{color:"#555",fontSize:"10px",marginTop:"4px"}}>📌 {q.topic}</div>
                      </div>
                      <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                        <button style={{...S.btn,padding:"5px 10px",fontSize:"11px",background:"rgba(0,114,255,0.4)"}}
                          onClick={()=>setEditingQ({...q})}>✏️</button>
                        <button style={{...S.btn,...S.btnDanger,padding:"5px 10px",fontSize:"11px"}}
                          onClick={async()=>{
                            const key=(q as Q&{fbKey?:string}).fbKey;
                            if(!key||!confirm("Soru silinsin mi?"))return;
                            await set(ref(db,"questions/"+key),null);
                            notify("Soru silindi!");
                            loadCustomQuestions();
                          }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KLANLAR */}
          {adminTab==="clans"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"12px"}}>
                <h2 style={{color:"#fc0",margin:0}}>🏰 Tüm Klanlar</h2>
                <button style={{...S.btn,background:"rgba(255,255,255,0.1)",fontSize:"12px"}} onClick={async()=>{
                  const snap=await get(ref(db,"clans")); if(snap.exists()) setAdminUsers(prev=>({...prev,__clans__:snap.val()}));
                }}>🔄 Yükle</button>
              </div>
              {(adminUsers as any).__clans__ ? Object.values((adminUsers as any).__clans__).map((c:any)=>(
                <div key={c.tag} style={{...S.glass,padding:"14px",marginBottom:"10px",border:"1px solid rgba(255,200,0,0.3)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontWeight:"800",fontSize:"16px",color:"#fc0"}}>🏰 {c.name} <span style={{color:"#aaa",fontSize:"13px"}}>#{c.tag}</span></div>
                      <div style={{fontSize:"12px",color:"#aaa",marginTop:"4px"}}>Lider: {c.leader} • {Object.keys(c.members||{}).length} üye</div>
                    </div>
                    <button style={{...S.btn,...S.btnDanger,padding:"5px 10px",fontSize:"11px"}}
                      onClick={async()=>{ if(!confirm("Klan silinsin mi?")) return; await set(ref(db,"clans/"+c.tag),null); notify("Klan silindi!"); }}>Sil</button>
                  </div>
                  <div style={{marginTop:"8px",display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {Object.entries(c.members||{}).map(([name,data]:any)=>(
                      <span key={name} style={{padding:"2px 8px",borderRadius:"6px",fontSize:"11px",
                        background:data.role==="leader"?"rgba(255,200,0,0.2)":data.role==="officer"?"rgba(0,198,255,0.2)":"rgba(255,255,255,0.06)",
                        color:data.role==="leader"?"#fc0":data.role==="officer"?"#00eaff":"#aaa"}}>
                        {data.role==="leader"?"👑":data.role==="officer"?"⭐":"👤"} {name}
                      </span>
                    ))}
                  </div>
                </div>
              )) : <div style={{color:"#555",textAlign:"center",padding:"30px"}}>Yüklemek için 🔄 tuşuna bas</div>}
            </div>
          )}

          {/* SİSTEM */}
          {adminTab==="system"&&(
            <div>
              <h2 style={{color:"#fc0",marginTop:0}}>⚙️ Sistem Yönetimi</h2>

              {/* Bakım modu */}
              <div style={{...S.glass,padding:"20px",marginBottom:"20px",border:"1px solid rgba(255,0,80,0.3)"}}>
                <h3 style={{margin:"0 0 12px",color:"#f05"}}>🔧 Bakım Modu</h3>
                <p style={{color:"#aaa",fontSize:"13px",margin:"0 0 14px"}}>Açıkken adminler dışındaki tüm oyuncular oyuna giremez.</p>
                <button style={{...S.btn,background:gameLocked?"#f05":"#0f6",fontSize:"15px",fontWeight:"800",width:"100%"}}
                  onClick={async()=>{
                    const newVal=!gameLocked;
                    await set(ref(db,"settings/gameLocked"),newVal);
                    notify(newVal?"🔧 Bakım modu AÇILDI":"✅ Bakım modu KAPATILDI");
                  }}>
                  {gameLocked?"✅ BAKIM MODU KAPALI YAP":"🔧 BAKIM MODU AÇ"}
                </button>
              </div>

              {/* Hesap silme */}
              <div style={{...S.glass,padding:"20px",border:"1px solid rgba(255,0,80,0.2)"}}>
                <h3 style={{margin:"0 0 12px",color:"#f05"}}>🗑️ Hesap Sil</h3>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px"}}>
                  {Object.keys(adminUsers).filter(k=>!isAdmin(k)).map(k=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:"8px"}}>
                      <span style={{fontSize:"13px"}}>{k}</span>
                      <button style={{...S.btn,...S.btnDanger,padding:"4px 10px",fontSize:"11px"}}
                        onClick={async()=>{
                          if(!confirm(`"${k}" silinsin mi?`)) return;
                          await set(ref(db,"users/"+k),null);
                          localStorage.removeItem(SAVE_KEY+k);
                          notify(`${k} silindi!`);
                          loadAdminUsers();
                        }}>Sil</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


        </div>
      )}

      {/* ── HARİTA ── */}
      {screen==="map"&&(
        <div style={{flex:1,position:"relative",backgroundColor:"#000",backgroundImage:"url('https://witchculttranslation.com/WM-K-Thumb.png')",backgroundSize:"cover",backgroundPosition:"center",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",zIndex:0}}/>
          <button style={{...S.btn,...S.btnDanger,position:"absolute",top:20,right:20,zIndex:10}} onClick={()=>setScreen("menu")}>GERİ</button>
          {REGIONS.map(r=>{
            const unlocked=player!.unlockedRegions.includes(r.id);
            return(
              <div key={r.id} onClick={()=>{if(unlocked){setModal(r);playSound("click");}else notify("Önceki Bölümü Bitir!");}}
                style={{position:"absolute",left:`${r.x}%`,top:`${r.y}%`,transform:"translate(-50%,-50%)",cursor:unlocked?"pointer":"not-allowed",textAlign:"center",opacity:unlocked?1:0.35,filter:unlocked?"drop-shadow(0 0 20px #00eaff)":"grayscale(100%)",zIndex:5}}>
                <div style={{fontSize:"70px",animation:unlocked?"pulse 2s infinite":""}}>
                  {unlocked?(r.type==="iletisim"?"📡":r.type==="hikaye"?"🌲":r.type==="siir"?"🎭":r.id==="tut"?"🎓":"🐲"):"🔒"}
                </div>
                <div style={{...S.glass,padding:"6px 16px",fontSize:"14px"}}>{r.name}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MARKET / ÇANTA ── */}
      {(screen==="shop"||screen==="inv")&&(
        <div style={{flex:1,overflowY:"auto",padding:isMobile?"10px 12px":"22px"}}>
          {/* Sticky başlık */}
          <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(10,10,20,0.95)",backdropFilter:"blur(8px)",padding:isMobile?"10px 0":"0 0 16px",marginBottom:isMobile?"10px":"20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:isMobile?"1px solid rgba(255,255,255,0.08)":"none"}}>
            <h2 style={{...S.neon("#00eaff"),margin:0,fontSize:isMobile?"18px":"26px"}}>{screen==="shop"?"🛒 MARKET":"🎒 ÇANTA"}</h2>
            <button style={{...S.btn,...S.btnDanger,fontSize:"12px",padding:"8px 12px"}} onClick={()=>setScreen("menu")}>← GERİ</button>
          </div>
          {screen==="inv"&&(
            <div style={{...S.glass,padding:isMobile?"12px":"18px",marginBottom:"16px"}}>
              <div style={{fontWeight:"800",color:"#fc0",marginBottom:"10px",fontSize:isMobile?"14px":"16px"}}>🎽 KUŞANILANLAR</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                {(["wep","arm"] as const).map(slot=>(
                  <div key={slot} style={{...S.glass,padding:"12px",textAlign:"center"}}>
                    <div style={{fontWeight:"800",marginBottom:"6px",fontSize:"13px"}}>{slot==="wep"?"⚔️ Silah":"🛡️ Zırh"}</div>
                    {player?.equipped[slot]?(
                      <>
                        <div style={{fontSize:isMobile?"32px":"40px"}}>{player.equipped[slot]!.icon}</div>
                        <div style={{fontSize:"12px",margin:"4px 0"}}>{player.equipped[slot]!.name}</div>
                        <button style={{...S.btn,marginTop:"8px",width:"100%",background:"#f05",fontSize:"11px",padding:"7px"}}
                          onClick={()=>{const np={...player!};np.inventory.push(np.equipped[slot]!);np.equipped[slot]=null;save(np);notify("Çıkarıldı!");}}>ÇIKAR</button>
                      </>
                    ):<div style={{color:"#555",fontSize:"13px",padding:"10px 0"}}>Boş</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(auto-fit,minmax(190px,1fr))",gap:isMobile?"10px":"16px"}}>
            {screen==="shop"?(
              <>
                {Object.values(ITEMS).filter(it=>it.type!=="joker").map(it=>(
                  <div key={it.id} style={{...S.glass,padding:isMobile?"12px":"18px",textAlign:"center"}}>
                    <div style={{fontSize:isMobile?"38px":"46px",marginBottom:"6px"}}>{it.icon}</div>
                    <div style={{fontWeight:"800",fontSize:isMobile?"13px":"15px"}}>{it.name}</div>
                    <div style={{color:"#fc0",margin:"6px 0",fontSize:"14px"}}>{it.cost} 🪙</div>
                    <button style={{...S.btn,...S.btnSuccess,width:"100%",fontSize:"12px",padding:"9px"}} onClick={()=>buyItem(it)}>SATIN AL</button>
                  </div>
                ))}
                <div style={{gridColumn:"1/-1",paddingTop:"16px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                  <div style={{...S.neon("#fc0"),fontWeight:"800",fontSize:isMobile?"14px":"16px",marginBottom:"12px"}}>🎴 JOKERLER</div>
                </div>
                {Object.values(ITEMS).filter(it=>it.type==="joker").map(it=>(
                  <div key={it.id} style={{...S.glass,padding:isMobile?"12px":"18px",textAlign:"center"}}>
                    <div style={{fontSize:isMobile?"38px":"46px",marginBottom:"6px"}}>{it.icon}</div>
                    <div style={{fontWeight:"800",fontSize:isMobile?"13px":"15px"}}>{it.name}</div>
                    <div style={{color:"#fc0",margin:"6px 0",fontSize:"14px"}}>{it.cost} 🪙</div>
                    <button style={{...S.btn,...S.btnSuccess,width:"100%",fontSize:"12px",padding:"9px"}} onClick={()=>buyItem(it)}>SATIN AL</button>
                  </div>
                ))}
              </>
            ):(
              player!.inventory.length===0?(
                <div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",color:"#555"}}>
                  <div style={{fontSize:"48px",marginBottom:"10px"}}>🎒</div>
                  Çantanız boş!
                </div>
              ):player!.inventory.map((it,i)=>(
                <div key={i} style={{...S.glass,padding:isMobile?"12px":"16px",textAlign:"center"}}>
                  <div style={{fontSize:isMobile?"34px":"40px",marginBottom:"4px"}}>{it.icon}</div>
                  <div style={{fontWeight:"700",fontSize:"13px",marginBottom:"6px"}}>{it.name}</div>
                  {it.type!=="joker"&&<button style={{...S.btn,width:"100%",fontSize:"11px",padding:"8px",marginBottom:"6px"}} onClick={()=>equipItem(it)}>KUŞAN</button>}
                  <button style={{...S.btn,width:"100%",fontSize:"11px",padding:"8px",background:"linear-gradient(135deg,#f7971e,#ffd200)",color:"#000"}} onClick={()=>sellItem(it)}>SAT</button>
                </div>
              ))
            )}
          </div>
          <div style={{height:"20px"}}/>
        </div>
      )}

      {/* ── BÖLGE MODAL ── */}
      {modal&&modal!=="wardrobe"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:100,display:"flex",justifyContent:"center",alignItems:"center"}}>
          <div style={{...S.glass,padding:isMobile?"16px":"36px",width:isMobile?"calc(100vw - 32px)":"640px",maxWidth:"640px",textAlign:"center",border:"2px solid #00eaff",maxHeight:"90vh",overflowY:"auto"}}>
            <h2 style={S.neon("#00eaff")}>{modal.name}</h2>
            <div style={{margin:"24px 0",maxHeight:"400px",overflowY:"auto"}}>
              {modal.levels.map((l,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px",marginBottom:"10px",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"10px",alignItems:"center",background:(player!.regionProgress[modal.id]??0)>=i?"rgba(0,255,100,0.06)":"rgba(0,0,0,0.28)"}}>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontWeight:"800",fontSize:"17px"}}>{l.t}</div>
                    <div style={{fontSize:"12px",color:"#aaa"}}>{l.diff} - {l.hp} HP</div>
                  </div>
                  {(player!.regionProgress?.[modal.id]??0)>=i
                    ? <button style={S.btn} onClick={()=>startBattle(modal,l)}>SAVAŞ</button>
                    : <span>🔒</span>}
                </div>
              ))}
            </div>
            <button style={{...S.btn,...S.btnDanger,width:"100%"}} onClick={()=>setModal(null)}>KAPAT</button>
          </div>
        </div>
      )}

      {/* ── PROFİL EKRANI ── */}
      {screen==="profile"&&(
        <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:isMobile?"10px":"20px"}}>
          <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(10,10,20,0.95)",backdropFilter:"blur(8px)",padding:"10px 0",marginBottom:"12px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <h2 style={{...S.neon("#00eaff"),margin:0,fontSize:isMobile?"18px":"22px"}}>👤 PROFİL</h2>
            <button style={{...S.btn,...S.btnDanger,fontSize:"12px",padding:"8px 12px"}} onClick={()=>setScreen("menu")}>← GERİ</button>
          </div>
          {(()=>{
            // viewProfile kendi adımızsa player!.data, değilse friends'ten bul
            const isOwn = !viewProfile || viewProfile === player!.name;
            const friendData = friends.find(f=>f.name===viewProfile);
            // Başka biri için sadece temel bilgiler var
            const p:Player = isOwn ? player! : {
              name: viewProfile||"",
              pass:"", hp:0, maxHp:0, gold:0, xp:0, maxXp:100,
              lvl: friendData?.lvl||1,
              inventory:[], equipped:{wep:null,arm:null}, jokers:{},
              mistakes:[], score: friendData?.score||0,
              unlockedRegions:[], regionProgress:{},
              unlockedCostumes:[friendData?.costume||"default"],
              currentCostume: friendData?.costume||"default",
              tutorialSeen:true,
              arenaScore: friendData?.arenaScore||0,
            } as Player;
            const lg = getLeague(p.arenaScore||0);
            const stats = getStats(p);
            const badgeList = p.badges||[];
            return (
              <div style={{maxWidth:"600px",margin:"0 auto",display:"flex",flexDirection:"column",gap:"12px"}}>
                {/* Profil kartı */}
                <div style={{...S.glass,padding:isMobile?"16px":"24px",textAlign:"center",border:`2px solid ${lg.color}`,background:lg.bg}}>
                  <div style={{fontSize:isMobile?"64px":"80px",marginBottom:"8px"}}>{COSTUMES[p.currentCostume].i}</div>
                  <div style={{fontSize:isMobile?"22px":"28px",fontWeight:"800",color:"#fff",marginBottom:"4px"}}>{p.name}</div>
                  <div style={{color:lg.color,fontWeight:"700",fontSize:"16px",marginBottom:"8px"}}>{lg.icon} {lg.name} Ligi</div>
                  <div style={{display:"flex",justifyContent:"center",gap:"16px",fontSize:"13px",color:"#aaa",flexWrap:"wrap"}}>
                    <span>⚡ Seviye {p.lvl}</span>
                    <span>⭐ {p.score} Skor</span>
                    <span>💰 {p.gold} Altın</span>
                  </div>
                </div>
                {/* İstatistikler */}
                <div style={{...S.glass,padding:isMobile?"14px":"20px"}}>
                  <div style={{fontWeight:"800",color:"#fc0",fontSize:isMobile?"14px":"16px",marginBottom:"12px"}}>📊 İSTATİSTİKLER</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                    {[
                      {l:"⚔️ Savaş Galibi",v:p.battleWins||0,c:"#0f6"},
                      {l:"💀 Savaş Yeniği",v:p.battleLoses||0,c:"#f05"},
                      {l:"🏟️ Arena Maçı",v:p.arenaGames||0,c:"#00eaff"},
                      {l:"🏆 Arena Puan",v:p.arenaScore||0,c:"#fc0"},
                      {l:"⚔️ Saldırı",v:stats.atk,c:"#f05"},
                      {l:"🛡️ Max Can",v:stats.maxHp,c:"#0f6"},
                      {l:"🎒 Eşya",v:p.inventory.length,c:"#b44fff"},
                      {l:"👗 Kostüm",v:p.unlockedCostumes.length,c:"#fc0"},
                    ].map(({l,v,c})=>(
                      <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"10px 12px",border:`1px solid ${c}22`}}>
                        <div style={{color:"#aaa",fontSize:"11px",marginBottom:"4px"}}>{l}</div>
                        <div style={{color:c,fontWeight:"800",fontSize:"18px"}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Rozetler */}
                <div style={{...S.glass,padding:isMobile?"14px":"20px"}}>
                  <div style={{fontWeight:"800",color:"#fc0",fontSize:isMobile?"14px":"16px",marginBottom:"12px"}}>🏅 ROZETLER ({badgeList.length}/{Object.keys(BADGES).length})</div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(4,1fr)",gap:"10px"}}>
                    {Object.keys(BADGES).map(id=>{
                      const b=BADGES[id];
                      const has=badgeList.includes(id);
                      return(
                        <div key={id} title={b.desc} style={{padding:"10px 8px",borderRadius:"10px",textAlign:"center",background:has?"rgba(255,200,0,0.1)":"rgba(255,255,255,0.03)",border:has?"1px solid rgba(255,200,0,0.4)":"1px solid rgba(255,255,255,0.06)",opacity:has?1:0.4,transition:"all 0.2s"}}>
                          <div style={{fontSize:"24px",filter:has?"":"grayscale(100%)"}}>{b.icon}</div>
                          <div style={{fontSize:"10px",color:has?"#fc0":"#555",marginTop:"4px",fontWeight:"700",lineHeight:1.2}}>{b.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Arkadaşa PvP meydan okuma butonu - kendi profili değilse */}
                {viewProfile&&viewProfile!==player!.name&&(friends.some(f=>f.name===viewProfile))&&(
                  <button style={{...S.btn,...S.btnDanger,width:"100%",padding:"14px",fontSize:"16px"}} onClick={()=>challengeFriend(viewProfile)}>
                    ⚔️ MEYDAN OKU
                  </button>
                )}
              </div>
            );
          })()}
          <div style={{height:"20px"}}/>
        </div>
      )}
      {/* ── SOSYAL EKRANI ── */}
      {screen==="social"&&(
        <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:isMobile?"10px":"20px"}}>
          {/* Sticky başlık */}
          <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(10,10,20,0.95)",backdropFilter:"blur(8px)",paddingBottom:"10px",marginBottom:"12px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <h2 style={{...S.neon("#b44fff"),margin:0,fontSize:isMobile?"18px":"22px"}}>🤝 SOSYAL</h2>
              <button style={{...S.btn,...S.btnDanger,fontSize:"12px",padding:"8px 12px"}} onClick={()=>setScreen("menu")}>← GERİ</button>
            </div>
            <div style={{display:"flex",gap:"6px"}}>
              {([["friends","👥 Arkadaşlar"],["requests","📬 İstekler"],["classroom","🏰 Klan"]] as const).map(([t,l])=>(
                <button key={t} style={{...S.btn,flex:1,fontSize:isMobile?"11px":"12px",padding:isMobile?"8px 4px":"8px 10px",
                  background:socialTab===t?"linear-gradient(135deg,#b44fff,#7b2fff)":"rgba(255,255,255,0.08)",position:"relative"}}
                  onClick={()=>{ setSocialTab(t); if(t==="friends")loadFriends(); if(t==="requests"){loadFriendRequests();loadDuelRequests();} if(t==="classroom"&&player?.classCode)loadClassMembers(player.classCode); }}>
                  {l}
                  {t==="requests"&&friendReqs.length>0&&<span style={{position:"absolute",top:"-4px",right:"-4px",background:"#f05",borderRadius:"50%",width:"16px",height:"16px",fontSize:"10px",display:"flex",alignItems:"center",justifyContent:"center"}}>{friendReqs.length}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ARKADAŞLAR */}
          {socialTab==="friends"&&(
            <div>
              <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
                <input style={{flex:1,padding:"10px 14px",borderRadius:"10px",border:"1px solid rgba(180,79,255,0.4)",background:"rgba(255,255,255,0.06)",color:"white",fontSize:"14px"}}
                  placeholder="Kullanıcı adı..." value={friendInput} onChange={e=>setFriendInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendFriendRequest()}/>
                <button style={{...S.btn,background:"linear-gradient(135deg,#b44fff,#7b2fff)",padding:"10px 16px"}} onClick={sendFriendRequest}>➕</button>
              </div>
              {friends.length===0?(
                <div style={{textAlign:"center",padding:"40px",color:"#555"}}>
                  <div style={{fontSize:"48px",marginBottom:"10px"}}>🤝</div>
                  Henüz arkadaşın yok.<br/>Kullanıcı adı ile arkadaş ekle!
                </div>
              ):friends.map(f=>{
                const lg=getLeague(f.arenaScore);
                return(
                  <div key={f.name} style={{...S.glass,padding:"12px 16px",marginBottom:"8px",display:"flex",alignItems:"center",gap:"12px",border:"1px solid rgba(180,79,255,0.2)"}}>
                    <div style={{fontSize:"32px"}}>{COSTUMES[f.costume]?.i||"🧑"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:"800",fontSize:"14px"}}>{f.name}</div>
                      <div style={{fontSize:"12px",color:"#aaa"}}>{lg.icon} {lg.name} • Lv.{f.lvl} • {f.arenaScore}🏆</div>
                    </div>
                    <div style={{display:"flex",gap:"6px"}}>
                      <button style={{...S.btn,padding:"6px 8px",fontSize:"11px",background:"rgba(0,114,255,0.4)"}}
                        onClick={()=>{setViewProfile(f.name);setScreen("profile");}}>👤</button>
                      <button style={{...S.btn,...S.btnDanger,padding:"6px 8px",fontSize:"11px"}}
                        onClick={()=>sendDuelRequest(f.name)}>⚔️</button>
                      <button style={{...S.btn,background:"rgba(255,255,255,0.1)",padding:"6px 8px",fontSize:"11px"}}
                        onClick={()=>removeFriend(f.name)}>✖</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* İSTEKLER */}
          {socialTab==="requests"&&(
            <div>
              {friendReqs.length===0?(
                <div style={{textAlign:"center",padding:"40px",color:"#555"}}>
                  <div style={{fontSize:"48px",marginBottom:"10px"}}>📬</div>
                  Bekleyen arkadaşlık isteği yok.
                </div>
              ):friendReqs.map(req=>(
                <div key={req.from} style={{...S.glass,padding:"14px 16px",marginBottom:"8px",display:"flex",alignItems:"center",gap:"12px",border:"1px solid rgba(255,200,0,0.3)"}}>
                  <div style={{fontSize:"28px"}}>👤</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"800"}}>{req.from}</div>
                    <div style={{fontSize:"12px",color:"#aaa"}}>arkadaşlık isteği gönderdi</div>
                  </div>
                  <button style={{...S.btn,...S.btnSuccess,padding:"8px 12px",fontSize:"12px"}} onClick={()=>acceptFriendRequest(req)}>✅ Kabul</button>
                  <button style={{...S.btn,...S.btnDanger,padding:"8px 10px",fontSize:"12px"}}
                    onClick={async()=>{ await set(ref(db,"friendRequests/"+player!.name+"/"+req.from+"_"+player!.name),null); loadFriendRequests(); }}>✖</button>
                </div>
              ))}
            </div>
          )}

          {/* SINIF */}
          {socialTab==="classroom"&&(
            <div>
              {!player?.classCode?(
                <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
                  <div style={{...S.glass,padding:"18px",border:"1px solid rgba(255,200,0,0.3)"}}>
                    <div style={{fontWeight:"800",color:"#fc0",marginBottom:"10px",fontSize:"15px"}}>🏰 Klan Oluştur</div>
                    <input style={{width:"100%",padding:"10px",marginBottom:"8px",borderRadius:"8px",border:"1px solid #444",background:"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box"}}
                      placeholder="Klan Adı..." value={clanNameInput} onChange={e=>setClanNameInput(e.target.value)}/>
                    <input style={{width:"100%",padding:"10px",marginBottom:"10px",borderRadius:"8px",border:"1px solid #444",background:"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box",letterSpacing:"3px",fontWeight:"800",fontSize:"16px",textTransform:"uppercase"}}
                      placeholder="ETIKET (maks 5 harf)" value={clanTagInput} maxLength={5}
                      onChange={e=>setClanTagInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))}/>
                    <button style={{...S.btn,...S.btnGold,width:"100%"}} onClick={createClan}>🏰 KLAN OLUŞTUR</button>
                  </div>
                  <div style={{...S.glass,padding:"18px",border:"1px solid rgba(180,79,255,0.3)"}}>
                    <div style={{fontWeight:"800",color:"#b44fff",marginBottom:"10px",fontSize:"15px"}}>🔑 Klana Katıl</div>
                    <div style={{display:"flex",gap:"8px"}}>
                      <input style={{flex:1,padding:"10px",borderRadius:"8px",border:"1px solid #444",background:"rgba(255,255,255,0.06)",color:"white",letterSpacing:"3px",fontWeight:"800",fontSize:"16px"}}
                        placeholder="KLAN ETİKETİ..." value={classInput} onChange={e=>setClassInput(e.target.value.toUpperCase())} maxLength={5}/>
                      <button style={{...S.btn,background:"linear-gradient(135deg,#b44fff,#7b2fff)"}} onClick={joinClan}>KATIL</button>
                    </div>
                  </div>
                </div>
              ):(
                <div>
                  {clan&&(
                    <>
                      {/* Klan başlık */}
                      <div style={{...S.glass,padding:"16px",marginBottom:"12px",border:"1px solid rgba(255,200,0,0.4)",textAlign:"center",background:"rgba(255,200,0,0.05)"}}>
                        <div style={{fontSize:"36px",marginBottom:"4px"}}>🏰</div>
                        <div style={{fontWeight:"800",fontSize:"18px",color:"#fc0"}}>{clan.name}</div>
                        <div style={{color:"#aaa",fontSize:"13px",marginTop:"2px"}}>#{clan.tag} • {Object.keys(clan.members).length} üye</div>
                        <div style={{color:"#555",fontSize:"11px",marginTop:"2px"}}>Lider: {clan.leader}</div>
                        <div style={{marginTop:"8px",color:"#fc0",fontWeight:"800",fontSize:"14px"}}>
                          Toplam: {clanMembers.reduce((s,m)=>s+(m.arenaScore||0),0)} 🏆
                        </div>
                      </div>
                      {/* Üye listesi */}
                      <div style={{fontWeight:"800",color:"#fc0",marginBottom:"8px",fontSize:"14px"}}>👥 Üyeler ({clanMembers.length})</div>
                      {clanMembers.map((m,i)=>{
                        const lg=getLeague(m.arenaScore);
                        const isMe=m.name===player!.name;
                        const myRole=clan.members[player!.name]?.role;
                        const canManage=(myRole==="leader"||myRole==="officer")&&m.name!==player!.name&&m.role!=="leader";
                        return(
                          <div key={m.name} style={{...S.glass,padding:"10px 12px",marginBottom:"6px",border:isMe?"1px solid #0072ff":"1px solid rgba(255,255,255,0.06)"}}>
                            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                              <span style={{fontSize:"16px"}}>{i===0?"👑":i===1?"🥈":i===2?"🥉":`${i+1}.`}</span>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:"800",fontSize:"13px"}}>{m.name}{isMe?" (Sen)":""}</div>
                                <div style={{fontSize:"10px",color:lg.color}}>{lg.icon} {lg.name} • {m.role==="leader"?"👑 Lider":m.role==="officer"?"⭐ Subay":"👤 Üye"}</div>
                              </div>
                              <span style={{color:"#fc0",fontWeight:"800",fontSize:"13px"}}>{m.arenaScore}🏆</span>
                              {canManage&&(
                                <div style={{display:"flex",gap:"4px"}}>
                                  <button style={{...S.btn,padding:"4px 7px",fontSize:"10px",background:m.role==="officer"?"rgba(255,0,80,0.4)":"rgba(0,198,255,0.4)"}}
                                    onClick={()=>updateMemberRole(m.name,m.role==="officer"?"member":"officer")}>
                                    {m.role==="officer"?"⬇️":"⭐"}
                                  </button>
                                  <button style={{...S.btn,...S.btnDanger,padding:"4px 7px",fontSize:"10px"}}
                                    onClick={()=>kickFromClan(m.name)}>✖</button>
                                </div>
                              )}
                              {!isMe&&(
                                <button style={{...S.btn,padding:"4px 7px",fontSize:"10px",background:"rgba(255,0,80,0.3)"}}
                                  onClick={()=>sendDuelRequest(m.name)}>⚔️</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <button style={{...S.btn,...S.btnDanger,width:"100%",marginTop:"12px",fontSize:"12px"}} onClick={leaveClan}>Klandan Ayrıl</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <div style={{height:"20px"}}/>
        </div>
      )}
      {/* ── DOLAP MODAL ── */}
      {modal==="wardrobe"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:100,display:"flex",justifyContent:"center",alignItems:"center"}}>
          <div style={{...S.glass,padding:"32px",width:"700px",height:"600px",textAlign:"center"}}>
            <h2 style={S.neon("#fc0")}>DOLAP</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"18px",margin:"22px 0",overflowY:"auto",height:"420px"}}>
              {Object.keys(COSTUMES).map(k=>(
                <div key={k} style={{border:`2px solid ${player!.currentCostume===k?"#0f6":"#444"}`,padding:"18px",borderRadius:"12px",background:player!.currentCostume===k?"rgba(0,255,100,0.06)":"transparent"}}>
                  <div style={{fontSize:"56px"}}>{COSTUMES[k].i}</div>
                  <div style={{fontWeight:"800",marginTop:"8px"}}>{COSTUMES[k].n}</div>
                  {player!.unlockedCostumes.includes(k)
                    ? <button style={{...S.btn,marginTop:"10px",width:"100%",background:player!.currentCostume===k?"#0f6":"#0072ff"}} onClick={()=>{save({...player!,currentCostume:k});setModal(null);}}>GİY</button>
                    : <div style={{color:"#f05",marginTop:"10px",fontWeight:"800"}}>KİLİTLİ</div>}
                </div>
              ))}
            </div>
            <button style={{...S.btn,...S.btnDanger,width:"100%"}} onClick={()=>setModal(null)}>KAPAT</button>
          </div>
        </div>
      )}
    </div>
  );
}