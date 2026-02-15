"use client";

import React, { useEffect, useRef, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getDatabase,
  ref,
  update,
  set,
  push,
  onValue,
  off,
  get,
} from "firebase/database";

// --- FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyD-Your-Key-Here",
  authDomain: "edebiyat-efsaneleri.firebaseapp.com",
  databaseURL:
    "https://edebiyat-efsaneleri-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "edebiyat-efsaneleri",
  storageBucket: "edebiyat-efsaneleri.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);
const SAVE_KEY = "edb_v47_ultra_fix";

// --- TİPLER ---
type Item = {
  id: string;
  name: string;
  type: "wep" | "arm" | "acc" | "joker";
  val: number;
  cost: number;
  icon: string;
  jokerId?: string;
  uid?: number;
};
type Region = {
  id: string;
  name: string;
  x: number;
  y: number;
  type: string;
  bg: string;
  unlockC: string;
  levels: Level[];
};
type Level = {
  id: string;
  t: string;
  hp: number;
  en: string;
  ico: string;
  diff: string;
  isBoss?: boolean;
};
type Player = {
  name: string;
  pass: string;
  hp: number;
  maxHp: number;
  gold: number;
  xp: number;
  maxXp: number;
  lvl: number;
  inventory: Item[];
  equipped: { wep: Item | null; arm: Item | null };
  jokers: { [k: string]: number };
  mistakes: string[];
  score: number;
  unlockedRegions: string[];
  regionProgress: { [k: string]: number };
  unlockedCostumes: string[];
  currentCostume: string;
  tutorialSeen: boolean;
  arenaRulesSeen?: boolean;
};

type BattleState = {
  active: boolean;
  region?: Region;
  level?: Level;
  enemyHp: number;
  maxEnemyHp: number;
  qs: Q[];
  qIdx: number;
  timer: number;
  combo: number;
  log: string | null;
  wait: boolean;
  dmgText: { val: number; c: string } | null;
  shaking: boolean;
};

type ModalState = Region | "wardrobe" | null;

type PvPState = {
  searching: boolean;
  matchId: string | null;
  matchData: {
    id: string;
    players: { host: string; guest: string | null };
    state: {
      hostHp: number;
      guestHp: number;
      turn: "host" | "guest";
      qIdx: number;
      qs: Q[];
      started: boolean;
      lastAnswer?: {
        player: string;
        correct: boolean;
        timestamp: number;
      } | null;
      turnStartTime?: number;
      log?: string | null;
    };
    createdAt: number;
  } | null;
  isHost: boolean;
  side: "host" | "guest" | null;
  searchStartTime?: number;
};

type ArenaView = "menu" | "rules" | "search";

// --- İÇERİK ---
const ITEMS: { [k: string]: Item } = {
  w1: { id: "w1", name: "Paslı Kalem", type: "wep", val: 20, cost: 50, icon: "✏️" },
  w2: { id: "w2", name: "Dolma Kalem", type: "wep", val: 45, cost: 250, icon: "✒️" },
  w3: { id: "w3", name: "Efsanevi Asa", type: "wep", val: 120, cost: 1500, icon: "🪄" },
  a1: { id: "a1", name: "Eski Defter", type: "arm", val: 50, cost: 50, icon: "📓" },
  a2: { id: "a2", name: "Ansiklopedi", type: "arm", val: 250, cost: 500, icon: "📚" },
  a3: { id: "a3", name: "Çelik Zırh", type: "arm", val: 600, cost: 2000, icon: "🛡️" },
  j1: { id: "j1", name: "Can İksiri", type: "joker", val: 0, cost: 100, icon: "🧪", jokerId: "heal" },
  j2: { id: "j2", name: "%50 Şans", type: "joker", val: 0, cost: 100, icon: "½", jokerId: "5050" },
  j3: { id: "j3", name: "Pas Geç", type: "joker", val: 0, cost: 150, icon: "⏩", jokerId: "skip" },
};
const COSTUMES: { [k: string]: { n: string; i: string } } = {
  default: { n: "Öğrenci", i: "🧑‍🎓" },
  prince: { n: "Prens", i: "🤴" },
  divan: { n: "Divan Şairi", i: "👳" },
  halk: { n: "Ozan", i: "🎸" },
  king: { n: "Kral", i: "👑" },
};
const REGIONS: Region[] = [
  {
    id: "tut",
    name: "Başlangıç",
    x: 20,
    y: 80,
    type: "iletisim",
    bg: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1000",
    unlockC: "default",
    levels: [
      { id: "l1", t: "Tanışma", hp: 50, en: "Çırak", ico: "👶", diff: "Kolay" },
      { id: "l2", t: "Söz Savaşı", hp: 80, en: "Kalfa", ico: "👦", diff: "Orta", isBoss: true },
    ],
  },
  {
    id: "r1",
    name: "İletişim Vadisi",
    x: 40,
    y: 60,
    type: "iletisim",
    bg: "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1000",
    unlockC: "prince",
    levels: [
      { id: "l3", t: "Kodlar", hp: 150, en: "Hatip", ico: "🗣️", diff: "Orta" },
      { id: "b1", t: "Büyük İletişimci", hp: 300, en: "Uzman", ico: "📡", diff: "Zor", isBoss: true },
    ],
  },
  {
    id: "r2",
    name: "Hikaye Ormanı",
    x: 60,
    y: 40,
    type: "hikaye",
    bg: "https://images.unsplash.com/photo-1448375240586-dfd8d395ea6c?w=1000",
    unlockC: "halk",
    levels: [
      { id: "l4", t: "Olay Örgüsü", hp: 250, en: "Yazar", ico: "📝", diff: "Zor" },
      { id: "b2", t: "Dede Korkut", hp: 500, en: "Bilge", ico: "👴", diff: "Boss", isBoss: true },
    ],
  },
  {
    id: "r3",
    name: "Arena",
    x: 80,
    y: 20,
    type: "all",
    bg: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1000",
    unlockC: "king",
    levels: [{ id: "b4", t: "SON SAVAŞ", hp: 1200, en: "Cehalet", ico: "🐲", diff: "Final", isBoss: true }],
  },
];

type Q = { q: string; o: string[]; a: number; topic: string };
const QUESTIONS: Q[] = [
  { q: "İletişimi başlatan öğe?", o: ["Alıcı", "Kanal", "Gönderici", "Dönüt"], a: 2, topic: "iletisim" },
  { q: "Sözlü iletişim türü?", o: ["Mektup", "Panel", "Dilekçe", "Roman"], a: 1, topic: "iletisim" },
  { q: "Kitle iletişim aracı örneği?", o: ["Radyo", "Mektup", "Günlük", "Roman"], a: 0, topic: "iletisim" },
  { q: "İletişimde geri bildirime ne denir?", o: ["Dönüt", "Kanal", "Gönderi", "Alıcı"], a: 0, topic: "iletisim" },
  { q: "İletişim modelinde kanal ne işe yarar?", o: ["Mesajı taşıma", "Alıcıyı seçme", "Şifreleme", "Yazma"], a: 0, topic: "iletisim" },
  { q: "Olay hikâyesi temsilcisi kimdir?", o: ["Sait Faik", "Ömer Seyfettin", "Memduh Şevket", "Nurullah Ataç"], a: 1, topic: "hikaye" },
  { q: "İlk yerli roman hangisidir?", o: ["Taaşşuk-ı Talat", "İntibah", "Eylül", "Cezmi"], a: 0, topic: "hikaye" },
  { q: "Çalıkuşu romanının yazarı?", o: ["Reşat Nuri", "Halide Edip", "Yakup Kadri", "Refik Halit"], a: 1, topic: "hikaye" },
  { q: "Dede Korkut hikâyeleri kaç tane?", o: ["12", "10", "14", "8"], a: 0, topic: "hikaye" },
  { q: "Olay örgüsü en çok hangi türde önemlidir?", o: ["Roman", "Şiir", "Makale", "Deneme"], a: 0, topic: "hikaye" },
  { q: "Divan edebiyatında nazım birimi nedir?", o: ["Dörtlük", "Beyit", "Bent", "Kıta"], a: 1, topic: "siir" },
  { q: "Halk şiirinde 11'li ölçü hangi türde kullanılır?", o: ["Koşma", "Mani", "Semai", "Destan"], a: 0, topic: "siir" },
  { q: "Sessiz Gemi şiiri kime aittir?", o: ["Yahya Kemal", "Ahmet Haşim", "Necip Fazıl", "Akif Ersoy"], a: 0, topic: "siir" },
  { q: "Garip akımının kurucusu kimdir?", o: ["Orhan Veli", "Cemal Süreya", "Edip Cansever", "Turgut Uyar"], a: 0, topic: "siir" },
  { q: "İkinci Yeni hareketinden biri kimdir?", o: ["Cemal Süreya", "Orhan Veli", "Oktay Rifat", "Melih Cevdet"], a: 0, topic: "siir" },
  { q: "İlk tarihi roman hangisidir?", o: ["Cezmi", "İntibah", "Vatan", "Eylül"], a: 0, topic: "genel" },
  { q: "Milli Edebiyat hareketinin öncüsü kimdir?", o: ["Ziya Gökalp", "Namık Kemal", "Fuzuli", "Baki"], a: 0, topic: "genel" },
  { q: "Beş Hececilerden biri kimdir?", o: ["Faruk Nafiz", "Orhan Veli", "Cemal Süreya", "Nazım Hikmet"], a: 0, topic: "genel" },
  { q: "Vatan şairi olarak bilinen kimdir?", o: ["Namık Kemal", "Ziya Paşa", "Şinasi", "Tevfik Fikret"], a: 0, topic: "genel" },
  { q: "İstiklal Marşı'nın vezni nedir?", o: ["Hece", "Aruz", "Serbest", "Syllabic"], a: 1, topic: "genel" },
  { q: "Beş Hececiler akımı hangi alandır?", o: ["Şiir", "Roman", "Tiyatro", "Deneme"], a: 0, topic: "siir" },
  { q: "İlk yerli roman yazarlarından biri?", o: ["Şemsettin Sami", "Halide Edip", "Yakup Kadri", "Refik Halit"], a: 0, topic: "hikaye" },
  { q: "Edebi türlerden hangisi düzyazıdır?", o: ["Roman", "Şiir", "Şarkı", "Mani"], a: 0, topic: "genel" },
  { q: "Servet-i Fünun döneminde öne çıkan tür?", o: ["Şiir", "Roman", "Tiyatro", "Masal"], a: 0, topic: "siir" },
  { q: "Halk edebiyatında temel ölçü hangisidir?", o: ["Hece", "Aruz", "Serbest", "Klasik"], a: 0, topic: "siir" },
  { q: "Hikaye türlerinden hangisi durum hikayesidir?", o: ["Maupassant", "Çehov", "Olay", "Klasik"], a: 1, topic: "hikaye" },
  { q: "Roman türünde karakter gelişimi en çok nerede görülür?", o: ["Roman", "Şiir", "Makale", "Mektup"], a: 0, topic: "hikaye" },
  { q: "Divan edebiyatında kafiye sistemi genellikle nasıldır?", o: ["Beyitlere dayalı", "Serbest", "Hece", "Ritim"], a: 0, topic: "siir" },
  { q: "Kurgu dışı türler arasında hangisi vardır?", o: ["Deneme", "Roman", "Masal", "Şiir"], a: 0, topic: "genel" },
  { q: "Edebi akımlar arasında gerçekçi akımın öncüsü kimdir?", o: ["Namık Kemal", "Zola", "Orhan Veli", "Cahit Sıtkı"], a: 1, topic: "genel" },
  { q: "Divan ve Halk edebiyatı arasındaki temel fark nedir?", o: ["Dil", "Renk", "Ses", "Matbaa"], a: 0, topic: "genel" },
  { q: "Toplumcu gerçekçi şiirin önde gelen ismi kimdir?", o: ["Nazım Hikmet", "Ahmet Haşim", "Yahya Kemal", "Tanpınar"], a: 0, topic: "siir" },
];

// --- STİLLER ---
const S = {
  glass: {
    background: "rgba(16, 20, 24, 0.88)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
    color: "white",
  },
  btn: {
    background: "linear-gradient(135deg, #00c6ff, #0072ff)",
    border: "none",
    color: "white",
    padding: "12px 15px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "700",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "0.18s",
    boxShadow: "0 6px 18px rgba(0,114,255,0.18)",
    textTransform: "uppercase" as const,
    fontSize: "14px",
  },
  btnDanger: { background: "linear-gradient(135deg, #ff416c, #ff4b2b)", boxShadow: "0 6px 15px rgba(255,75,43,0.28)" },
  btnSuccess: { background: "linear-gradient(135deg, #11998e, #38ef7d)", boxShadow: "0 6px 15px rgba(56,239,125,0.28)" },
  neon: (c: string) => ({ color: c, textShadow: `0 0 10px ${c}, 0 0 18px ${c}` }),
  bar: { height: "12px", background: "#222", borderRadius: "6px", overflow: "hidden", marginTop: "8px", border: "1px solid rgba(255,255,255,0.12)" },
};

// --- BILEŞEN ---
export default function Game() {
  const [screen, setScreen] = useState<"auth" | "menu" | "battle" | "map" | "shop" | "inv" | "arena">("auth");
  const [player, setPlayer] = useState<Player | null>(null);
  const [auth, setAuth] = useState({ user: "", pass: "", reg: false });
  const [battle, setBattle] = useState<BattleState>({ active: false, enemyHp: 0, maxEnemyHp: 0, qs: [], qIdx: 0, timer: 20, combo: 0, log: null, wait: false, dmgText: null, shaking: false });
  const [modal, setModal] = useState<ModalState>(null);
  const [notif, setNotif] = useState<string | null>(null);
  const [botMatch, setBotMatch] = useState(false);
  const [turn, setTurn] = useState<"p1" | "p2">("p1");
  const [mounted, setMounted] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<{ idx: number | null; correct: boolean | null }>({ idx: null, correct: null });
  const [arenaView, setArenaView] = useState<ArenaView>("menu");
  const [answerStartTime, setAnswerStartTime] = useState<number | null>(null);
  const [searchInterval, setSearchInterval] = useState<NodeJS.Timeout | null>(null);
  const [searchTimeLeft, setSearchTimeLeft] = useState<number>(50);
  const [leaderboard, setLeaderboard] = useState<Array<{name: string, score: number, lvl: number}>>([]);

  // PvP state
  const [pvp, setPvp] = useState<PvPState>({ searching: false, matchId: null, matchData: null, isHost: false, side: null, searchStartTime: undefined });

  // Confetti canvas ref
  const confettiRef = useRef<HTMLCanvasElement | null>(null);

  // Ses ve Bildirim
  const notify = (m: string) => {
    setNotif(m);
    setTimeout(() => setNotif(null), 3000);
  };
  const playSound = (t: "click" | "win" | "hit") => {
    if (typeof window === "undefined") return;
    try {
      new Audio(
        t === "click"
          ? "https://cdn.pixabay.com/audio/2022/03/24/audio_78c2cb5739.mp3"
          : t === "win"
          ? "https://cdn.pixabay.com/audio/2021/08/09/audio_88447e769f.mp3"
          : "https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3"
      )
        .play()
        .catch(() => {});
    } catch (e) {}
  };
  const getStats = (p: Player) => {
    let atk = 25 + p.lvl * 10,
      hp = 120 + p.lvl * 30;
    if (p.equipped.wep) atk += p.equipped.wep.val;
    if (p.equipped.arm) hp += p.equipped.arm.val;
    return { atk, maxHp: hp };
  };
  
  const save = (p: Player) => {
    p.regionProgress = p.regionProgress || {};
    REGIONS.forEach((r) => {
      if (p.regionProgress[r.id] === undefined) {
        p.regionProgress[r.id] = 0;
      }
    });
    if (p.name !== "ADMIN" && p.name !== "ADMIN2" && p.name !== "ADMIN3") {
      try {
        localStorage.setItem(SAVE_KEY + p.name, JSON.stringify(p));
        update(ref(db, "users/" + p.name), { score: p.score, lvl: p.lvl }).catch(() => {});
      } catch (e) {}
    }
    setPlayer({ ...p });
    loadLeaderboard();
  };

  // Leaderboard yükle
  const loadLeaderboard = async () => {
    try {
      const usersRef = ref(db, "users");
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const users = snapshot.val();
        const leaderboardData = Object.keys(users)
          .map(key => ({
            name: key,
            score: users[key].score || 0,
            lvl: users[key].lvl || 1
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        setLeaderboard(leaderboardData);
      }
    } catch (e) {
      console.error("Leaderboard yüklenemedi:", e);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadLeaderboard();
    return () => {
      if (pvp.matchId) {
        try {
          off(ref(db, `matches/${pvp.matchId}`));
        } catch {}
      }
      if (searchInterval) {
        clearInterval(searchInterval);
      }
    };
  }, []);

  // 50 SANİYE TIMER KONTROLÜ
  useEffect(() => {
    console.log("Timer useEffect çalıştı. searching:", pvp.searching);
    
    if (pvp.searching && pvp.searchStartTime) {
      console.log("Timer başlatılıyor. Başlangıç zamanı:", pvp.searchStartTime);
      
      if (searchInterval) {
        clearInterval(searchInterval);
      }
      
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - pvp.searchStartTime!) / 1000);
        const remaining = Math.max(0, 50 - elapsedSeconds);
        
        console.log("Geçen süre:", elapsedSeconds, "Kalan süre:", remaining);
        setSearchTimeLeft(remaining);
        
        if (elapsedSeconds >= 50) {
          console.log("50 SANİYE DOLDU! Bot ile eşleştiriliyor...");
          clearInterval(interval);
          setSearchInterval(null);
          
          setPvp(prev => ({ ...prev, searching: false, searchStartTime: undefined }));
          startBotArenaMatch();
          notify("Rakip bulunamadı, bot ile eşleştiniz!");
        }
      }, 1000);
      
      setSearchInterval(interval);
      
      return () => {
        console.log("Timer temizleniyor");
        if (interval) clearInterval(interval);
      };
    } else {
      if (searchInterval) {
        clearInterval(searchInterval);
        setSearchInterval(null);
      }
      setSearchTimeLeft(50);
    }
  }, [pvp.searching, pvp.searchStartTime]);

  const getSearchTimeLeft = () => {
    return searchTimeLeft;
  };

  const startBotArenaMatch = () => {
    console.log("BOT MAÇI BAŞLATILIYOR!");
    
    const stats = getStats(player!);
    const botAtk = Math.floor(stats.atk * 0.8);
    const botHp = stats.maxHp;
    
    setBotMatch(true);
    setTurn("p1");
    
    const pool = QUESTIONS.slice();
    const qs = shuffle(pool).slice(0, 25);
    
    setBattle({
      active: true,
      region: { id: "arena", name: "ARENA", x: 0, y: 0, type: "all", bg: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1000", unlockC: "king", levels: [] },
      level: { id: "pvp-bot", t: "Bot Arena", hp: botHp, en: "Bot", ico: "🤖", diff: "Arena" },
      enemyHp: botHp,
      maxEnemyHp: botHp,
      qs,
      qIdx: 0,
      timer: 20,
      combo: 0,
      log: "Bot ile savaş başlıyor!",
      wait: false,
      dmgText: null,
      shaking: false,
    });
    
    setScreen("battle");
  };

  const handleArenaClick = () => {
    const r2Levels = REGIONS.find((r) => r.id === "r2")!.levels.length;
    const r2Progress = player!.regionProgress["r2"] ?? 0;

    if (player!.name !== "ADMIN" && player!.name !== "ADMIN2" && player!.name !== "ADMIN3" && r2Progress < r2Levels) {
      notify("Arena için Hikaye Ormanı bitmeli!");
      return;
    }

    if (!player!.arenaRulesSeen) {
      setArenaView("rules");
    } else {
      setArenaView("menu");
    }
    setScreen("arena");
  };

  const shuffle = <T,>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);

  const launchConfetti = async () => {
    if (typeof window === "undefined") return;
    try {
      const mod: any = await import("canvas-confetti");
      const confetti = mod.default || mod;
      confetti({ particleCount: 120, spread: 140, origin: { y: 0.6 } });
      return;
    } catch {
      const canvas = confettiRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);
      const particles: { x: number; y: number; vx: number; vy: number; c: string; life: number; }[] = [];
      for (let i = 0; i < 80; i++) {
        particles.push({
          x: w / 2 + (Math.random() - 0.5) * 200,
          y: h / 2 + (Math.random() - 0.5) * 50,
          vx: (Math.random() - 0.5) * 8,
          vy: -6 - Math.random() * 6,
          c: ["#ff4b2b", "#ffb400", "#00eaff", "#0f6", "#8a2be2"][Math.floor(Math.random() * 5)],
          life: 80 + Math.random() * 40,
        });
      }
      let raf = 0;
      const tick = () => {
        ctx.clearRect(0, 0, w, h);
        for (const p of particles) {
          p.vy += 0.25;
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x, p.y, 6, 10);
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].life <= 0) particles.splice(i, 1);
        }
        if (particles.length) raf = requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, w, h);
      };
      raf = requestAnimationFrame(tick);
      setTimeout(() => cancelAnimationFrame(raf), 5000);
    }
  };

  useEffect(() => {
    if (battle.active && botMatch && turn === "p2" && !battle.wait) {
      const timer = setTimeout(() => {
        const hit = Math.random() > 0.4;
        handleMove(hit);
      }, 1400 + Math.random() * 1400);
      return () => clearTimeout(timer);
    }
  }, [battle, turn, botMatch]);

  const handleAuth = () => {
    if (!auth.user || !auth.pass) return notify("Boş bırakma!");
    const key = SAVE_KEY + auth.user;
    
    if ((auth.user === "ADMIN" || auth.user === "ADMIN2" || auth.user === "ADMIN3") && auth.pass === "1234") {
      const adminP: Player = {
        name: auth.user,
        pass: "1234",
        hp: 9999,
        maxHp: 9999,
        gold: 99999,
        xp: 0,
        maxXp: 100,
        lvl: 99,
        inventory: [],
        equipped: { wep: null, arm: null },
        jokers: { heal: 99, "5050": 99, skip: 99 },
        mistakes: [],
        score: 1000,
        unlockedRegions: ["tut", "r1", "r2", "r3"],
        regionProgress: { tut: 2, r1: 2, r2: 2, r3: 1 },
        unlockedCostumes: Object.keys(COSTUMES),
        currentCostume: "king",
        tutorialSeen: true,
        arenaRulesSeen: true,
      };
      
      update(ref(db, "users/" + auth.user), { score: adminP.score, lvl: adminP.lvl }).catch(() => {});
      
      setPlayer(adminP);
      setScreen("menu");
      loadLeaderboard();
      return;
    }

    if (auth.reg) {
      if (localStorage.getItem(key)) return notify("Kullanıcı zaten var!");
      const newP: Player = {
        name: auth.user,
        pass: auth.pass,
        hp: 100,
        maxHp: 100,
        gold: 0,
        xp: 0,
        maxXp: 100,
        lvl: 1,
        inventory: [],
        equipped: { wep: null, arm: null },
        jokers: { heal: 1, "5050": 1, skip: 1 },
        mistakes: [],
        score: 0,
        unlockedRegions: ["tut"],
        regionProgress: { tut: 0 },
        unlockedCostumes: ["default"],
        currentCostume: "default",
        tutorialSeen: false,
        arenaRulesSeen: false,
      };
      localStorage.setItem(key, JSON.stringify(newP));
      update(ref(db, "users/" + auth.user), { score: 0, lvl: 1 }).catch(() => {});
      setAuth({ ...auth, reg: false });
      notify("Kayıt Oldun!");
    } else {
      const d = localStorage.getItem(key);
      if (!d) return notify("Kullanıcı yok!");
      const p = JSON.parse(d);
      if (p.pass !== auth.pass) return notify("Şifre yanlış!");
      setPlayer(p);
      setScreen("menu");
      loadLeaderboard();
    }
  };

  const startBattle = (r: Region, l: Level, isBot: boolean = false) => {
    playSound("click");
    setModal(null);
    setBotMatch(isBot);
    setTurn("p1");
    const stats = getStats(player!);

    let pool = QUESTIONS.slice();
    if (r && r.type && r.type !== "all") {
      pool = QUESTIONS.filter((q) => q.topic === r.type || q.topic === "genel");
    }
    const count = isBot ? 25 : 15;
    const qs = shuffle(pool).slice(0, Math.min(count, pool.length));
    setBattle({
      active: true,
      region: r,
      level: l,
      enemyHp: l.hp,
      maxEnemyHp: l.hp,
      qs,
      qIdx: 0,
      timer: 20,
      combo: 0,
      log: null,
      wait: false,
      dmgText: null,
      shaking: false,
    });
    setScreen("battle");
  };

  const handleMove = (correct: boolean) => {
    if (!battle.active) return;
    let nb = { ...battle };
    const currentTurn = turn;
    const pStats = getStats(player!);
    const dmg = botMatch && currentTurn === "p2" ? Math.floor(pStats.atk * 0.8) : pStats.atk;

    const answeredIdx = nb.qIdx;
    playSound(correct ? "hit" : "hit");
    nb.dmgText = correct ? { val: dmg, c: "#0f6" } : { val: 20, c: "#f05" };

    if (correct) {
      if (currentTurn === "p1") {
        nb.enemyHp -= dmg;
        nb.log = `SÜPER! ${dmg} Hasar!`;
        nb.combo = (nb.combo || 0) + 1;
        if (nb.enemyHp <= 0) {
          playSound("win");
          notify("ZAFER! +100 Altın");
          launchConfetti();
          const np = { ...player! };
          np.gold += 100;
          np.xp += 30;
          np.score += 50;
          np.hp = pStats.maxHp;
          if (np.xp >= np.maxXp) {
            np.lvl++;
            np.xp = 0;
            np.maxXp = Math.floor(np.maxXp * 1.2);
            notify("SEVİYE ATLADIN!");
          }
          if (nb.region && nb.level) {
            np.regionProgress = np.regionProgress || {};
            const currentRegionId = nb.region.id;
            const currentLevelIndex = nb.region.levels.findIndex((x) => x.id === nb.level?.id);
            if (currentLevelIndex >= 0) {
              const currentProgress = np.regionProgress[currentRegionId] ?? 0;
              np.regionProgress[currentRegionId] = Math.max(currentProgress, currentLevelIndex + 1);
            }
          }
          if (nb.level?.isBoss && nb.region) {
            const region = nb.region;
            np.unlockedRegions = np.unlockedRegions || ["tut"];
            np.unlockedCostumes = np.unlockedCostumes || ["default"];
            np.regionProgress = np.regionProgress || {};
            if (region.unlockC && !np.unlockedCostumes.includes(region.unlockC)) {
              np.unlockedCostumes.push(region.unlockC);
            }
            if (region.levels && region.levels.length > 0) {
              np.regionProgress[region.id] = region.levels.length;
            }
            const rIdx = REGIONS.findIndex((r) => r.id === region.id);
            if (rIdx !== -1 && rIdx < REGIONS.length - 1) {
              const nextR = REGIONS[rIdx + 1].id;
              if (nextR === "r3") {
                if (np.regionProgress["r2"] >= REGIONS.find(r => r.id === "r2")!.levels.length) {
                  if (!np.unlockedRegions.includes(nextR)) {
                    np.unlockedRegions.push(nextR);
                  }
                }
              } else {
                if (!np.unlockedRegions.includes(nextR)) {
                  np.unlockedRegions.push(nextR);
                }
              }
            }
          }
          save(np);
          setScreen("menu");
          return;
        }
      } else {
        const np = { ...player! };
        np.hp -= dmg;
        setPlayer(np);
        nb.log = `BOT VURDU: ${dmg}!`;
        if (np.hp <= 0) {
          np.hp = pStats.maxHp;
          save(np);
          notify("YENİLDİN...");
          setBattle({ active: false, enemyHp: 0, maxEnemyHp: 0, qs: [], qIdx: 0, timer: 20, combo: 0, log: null, wait: false, dmgText: null, shaking: false });
          setScreen("menu");
          return;
        }
      }
    } else {
      if (currentTurn === "p1") {
        const np = { ...player! };
        np.hp -= 25;
        setPlayer(np);
        nb.log = "HATALI! -25 Can";
        nb.combo = 0;
        if (np.hp <= 0) {
          np.hp = pStats.maxHp;
          save(np);
          notify("YENİLDİN...");
          setBattle({ active: false, enemyHp: 0, maxEnemyHp: 0, qs: [], qIdx: 0, timer: 20, combo: 0, log: null, wait: false, dmgText: null, shaking: false });
          setScreen("menu");
          return;
        }
      } else {
        nb.log = "BOT ISKALADI!";
      }
    }

    nb.qIdx = (nb.qIdx + 1) % nb.qs.length;
    setBattle(nb);
    setLastAnswer({ idx: answeredIdx, correct });
    setTimeout(() => setLastAnswer({ idx: null, correct: null }), 900);
    setTurn((prev) => (prev === "p1" ? "p2" : "p1"));
    setBattle(nb);
  };

  const useJoker = (id: "heal" | "5050" | "skip") => {
    if (!battle.active) return;
    if (!player) return;

    const np = { ...player };

    if (!np.jokers) np.jokers = { heal: 0, "5050": 0, skip: 0 };
    if ((np.jokers[id] ?? 0) <= 0) return;

    np.jokers[id]--;

    if (id === "heal") {
      const st = getStats(np);
      np.hp = Math.min(np.hp + 80, st.maxHp);
      notify("❤️ Can basıldı!");
      save(np);
      return;
    }

    if (id === "skip") {
      notify("⏩ Soru geçildi!");
      setBattle((b) => ({ ...b, qIdx: (b.qIdx + 1) % b.qs.length }));
      save(np);
      return;
    }

    if (id === "5050") {
      notify("½ Joker aktif! (şimdilik görsel)");
      save(np);
      return;
    }

    save(np);
  };

  const buyItem = (it: Item) => {
    if (!player) return;
    const np = { ...player };
    if (!np.jokers) np.jokers = { heal: 0, "5050": 0, skip: 0 };

    if (np.name === "ADMIN" || np.name === "ADMIN2" || np.name === "ADMIN3") {
      if (it.type === "joker") {
        const jid = it.jokerId;
        if (jid) np.jokers[jid] = (np.jokers[jid] || 0) + 1;
        save(np);
        notify("ADMIN: Joker eklendi!");
        return;
      }
      if (!np.inventory.some((x) => x.id === it.id)) {
        np.inventory.push(it);
      }
      save(np);
      notify("ADMIN: Ürün eklendi!");
      return;
    }

    if (np.gold < it.cost) {
      notify("Yeterli altın yok!");
      return;
    }

    if (it.type === "joker") {
      np.gold -= it.cost;
      const jid = it.jokerId;
      if (jid) np.jokers[jid] = (np.jokers[jid] || 0) + 1;
      save(np);
      notify("Joker satın alındı!");
      return;
    }

    if (np.inventory.some((x) => x.id === it.id)) {
      notify("Bu item zaten sende var!");
      return;
    }

    np.gold -= it.cost;
    np.inventory.push(it);
    save(np);
    notify("Satın alındı!");
  };

  const equipItem = (it: Item) => {
    if (!player) return;
    const np = { ...player };
    np.inventory = np.inventory.filter((x) => x.id !== it.id);

    if (it.type === "wep") {
      if (np.equipped.wep) {
        np.inventory.push(np.equipped.wep);
      }
      np.equipped.wep = it;
      save(np);
      notify("⚔️ Silah kuşanıldı!");
      return;
    }

    if (it.type === "arm") {
      if (np.equipped.arm) {
        np.inventory.push(np.equipped.arm);
      }
      np.equipped.arm = it;
      save(np);
      notify("🛡️ Zırh kuşanıldı!");
      return;
    }
  };

  const sellItem = (it: Item) => {
    if (!player) return;
    const np = { ...player };
    np.inventory = np.inventory.filter((x) => x.id !== it.id);
    const sellPrice = Math.floor(it.cost / 2);
    np.gold += sellPrice;
    save(np);
    notify(`💰 ${it.name} satıldı! +${sellPrice} Altın`);
  };

  // --- PVP FONKSİYONLARI ---
  const createPvPMatch = async () => {
    if (!player) return notify("Giriş yapmalısın");
    
    console.log("Yeni maç oluşturuluyor");
    
    const pool = QUESTIONS.slice();
    const qs = shuffle(pool).slice(0, Math.min(30, pool.length));
    const newRef = push(ref(db, "matches"));
    const matchId = newRef.key!;
    
    const initialState = {
      id: matchId,
      players: { host: player.name, guest: null },
      state: {
        hostHp: getStats(player).maxHp,
        guestHp: 0,
        turn: "host" as const,
        qIdx: 0,
        qs,
        started: false,
        lastAnswer: null,
        turnStartTime: Date.now(),
        log: null,
      },
      createdAt: Date.now(),
    };
    
    console.log("Maç oluşturuldu:", matchId, initialState);
    
    await set(newRef, initialState);
    
    const startTime = Date.now();
    console.log("Arama başlangıç zamanı:", startTime);
    
    setPvp({ 
      searching: true, 
      matchId, 
      matchData: initialState, 
      isHost: true, 
      side: "host", 
      searchStartTime: startTime
    });
    
    onValue(ref(db, `matches/${matchId}`), (snap) => {
      const val = snap.val();
      console.log("Maç güncellendi:", val);
      setPvp((s) => ({ ...s, matchData: val }));
      
      if (val && val.players && val.players.guest && val.state && !val.state.started && val.players.host === player.name) {
        console.log("Guest katıldı, maç başlatılıyor");
        const guestStats = getStats(player);
        const guestHp = guestStats.maxHp;
        update(ref(db, `matches/${matchId}/state`), { guestHp, started: true });
      }
    });
    
    notify(`Rakip aranıyor... (50 saniye içinde bot ile eşleşir)`);
  };

  const findAndJoinMatch = async () => {
    if (!player) return notify("Giriş yapmalısın");
    
    console.log("Eşleştirme bul başlatıldı");
    
    try {
      const snap = await get(ref(db, "matches"));
      const matchesObj = snap.val() || {};
      console.log("Mevcut maçlar:", matchesObj);
      
      let candidateId: string | null = null;
      
      for (const k of Object.keys(matchesObj)) {
        const m = matchesObj[k];
        if (m && m.players && !m.players.guest && m.players.host !== player.name) {
          candidateId = k;
          console.log("Aday maç bulundu:", candidateId);
          break;
        }
      }
      
      if (!candidateId) {
        console.log("Açık maç yok, yeni maç oluşturuluyor");
        await createPvPMatch();
        return;
      }
      
      console.log("Maça katılınıyor:", candidateId);
      await update(ref(db, `matches/${candidateId}/players`), { guest: player.name });
      
      setPvp({ 
        searching: false, 
        matchId: candidateId, 
        matchData: null, 
        isHost: false, 
        side: "guest", 
        searchStartTime: undefined 
      });
      
      onValue(ref(db, `matches/${candidateId}`), (snap2) => {
        const val = snap2.val();
        console.log("Maç güncellendi:", val);
        setPvp((s) => ({ ...s, matchData: val }));
      });
      
      setScreen("battle");
      notify(`Maça katıldın!`);
    } catch (error) {
      console.error("Eşleştirme hatası:", error);
      notify("Eşleştirme sırasında hata oluştu!");
    }
  };

  const cancelSearch = async () => {
    console.log("Arama iptal ediliyor");
    
    if (searchInterval) {
      clearInterval(searchInterval);
      setSearchInterval(null);
    }
    
    if (pvp.matchId) {
      try {
        off(ref(db, `matches/${pvp.matchId}`));
        await set(ref(db, `matches/${pvp.matchId}`), null);
      } catch {}
    }
    
    setPvp({ searching: false, matchId: null, matchData: null, isHost: false, side: null, searchStartTime: undefined });
    setSearchTimeLeft(50);
    setArenaView("menu");
  };

  const leavePvP = async () => {
    if (searchInterval) {
      clearInterval(searchInterval);
      setSearchInterval(null);
    }
    if (pvp.matchId) {
      try {
        off(ref(db, `matches/${pvp.matchId}`));
        const snap = await get(ref(db, `matches/${pvp.matchId}`));
        const val = snap.val();
        if (val) {
          if (val.players && val.players.host === player!.name && !val.players.guest) {
            await set(ref(db, `matches/${pvp.matchId}`), null);
          } else {
            if (val.players && val.players.guest === player!.name) {
              await update(ref(db, `matches/${pvp.matchId}/players`), { guest: null });
            }
          }
        }
      } catch {}
    }
    setPvp({ searching: false, matchId: null, matchData: null, isHost: false, side: null, searchStartTime: undefined });
    setBattle({ active: false, enemyHp: 0, maxEnemyHp: 0, qs: [], qIdx: 0, timer: 20, combo: 0, log: null, wait: false, dmgText: null, shaking: false });
    setScreen("arena");
    setArenaView("menu");
    setSearchTimeLeft(50);
    notify("PvP'den ayrıldın");
  };

  const savePvPAnswer = async (matchId: string, correct: boolean) => {
    if (!player) return;
    await set(ref(db, `matches/${matchId}/answers/${player.name}`), {
      correct,
      timestamp: Date.now()
    });
  };

  const pvpAnswer = async (selectedIndex: number) => {
    if (!pvp.matchId || !pvp.matchData || !player) return;
    const matchId = pvp.matchId;
    const data = pvp.matchData;
    const side = pvp.side;
    if (!side) return;
    if (!data.state || !data.state.started) return notify("Maç henüz başlamadı");
    const isMyTurn = (side === "host" && data.state.turn === "host") || (side === "guest" && data.state.turn === "guest");
    if (!isMyTurn) return notify("Sıra sende değil");
    if (data.state.lastAnswer) return notify("Bu soru zaten cevaplandı!");

    const qs: Q[] = data.state.qs || [];
    const qIdx = data.state.qIdx || 0;
    if (!qs.length || qIdx >= qs.length) return notify("Soru bulunamadı");
    
    const q = qs[qIdx];
    const correct = selectedIndex === q.a;
    const answerTime = Date.now();
    
    const updates: any = {
      "state/lastAnswer": {
        player: player.name,
        correct: correct,
        timestamp: answerTime
      }
    };

    await update(ref(db, `matches/${matchId}`), updates);

    setTimeout(async () => {
      const currentMatch = await get(ref(db, `matches/${matchId}`));
      const current = currentMatch.val();
      if (!current) return;

      const myAnswer = current.state.lastAnswer;
      const opponentName = side === "host" ? current.players.guest : current.players.host;
      let opponentAnswer = null;
      
      if (opponentName) {
        const opponentAnswerRef = ref(db, `matches/${matchId}/answers/${opponentName}`);
        const opponentSnap = await get(opponentAnswerRef);
        opponentAnswer = opponentSnap.val();
      }

      const pStats = getStats(player!);
      const botDmg = Math.floor(pStats.atk * 0.8);

      if (!opponentAnswer) {
        if (opponentName && opponentName.includes("BOT")) {
          const botCorrect = Math.random() > 0.4;
          if (myAnswer.correct && botCorrect) {
            if (side === "host") {
              updates["state/guestHp"] = Math.max(0, current.state.guestHp - pStats.atk);
            } else {
              updates["state/hostHp"] = Math.max(0, current.state.hostHp - pStats.atk);
            }
          } else if (myAnswer.correct && !botCorrect) {
            if (side === "host") {
              updates["state/guestHp"] = Math.max(0, current.state.guestHp - pStats.atk);
            } else {
              updates["state/hostHp"] = Math.max(0, current.state.hostHp - pStats.atk);
            }
          } else if (!myAnswer.correct && botCorrect) {
            if (side === "host") {
              updates["state/hostHp"] = Math.max(0, current.state.hostHp - botDmg);
            } else {
              updates["state/guestHp"] = Math.max(0, current.state.guestHp - botDmg);
            }
          } else {
            updates["state/log"] = "Kimse bilemedi!";
            if (side === "host") {
              updates["state/hostHp"] = Math.max(0, current.state.hostHp - 20);
              updates["state/guestHp"] = Math.max(0, current.state.guestHp - 20);
            } else {
              updates["state/guestHp"] = Math.max(0, current.state.guestHp - 20);
              updates["state/hostHp"] = Math.max(0, current.state.hostHp - 20);
            }
          }
        } else {
          if (side === "host") {
            updates["state/guestHp"] = 0;
          } else {
            updates["state/hostHp"] = 0;
          }
        }
      } else {
        if (myAnswer.correct && opponentAnswer.correct) {
          if (myAnswer.timestamp < opponentAnswer.timestamp) {
            if (side === "host") {
              updates["state/guestHp"] = Math.max(0, current.state.guestHp - pStats.atk);
            } else {
              updates["state/hostHp"] = Math.max(0, current.state.hostHp - pStats.atk);
            }
          } else if (opponentAnswer.timestamp < myAnswer.timestamp) {
            if (side === "host") {
              updates["state/hostHp"] = Math.max(0, current.state.hostHp - pStats.atk);
            } else {
              updates["state/guestHp"] = Math.max(0, current.state.guestHp - pStats.atk);
            }
          }
        } else if (myAnswer.correct && !opponentAnswer.correct) {
          if (side === "host") {
            updates["state/guestHp"] = Math.max(0, current.state.guestHp - pStats.atk);
          } else {
            updates["state/hostHp"] = Math.max(0, current.state.hostHp - pStats.atk);
          }
        } else if (!myAnswer.correct && opponentAnswer.correct) {
          if (side === "host") {
            updates["state/hostHp"] = Math.max(0, current.state.hostHp - pStats.atk);
          } else {
            updates["state/guestHp"] = Math.max(0, current.state.guestHp - pStats.atk);
          }
        } else {
          updates["state/log"] = "Kimse bilemedi!";
          if (side === "host") {
            updates["state/hostHp"] = Math.max(0, current.state.hostHp - 20);
            updates["state/guestHp"] = Math.max(0, current.state.guestHp - 20);
          } else {
            updates["state/guestHp"] = Math.max(0, current.state.guestHp - 20);
            updates["state/hostHp"] = Math.max(0, current.state.hostHp - 20);
          }
        }
      }

      updates["state/lastAnswer"] = null;
      updates["state/qIdx"] = (qIdx + 1) % qs.length;
      updates["state/turn"] = data.state.turn === "host" ? "guest" : "host";
      updates["state/turnStartTime"] = Date.now();

      await set(ref(db, `matches/${matchId}/answers`), null);
      await update(ref(db, `matches/${matchId}`), updates);

      const updatedMatch = await get(ref(db, `matches/${matchId}`));
      const updated = updatedMatch.val();
      if (updated && updated.state) {
        if (updated.state.guestHp <= 0 || updated.state.hostHp <= 0) {
          const winner = updated.state.guestHp <= 0 ? updated.players.host : updated.players.guest;
          if (winner === player.name) {
            notify("🏆 TEBRİKLER! ARENA ŞAMPİYONU!");
            launchConfetti();
            const np = { ...player! };
            np.gold += 500;
            np.score += 200;
            save(np);
          } else {
            notify("MAĞLUP OLDUN...");
          }
          setTimeout(async () => {
            await set(ref(db, `matches/${matchId}`), null);
          }, 3000);
        }
      }
    }, 2000);
  };

  useEffect(() => {
    if (!pvp.matchData || !player) return;
    const m = pvp.matchData;
    if (m.state && m.state.started && pvp.side) {
      if (!m.state.qs) return;
      const isHost = pvp.side === "host";
      const enemyHp = isHost ? m.state.guestHp : m.state.hostHp;
      
      setBattle({
        active: true,
        region: { id: "pvp", name: "PvP", x: 0, y: 0, type: "all", bg: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1000", unlockC: "king", levels: [] },
        level: { id: "pvp-l", t: "PvP", hp: 0, en: isHost ? (m.players.guest ?? "Bot") : m.players.host, ico: "🤼", diff: "PvP", isBoss: false },
        enemyHp: enemyHp,
        maxEnemyHp: getStats(player).maxHp,
        qs: m.state.qs,
        qIdx: m.state.qIdx,
        timer: 20,
        combo: 0,
        log: m.state.log || null,
        wait: m.state.lastAnswer !== null,
        dmgText: null,
        shaking: false,
      });
      
      const currentTurn = m.state.turn;
      if (currentTurn === "host" && isHost) setTurn("p1");
      else if (currentTurn === "guest" && !isHost) setTurn("p1");
      else setTurn("p2");
      
      setAnswerStartTime(m.state.turnStartTime || Date.now());
      setScreen("battle");
    }
  }, [pvp.matchData, player]);

  useEffect(() => {
    if (!battle.active || !pvp.matchId) return;
    
    const interval = setInterval(() => {
      if (answerStartTime && turn === "p1" && !battle.wait) {
        const elapsed = Math.floor((Date.now() - answerStartTime) / 1000);
        const remaining = 20 - elapsed;
        if (remaining <= 0) {
          notify("Süren doldu! Cevap veremedin!");
          pvpAnswer(-1);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [battle.active, pvp.matchId, answerStartTime, turn, battle.wait]);

  const globalStyles = `
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
    @keyframes float { 0% { transform: translateY(0); opacity:1; } 100% { transform: translateY(-50px); opacity:0; } }
    .answer-btn.correct { background: linear-gradient(90deg,#0f6,#00eaff) !important; transform: translateY(-4px); box-shadow: 0 14px 30px rgba(0,255,170,0.12); }
    .answer-btn.wrong { background: linear-gradient(90deg,#ff6b6b,#ff4b2b) !important; transform: translateY(-4px); box-shadow: 0 14px 30px rgba(255,80,80,0.12); }
    .dim { opacity:0.4; pointer-events:none; }
    .floating-dmg { position:absolute; left:50%; transform:translateX(-50%); font-size:72px; font-weight:800; text-shadow:0 0 30px black; animation:float 1s forwards; }
  `;

  if (!mounted) return <div style={{ height: "100vh", background: "#000" }}></div>;
  
  if (screen === "auth")
    return (
      <div style={{ height: "100vh", background: "#000", display: "flex", justifyContent: "center", alignItems: "center", color: "black", fontFamily: "sans-serif" }}>
        <style>{globalStyles}</style>
        <div style={{ ...S.glass, padding: "40px", width: "420px", textAlign: "center" }}>
          <h1 style={{ ...S.neon("#00eaff"), fontSize: "44px", marginBottom: "20px" }}>EDEBİYAT<br />EFSANELERİ</h1>
          <input style={{ width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "10px", border: "none", background: "rgba(255,255,255,0.06)", color: "white" }} placeholder="Kullanıcı Adı" value={auth.user} onChange={(e) => setAuth({ ...auth, user: e.target.value })} />
          <input style={{ width: "100%", padding: "12px", marginBottom: "18px", borderRadius: "10px", border: "none", background: "rgba(255,255,255,0.06)", color: "white" }} type="password" placeholder="Şifre" value={auth.pass} onChange={(e) => setAuth({ ...auth, pass: e.target.value })} />
          <button style={{ ...S.btn, ...S.btnSuccess, width: "100%", fontSize: "16px" }} onClick={handleAuth}>{auth.reg ? "KAYIT OL" : "GİRİŞ YAP"}</button>
          <p style={{ marginTop: "16px", cursor: "pointer", color: "#aaa" }} onClick={() => setAuth({ ...auth, reg: !auth.reg })}>{auth.reg ? "Giriş Yap" : "Kayıt Ol"}</p>
          {notif && <div style={{ color: "#f05", marginTop: "12px", fontWeight: "bold" }}>{notif}</div>}
        </div>
      </div>
    );

  return (
    <div style={{ height: "100vh", background: "radial-gradient(circle at center, #1a1a2e, #000)", color: "white", fontFamily: "Segoe UI, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{globalStyles}</style>
      <canvas ref={confettiRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }} />
     
      {screen !== "battle" && screen !== "arena" && (
        <div style={{ ...S.glass, margin: "15px", padding: "15px 25px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "18px", fontSize: "18px", fontWeight: "700", alignItems: "center" }}>
            <span style={{ fontSize: "24px" }}>{COSTUMES[player!.currentCostume].i}</span>
            <span style={S.neon("#fc0")}>⚡ {player?.lvl}</span>
            <span style={S.neon("#0f6")}>❤️ {player?.hp}</span>
            <span style={S.neon("#00eaff")}>💰 {player?.gold}</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={{ ...S.btn, ...S.btnDanger, padding: "10px 18px", fontSize: 14 }} onClick={() => setScreen("auth")}>ÇIKIŞ</button>
          </div>
        </div>
      )}
      
      {notif && <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", background: "#0f6", padding: "12px 22px", borderRadius: "12px", color: "#000", zIndex: 999, fontWeight: "700", boxShadow: "0 0 20px #0f6" }}>{notif}</div>}

      {screen === "menu" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "28px", padding: "20px" }}>
          <div style={{ ...S.glass, padding: "36px", textAlign: "center", width: "380px", height: "500px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "96px", cursor: "pointer", animation: "pulse 2s infinite" }} onClick={() => setModal("wardrobe")}>{COSTUMES[player!.currentCostume].i}</div>
            <h2 style={{ ...S.neon("#fff"), fontSize: "30px", margin: "8px 0" }}>{player?.name}</h2>
            <div style={{ color: "#aaa", marginBottom: "18px" }}>{COSTUMES[player!.currentCostume].n}</div>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "12px", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><span>⚔️ Saldırı</span><span style={{ color: "#f05", fontWeight: "700" }}>{getStats(player!).atk}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>🛡️ Can</span><span style={{ color: "#0f6", fontWeight: "700" }}>{getStats(player!).maxHp}</span></div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", width: "620px" }}>
            {[{ id: "map", t: "MACERA", i: "🗺️", c: "#fc0" }, { id: "arena", t: "ARENA", i: "⚔️", c: "#f05" }, { id: "shop", t: "MARKET", i: "🛒", c: "#0f6" }, { id: "inv", t: "ÇANTA", i: "🎒", c: "#00eaff" }].map((m) => (
              <div key={m.id} onClick={() => { playSound("click"); if (m.id === "arena") { handleArenaClick(); } else setScreen(m.id as any); }} style={{ ...S.glass, height: "210px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", border: `1px solid ${m.c}`, background: "rgba(20,20,30,0.84)" }}>
                <div style={{ fontSize: "64px", marginBottom: "14px" }}>{m.i}</div>
                <div style={{ ...S.neon(m.c), fontSize: "20px", fontWeight: "800" }}>{m.t}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === "arena" && arenaView === "menu" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...S.glass, padding: "40px", width: "500px", textAlign: "center" }}>
            <h1 style={{ ...S.neon("#f05"), fontSize: "36px", marginBottom: "30px" }}>⚔️ ARENA ⚔️</h1>
            
            <div style={{ marginBottom: "30px", background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "15px" }}>
              <h2 style={{ ...S.neon("#fc0"), marginBottom: "15px" }}>🏆 SIRALAMA</h2>
              {leaderboard.length > 0 ? (
                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                  {leaderboard.map((user, index) => (
                    <div key={user.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", marginBottom: "5px", background: index < 3 ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)", borderRadius: "5px" }}>
                      <span>{index + 1}. {user.name} {index === 0 && "👑"}</span>
                      <span style={{ color: "#fc0" }}>{user.score} Puan</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#aaa" }}>Sıralama yükleniyor...</p>
              )}
            </div>
            
            <div style={{ marginBottom: "30px", color: "#aaa" }}>
              <p>🏆 Sıralamada üst sıralara tırman!</p>
              <p>⚡ Gerçek oyunculara karşı savaş</p>
              <p>🤖 50 sn'de rakip bulunmazsa bot ile eşleş</p>
            </div>
            <button style={{ ...S.btn, ...S.btnDanger, width: "100%", padding: "18px", fontSize: "20px", marginBottom: "15px" }} onClick={() => { setArenaView("search"); findAndJoinMatch(); }}>🎮 EŞLEŞTİRME BUL</button>
            <button style={{ ...S.btn, width: "100%", padding: "12px" }} onClick={() => { const np = { ...player!, arenaRulesSeen: true }; save(np); setArenaView("rules"); }}>📜 KURALLAR</button>
            <button style={{ ...S.btn, ...S.btnSuccess, width: "100%", padding: "12px", marginTop: "15px" }} onClick={() => setScreen("menu")}>GERİ</button>
          </div>
        </div>
      )}

      {screen === "arena" && arenaView === "rules" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...S.glass, padding: "40px", width: "600px", maxHeight: "80vh", overflowY: "auto" }}>
            <h1 style={{ ...S.neon("#fc0"), fontSize: "32px", marginBottom: "25px" }}>📜 ARENA KURALLARI</h1>
            
            <div style={{ marginBottom: "20px", padding: "15px", background: "rgba(255,255,255,0.05)", borderRadius: "10px" }}>
              <h3 style={{ color: "#0f6", marginBottom: "10px" }}>⚔️ SAVAŞ SİSTEMİ</h3>
              <p>• Sırayla sorular cevaplanır</p>
              <p>• Her soru için 20 saniye süreniz var</p>
              <p>• Doğru cevap: Rakibe hasar (gücünüz kadar)</p>
              <p>• Yanlış cevap: Kendinize 20 hasar</p>
            </div>

            <div style={{ marginBottom: "20px", padding: "15px", background: "rgba(255,255,255,0.05)", borderRadius: "10px" }}>
              <h3 style={{ color: "#00eaff", marginBottom: "10px" }}>🎯 ÖZEL DURUMLAR</h3>
              <p>• İki oyuncu da doğru bilirse: Hızlı cevaplayan kazanır</p>
              <p>• İki oyuncu da yanlış bilirse: İkisi de 20 hasar alır</p>
              <p>• Bir kişi doğru, diğeri yanlış: Doğru bilen hasar verir</p>
              <p>• Süre biterse: Cevap verilmemiş sayılır</p>
            </div>

            <div style={{ marginBottom: "30px", padding: "15px", background: "rgba(255,0,85,0.1)", borderRadius: "10px" }}>
              <h3 style={{ color: "#f05", marginBottom: "10px" }}>🤖 BOT EŞLEŞMESİ</h3>
              <p>• 50 saniye içinde rakip bulunamazsa</p>
              <p>• Sizin gücünüzün %80'i kadar güce sahip bot ile eşleşir</p>
              <p>• Bot rastgele cevaplar verir (%60 doğruluk)</p>
            </div>

            <button style={{ ...S.btn, ...S.btnSuccess, width: "100%", padding: "15px", fontSize: "18px" }} onClick={() => { const np = { ...player!, arenaRulesSeen: true }; save(np); setArenaView("menu"); }}>ANLAŞILDI, ARENA'YA DÖN</button>
          </div>
        </div>
      )}

      {screen === "arena" && arenaView === "search" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...S.glass, padding: "40px", width: "450px", textAlign: "center" }}>
            <div style={{ fontSize: "64px", marginBottom: "20px", animation: "pulse 1s infinite" }}>🔍</div>
            <h2 style={{ ...S.neon("#f05"), fontSize: "28px", marginBottom: "15px" }}>RAKİP ARANIYOR</h2>
            <div style={{ fontSize: "48px", fontWeight: "800", marginBottom: "20px", color: "#00eaff" }}>{searchTimeLeft}s</div>
            <div style={{ color: "#aaa", marginBottom: "30px" }}>
              <p>🏆 Aktif oyuncu aranıyor...</p>
              <p>⏳ {searchTimeLeft} saniye sonra bot ile eşleşeceksin</p>
            </div>
            <button style={{ ...S.btn, ...S.btnDanger, width: "100%", padding: "15px" }} onClick={cancelSearch}>❌ EŞLEŞTİRMEYİ İPTAL ET</button>
          </div>
        </div>
      )}

      {screen === "battle" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.9)), url(${battle.region?.bg || ""}) center/cover` }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-around", position: "relative" }}>
            {battle.dmgText && <div className="floating-dmg" style={{ top: "38%", color: battle.dmgText.c }}>{battle.dmgText.val}</div>}

            <div style={{ textAlign: "center", transform: battle.shaking ? "translateX(5px)" : "" }}>
              <div style={{ fontSize: "120px", filter: "drop-shadow(0 0 30px #f05)" }}>{battle.level?.ico}</div>
              <div style={{ ...S.glass, padding: "10px 20px", marginTop: "10px", display: "inline-block" }}>
                <div style={{ fontWeight: "800", fontSize: "20px" }}>{battle.level?.en}</div>
                <div style={S.bar}><div style={{ width: `${Math.max(0, (battle.enemyHp / battle.maxEnemyHp) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #f05, #ff8)" }} /></div>
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: "16px", fontSize: "22px", fontWeight: "700", color: "#fc0" }}>{battle.log}</div>
              {botMatch && turn !== "p1" ? (
                <div style={{ ...S.neon("#f05"), fontSize: "28px", animation: "pulse 1s infinite" }}>BOT DÜŞÜNÜYOR...</div>
              ) : pvp.matchId ? (
                <div>
                  <div style={{ ...S.neon(turn === "p1" ? "#0f6" : "#f05"), fontSize: "34px" }}>
                    {turn === "p1" ? "SENİN SIRAN" : "RAKİBİN SIRASI"}
                  </div>
                  {turn === "p2" && battle.wait && (
                    <div style={{ color: "#aaa", marginTop: "10px" }}>Rakip cevap veriyor...</div>
                  )}
                  {turn === "p1" && answerStartTime && !battle.wait && (
                    <div style={{ fontSize: "24px", color: "#00eaff", marginTop: "10px" }}>
                      {Math.max(0, 20 - Math.floor((Date.now() - answerStartTime) / 1000))}s
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ ...S.neon("#0f6"), fontSize: "34px" }}>SENİN SIRAN</div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "120px", filter: "drop-shadow(0 0 30px #00eaff)" }}>{COSTUMES[player!.currentCostume].i}</div>
              <div style={{ ...S.glass, padding: "10px 20px", marginTop: "10px", display: "inline-block" }}>
                <div style={{ fontWeight: "800", fontSize: "20px" }}>{player?.name}</div>
                <div style={S.bar}><div style={{ width: `${(player!.hp / getStats(player!).maxHp) * 100}%`, height: "100%", background: "linear-gradient(90deg, #0f6, #00eaff)" }} /></div>
              </div>
            </div>
          </div>

          <div style={{ ...S.glass, margin: "22px", padding: "22px", border: "1px solid #00eaff", minHeight: "260px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {pvp.matchId && pvp.matchData && pvp.matchData.state && pvp.matchData.state.started && pvp.side ? (
              <>
                <div style={{ textAlign: "center", marginBottom: "18px", fontSize: "22px", fontWeight: "800" }}>{pvp.matchData.state.qs[pvp.matchData.state.qIdx].q}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  {pvp.matchData.state.qs[pvp.matchData.state.qIdx].o.map((o: string, i: number) => {
                    const isDisabled = turn !== "p1" || pvp.matchData?.state?.lastAnswer !== null;
                    return (
                      <button key={i} className="answer-btn" style={{ ...S.btn, padding: "14px", fontSize: 15, width: "100%", textTransform: "none", opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? "not-allowed" : "pointer" }} onClick={() => { if (!isDisabled) { savePvPAnswer(pvp.matchId!, i === pvp.matchData!.state.qs[pvp.matchData!.state.qIdx].a); pvpAnswer(i); } }} disabled={isDisabled}>{o}</button>
                    );
                  })}
                </div>
                {pvp.matchData.state.lastAnswer && (
                  <div style={{ textAlign: "center", marginTop: "15px", color: "#fc0" }}>
                    {pvp.matchData.state.lastAnswer.player === player?.name ? "Cevabınız kaydedildi, rakip bekleniyor..." : "Rakip cevapladı, sıranızı bekleyin..."}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "18px" }}>
                  <button style={{ ...S.btn, background: "#444", fontSize: "13px" }} onClick={() => leavePvP()}>MAÇTAN AYRIL</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: "18px", fontSize: "22px", fontWeight: "800" }}>{battle.qs ? battle.qs[battle.qIdx].q : "Hazırlanıyor..."}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  {battle.qs && battle.qs[battle.qIdx].o.map((o: string, i: number) => {
                    const isAnswered = lastAnswer.idx === battle.qIdx;
                    const className = isAnswered ? (lastAnswer.correct ? "answer-btn correct" : "answer-btn wrong") : "answer-btn";
                    const disabled = (botMatch && turn !== "p1") || (isAnswered && lastAnswer.idx === battle.qIdx);
                    return (
                      <button key={i} className={className} style={{ ...S.btn, padding: "14px", fontSize: 15, width: "100%", textTransform: "none" }} onClick={() => handleMove(i === battle.qs[battle.qIdx].a)} disabled={disabled}>{o}</button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
                  {Object.keys(player!.jokers).map((k) => (
                    <button key={k} style={{ ...S.btn, background: "#444", fontSize: "13px", opacity: player!.jokers[k] === 0 ? 0.5 : 1, }} onClick={() => useJoker(k as "heal" | "5050" | "skip")} disabled={player!.jokers[k] === 0}>
                      {k === "heal" ? "❤️" : k === "skip" ? "⏩" : "½"} ({player!.jokers[k]})
                    </button>
                  ))}
                  <button style={{ ...S.btn, ...S.btnDanger }} onClick={() => { setScreen("menu"); setBattle({ active: false, enemyHp: 0, maxEnemyHp: 0, qs: [], qIdx: 0, timer: 20, combo: 0, log: null, wait: false, dmgText: null, shaking: false }); }}>PES ET</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {screen === "map" && (
        <div style={{ flex: 1, position: "relative", backgroundColor: "#000", backgroundImage: "url('https://witchculttranslation.com/WM-K-Thumb.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 0 }} />
          <button style={{ ...S.btn, ...S.btnDanger, position: "absolute", top: 20, right: 20, zIndex: 10 }} onClick={() => setScreen("menu")}>GERİ</button>
          {REGIONS.map((r) => {
            const unlocked = player!.unlockedRegions.includes(r.id);
            return (
              <div key={r.id} onClick={() => { if (unlocked) { setModal(r); playSound("click"); } else { notify("Önceki Bölümü Bitir!"); } }} style={{ position: "absolute", left: `${r.x}%`, top: `${r.y}%`, transform: "translate(-50%,-50%)", cursor: unlocked ? "pointer" : "not-allowed", textAlign: "center", opacity: unlocked ? 1 : 0.35, filter: unlocked ? "drop-shadow(0 0 20px #00eaff)" : "grayscale(100%)", zIndex: 5 }}>
                <div style={{ fontSize: "70px", animation: unlocked ? "pulse 2s infinite" : "" }}>{unlocked ? (r.type === "iletisim" ? "📡" : r.type === "hikaye" ? "🌲" : r.type === "siir" ? "🎭" : r.id === "tut" ? "🎓" : "🐲") : "🔒"}</div>
                <div style={{ ...S.glass, padding: "6px 16px", fontSize: "14px" }}>{r.name}</div>
              </div>
            );
          })}
        </div>
      )}

      {(screen === "shop" || screen === "inv") && (
        <div style={{ flex: 1, padding: "22px", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "26px", alignItems: "center" }}>
            <h1 style={S.neon("#00eaff")}>{screen === "shop" ? "MARKET" : "ÇANTA"}</h1>
            <button style={{ ...S.btn, ...S.btnDanger }} onClick={() => setScreen("menu")}>GERİ</button>
          </div>

          {screen === "inv" && (
            <div style={{ ...S.glass, padding: "18px", marginBottom: "20px" }}>
              <h2 style={S.neon("#fc0")}>🎽 KUŞANILANLAR</h2>
              <div style={{ display: "flex", gap: "14px", marginTop: "14px", flexWrap: "wrap" }}>
                <div style={{ ...S.glass, padding: "14px", width: "200px", textAlign: "center" }}>
                  <div style={{ fontWeight: "800", marginBottom: "8px" }}>⚔️ Silah</div>
                  {player?.equipped?.wep ? (
                    <>
                      <div style={{ fontSize: "40px" }}>{player.equipped.wep.icon}</div>
                      <div>{player.equipped.wep.name}</div>
                      <button style={{ ...S.btn, marginTop: "10px", width: "100%", background: "#f05" }} onClick={() => { const np = { ...player }; np.inventory.push(np.equipped.wep!); np.equipped.wep = null; save(np); notify("Silah çıkarıldı!"); }}>ÇIKAR</button>
                    </>
                  ) : (<div style={{ color: "#aaa" }}>Boş</div>)}
                </div>
                <div style={{ ...S.glass, padding: "14px", width: "200px", textAlign: "center" }}>
                  <div style={{ fontWeight: "800", marginBottom: "8px" }}>🛡️ Zırh</div>
                  {player?.equipped?.arm ? (
                    <>
                      <div style={{ fontSize: "40px" }}>{player.equipped.arm.icon}</div>
                      <div>{player.equipped.arm.name}</div>
                      <button style={{ ...S.btn, marginTop: "10px", width: "100%", background: "#f05" }} onClick={() => { const np = { ...player }; np.inventory.push(np.equipped.arm!); np.equipped.arm = null; save(np); notify("Zırh çıkarıldı!"); }}>ÇIKAR</button>
                    </>
                  ) : (<div style={{ color: "#aaa" }}>Boş</div>)}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "18px" }}>
            {screen === "shop" ? (
              <>
                {Object.values(ITEMS).filter((it) => it.type !== "joker").map((it) => (
                  <div key={it.id} style={{ ...S.glass, padding: "18px", textAlign: "center" }}>
                    <div style={{ fontSize: "46px", marginBottom: "8px" }}>{it.icon}</div>
                    <div style={{ fontWeight: "800", fontSize: "16px" }}>{it.name}</div>
                    <div style={{ color: "#fc0", margin: "8px 0" }}>{it.cost} G</div>
                    <button style={{ ...S.btn, ...S.btnSuccess, width: "100%" }} onClick={() => buyItem(it)}>SATIN AL</button>
                  </div>
                ))}
                <div style={{ gridColumn: "1 / -1", marginTop: "30px" }}><h2 style={S.neon("#fc0")}>🎴 JOKERLER</h2></div>
                {Object.values(ITEMS).filter((it) => it.type === "joker").map((it) => (
                  <div key={it.id} style={{ ...S.glass, padding: "18px", textAlign: "center" }}>
                    <div style={{ fontSize: "46px", marginBottom: "8px" }}>{it.icon}</div>
                    <div style={{ fontWeight: "800", fontSize: "16px" }}>{it.name}</div>
                    <div style={{ color: "#fc0", margin: "8px 0" }}>{it.cost} G</div>
                    <button style={{ ...S.btn, ...S.btnSuccess, width: "100%" }} onClick={() => buyItem(it)}>SATIN AL</button>
                  </div>
                ))}
              </>
            ) : (
              player!.inventory.map((it, i) => (
                <div key={i} style={{ ...S.glass, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "40px" }}>{it.icon}</div>
                  <div style={{ fontWeight: 700 }}>{it.name}</div>
                  {it.type !== "joker" && <button style={{ ...S.btn, marginTop: "10px", width: "100%" }} onClick={() => equipItem(it)}>KUŞAN</button>}
                  <button style={{ ...S.btn, marginTop: "8px", width: "100%", background: "#fc0", color: "black" }} onClick={() => sellItem(it)}>SAT</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {modal && modal !== "wardrobe" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ ...S.glass, padding: "36px", width: "640px", textAlign: "center", border: "2px solid #00eaff" }}>
            <h2 style={S.neon("#00eaff")}>{modal.name}</h2>
            <div style={{ margin: "24px 0", maxHeight: "400px", overflowY: "auto" }}>
              {modal.levels.map((l: Level, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px", marginBottom: "10px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", alignItems: "center", background: player!.regionProgress[modal.id] >= i ? "rgba(0,255,100,0.06)" : "rgba(0,0,0,0.28)" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: "800", fontSize: "17px" }}>{l.t}</div>
                    <div style={{ fontSize: "12px", color: "#aaa" }}>{l.diff} - {l.hp} HP</div>
                  </div>
                  {(player!.regionProgress?.[modal.id] ?? 0) >= i ? (
                    <button style={S.btn} onClick={() => startBattle(modal, l)}>SAVAŞ</button>
                  ) : (<span>🔒</span>)}
                </div>
              ))}
            </div>
            <button style={{ ...S.btn, ...S.btnDanger, width: "100%" }} onClick={() => setModal(null)}>KAPAT</button>
          </div>
        </div>
      )}

      {modal === "wardrobe" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ ...S.glass, padding: "32px", width: "700px", height: "600px", textAlign: "center" }}>
            <h2 style={S.neon("#fc0")}>DOLAP</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "18px", margin: "22px 0", overflowY: "auto", height: "420px" }}>
              {Object.keys(COSTUMES).map((k) => (
                <div key={k} style={{ border: `2px solid ${player!.currentCostume === k ? "#0f6" : "#444"}`, padding: "18px", borderRadius: "12px", background: player!.currentCostume === k ? "rgba(0,255,100,0.06)" : "transparent" }}>
                  <div style={{ fontSize: "56px" }}>{COSTUMES[k].i}</div>
                  <div style={{ fontWeight: "800", marginTop: "8px" }}>{COSTUMES[k].n}</div>
                  {player!.unlockedCostumes.includes(k) ? <button style={{ ...S.btn, marginTop: "10px", width: "100%", background: player!.currentCostume === k ? "#0f6" : "#0072ff" }} onClick={() => { save({ ...player!, currentCostume: k }); setModal(null); }}>GİY</button> : <div style={{ color: "#f05", marginTop: "10px", fontWeight: "800" }}>KİLİTLİ</div>}
                </div>
              ))}
            </div>
            <button style={{ ...S.btn, ...S.btnDanger, width: "100%" }} onClick={() => setModal(null)}>KAPAT</button>
          </div>
        </div>
      )}
    </div>
  );
}