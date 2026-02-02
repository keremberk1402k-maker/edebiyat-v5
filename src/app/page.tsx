'use client';

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, query, orderByChild, limitToLast, get, push, set, onValue, remove } from "firebase/database";

// --- FIREBASE AYARLARI ---
const firebaseConfig = {
  apiKey: "AIzaSyD-Your-Key-Here",
  authDomain: "edebiyat-efsaneleri.firebaseapp.com",
  databaseURL: "https://edebiyat-efsaneleri-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "edebiyat-efsaneleri",
  storageBucket: "edebiyat-efsaneleri.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

// --- OYUN AYARLARI ---
const SAVE_KEY_PREFIX = "edb_save_v45_ultra_"; 
const BASE_WIDTH = 1200;
const BASE_HEIGHT = 900;

// --- TASARIM STILLERI ---
const styles = {
    glass: {
        background: 'rgba(20, 20, 30, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        borderRadius: '20px',
    },
    neonText: (color: string) => ({
        color: color,
        textShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
        fontWeight: 'bold' as const
    }),
    btn: {
        background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'white',
        padding: '15px 20px',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        userSelect: 'none' as const
    }
};

// --- DATA TİPLERİ ---
type Item = { id: string; name: string; type: 'wep' | 'arm' | 'acc' | 'joker'; val: number; cost: number; icon: string; jokerId?: string; uid?: number };
type Costume = { id: string; name: string; icon: string; desc: string };
type Question = { q: string; o: string[]; a: number; topic: string };
type Level = { id: string; t: string; hp: number; en: string; ico: string; diff: string; isBoss?: boolean };
type Region = { id: string; name: string; desc: string; x: number; y: number; type: 'iletisim' | 'hikaye' | 'siir' | 'all'; bg?: string; unlockC: string; levels: Level[] };
type Player = {
    name: string; pass: string; hp: number; maxHp: number; gold: number; xp: number; maxXp: number; lvl: number; baseAtk: number;
    inventory: Item[]; equipped: { wep: Item | null; arm: Item | null; acc: Item | null };
    jokers: { [key: string]: number }; mistakes: { q: string; a: string }[]; score: number;
    unlockedRegions: string[]; regionProgress: { [key: string]: number };
    unlockedCostumes: string[]; currentCostume: string; tutorialSeen: boolean;
};

// --- VERİTABANI ---
const itemDB: { [key: string]: Item } = {
    'w1': { id: 'w1', name: 'Paslı Kalem', type: 'wep', val: 15, cost: 50, icon: '✏️' },
    'w2': { id: 'w2', name: 'Divit Uç', type: 'wep', val: 30, cost: 150, icon: '✒️' },
    'w3': { id: 'w3', name: 'Altın Dolma', type: 'wep', val: 60, cost: 500, icon: '🖊️' },
    'w4': { id: 'w4', name: 'Efsanevi Kılıç', type: 'wep', val: 150, cost: 2500, icon: '🗡️' },
    'a1': { id: 'a1', name: 'Eski Defter', type: 'arm', val: 50, cost: 50, icon: '📓' },
    'a2': { id: 'a2', name: 'Deri Cilt', type: 'arm', val: 150, cost: 200, icon: '📕' },
    'a3': { id: 'a3', name: 'Ansiklopedi', type: 'arm', val: 400, cost: 800, icon: '📚' },
    'a4': { id: 'a4', name: 'Titanyum Zırh', type: 'arm', val: 800, cost: 3000, icon: '🛡️' },
    'j1': { id: 'j1', name: '%50 Joker', type: 'joker', val: 0, cost: 50, icon: '½', jokerId: '5050' },
    'j2': { id: 'j2', name: 'Can İksiri', type: 'joker', val: 0, cost: 75, icon: '🧪', jokerId: 'heal' },
    'j3': { id: 'j3', name: 'Pas Geç', type: 'joker', val: 0, cost: 100, icon: '⏩', jokerId: 'skip' },
    'j4': { id: 'j4', name: 'Ek Süre', type: 'joker', val: 0, cost: 60, icon: '⏳', jokerId: 'time' },
};

const costumeDB: { [key: string]: Costume } = {
    'default': { id: 'default', name: 'Öğrenci', icon: '🧑‍🎓', desc: 'Maceraya yeni başlayan.' },
    'prince': { id: 'prince', name: 'Şair Prens', icon: '🤴', desc: 'Sözcüklerin efendisi.' },
    'divan': { id: 'divan', name: 'Divan Şairi', icon: '👳', desc: 'Aruz vezninin ustası.' },
    'halk': { id: 'halk', name: 'Halk Ozanı', icon: '🎸', desc: 'Kopuz çalan aşık.' },
    'modern': { id: 'modern', name: 'Modern Yazar', icon: '🕴️', desc: 'Batılı tarzda yazar.' },
    'king': { id: 'king', name: 'Edebiyat Kralı', icon: '👑', desc: 'Tüm zamanların en iyisi.' },
};

const regions: Region[] = [
    { id: 'tut', name: 'Başlangıç Kampı', desc: 'Eğitim', x: 20, y: 80, type: 'iletisim', unlockC: 'default', levels: [{ id: 'l1', t: 'İlk Adım', hp: 50, en: 'Çırak', ico: '👶', diff: 'Kolay' }, { id: 'l2', t: 'Kelime Savaşı', hp: 80, en: 'Kalfa', ico: '👦', diff: 'Orta', isBoss: true }] },
    { id: 'r1', name: 'İletişim Vadisi', desc: 'Sözcükler', x: 40, y: 65, type: 'iletisim', unlockC: 'prince', levels: [{ id: 'l3', t: 'Sözlü Atışma', hp: 120, en: 'Hatip', ico: '🗣️', diff: 'Kolay' }, { id: 'l4', t: 'Kod Çözme', hp: 150, en: 'Şifreci', ico: '🧩', diff: 'Orta' }, { id: 'b1', t: 'Büyük İletişimci', hp: 300, en: 'İletişim Uzmanı', ico: '📡', diff: 'Zor', isBoss: true }] },
    { id: 'r2', name: 'Hikaye Ormanı', desc: 'Olaylar', x: 60, y: 50, type: 'hikaye', unlockC: 'halk', levels: [{ id: 'l5', t: 'Olay Örgüsü', hp: 200, en: 'Kurgucu', ico: '📝', diff: 'Orta' }, { id: 'l6', t: 'Karakter Analizi', hp: 250, en: 'Eleştirmen', ico: '🧐', diff: 'Zor' }, { id: 'b2', t: 'Hikaye Anlatıcısı', hp: 500, en: 'Dede Korkut', ico: '👴', diff: 'Boss', isBoss: true }] },
    { id: 'r3', name: 'Şiir Dağı', desc: 'Duygular', x: 80, y: 35, type: 'siir', unlockC: 'divan', levels: [{ id: 'l7', t: 'Kafiye Bulmaca', hp: 350, en: 'Şair', ico: '✍️', diff: 'Zor' }, { id: 'l8', t: 'Aruz Vezni', hp: 400, en: 'Üstad', ico: '📜', diff: 'Çok Zor' }, { id: 'b3', t: 'Şairler Sultanı', hp: 700, en: 'Baki', ico: '👳', diff: 'Boss', isBoss: true }] },
    { id: 'r4', name: 'Efsaneler Arenası', desc: 'Son Durak', x: 85, y: 15, type: 'all', unlockC: 'king', levels: [{ id: 'l9', t: 'Karışık Soru', hp: 600, en: 'Bilge', ico: '🧙', diff: 'Zor' }, { id: 'b4', t: 'Cehalet Kalesi', hp: 1000, en: 'Cehalet Canavarı', ico: '🐲', diff: 'Final Boss', isBoss: true }] },
];

const qPool: Question[] = [
    { topic: "İletişim", q: "İletişim şemasında 'gönderici'nin diğer adı nedir?", o: ["Kanal", "Kaynak", "Alıcı", "Dönüt"], a: 1 },
    { topic: "İletişim", q: "Hangisi sözlü iletişim türüdür?", o: ["Mektup", "Panel", "Dilekçe", "Günlük"], a: 1 },
    { topic: "İletişim", q: "İletişimin başlatıcısı kimdir?", o: ["Alıcı", "Kanal", "Gönderici", "Kod"], a: 2 },
    { topic: "Hikaye", q: "Dünya edebiyatında hikaye türünün ilk örneği?", o: ["Decameron", "Don Kişot", "Sefiller", "Suç ve Ceza"], a: 0 },
    { topic: "Hikaye", q: "Olay hikayesinin (Maupassant) Türk edebiyatındaki en önemli temsilcisi?", o: ["Sait Faik", "Ömer Seyfettin", "Memduh Şevket", "Nurullah Ataç"], a: 1 },
    { topic: "Hikaye", q: "Durum hikayesinin (Çehov) Türk edebiyatındaki öncüsü?", o: ["Ömer Seyfettin", "Memduh Şevket Esendal", "Namık Kemal", "Ziya Paşa"], a: 1 },
    { topic: "Şiir", q: "İstiklal Marşı hangi vezinle yazılmıştır?", o: ["Hece", "Aruz", "Serbest", "Syllabic"], a: 1 },
    { topic: "Şiir", q: "İslamiyet öncesi Türk şiirinde ağıtın karşılığı nedir?", o: ["Sagu", "Koşuk", "Sav", "Destan"], a: 0 },
    { topic: "Şiir", q: "Divan edebiyatında şairlerin şiirlerini topladıkları esere ne denir?", o: ["Cönk", "Divan", "Hamse", "Tezkire"], a: 1 },
    { topic: "Tanzimat", q: "Türk edebiyatında ilk yerli roman hangisidir?", o: ["Taaşşuk-ı Talat ve Fitnat", "İntibah", "Mai ve Siyah", "Araba Sevdası"], a: 0 },
    { topic: "Tanzimat", q: "Türk edebiyatında ilk edebi roman hangisidir?", o: ["Eylül", "İntibah", "Cezmi", "Karabibik"], a: 1 },
    { topic: "Servetifünun", q: "Servetifünun döneminin en büyük şairi kimdir?", o: ["Tevfik Fikret", "Cenap Şahabettin", "Namık Kemal", "Ziya Gökalp"], a: 0 },
    { topic: "Tanzimat", q: "'Vatan Şairi' olarak bilinen Tanzimat sanatçısı?", o: ["Ziya Paşa", "Namık Kemal", "Şinasi", "Recaizade"], a: 1 },
    { topic: "Milli Edebiyat", q: "Milli Edebiyat akımının öncüsü olan dergi?", o: ["Genç Kalemler", "Servetifünun", "Varlık", "Yaprak"], a: 0 },
    { topic: "Cumhuriyet", q: "'Beş Hececiler'den biri değildir?", o: ["Orhan Veli", "Faruk Nafiz", "Enis Behiç", "Yusuf Ziya"], a: 0 },
    { topic: "Cumhuriyet", q: "'Kaldırımlar Şairi' olarak bilinen şairimiz?", o: ["Necip Fazıl", "Nazım Hikmet", "Yahya Kemal", "Attila İlhan"], a: 0 },
    { topic: "Cumhuriyet", q: "'Garip' akımının kurucusu kimdir?", o: ["Orhan Veli", "Cemal Süreya", "Edip Cansever", "Turgut Uyar"], a: 0 },
    { topic: "Cumhuriyet", q: "Hangisi 'İkinci Yeni' şairlerinden biridir?", o: ["Orhan Veli", "Cemal Süreya", "Attila İlhan", "Faruk Nafiz"], a: 1 },
    { topic: "Cumhuriyet", q: "'Sessiz Gemi' şiiri kime aittir?", o: ["Yahya Kemal", "Ahmet Haşim", "Tevfik Fikret", "Mehmet Akif"], a: 0 },
    { topic: "Cumhuriyet", q: "'Çalıkuşu' romanının yazarı kimdir?", o: ["Reşat Nuri", "Halide Edip", "Yakup Kadri", "Refik Halit"], a: 0 },
    { topic: "Cumhuriyet", q: "İstiklal Marşı şairimiz kimdir?", o: ["Mehmet Akif Ersoy", "Ziya Gökalp", "Tevfik Fikret", "Yahya Kemal"], a: 0 },
];

const libraryDB = [
    { t: "İletişim", c: "Duygu, düşünce ve bilgilerin akla gelebilecek her türlü yolla başkalarına aktarılmasına iletişim denir. Ögeleri: Gönderici, Alıcı, İleti, Kanal, Dönüt, Bağlam." },
    { t: "Hikaye (Öykü)", c: "Yaşanmış ya da yaşanabilir olayların anlatıldığı kısa yazılardır. Olay (Maupassant) ve Durum (Çehov) olmak üzere ikiye ayrılır." },
    { t: "Şiir Bilgisi", c: "Duyguların, hayallerin ahenkli bir dille anlatılmasıdır. Ölçü, kafiye, redif ve nazım birimi şiirin ahenk unsurlarıdır." },
    { t: "Tanzimat Edebiyatı", c: "1860'ta Tercüman-ı Ahval gazetesiyle başlar. Batılı anlamda ilk eserler verilir. Vatan, hürriyet kavramları işlenir." },
    { t: "Milli Edebiyat", c: "1911'de Genç Kalemler dergisiyle başlar. Sade dil ve hece ölçüsü savunulur. Ömer Seyfettin, Ziya Gökalp öncüdür." },
];

const calcStats = (p: Player | null) => {
    if (!p) return { atk: 0, maxHp: 100 };
    let atk = p.baseAtk + (p.lvl * 5);
    let hpBonus = (p.lvl * 30);
    if (p.equipped.wep) atk += p.equipped.wep.val;
    if (p.equipped.arm) hpBonus += p.equipped.arm.val;
    return { atk, maxHp: 100 + hpBonus };
};

const shuffleQuestions = (qs: Question[]) => {
    return qs.map(q => {
        const optionsWithIndex = q.o.map((opt, i) => ({ val: opt, originalIndex: i }));
        for (let i = optionsWithIndex.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
        }
        const newAnswerIndex = optionsWithIndex.findIndex(item => item.originalIndex === q.a);
        return { ...q, o: optionsWithIndex.map(item => item.val), a: newAnswerIndex };
    });
};
export default function Game() {
  const [device, setDevice] = useState<'pc' | 'mobile' | null>(null);
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<'auth'|'menu'|'map'|'battle'|'shop'|'inv'|'lib'|'mistake'|'arena'>('auth');
  const [isRegister, setIsRegister] = useState(false);
  
  const [authName, setAuthName] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const pStats = calcStats(player);

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'logout' | 'surrender' | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  const [roomID, setRoomID] = useState<string | null>(null);
  const [playerSide, setPlayerSide] = useState<'p1' | 'p2' | null>(null);
  const [turn, setTurn] = useState<'p1' | 'p2' | 'resolving'>('p1');
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState({ speed: 3000, acc: 0.5, name: 'Acemi Bot', itemLvl: 0 });

  const [battle, setBattle] = useState<{
    active: boolean; 
    region: Region | null; level: Level | null;
    qs: Question[]; qIndex: number;
    enemyHp: number; maxEnemyHp: number; timer: number; combo: number;
    shaking: boolean; fiftyUsed: boolean; isArena: boolean;
    dmgText: {val: number, color: string, id: number} | null;
    isTransitioning: boolean; 
  }>({
    active: false, region: null, level: null, qs: [], qIndex: 0, enemyHp: 0, maxEnemyHp: 0,
    timer: 0, combo: 0, shaking: false, fiftyUsed: false, dmgText: null, isArena: false, isTransitioning: false
  });

  const [shopMode, setShopMode] = useState<'buy' | 'joker' | 'sell'>('buy');
  const [leaderboard, setLeaderboard] = useState<{name:string, score:number}[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [arenaSearching, setArenaSearching] = useState(false);

  const playSound = (type: 'click' | 'correct' | 'wrong' | 'win') => {
    if (isMuted || typeof window === 'undefined') return;
    setTimeout(() => {
        try {
            const urls = {
                'click': 'https://cdn.pixabay.com/audio/2022/03/24/audio_78c2cb5739.mp3',
                'correct': 'https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3',
                'wrong': 'https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3',
                'win': 'https://cdn.pixabay.com/audio/2021/08/09/audio_88447e769f.mp3'
            };
            const audio = new Audio(urls[type]);
            audio.volume = 0.5;
            audio.play().catch(()=>{});
        } catch (e) { }
    }, 0);
  };

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const scaleX = (window.innerWidth / BASE_WIDTH) * 0.95;
        const scaleY = (window.innerHeight / BASE_HEIGHT) * 0.95;
        setDevice(window.innerWidth < 768 ? 'mobile' : 'pc');
      }
    };
    if (typeof window !== 'undefined') {
        handleResize();
        window.addEventListener('resize', handleResize);
    }
    return () => { if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize); }
  }, []);

  // SAVAŞ ZAMANLAYICISI
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === 'battle' && battle.active && battle.timer > 0 && !battle.isTransitioning) {
      if (battle.isArena && turn !== playerSide) return;
      interval = setInterval(() => {
        setBattle(prev => {
          if (prev.timer <= 1) { 
              handleAnswer(false);
              return { ...prev, timer: 0 }; 
          }
          return { ...prev, timer: prev.timer - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, battle.active, battle.timer, turn, battle.isTransitioning, playerSide]);

  // BOT HAREKETİ (OTOMATİK)
  useEffect(() => {
      if (screen === 'battle' && battle.active && battle.isArena && isBotMatch && turn === 'p2' && !battle.isTransitioning) {
          const thinkTime = 3000;
          const botTimer = setTimeout(() => {
              const isCorrect = Math.random() < botDifficulty.acc;
              if (isCorrect) handleBotMove('correct');
              else handleBotMove('wrong');
          }, thinkTime);
          return () => clearTimeout(botTimer);
      }
  }, [turn, screen, battle.active, isBotMatch]);

  // LEADERBOARD GÜNCELLEME
  useEffect(() => {
      if (player && db) { 
          const usersRef = query(ref(db, 'users'), orderByChild('score'), limitToLast(100));
          get(usersRef).then((snapshot) => {
              if (snapshot.exists()) {
                  const data = snapshot.val();
                  const list = Object.values(data) as {name:string, score:number}[];
                  list.sort((a, b) => b.score - a.score);
                  setLeaderboard(list.slice(0, 50));
                  const myRank = list.findIndex(u => u.name === player.name);
                  setUserRank(myRank + 1);
              }
          }).catch(() => {});
      }
  }, [player?.score, screen]); 

  // --- OYUN FONKSİYONLARI ---

  const handleBotMove = (move: 'correct' | 'wrong') => {
      if (!battle.active) return;
      const botStats = botDifficulty;
      let dmg = 30 + (botStats.itemLvl * 10);
      const hit = move === 'correct';

      if (hit) {
          setBattle(prev => ({...prev, shaking: true, dmgText: {val: dmg, color:'#ff0055', id: Date.now()}}));
          const np = {...player!};
          np.hp -= dmg;
          setPlayer(np);
          notify(`${botStats.name} Doğru Bildi! -${dmg} Can`, 'error');
          if (np.hp <= 0) {
              np.hp = calcStats(np).maxHp; saveGame(np);
              setBattle(prev=>({...prev, active:false})); notify("KAYBETTİN...", "error"); setScreen('menu'); return;
          }
      } else {
          notify(`${botStats.name} Bilemedi!`, 'success');
      }

      setTurn('p1'); // SIRA SANA GEÇİYOR
      setBattle(prev => ({...prev, timer: 20}));
  };

  const startBotMatch = () => {
      if(!player) return;
      setIsBotMatch(true);
      setPlayerSide('p1'); // ARTIK SEN P1'SİN (KESİN)
      setTurn('p1'); // İLK SIRA SENDE

      const botStats = { speed: 3000, acc: 0.6, name: 'Bilge Bot', itemLvl: Math.floor(player.lvl / 2) };
      setBotDifficulty(botStats);
      const myStats = calcStats(player);
      
      let rawQs = [...qPool];
      rawQs.sort(() => Math.random() - 0.5);
      const shuffledQs = shuffleQuestions(rawQs).slice(0, 15);

      setBattle({
          active: true, isArena: true,
          region: { id:'arena', name:'Online Arena', desc:'', x:0, y:0, type:'all', bg:'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000', levels:[], unlockC: 'default' },
          level: { id:'bot', t:'Bot Savaşı', hp: myStats.maxHp, en: botStats.name, ico:'🤖', diff:'PvE', isBoss:true },
          qs: shuffledQs,
          export default function Game() {
  const [device, setDevice] = useState<'pc' | 'mobile' | null>(null);
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<'auth'|'menu'|'map'|'battle'|'shop'|'inv'|'lib'|'mistake'|'arena'>('auth');
  const [isRegister, setIsRegister] = useState(false);
  
  const [authName, setAuthName] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const pStats = calcStats(player);

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'logout' | 'surrender' | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  const [roomID, setRoomID] = useState<string | null>(null);
  const [playerSide, setPlayerSide] = useState<'p1' | 'p2' | null>(null);
  const [turn, setTurn] = useState<'p1' | 'p2' | 'resolving'>('p1');
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState({ speed: 3000, acc: 0.5, name: 'Acemi Bot', itemLvl: 0 });

  const [battle, setBattle] = useState<{
    active: boolean; 
    region: Region | null; level: Level | null;
    qs: Question[]; qIndex: number;
    enemyHp: number; maxEnemyHp: number; timer: number; combo: number;
    shaking: boolean; fiftyUsed: boolean; isArena: boolean;
    dmgText: {val: number, color: string, id: number} | null;
    isTransitioning: boolean; 
  }>({
    active: false, region: null, level: null, qs: [], qIndex: 0, enemyHp: 0, maxEnemyHp: 0,
    timer: 0, combo: 0, shaking: false, fiftyUsed: false, dmgText: null, isArena: false, isTransitioning: false
  });

  const [shopMode, setShopMode] = useState<'buy' | 'joker' | 'sell'>('buy');
  const [leaderboard, setLeaderboard] = useState<{name:string, score:number}[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [arenaSearching, setArenaSearching] = useState(false);

  const playSound = (type: 'click' | 'correct' | 'wrong' | 'win') => {
    if (isMuted || typeof window === 'undefined') return;
    setTimeout(() => {
        try {
            const urls = {
                'click': 'https://cdn.pixabay.com/audio/2022/03/24/audio_78c2cb5739.mp3',
                'correct': 'https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3',
                'wrong': 'https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3',
                'win': 'https://cdn.pixabay.com/audio/2021/08/09/audio_88447e769f.mp3'
            };
            const audio = new Audio(urls[type]);
            audio.volume = 0.5;
            audio.play().catch(()=>{});
        } catch (e) { }
    }, 0);
  };

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const scaleX = (window.innerWidth / BASE_WIDTH) * 0.95;
        const scaleY = (window.innerHeight / BASE_HEIGHT) * 0.95;
        setDevice(window.innerWidth < 768 ? 'mobile' : 'pc');
      }
    };
    if (typeof window !== 'undefined') {
        handleResize();
        window.addEventListener('resize', handleResize);
    }
    return () => { if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize); }
  }, []);

  // SAVAŞ ZAMANLAYICISI
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === 'battle' && battle.active && battle.timer > 0 && !battle.isTransitioning) {
      if (battle.isArena && turn !== playerSide) return;
      interval = setInterval(() => {
        setBattle(prev => {
          if (prev.timer <= 1) { 
              handleAnswer(false);
              return { ...prev, timer: 0 }; 
          }
          return { ...prev, timer: prev.timer - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, battle.active, battle.timer, turn, battle.isTransitioning, playerSide]);

  // BOT HAREKETİ (OTOMATİK)
  useEffect(() => {
      if (screen === 'battle' && battle.active && battle.isArena && isBotMatch && turn === 'p2' && !battle.isTransitioning) {
          const thinkTime = 3000;
          const botTimer = setTimeout(() => {
              const isCorrect = Math.random() < botDifficulty.acc;
              if (isCorrect) handleBotMove('correct');
              else handleBotMove('wrong');
          }, thinkTime);
          return () => clearTimeout(botTimer);
      }
  }, [turn, screen, battle.active, isBotMatch]);

  // LEADERBOARD GÜNCELLEME
  useEffect(() => {
      if (player && db) { 
          const usersRef = query(ref(db, 'users'), orderByChild('score'), limitToLast(100));
          get(usersRef).then((snapshot) => {
              if (snapshot.exists()) {
                  const data = snapshot.val();
                  const list = Object.values(data) as {name:string, score:number}[];
                  list.sort((a, b) => b.score - a.score);
                  setLeaderboard(list.slice(0, 50));
                  const myRank = list.findIndex(u => u.name === player.name);
                  setUserRank(myRank + 1);
              }
          }).catch(() => {});
      }
  }, [player?.score, screen]); 

  // --- OYUN FONKSİYONLARI ---

  const handleBotMove = (move: 'correct' | 'wrong') => {
      if (!battle.active) return;
      const botStats = botDifficulty;
      let dmg = 30 + (botStats.itemLvl * 10);
      const hit = move === 'correct';

      if (hit) {
          setBattle(prev => ({...prev, shaking: true, dmgText: {val: dmg, color:'#ff0055', id: Date.now()}}));
          const np = {...player!};
          np.hp -= dmg;
          setPlayer(np);
          notify(`${botStats.name} Doğru Bildi! -${dmg} Can`, 'error');
          if (np.hp <= 0) {
              np.hp = calcStats(np).maxHp; saveGame(np);
              setBattle(prev=>({...prev, active:false})); notify("KAYBETTİN...", "error"); setScreen('menu'); return;
          }
      } else {
          notify(`${botStats.name} Bilemedi!`, 'success');
      }

      setTurn('p1'); // SIRA SANA GEÇİYOR
      setBattle(prev => ({...prev, timer: 20}));
  };

  const startBotMatch = () => {
      if(!player) return;
      setIsBotMatch(true);
      setPlayerSide('p1'); // ARTIK SEN P1'SİN (KESİN)
      setTurn('p1'); // İLK SIRA SENDE

      const botStats = { speed: 3000, acc: 0.6, name: 'Bilge Bot', itemLvl: Math.floor(player.lvl / 2) };
      setBotDifficulty(botStats);
      const myStats = calcStats(player);
      
      let rawQs = [...qPool];
      rawQs.sort(() => Math.random() - 0.5);
      const shuffledQs = shuffleQuestions(rawQs).slice(0, 15);

      setBattle({
          active: true, isArena: true,
          region: { id:'arena', name:'Online Arena', desc:'', x:0, y:0, type:'all', bg:'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000', levels:[], unlockC: 'default' },
          level: { id:'bot', t:'Bot Savaşı', hp: myStats.maxHp, en: botStats.name, ico:'🤖', diff:'PvE', isBoss:true },
          qs: shuffledQs,
          qIndex: 0, enemyHp: myStats.maxHp, maxEnemyHp: myStats.maxHp,
          timer: 20, combo: 0, shaking: false, fiftyUsed: false, dmgText: null, isTransitioning: false
      });
      setScreen('battle');
      notify(`Rakip: ${botStats.name}`, "success");
  };

  const handleAnswer = (correct: boolean) => {
    if (!player || battle.isTransitioning) return;
    if (correct) playSound('correct'); else playSound('wrong');
    if (!battle.isArena || isBotMatch) {
        setBattle(prev => ({ ...prev, isTransitioning: true }));
        setTimeout(() => { processAnswer(correct); }, 800); 
    } else {
        processAnswer(correct);
    }
  };

  const processAnswer = (correct: boolean) => {
      let nb = { ...battle, isTransitioning: false };
      
      // ONLINE PVP
      if (nb.isArena && roomID && !isBotMatch && db) {
           if (turn !== playerSide) return;
           const myMove = correct ? 'correct' : 'wrong';
           const updates: any = {};
           updates[`arena_rooms/${roomID}/${playerSide}_move`] = myMove;
           if (playerSide === 'p1') updates[`arena_rooms/${roomID}/turn`] = 'p2'; 
           else { updates[`arena_rooms/${roomID}/turn`] = 'resolving'; resolveRoundOnline(myMove); return; }
           update(ref(db), updates); return;
      }

      // BOT MAÇI (SENİN HAMLEN)
      if (nb.isArena && isBotMatch) {
          const myDmg = calcStats(player!).atk;
          if (correct) {
              nb.enemyHp -= myDmg;
              nb.dmgText = { val: myDmg, color: '#00ff66', id: Date.now() };
              nb.shaking = true;
          }
          if (nb.enemyHp <= 0) {
              playSound('win');
              const np = {...player!}; np.score += 50; np.gold += 50; np.hp = calcStats(np).maxHp; saveGame(np);
              setBattle({...nb, active:false}); notify("KAZANDIN! +50 SKOR", "success"); setScreen('menu'); return;
          }
          setTurn('p2'); // SIRA BOTA GEÇİYOR
          nb.qIndex++; if(nb.qIndex >= nb.qs.length) nb.qIndex = 0;
          nb.timer = 20; 
          setBattle(nb);
          return;
      }

      // HİKAYE MODU
      const np = { ...player! };
      if (correct) {
        nb.combo++; const stats = calcStats(np); let dmg = stats.atk; if (nb.combo > 2) dmg *= 1.5; dmg = Math.floor(dmg);
        nb.enemyHp = Math.max(0, nb.enemyHp - dmg);
        nb.dmgText = { val: dmg, color: '#00ff66', id: Date.now() }; 
        np.xp += 20; if(np.xp >= np.maxXp) { np.lvl++; np.xp=0; np.maxXp=Math.floor(np.maxXp*1.2); np.hp = calcStats(np).maxHp; setShowLevelUp(true); playSound('win'); }
      } else {
        nb.combo = 0; np.hp -= 20; nb.shaking = true;
        nb.dmgText = { val: 20, color: '#ff0055', id: Date.now() };
        const q = nb.qs[nb.qIndex];
        if(nb.region && !np.mistakes.find(m => m.q === q.q)) np.mistakes.push({q:q.q, a:q.o[q.a]});
      }

      if (nb.enemyHp <= 0) {
        playSound('win');
        np.gold += 100;
        if (nb.region && nb.level) {
            const currentProgress = np.regionProgress[nb.region.id] || 0;
            const levelIndex = nb.region.levels.findIndex(l => l.id === nb.level!.id);
            if(levelIndex === currentProgress) np.regionProgress[nb.region.id] = currentProgress + 1;
            if(nb.level.isBoss) {
                if(nb.region.unlockC && !np.unlockedCostumes.includes(nb.region.unlockC)) np.unlockedCostumes.push(nb.region.unlockC);
                const rIdx = regions.findIndex(r => r.id === nb.region!.id);
                if(rIdx < regions.length - 1) {
                    const nextR = regions[rIdx + 1].id;
                    if(!np.unlockedRegions.includes(nextR)) { np.unlockedRegions.push(nextR); np.regionProgress[nextR] = 0; }
                }
            }
        }
        saveGame(np); setBattle({...nb, active:false}); notify("ZAFER! +100 ALTIN", "success"); setScreen('map'); return;
      }

      if (np.hp <= 0) { np.hp = 20; saveGame(np); setBattle({...nb, active:false}); notify("KAYBETTİN!", "error"); setScreen('menu'); return; }
      if (!correct || nb.enemyHp > 0) { nb.qIndex++; nb.timer=20; nb.fiftyUsed=false; }
      if (nb.qIndex >= nb.qs.length) { nb.qs = shuffleQuestions(nb.qs); nb.qIndex = 0; }
      setBattle(nb); saveGame(np);
  };

  const resolveRoundOnline = async (p2LastMove: string) => { /* Online Logic Same */ }; 

  const buyItem = (id:string) => { playSound('click'); const it=itemDB[id]; if(player!.gold>=it.cost){let np={...player!}; np.gold-=it.cost; if(it.type==='joker') np.jokers[it.jokerId!]=(np.jokers[it.jokerId!]||0)+1; else np.inventory.push({...it, uid:Date.now()}); saveGame(np); notify("Satın Alındı!", "success");}else notify("Para Yetersiz!", "error"); };
  const equipItem = (idx:number) => { playSound('click'); if(!player) return; const np={...player}; const it=np.inventory[idx]; if (it.type === 'joker') return notify("Jokerler kuşanılamaz!", "error"); const type = it.type as 'wep' | 'arm' | 'acc'; if(np.equipped[type]) np.inventory.push(np.equipped[type]!); np.equipped[type]=it; np.inventory.splice(idx,1); saveGame(np); notify("Kuşanıldı", "success"); };
  const unequipItem = (type: 'wep' | 'arm' | 'acc') => { playSound('click'); if(!player || !player.equipped[type]) return; const np = { ...player }; np.inventory.push(np.equipped[type]!); np.equipped[type] = null; saveGame(np); notify("Çıkarıldı", "success"); };
  const useJoker = (type: string) => { playSound('click'); if(!player || !battle.active) return; if((player.jokers[type]||0)<=0) return notify("Jokerin Kalmadı!", "error"); let np = {...player}; np.jokers[type]--; if(type==='heal') { np.hp = Math.min(np.hp+50, calcStats(np).maxHp); notify("Can Yenilendi! (+50)", "success"); } if(type==='skip') { setBattle(prev=>({...prev, enemyHp:0})); setTimeout(()=>handleAnswer(true), 100); notify("Bölüm Geçildi!", "success"); } if(type==='time') { setBattle(prev=>({...prev, timer:prev.timer+20})); notify("Ek Süre Eklendi!", "success"); } if(type==='5050') { setBattle(prev=>({...prev, fiftyUsed:true})); notify("%50 Kullanıldı!", "success"); } saveGame(np); };
  const sellItem = (idx:number) => { playSound('click'); if(!player)return; const np={...player}; np.gold+=np.inventory[idx].cost/2; np.inventory.splice(idx,1); saveGame(np); notify("Satıldı", "success"); };
  
  const handleRegionClick = (r: Region) => { playSound('click'); if (!player!.unlockedRegions.includes(r.id)) return notify("Önceki bölgeleri tamamla!", "error"); setSelectedRegion(r); setShowRegionModal(true); };
  const startBattle = (r: Region, l: Level) => { playSound('click'); setShowRegionModal(false); let rawQs = [...qPool]; rawQs.sort(() => Math.random() - 0.5); const shuffledQs = shuffleQuestions(rawQs); setBattle({ active: true, region: r, level: l, qs: shuffledQs, qIndex: 0, enemyHp: l.hp, maxEnemyHp: l.hp, timer: 20, combo: 0, shaking: false, fiftyUsed: false, dmgText: null, isArena: false, isTransitioning: false }); setScreen('battle'); };
  const handleDeviceSelect = (type: 'pc' | 'mobile') => { setDevice(type); setTimeout(() => { playSound('click'); if (type === 'mobile' && typeof window !== 'undefined') try { document.documentElement.requestFullscreen().catch(()=>{}); } catch(e){} }, 50); };
  const handleAuth = () => { playSound('click'); if(!authName||!authPass) return notify("Boş alan bırakma!", "error"); const key = `${SAVE_KEY_PREFIX}${authName}`; if(authName==="admin"&&authPass==="1234"){ setPlayer({ name: "ADMIN", pass: "1234", hp: 9999, maxHp: 9999, gold: 99999, xp: 0, maxXp: 100, lvl: 99, baseAtk: 999, inventory: [], equipped: {wep:null,arm:null,acc:null}, jokers: {'5050':99,'heal':99,'skip':99,'time':99}, mistakes: [], score: 9999, unlockedRegions: ['tut','r1','r2','r3','r4'], regionProgress: {'tut':2,'r1':4,'r2':4,'r3':4,'r4':3}, unlockedCostumes: Object.keys(costumeDB), currentCostume: 'default', tutorialSeen: true }); setScreen('menu'); return; } if(isRegister){ if(localStorage.getItem(key)) return notify("Bu isim dolu!", "error"); const newP: Player = { name: authName, pass: authPass, hp: 100, maxHp: 100, gold: 0, xp: 0, maxXp: 100, lvl: 1, baseAtk: 20, inventory: [], equipped: {wep:null,arm:null,acc:null}, jokers: {'5050':1,'heal':1,'skip':1,'time':1}, mistakes: [], score: 0, unlockedRegions: ['tut'], regionProgress: {'tut': 0}, unlockedCostumes: ['default'], currentCostume: 'default', tutorialSeen: false }; localStorage.setItem(key, JSON.stringify(newP)); if(db) update(ref(db, 'users/'+authName), {name:authName, score:0}).catch(()=>{}); setIsRegister(false); notify("Kayıt Başarılı!", "success"); } else { const d=localStorage.getItem(key); if(!d) return notify("Kayıt yok!", "error"); try{ const p=JSON.parse(d); if(p.pass!==authPass) return notify("Şifre yanlış!", "error"); if(!p.unlockedRegions) p.unlockedRegions=['tut']; if(db) update(ref(db, 'users/'+authName), {name:authName, score:p.score}).catch(()=>{}); setPlayer(p); setScreen('menu'); if(!p.tutorialSeen) setShowTutorial(true); }catch(e){ notify("Dosya bozuk", "error"); } } };
  const findMatch = async () => { if (!player) return; setArenaSearching(true); playSound('click'); setTimeout(() => { setArenaSearching(false); startBotMatch(); }, 2500); };
  const saveGame = (p: Player) => { if(p.name !== "ADMIN") { localStorage.setItem(`${SAVE_KEY_PREFIX}${p.name}`, JSON.stringify(p)); if (db) update(ref(db, 'users/' + p.name), { score: p.score }).catch(()=>{}); } setPlayer({...p}); };

  if (!mounted) return <div style={{color:'white', background:'black', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Yükleniyor...</div>;
  if (!device) return (<div style={{position:'fixed', inset:0, background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'30px'}}><h1 style={{...styles.neonText('#00eaff'), fontSize:'40px'}}>CİHAZ SEÇ</h1><div style={{display:'flex', gap:'20px'}}><button onClick={()=>handleDeviceSelect('mobile')} style={{...styles.btn, background:'#ffcc00', color:'black', fontSize:'24px'}}>📱 TELEFON</button><button onClick={()=>handleDeviceSelect('pc')} style={{...styles.btn, fontSize:'24px'}}>💻 BİLGİSAYAR</button></div></div>);

  if (screen === 'auth') return (<div style={{position:'fixed', inset:0, background:'radial-gradient(circle, #222 0%, #000 100%)', display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{...styles.glass, padding:'40px', width: device==='mobile'?'90%':'450px', textAlign:'center'}}><h1 style={{...styles.neonText('#00eaff'), fontSize:'50px', margin:'0 0 30px 0'}}>EDEBİYAT<br/>EFSANELERİ</h1><input style={{padding:'15px', borderRadius:'10px', border:'none', background:'rgba(255,255,255,0.1)', color:'white', width:'100%', marginBottom:'15px'}} placeholder="Kullanıcı Adı" value={authName} onChange={e=>setAuthName(e.target.value)} /><input style={{padding:'15px', borderRadius:'10px', border:'none', background:'rgba(255,255,255,0.1)', color:'white', width:'100%', marginBottom:'20px'}} type="password" placeholder="Şifre" value={authPass} onChange={e=>setAuthPass(e.target.value)} /><button style={{...styles.btn, background:'#00ff66', color:'black', width:'100%', justifyContent:'center'}} onClick={handleAuth}>{isRegister?'KAYIT OL':'GİRİŞ YAP'}</button><p style={{color:'#aaa', cursor:'pointer', marginTop:'15px', textDecoration:'underline'}} onClick={()=>setIsRegister(!isRegister)}>{isRegister?'Giriş Yap':'Kayıt Ol'}</p></div>{notification && <div style={{position:'fixed', top:'20px', left:'50%', transform:'translate(-50%,0)', background:notification.type==='error'?'#ff0055':'#00ff66', padding:'10px 20px', borderRadius:'10px', color:'black', fontWeight:'bold'}}>{notification.msg}</div>}</div>);
  return (
    <>
      <style>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
        @keyframes float { 0% { transform: translateY(0px); opacity: 1; } 100% { transform: translateY(-50px); opacity: 0; } }
      `}</style>
      
      {notification && <div style={{position:'fixed', top:'20px', left:'50%', transform:'translate(-50%,0)', background:notification.type==='error'?'#ff0055':'#00ff66', padding:'15px 30px', borderRadius:'20px', color:'black', fontWeight:'bold', zIndex:99999, boxShadow:'0 0 20px rgba(0,0,0,0.5)'}}>{notification.msg}</div>}
      
      {confirmAction && <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{...styles.glass, padding:'30px', textAlign:'center'}}><h2 style={{color:'#ff0055'}}>EMİN MİSİN?</h2><div style={{display:'flex', gap:'20px', justifyContent:'center'}}><button style={{...styles.btn, background:'#ff0055'}} onClick={()=>{if(confirmAction==='surrender'){setBattle(prev=>({...prev, active:false})); const np={...player!}; np.hp=calcStats(np).maxHp; saveGame(np); setScreen('menu');}else window.location.reload(); setConfirmAction(null);}}>EVET</button><button style={styles.btn} onClick={()=>setConfirmAction(null)}>HAYIR</button></div></div></div>}

      {showWardrobe && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{...styles.glass, width: device==='mobile'?'95%':'600px', height:'600px', padding:'30px', display:'flex', flexDirection:'column'}}><h1 style={{...styles.neonText('#ffcc00'), textAlign:'center'}}>DOLAP</h1><div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px', overflowY:'auto', flex:1, padding:'20px'}}>{Object.keys(costumeDB).map(k=>(<div key={k} style={{border:'1px solid #555', padding:'10px', borderRadius:'10px', textAlign:'center', background:player!.currentCostume===k?'rgba(0,255,100,0.2)':'transparent'}}><div style={{fontSize:'50px'}}>{costumeDB[k].icon}</div><div>{costumeDB[k].name}</div>{player!.unlockedCostumes.includes(k)?<button style={{...styles.btn, fontSize:'12px', width:'100%', marginTop:'5px', background:player!.currentCostume===k?'#00ff66':'#00eaff', color:'black'}} onClick={()=>{saveGame({...player!, currentCostume:k}); setShowWardrobe(false)}}>GİY</button>:<div style={{color:'red', fontSize:'12px', marginTop:'5px'}}>KİLİTLİ</div>}</div>))}</div><button style={{...styles.btn, background:'#ff0055'}} onClick={()=>setShowWardrobe(false)}>KAPAT</button></div></div>)}

      <div style={containerStyle}>
        <div style={{...styles.glass, margin:'10px', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{display:'flex', gap:'20px', fontSize:'18px', fontWeight:'bold'}}>
                <span style={{color:'#ffcc00'}}>⚡ {player?.lvl}</span>
                <span style={{color:'#00ff66'}}>❤️ {player?.hp}/{pStats.maxHp}</span>
                <span style={{color:'#00eaff'}}>💰 {player?.gold}</span>
            </div>
            <button style={{...styles.btn, background:'#ff0055', fontSize:'12px', padding:'8px 15px'}} onClick={()=>setConfirmAction('logout')}>ÇIKIŞ</button>
        </div>

        {screen === 'menu' && (
            <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'40px', flexDirection: device==='mobile'?'column':'row'}}>
                <div style={{...styles.glass, width: device==='mobile'?'90%':'350px', textAlign:'center', padding:'30px'}}>
                    <div style={{fontSize:'80px', cursor:'pointer', animation:'pulse 3s infinite'}} onClick={()=>setShowWardrobe(true)}>{costumeDB[player!.currentCostume].icon}</div>
                    <h2 style={{...styles.neonText('#00eaff'), fontSize:'30px', margin:'10px 0'}}>{player?.name}</h2>
                    <div style={{color:'#aaa', marginBottom:'20px'}}>Sıralama: #{userRank||'-'}</div>
                    <div style={{background:'rgba(0,0,0,0.5)', borderRadius:'10px', padding:'15px', textAlign:'left'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>⚔️ Saldırı</span><span style={{color:'#ff0055'}}>{pStats.atk}</span></div>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>❤️ Can</span><span style={{color:'#00ff66'}}>{pStats.maxHp}</span></div>
                    </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', width: device==='mobile'?'90%':'500px'}}>
                    {[{id:'map',t:'MACERA',i:'🗺️',c:'#ffcc00'},{id:'arena',t:'ARENA',i:'⚔️',c:'#ff0055'},{id:'shop',t:'MARKET',i:'🛒',c:'#00ff66'},{id:'inv',t:'ÇANTA',i:'🎒',c:'#00eaff'},{id:'lib',t:'BİLGİ',i:'📚',c:'#aa00ff'},{id:'mistake',t:'HATA',i:'📜',c:'#ffffff'}].map(m=>(
                        <div key={m.id} onClick={()=>{playSound('click'); setScreen(m.id as any);}} style={{...styles.glass, height:'140px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', border:`1px solid ${m.c}`}}>
                            <div style={{fontSize:'50px', marginBottom:'10px'}}>{m.i}</div>
                            <div style={{...styles.neonText(m.c), fontSize:'20px'}}>{m.t}</div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {screen === 'battle' && (
            <div style={{height:'100%', display:'flex', flexDirection:'column', background:`linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${battle.isArena ? battle.region?.bg : battle.level?.ico}) center/cover`}}>
                <div style={{padding:'20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <button style={{...styles.btn, background:'#ff0055'}} onClick={()=>setConfirmAction('surrender')}>TESLİM</button>
                    <div style={{flex:1, margin:'0 20px', background:'#333', height:'15px', borderRadius:'10px', overflow:'hidden', border:'1px solid white'}}>
                        <div style={{width:`${(battle.timer/20)*100}%`, height:'100%', background: battle.timer<5?'red':'#00eaff', transition:'width 1s linear'}}></div>
                    </div>
                </div>

                <div style={{flex:2, display:'flex', alignItems:'center', justifyContent:'space-around', position:'relative'}}>
                    {battle.dmgText && <div style={{position:'absolute', top:'40%', left:'50%', transform:'translate(-50%,-50%)', fontSize:'50px', fontWeight:'bold', color:battle.dmgText.color, animation:'float 1s forwards', textShadow:'0 0 10px black'}}>-{battle.dmgText.val}</div>}
                    
                    {/* RAKİP */}
                    <div style={{textAlign:'center', animation: battle.shaking ? 'shake 0.5s' : ''}}>
                        <div style={{fontSize:'100px', filter:'drop-shadow(0 0 20px red)'}}>{battle.isArena ? '🤺' : battle.level?.ico}</div>
                        <div style={{background:'rgba(0,0,0,0.7)', padding:'5px 15px', borderRadius:'10px', marginTop:'10px'}}>
                            <div style={{color:'white', fontWeight:'bold'}}>{battle.level?.en}</div>
                            <div style={{width:'120px', height:'8px', background:'#333', marginTop:'5px', borderRadius:'4px'}}><div style={{width:`${(battle.enemyHp/battle.maxEnemyHp)*100}%`, height:'100%', background:'#ff0055', transition:'width 0.3s'}}></div></div>
                        </div>
                    </div>

                    {/* VS / DURUM */}
                    <div style={{textAlign:'center'}}>
                        {battle.isArena && turn !== playerSide ? 
                            <div style={{...styles.neonText('#ff0055'), fontSize:'24px', animation:'pulse 1s infinite'}}>BOT DÜŞÜNÜYOR...</div> : 
                            <div style={{...styles.neonText('#00ff66'), fontSize:'30px'}}>SENİN SIRAN</div>
                        }
                    </div>

                    {/* OYUNCU */}
                    <div style={{textAlign:'center'}}>
                        <div style={{fontSize:'100px', filter:'drop-shadow(0 0 20px #00eaff)'}}>{costumeDB[player!.currentCostume].icon}</div>
                        <div style={{background:'rgba(0,0,0,0.7)', padding:'5px 15px', borderRadius:'10px', marginTop:'10px'}}>
                            <div style={{color:'white', fontWeight:'bold'}}>{player?.name}</div>
                            <div style={{width:'120px', height:'8px', background:'#333', marginTop:'5px', borderRadius:'4px'}}><div style={{width:`${(player!.hp/pStats.maxHp)*100}%`, height:'100%', background:'#00ff66', transition:'width 0.3s'}}></div></div>
                        </div>
                    </div>
                </div>

                {/* SORU PANOSU */}
                <div style={{...styles.glass, margin:'20px', padding:'30px', border:'2px solid #00eaff', display:'flex', flexDirection:'column', gap:'20px'}}>
                    {battle.isArena && turn !== playerSide ? (
                        <div style={{textAlign:'center', color:'#aaa', fontSize:'20px'}}>Rakibin hamlesi bekleniyor...</div>
                    ) : (
                        <>
                            <div style={{textAlign:'center', fontSize:'22px', fontWeight:'bold', color:'white'}}>{battle.qs[battle.qIndex]?.q}</div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                {battle.qs[battle.qIndex]?.o.map((o,i)=>(
                                    <button key={i} 
                                        disabled={battle.isTransitioning}
                                        onClick={()=>handleAnswer(battle.qs[battle.qIndex].a === i)} 
                                        style={{
                                            ...styles.btn, 
                                            background: battle.isTransitioning ? (battle.qs[battle.qIndex].a === i ? '#00ff66' : '#ff0055') : 'rgba(255,255,255,0.1)',
                                            color: battle.isTransitioning ? 'black' : 'white',
                                            opacity: battle.fiftyUsed && i!==battle.qs[battle.qIndex].a && i%2!==0 ? 0.2 : 1
                                        }}
                                    >{o}</button>
                                ))}
                            </div>
                            {device==='pc' && !battle.isArena && (
                                <div style={{display:'flex', gap:'10px', justifyContent:'center', marginTop:'10px'}}>
                                    <button onClick={()=>useJoker('heal')} style={styles.btn}>❤️ Can ({player!.jokers['heal']||0})</button>
                                    <button onClick={()=>useJoker('5050')} style={styles.btn}>½ Yarı ({player!.jokers['5050']||0})</button>
                                    <button onClick={()=>useJoker('skip')} style={styles.btn}>⏩ Pas ({player!.jokers['skip']||0})</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        )}

        {/* HARİTA EKRANI */}
        {screen === 'map' && (
            <div style={{height:'100%', width: '100%', position:'relative', background:'url(https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000) center/cover', overflow:'hidden', boxShadow:'inset 0 0 100px black'}}>
                <button style={{...styles.btn, position:'absolute', top:'20px', right:'20px', zIndex:10, background:'#ff0055'}} onClick={()=>setScreen('menu')}>GERİ</button>
                <svg style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}>{regions.map((r, i) => {if (i === regions.length - 1) return null;const next = regions[i+1];const unlocked = player!.unlockedRegions.includes(next.id);return <line key={i} x1={`${r.x}%`} y1={`${r.y}%`} x2={`${next.x}%`} y2={`${next.y}%`} stroke={unlocked?'#fff':'#555'} strokeWidth="3" strokeDasharray="10" />})}</svg>
                {regions.map((r) => {
                    const unlocked = player!.unlockedRegions.includes(r.id);
                    return (
                        <div key={r.id} onClick={()=>handleRegionClick(r)} style={{position:'absolute', left:`${r.x}%`, top:`${r.y}%`, transform:'translate(-50%, -50%)', cursor: unlocked ? 'pointer' : 'not-allowed', textAlign:'center', zIndex:5, opacity: unlocked ? 1 : 0.6, filter: unlocked ? 'drop-shadow(0 0 10px #00eaff)' : 'grayscale(100%)'}}>
                            <div style={{fontSize:'60px', transition:'transform 0.3s', animation: unlocked ? 'pulse 2s infinite' : ''}}>{r.type==='iletisim'?'📡':r.type==='hikaye'?'🌲':r.type==='siir'?'🎭':r.id==='tut'?'🎓':'🐲'}</div>
                            <div style={{background:'rgba(0,0,0,0.8)', padding:'5px 10px', borderRadius:'5px', color:'white', fontSize:'14px', marginTop:'-10px'}}>{r.name}</div>
                        </div>
                    )
                })}
            </div>
        )}

        {/* MARKET, ÇANTA VB. */}
        {['shop','inv','lib','mistake','arena'].includes(screen) && screen !== 'battle' && (
            <div style={{padding:'20px', overflowY:'auto', height:'100%'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h1 style={{...styles.neonText('#00eaff'), margin:0}}>{screen==='shop'?'MARKET':screen==='inv'?'ÇANTA':screen==='arena'?'ARENA LİDERLİK':screen==='lib'?'KÜTÜPHANE':'HATALAR'}</h1>
                    <button style={{...styles.btn, background:'#ff0055'}} onClick={()=>setScreen('menu')}>GERİ</button>
                </div>
                
                {screen === 'shop' && (
                    <div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr 1fr':'repeat(auto-fit, minmax(200px, 1fr))', gap:'20px'}}>
                        {Object.keys(itemDB).map(k=>(<div key={k} style={{...styles.glass, padding:'20px', textAlign:'center'}}><div style={{fontSize:'40px'}}>{itemDB[k].icon}</div><div style={{fontWeight:'bold'}}>{itemDB[k].name}</div><div style={{color:'#aaa', fontSize:'12px', margin:'5px 0'}}>{itemDB[k].type==='wep'?'⚔️ Güç':itemDB[k].type==='arm'?'🛡️ Zırh':'⚡ Özel'} +{itemDB[k].val}</div><button style={{...styles.btn, background:'#00eaff', color:'black', width:'100%', marginTop:'10px'}} onClick={()=>buyItem(k)}>{itemDB[k].cost} G</button></div>))}
                    </div>
                )}

                {screen === 'arena' && (
                    <div style={{textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center'}}>
                        <div style={{...styles.glass, padding:'20px', width: device==='mobile'?'100%':'600px', marginBottom:'20px'}}>
                            {leaderboard.map((u,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid rgba(255,255,255,0.1)', color:u.name===player?.name?'#00eaff':'white'}}><span>#{i+1} {u.name}</span><span>{u.score} P</span></div>)}
                        </div>
                        {arenaSearching ? <div style={{fontSize:'24px', color:'#00eaff', animation:'pulse 1s infinite'}}>RAKİP ARANIYOR...</div> : <button style={{...styles.btn, background:'#00ff66', color:'black', fontSize:'24px', padding:'20px 50px'}} onClick={findMatch}>SAVAŞ BUL</button>}
                    </div>
                )}

                {screen === 'inv' && (
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'20px'}}>
                        {player!.inventory.map((it,i)=>(<div key={i} style={{...styles.glass, padding:'20px', textAlign:'center'}}><div style={{fontSize:'40px'}}>{it.icon}</div><div>{it.name}</div><button style={{...styles.btn, marginTop:'10px', width:'100%'}} onClick={()=>equipItem(i)}>KUŞAN</button></div>))}
                    </div>
                )}
            </div>
        )}

        {showRegionModal && selectedRegion && (
            <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <div style={{...styles.glass, width: device==='mobile'?'95%':'600px', padding:'30px', textAlign:'center', border:'2px solid #00eaff'}}>
                    <h2 style={{...styles.neonText('#00eaff'), fontSize:'40px'}}>{selectedRegion.name}</h2>
                    <div style={{display:'flex', flexDirection:'column', gap:'15px', maxHeight:'400px', overflowY:'auto', marginTop:'20px'}}>
                        {selectedRegion.levels.map((lvl, idx) => {
                            const unlocked = (player!.regionProgress[selectedRegion.id] || 0) >= idx;
                            return (
                                <div key={lvl.id} style={{padding:'15px', border:`1px solid ${unlocked?(lvl.isBoss?'#ff0055':'#00ff66'):'#333'}`, borderRadius:'10px', background:unlocked?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.5)', display:'flex', justifyContent:'space-between', alignItems:'center', opacity:unlocked?1:0.5}}>
                                    <div style={{textAlign:'left'}}><div style={{fontWeight:'bold', fontSize:'18px'}}>{lvl.t}</div><div style={{fontSize:'12px', color:'#aaa'}}>{lvl.diff}</div></div>
                                    {unlocked ? <button style={{...styles.btn, background:lvl.isBoss?'#ff0055':'#00ff66', color:'black'}} onClick={()=>startBattle(selectedRegion, lvl)}>GİR</button> : <span>🔒</span>}
                                </div>
                            )
                        })}
                    </div>
                    <button style={{...styles.btn, background:'#ff0055', marginTop:'20px', width:'100%'}} onClick={()=>setShowRegionModal(false)}>KAPAT</button>
                </div>
            </div>
        )}
      </div>
    </>
  );
}