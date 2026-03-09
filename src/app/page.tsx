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
};
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
const QUESTIONS:Q[] = [
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
const shuffle = <T,>(a:T[]) => a.slice().sort(()=>Math.random()-0.5);
const isAdmin = (name:string) => ["ADMIN","ADMIN2","ADMIN3"].includes(name);

// ─── BILEŞEN ────────────────────────────────────────────────────────────────
export default function Game() {
  const [screen,    setScreen]    = useState<"auth"|"menu"|"battle"|"map"|"shop"|"inv"|"arena">("auth");
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
  const [leaderboard, setLeaderboard] = useState<{name:string;score:number;lvl:number}[]>([]);

  // Arena state - temiz ve bağımsız
  const [arenaScreen, setArenaScreen] = useState<"menu"|"rules"|"searching"|"battle">("menu");
  const [searchTime,  setSearchTime]  = useState(50);
  const [pvp,         setPvp]         = useState<PvPState>({ matchId:null, matchData:null, side:null });

  const confettiRef = useRef<HTMLCanvasElement|null>(null);
  const pvpRef      = useRef(pvp); // closure sorununu önlemek için ref
  useEffect(() => { pvpRef.current = pvp; }, [pvp]);

  // ── Yardımcılar ──────────────────────────────────────────────────────────
  const notify = (m:string) => { setNotif(m); setTimeout(()=>setNotif(null),3000); };
  const playSound = (t:"click"|"win"|"correct"|"wrong") => {
    if (typeof window==="undefined") return;
    const urls:Record<string,string> = {
      click:   "https://cdn.pixabay.com/audio/2022/03/24/audio_78c2cb5739.mp3",
      win:     "https://cdn.pixabay.com/audio/2021/08/09/audio_88447e769f.mp3",
      correct: "https://cdn.pixabay.com/audio/2022/01/18/audio_8db1a2afce.mp3",
      wrong:   "https://cdn.pixabay.com/audio/2021/10/28/audio_d432e8b819.mp3",
    };
    try { new Audio(urls[t]).play().catch(()=>{}); } catch(e){}
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
    if(!isAdmin(p.name)) { try { localStorage.setItem(SAVE_KEY+p.name,JSON.stringify(p)); } catch(e){} }
    update(ref(db,"users/"+p.name),{score:p.score,lvl:p.lvl,name:p.name}).catch(()=>{});
    setPlayer({...p});
    loadLeaderboard();
  };
  const loadLeaderboard = async () => {
    try {
      const snap = await get(ref(db,"users"));
      if(snap.exists()) {
        const u = snap.val();
        setLeaderboard(Object.keys(u).map(k=>({name:k,score:u[k].score||0,lvl:u[k].lvl||1})).sort((a,b)=>b.score-a.score).slice(0,10));
      }
    } catch(e){}
  };

  useEffect(() => { setMounted(true); loadLeaderboard(); }, []);

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
    let pool=QUESTIONS.slice();
    if(r.type!=="all") pool=QUESTIONS.filter(q=>q.topic===r.type||q.topic==="genel");
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
            if(np.hp<=0){np.hp=pStats.maxHp;save(np);notify("YENİLDİN...");setBattle({active:false,enemyHp:0,maxEnemyHp:0,qs:[],qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});setScreen("menu");return;}
          } else {
            nb.log=`✅ DOĞRU! ${dmg} Hasar! | 🤖 Bot Iskaladı`;
          }
        }
      } else {
        // Oyuncu yanlış yaptı - kendine hasar
        const np={...player!}; np.hp=Math.max(0,np.hp-20); setPlayer(np);
        nb.log=`❌ YANLIŞ! -20 Can`; nb.combo=0;
        if(np.hp<=0){np.hp=pStats.maxHp;save(np);notify("YENİLDİN...");setBattle({active:false,enemyHp:0,maxEnemyHp:0,qs:[],qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});setScreen("menu");return;}
        // Bot sırası - yanlış yapınca da bot cevaplar
        if(botMatch) {
          const botCorrect=Math.random()>0.4;
          if(botCorrect){
            nb.enemyHp=Math.max(0,nb.enemyHp-botDmg);
            nb.log=`❌ YANLIŞ! -20 Can | 🤖 Bot Doğru: -${botDmg} Düşman Can`;
            if(nb.enemyHp<=0){playSound("win");notify("🏆 ZAFER!");launchConfetti();const np2={...player!};np2.gold+=100;np2.xp+=30;np2.score+=50;np2.hp=pStats.maxHp;save(np2);setScreen("menu");return;}
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
  const findMatch = async () => {
    if(!player) return notify("Önce giriş yapmalısın!");
    try {
      const qs  = shuffle(QUESTIONS).slice(0,30);
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
      setSearchTime(50);
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
    setSearchTime(50);
  };

  // ── 50 sn sayacı + açık maç arama ──────────────────────────────────────
  useEffect(()=>{
    if(arenaScreen!=="searching" || !player) return;
    setSearchTime(50);

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
    const upd:any={};
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
    const newHostHp = upd["state/hostHp"] ?? cur.state.hostHp;
    const newGuestHp= upd["state/guestHp"] ?? cur.state.guestHp;
    if(newHostHp<=0||newGuestHp<=0){
      const winner=newGuestHp<=0?cur.players.host:cur.players.guest;
      if(winner===player.name){notify("🏆 TEBRİKLER! KAZANDIN!");launchConfetti();save({...player,gold:player.gold+500,score:player.score+200});}
      else notify("😔 Mağlup oldun...");
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
    setBattle({
      active:true,
      region:{id:"arena",name:"ARENA",x:0,y:0,type:"all",bg:ARENA_BG,unlockC:"king",levels:[]},
      level:{id:"pvp-bot",t:"Bot Arena",hp:stats.maxHp,en:"🤖 Bot",ico:"🤖",diff:"Arena"},
      enemyHp:stats.maxHp, maxEnemyHp:stats.maxHp,
      qs:shuffle(QUESTIONS).slice(0,25), qIdx:0, timer:20, combo:0,
      log:"🤖 Bot ile savaş başlıyor!", wait:false, dmgText:null, shaking:false,
    });
    setScreen("battle");
  };

  // ── Maçtan ayrıl ────────────────────────────────────────────────────────
  const leaveMatch = async () => {
    await cleanupPvP(pvp.matchId, true);
    setPvp({matchId:null,matchData:null,side:null});
    setBattle({active:false,enemyHp:0,maxEnemyHp:0,qs:[],qIdx:0,timer:20,combo:0,log:null,wait:false,dmgText:null,shaking:false});
    setArenaScreen("menu"); setScreen("arena");
    notify("Maçtan ayrıldın.");
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  const globalStyles=`
    @keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}
    @keyframes float{0%{transform:translateX(-50%) translateY(0);opacity:1}100%{transform:translateX(-50%) translateY(-60px);opacity:0}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes popIn{0%{transform:scale(0.7);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
    @keyframes shakeX{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
    @keyframes glowGreen{0%,100%{box-shadow:0 0 10px #0f6}50%{box-shadow:0 0 30px #0f6,0 0 60px #0f6}}
    @keyframes glowRed{0%,100%{box-shadow:0 0 10px #f05}50%{box-shadow:0 0 30px #f05,0 0 60px #f05}}
    .floating-dmg{position:absolute;left:50%;font-size:72px;font-weight:800;text-shadow:0 0 30px black;animation:float 1.2s forwards;pointer-events:none}
    .ans-reveal-correct{animation:glowGreen 0.6s ease infinite,popIn 0.3s ease!important}
    .ans-reveal-wrong{animation:glowRed 0.4s ease,shakeX 0.4s ease!important}
  `;

  if(!mounted) return <div style={{height:"100vh",background:"#000"}}/>;

  // ── AUTH ekranı ──────────────────────────────────────────────────────────
  if(screen==="auth") return (
    <div style={{height:"100vh",background:"#000",display:"flex",justifyContent:"center",alignItems:"center",fontFamily:"sans-serif"}}>
      <style>{globalStyles}</style>
      <div style={{...S.glass,padding:"40px",width:"420px",textAlign:"center"}}>
        <h1 style={{...S.neon("#00eaff"),fontSize:"44px",marginBottom:"20px"}}>EDEBİYAT<br/>EFSANELERİ</h1>
        <input style={{width:"100%",padding:"12px",marginBottom:"12px",borderRadius:"10px",border:"none",background:"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box"}} placeholder="Kullanıcı Adı" value={auth.user} onChange={e=>setAuth({...auth,user:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
        <input type="password" style={{width:"100%",padding:"12px",marginBottom:"18px",borderRadius:"10px",border:"none",background:"rgba(255,255,255,0.06)",color:"white",boxSizing:"border-box"}} placeholder="Şifre" value={auth.pass} onChange={e=>setAuth({...auth,pass:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
        <button style={{...S.btn,...S.btnSuccess,width:"100%",fontSize:"16px"}} onClick={handleAuth}>{auth.reg?"KAYIT OL":"GİRİŞ YAP"}</button>
        <p style={{marginTop:"16px",cursor:"pointer",color:"#aaa"}} onClick={()=>setAuth({...auth,reg:!auth.reg})}>{auth.reg?"Giriş Yap":"Kayıt Ol"}</p>
        {notif&&<div style={{color:"#f05",marginTop:"12px",fontWeight:"bold"}}>{notif}</div>}
      </div>
    </div>
  );

  return (
    <div style={{height:"100vh",background:"radial-gradient(circle at center,#1a1a2e,#000)",color:"white",fontFamily:"Segoe UI,sans-serif",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <style>{globalStyles}</style>
      <canvas ref={confettiRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999}}/>

      {/* ── HEADER ── */}
      {screen!=="battle"&&screen!=="arena"&&(
        <div style={{...S.glass,margin:"15px",padding:"15px 25px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:"18px",fontSize:"18px",fontWeight:"700",alignItems:"center"}}>
            <span style={{fontSize:"24px"}}>{COSTUMES[player!.currentCostume].i}</span>
            <span style={S.neon("#fc0")}>⚡ {player?.lvl}</span>
            <span style={S.neon("#0f6")}>❤️ {player?.hp}</span>
            <span style={S.neon("#00eaff")}>💰 {player?.gold}</span>
          </div>
          <button style={{...S.btn,...S.btnDanger,padding:"10px 18px",fontSize:14}} onClick={()=>setScreen("auth")}>ÇIKIŞ</button>
        </div>
      )}

      {notif&&<div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",background:"#0f6",padding:"12px 22px",borderRadius:"12px",color:"#000",zIndex:999,fontWeight:"700",boxShadow:"0 0 20px #0f6"}}>{notif}</div>}

      {/* ── MENU ── */}
      {screen==="menu"&&(
        <div style={{flex:1,display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:"28px",padding:"20px"}}>
          <div style={{...S.glass,padding:"36px",textAlign:"center",width:"380px",height:"500px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{fontSize:"96px",cursor:"pointer",animation:"pulse 2s infinite"}} onClick={()=>setModal("wardrobe")}>{COSTUMES[player!.currentCostume].i}</div>
            <h2 style={{...S.neon("#fff"),fontSize:"30px",margin:"8px 0"}}>{player?.name}</h2>
            <div style={{color:"#aaa",marginBottom:"18px"}}>{COSTUMES[player!.currentCostume].n}</div>
            <div style={{background:"rgba(255,255,255,0.03)",padding:"12px",borderRadius:"12px",textAlign:"left"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span>⚔️ Saldırı</span><span style={{color:"#f05",fontWeight:"700"}}>{getStats(player!).atk}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span>🛡️ Can</span><span style={{color:"#0f6",fontWeight:"700"}}>{getStats(player!).maxHp}</span></div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",width:"620px"}}>
            {[{id:"map",t:"MACERA",i:"🗺️",c:"#fc0"},{id:"arena",t:"ARENA",i:"⚔️",c:"#f05"},{id:"shop",t:"MARKET",i:"🛒",c:"#0f6"},{id:"inv",t:"ÇANTA",i:"🎒",c:"#00eaff"}].map(m=>(
              <div key={m.id} onClick={()=>{playSound("click");if(m.id==="arena")goToArena();else setScreen(m.id as any);}}
                style={{...S.glass,height:"210px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",border:`1px solid ${m.c}`,background:"rgba(20,20,30,0.84)"}}>
                <div style={{fontSize:"64px",marginBottom:"14px"}}>{m.i}</div>
                <div style={{...S.neon(m.c),fontSize:"20px",fontWeight:"800"}}>{m.t}</div>
              </div>
            ))}
          </div>
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
                  <p style={{margin:"6px 0",color:"#ccc"}}>• 50 saniye içinde rakip bulunamazsa bot ile eşleşirsin</p>
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
              <div style={{display:"flex",gap:"24px",alignItems:"flex-start",flexWrap:"wrap",justifyContent:"center",width:"100%",maxWidth:"900px"}}>

                {/* Sol: Sıralama */}
                <div style={{...S.glass,padding:"24px",width:"320px",minWidth:"280px"}}>
                  <h2 style={{...S.neon("#fc0"),margin:"0 0 16px",textAlign:"center"}}>🏆 SIRALAMA</h2>
                  {leaderboard.length>0 ? (
                    <div>
                      {leaderboard.map((u,i)=>(
                        <div key={u.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",marginBottom:"6px",borderRadius:"8px",background:u.name===player?.name?"rgba(0,114,255,0.2)":i<3?"rgba(255,215,0,0.08)":"rgba(255,255,255,0.04)",border:u.name===player?.name?"1px solid #0072ff":"1px solid transparent"}}>
                          <span style={{fontSize:"13px"}}>{i===0?"👑":i===1?"🥈":i===2?"🥉":"  "} {i+1}. {u.name}</span>
                          <span style={{color:"#fc0",fontWeight:"700",fontSize:"13px"}}>{u.score}</span>
                        </div>
                      ))}
                    </div>
                  ):(
                    <div style={{textAlign:"center",color:"#aaa",padding:"20px"}}>Yükleniyor...</div>
                  )}
                  <button style={{...S.btn,width:"100%",marginTop:"12px",padding:"10px",fontSize:"12px",background:"rgba(255,255,255,0.08)"}} onClick={loadLeaderboard}>🔄 YENİLE</button>
                </div>

                {/* Sağ: Butonlar */}
                <div style={{...S.glass,padding:"32px",width:"360px",minWidth:"300px",display:"flex",flexDirection:"column",gap:"14px",alignItems:"stretch"}}>
                  <h2 style={{...S.neon("#f05"),margin:"0 0 8px",textAlign:"center",fontSize:"26px"}}>⚔️ ARENA</h2>
                  <p style={{color:"#aaa",textAlign:"center",margin:"0 0 12px",fontSize:"14px",lineHeight:"1.6"}}>
                    Gerçek oyunculara karşı savaş!<br/>
                    50 sn'de rakip bulunamazsa bot ile eşleş.
                  </p>

                  <button
                    style={{...S.btn,...S.btnDanger,padding:"18px",fontSize:"18px",width:"100%"}}
                    onClick={findMatch}
                  >
                    🎮 EŞLEŞTİRME BUL
                  </button>

                  <button
                    style={{...S.btn,padding:"14px",fontSize:"15px",width:"100%",background:"rgba(255,255,255,0.08)"}}
                    onClick={()=>setArenaScreen("rules")}
                  >
                    📜 KURALLARI GÖR
                  </button>

                  <button
                    style={{...S.btn,...S.btnSuccess,padding:"12px",fontSize:"14px",width:"100%"}}
                    onClick={()=>setScreen("menu")}
                  >
                    ← ANA MENÜYE DÖN
                  </button>
                </div>

              </div>
            )}

            {/* ── RAKİP ARANYOR ── */}
            {arenaScreen==="searching"&&(
              <div style={{...S.glass,padding:"48px",width:"420px",textAlign:"center"}}>
                <div style={{fontSize:"72px",marginBottom:"16px",animation:"spin 2s linear infinite",display:"inline-block"}}>⚔️</div>
                <h2 style={{...S.neon("#f05"),fontSize:"26px",marginBottom:"12px"}}>RAKİP ARANIYOR</h2>
                <div style={{fontSize:"56px",fontWeight:"800",color:"#00eaff",marginBottom:"8px"}}>{searchTime}s</div>
                <div style={{...S.bar,marginBottom:"24px"}}>
                  <div style={{width:`${(searchTime/50)*100}%`,height:"100%",background:"linear-gradient(90deg,#f05,#00eaff)",transition:"width 1s linear"}}/>
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
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-around",position:"relative"}}>
            {battle.dmgText&&<div className="floating-dmg" style={{top:"38%",color:battle.dmgText.c}}>{battle.dmgText.val}</div>}

            {/* Düşman */}
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"120px",filter:"drop-shadow(0 0 30px #f05)"}}>{battle.level?.ico}</div>
              <div style={{...S.glass,padding:"10px 20px",marginTop:"10px",display:"inline-block"}}>
                <div style={{fontWeight:"800",fontSize:"20px"}}>{battle.level?.en}</div>
                <div style={S.bar}><div style={{width:`${Math.max(0,(battle.enemyHp/battle.maxEnemyHp)*100)}%`,height:"100%",background:"linear-gradient(90deg,#f05,#ff8)"}}/></div>
                <div style={{fontSize:"12px",color:"#aaa",marginTop:"4px"}}>{Math.max(0,battle.enemyHp)} / {battle.maxEnemyHp}</div>
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
              <div style={{fontSize:"120px",filter:"drop-shadow(0 0 30px #00eaff)"}}>{COSTUMES[player!.currentCostume].i}</div>
              <div style={{...S.glass,padding:"10px 20px",marginTop:"10px",display:"inline-block"}}>
                <div style={{fontWeight:"800",fontSize:"20px"}}>{player?.name}</div>
                <div style={S.bar}><div style={{width:`${(player!.hp/getStats(player!).maxHp)*100}%`,height:"100%",background:"linear-gradient(90deg,#0f6,#00eaff)"}}/></div>
                <div style={{fontSize:"12px",color:"#aaa",marginTop:"4px"}}>{player?.hp} / {getStats(player!).maxHp}</div>
              </div>
            </div>
          </div>

          {/* Soru kutusu */}
          <div style={{...S.glass,margin:"22px",padding:"22px",border:"1px solid #00eaff",minHeight:"260px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
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
                    const disabled=myAns!==-1||pvp.matchData!.state.resolving;
                    return(
                      <button key={i} style={{...S.btn,padding:"14px",fontSize:15,width:"100%",textTransform:"none",opacity:disabled?0.45:1,cursor:disabled?"not-allowed":"pointer"}}
                        onClick={()=>pvpAnswer(i)} disabled={disabled}>{o}</button>
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
                <div style={{textAlign:"center",marginBottom:"18px",fontSize:"22px",fontWeight:"800",color:"#fff"}}>
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
                        style={{...S.btn,padding:"14px",fontSize:15,width:"100%",textTransform:"none",
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
                      onClick={()=>useJoker(k as any)} disabled={player!.jokers[k]===0}>
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
        <div style={{flex:1,padding:"22px",overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"26px",alignItems:"center"}}>
            <h1 style={S.neon("#00eaff")}>{screen==="shop"?"MARKET":"ÇANTA"}</h1>
            <button style={{...S.btn,...S.btnDanger}} onClick={()=>setScreen("menu")}>GERİ</button>
          </div>
          {screen==="inv"&&(
            <div style={{...S.glass,padding:"18px",marginBottom:"20px"}}>
              <h2 style={S.neon("#fc0")}>🎽 KUŞANILANLAR</h2>
              <div style={{display:"flex",gap:"14px",marginTop:"14px",flexWrap:"wrap"}}>
                {(["wep","arm"] as const).map(slot=>(
                  <div key={slot} style={{...S.glass,padding:"14px",width:"200px",textAlign:"center"}}>
                    <div style={{fontWeight:"800",marginBottom:"8px"}}>{slot==="wep"?"⚔️ Silah":"🛡️ Zırh"}</div>
                    {player?.equipped[slot]?(
                      <>
                        <div style={{fontSize:"40px"}}>{player.equipped[slot]!.icon}</div>
                        <div>{player.equipped[slot]!.name}</div>
                        <button style={{...S.btn,marginTop:"10px",width:"100%",background:"#f05"}}
                          onClick={()=>{const np={...player!};np.inventory.push(np.equipped[slot]!);np.equipped[slot]=null;save(np);notify("Çıkarıldı!");}}>ÇIKAR</button>
                      </>
                    ):<div style={{color:"#aaa"}}>Boş</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"18px"}}>
            {screen==="shop"?(
              <>
                {Object.values(ITEMS).filter(it=>it.type!=="joker").map(it=>(
                  <div key={it.id} style={{...S.glass,padding:"18px",textAlign:"center"}}>
                    <div style={{fontSize:"46px",marginBottom:"8px"}}>{it.icon}</div>
                    <div style={{fontWeight:"800",fontSize:"16px"}}>{it.name}</div>
                    <div style={{color:"#fc0",margin:"8px 0"}}>{it.cost} G</div>
                    <button style={{...S.btn,...S.btnSuccess,width:"100%"}} onClick={()=>buyItem(it)}>SATIN AL</button>
                  </div>
                ))}
                <div style={{gridColumn:"1 / -1",marginTop:"30px"}}><h2 style={S.neon("#fc0")}>🎴 JOKERLER</h2></div>
                {Object.values(ITEMS).filter(it=>it.type==="joker").map(it=>(
                  <div key={it.id} style={{...S.glass,padding:"18px",textAlign:"center"}}>
                    <div style={{fontSize:"46px",marginBottom:"8px"}}>{it.icon}</div>
                    <div style={{fontWeight:"800",fontSize:"16px"}}>{it.name}</div>
                    <div style={{color:"#fc0",margin:"8px 0"}}>{it.cost} G</div>
                    <button style={{...S.btn,...S.btnSuccess,width:"100%"}} onClick={()=>buyItem(it)}>SATIN AL</button>
                  </div>
                ))}
              </>
            ):(
              player!.inventory.map((it,i)=>(
                <div key={i} style={{...S.glass,padding:"16px",textAlign:"center"}}>
                  <div style={{fontSize:"40px"}}>{it.icon}</div>
                  <div style={{fontWeight:700}}>{it.name}</div>
                  {it.type!=="joker"&&<button style={{...S.btn,marginTop:"10px",width:"100%"}} onClick={()=>equipItem(it)}>KUŞAN</button>}
                  <button style={{...S.btn,marginTop:"8px",width:"100%",background:"#fc0",color:"black"}} onClick={()=>sellItem(it)}>SAT</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── BÖLGE MODAL ── */}
      {modal&&modal!=="wardrobe"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:100,display:"flex",justifyContent:"center",alignItems:"center"}}>
          <div style={{...S.glass,padding:"36px",width:"640px",textAlign:"center",border:"2px solid #00eaff"}}>
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