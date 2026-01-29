'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, update, query, orderByChild, limitToLast, get, push, set, onValue, remove } from "firebase/database";

// --- AYARLAR ---
const BASE_WIDTH = 1200;

// --- TASARIM (PC İÇİN YATAY - MOBİL İÇİN DİKEY) ---
const containerStyle = {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'radial-gradient(circle, #1a1a20 0%, #000000 100%)',
    color: 'white',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    overflow: 'hidden'
};

const btnStyle = {
    padding: '12px 24px',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'linear-gradient(145deg, #333, #222)',
    color: 'white',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
    margin: '5px'
};

const actionBtnStyle = {
    ...btnStyle,
    background: 'linear-gradient(145deg, #00eaff, #008c99)',
    color: 'black',
    border: 'none',
    boxShadow: '0 0 20px rgba(0, 234, 255, 0.4)',
    fontSize: '20px',
    padding: '15px 40px'
};

const dangerBtnStyle = { ...btnStyle, background: 'linear-gradient(145deg, #ff0055, #990033)', boxShadow: '0 0 10px rgba(255, 0, 85, 0.3)' };
const successBtnStyle = { ...btnStyle, background: 'linear-gradient(145deg, #00ff66, #00993d)', color: 'black', boxShadow: '0 0 10px rgba(0, 255, 102, 0.3)' };

const cardStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    minHeight: '220px',
    justifyContent: 'space-between'
};

const statsBoxStyle = {
    background: 'rgba(0, 0, 0, 0.6)',
    border: '1px solid #333',
    borderRadius: '15px',
    padding: '20px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginTop: '20px'
};

const NotificationComponent = () => null;

// --- VERİ TİPLERİ ---
type Item = { id: string; name: string; type: 'wep' | 'arm' | 'acc' | 'joker'; val: number; cost: number; icon: string; jokerId?: string; uid?: number };
type Costume = { id: string; name: string; icon: string };
type Question = { q: string; o: string[]; a: number };
type Level = { id: string; t: string; hp: number; en: string; ico: string; diff: string; isBoss?: boolean };
type Region = { id: string; name: string; desc: string; x: number; y: number; type: 'iletisim' | 'hikaye' | 'siir' | 'all'; bg?: string; unlockC: string; levels: Level[] };
type Player = {
    name: string; pass: string; hp: number; maxHp: number; gold: number; xp: number; maxXp: number; lvl: number; baseAtk: number;
    inventory: Item[]; equipped: { wep: Item | null; arm: Item | null; acc: Item | null };
    jokers: { [key: string]: number }; mistakes: { q: string; a: string }[]; score: number;
    unlockedRegions: string[]; regionProgress: { [key: string]: number };
    unlockedCostumes: string[]; currentCostume: string; tutorialSeen: boolean;
};

// --- DATABASE ---
const itemDB: { [key: string]: Item } = {
    'w1': { id: 'w1', name: 'Paslı Kalem', type: 'wep', val: 10, cost: 50, icon: '✏️' },
    'w2': { id: 'w2', name: 'Divit Uç', type: 'wep', val: 25, cost: 150, icon: '✒️' },
    'w3': { id: 'w3', name: 'Altın Dolma', type: 'wep', val: 50, cost: 500, icon: '🖊️' },
    'w4': { id: 'w4', name: 'Efsanevi Kılıç', type: 'wep', val: 120, cost: 2500, icon: '🗡️' },
    'a1': { id: 'a1', name: 'Eski Defter', type: 'arm', val: 50, cost: 50, icon: '📓' },
    'a2': { id: 'a2', name: 'Deri Cilt', type: 'arm', val: 150, cost: 200, icon: '📕' },
    'a3': { id: 'a3', name: 'Ansiklopedi', type: 'arm', val: 300, cost: 800, icon: '📚' },
    'a4': { id: 'a4', name: 'Titanyum Zırh', type: 'arm', val: 600, cost: 3000, icon: '🛡️' },
    'ac1': { id: 'ac1', name: 'Okuma Gözlüğü', type: 'acc', val: 10, cost: 100, icon: '👓' },
    'ac2': { id: 'ac2', name: 'Bilge Şapkası', type: 'acc', val: 30, cost: 600, icon: '🎓' },
    'j1': { id: 'j1', name: '%50 Joker', type: 'joker', val: 0, cost: 50, icon: '½', jokerId: '5050' },
    'j2': { id: 'j2', name: 'Can İksiri', type: 'joker', val: 0, cost: 75, icon: '🧪', jokerId: 'heal' },
    'j3': { id: 'j3', name: 'Pas Geç', type: 'joker', val: 0, cost: 100, icon: '⏩', jokerId: 'skip' },
    'j4': { id: 'j4', name: 'Ek Süre', type: 'joker', val: 0, cost: 60, icon: '⏳', jokerId: 'time' },
};

const costumeDB: { [key: string]: Costume } = {
    'default': { id: 'default', name: 'Öğrenci', icon: '🧑‍🎓' },
    'prince': { id: 'prince', name: 'Şair Prens', icon: '🤴' },
    'divan': { id: 'divan', name: 'Divan Şairi', icon: '👳' },
    'halk': { id: 'halk', name: 'Halk Ozanı', icon: '🎸' },
    'modern': { id: 'modern', name: 'Modern Yazar', icon: '🕴️' },
    'king': { id: 'king', name: 'Edebiyat Kralı', icon: '👑' },
};

const regions: Region[] = [
    // --- BURASI DÜZELTİLDİ: Eğitim kampının sonuna "isBoss: true" eklendi ki kilit açılsın ---
    { id: 'tut', name: 'Başlangıç Kampı', desc: 'Eğitim', x: 15, y: 80, type: 'iletisim', unlockC: 'default', levels: [{ id: 'l1', t: 'İlk Adım', hp: 50, en: 'Çırak', ico: '👶', diff: 'Kolay' }, { id: 'l2', t: 'Kelime Savaşı', hp: 80, en: 'Kalfa', ico: '👦', diff: 'Orta', isBoss: true }] },
    
    { id: 'r1', name: 'İletişim Vadisi', desc: 'Sözcükler', x: 35, y: 65, type: 'iletisim', unlockC: 'prince', levels: [{ id: 'l3', t: 'Sözlü Atışma', hp: 120, en: 'Hatip', ico: '🗣️', diff: 'Kolay' }, { id: 'l4', t: 'Kod Çözme', hp: 150, en: 'Şifreci', ico: '🧩', diff: 'Orta' }, { id: 'b1', t: 'Büyük İletişimci', hp: 300, en: 'İletişim Uzmanı', ico: '📡', diff: 'Zor', isBoss: true }] },
    { id: 'r2', name: 'Hikaye Ormanı', desc: 'Olaylar', x: 55, y: 50, type: 'hikaye', unlockC: 'halk', levels: [{ id: 'l5', t: 'Olay Örgüsü', hp: 200, en: 'Kurgucu', ico: '📝', diff: 'Orta' }, { id: 'l6', t: 'Karakter Analizi', hp: 250, en: 'Eleştirmen', ico: '🧐', diff: 'Zor' }, { id: 'b2', t: 'Hikaye Anlatıcısı', hp: 500, en: 'Dede Korkut', ico: '👴', diff: 'Boss', isBoss: true }] },
    { id: 'r3', name: 'Şiir Dağı', desc: 'Duygular', x: 75, y: 35, type: 'siir', unlockC: 'divan', levels: [{ id: 'l7', t: 'Kafiye Bulmaca', hp: 350, en: 'Şair', ico: '✍️', diff: 'Zor' }, { id: 'l8', t: 'Aruz Vezni', hp: 400, en: 'Üstad', ico: '📜', diff: 'Çok Zor' }, { id: 'b3', t: 'Şairler Sultanı', hp: 700, en: 'Baki', ico: '👳', diff: 'Boss', isBoss: true }] },
    { id: 'r4', name: 'Efsaneler Arenası', desc: 'Son Durak', x: 85, y: 15, type: 'all', unlockC: 'king', levels: [{ id: 'l9', t: 'Karışık Soru', hp: 600, en: 'Bilge', ico: '🧙', diff: 'Zor' }, { id: 'b4', t: 'Cehalet Kalesi', hp: 1000, en: 'Cehalet Canavarı', ico: '🐲', diff: 'Final Boss', isBoss: true }] },
];

const expandedQPool = {
    iletisim: [
        { q: "İletişim şemasında 'gönderici'nin diğer adı nedir?", o: ["Kanal", "Kaynak", "Alıcı", "Dönüt"], a: 1 },
        { q: "Hangisi sözlü iletişim türüdür?", o: ["Mektup", "Panel", "Dilekçe", "Günlük"], a: 1 },
        { q: "İletişimin başlatıcısı kimdir?", o: ["Alıcı", "Kanal", "Gönderici", "Kod"], a: 2 },
    ],
    hikaye: [
        { q: "Hangisi olay hikayesinin temsilcisidir?", o: ["Sait Faik", "Ömer Seyfettin", "Memduh Şevket", "Nurullah Ataç"], a: 1 },
        { q: "Durum hikayesinin Türk edebiyatındaki öncüsü kimdir?", o: ["Ömer Seyfettin", "Sait Faik", "Namık Kemal", "Ziya Paşa"], a: 1 },
        { q: "Dünya edebiyatında hikaye türünün ilk örneği?", o: ["Decameron", "Don Kişot", "Sefiller", "Suç ve Ceza"], a: 0 },
    ],
    siir: [
        { q: "Divan edebiyatında şairlerin şiirlerini topladıkları esere ne denir?", o: ["Cönk", "Divan", "Hamse", "Tezkire"], a: 1 },
        { q: "İstiklal Marşı hangi vezinle yazılmıştır?", o: ["Hece", "Aruz", "Serbest", "Syllabic"], a: 1 },
        { q: "Koşuk ve Sagu hangi döneme aittir?", o: ["İslamiyet Öncesi", "Divan", "Halk", "Tanzimat"], a: 0 },
    ],
    all: [] as Question[]
};
expandedQPool.all = [...expandedQPool.iletisim, ...expandedQPool.hikaye, ...expandedQPool.siir];

const libraryDB = [
    { t: "İletişim", c: "Duygu, düşünce ve bilgilerin akla gelebilecek her türlü yolla başkalarına aktarılmasına iletişim denir. Ögeleri: Gönderici, Alıcı, İleti, Kanal, Dönüt, Bağlam." },
    { t: "Hikaye (Öykü)", c: "Yaşanmış ya da yaşanabilir olayların anlatıldığı kısa yazılardır. Olay (Maupassant) ve Durum (Çehov) olmak üzere ikiye ayrılır." },
    { t: "Şiir Bilgisi", c: "Duyguların, hayallerin ahenkli bir dille anlatılmasıdır. Ölçü, kafiye, redif ve nazım birimi şiirin ahenk unsurlarıdır." },
];

const calcStats = (p: Player | null) => {
    if (!p) return { atk: 0, maxHp: 100 };
    let atk = p.baseAtk + (p.lvl * 5);
    let hpBonus = (p.lvl * 25);
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
  const [scale, setScale] = useState(1);
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
    if (isMuted) return;
    if (typeof window !== 'undefined') {
        const urls = {
            'click': 'https://cdn.pixabay.com/audio/2022/03/24/audio_78c2cb5739.mp3',
            'correct': 'https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3',
            'wrong': 'https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3',
            'win': 'https://cdn.pixabay.com/audio/2021/08/09/audio_88447e769f.mp3'
        };
        try {
            const audio = new Audio(urls[type]);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
    }
  };

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
      setNotification({ msg, type });
      setTimeout(() => setNotification(null), 3000);
  };

  const toggleFullScreen = (enable: boolean) => {
    playSound('click');
    if (!document) return;
    if (enable) { document.documentElement.requestFullscreen().catch(() => {}); } 
    else { if (document.fullscreenElement) document.exitFullscreen(); }
  };

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      if (device === 'mobile') { setScale(1); return; }
      const scaleX = (window.innerWidth / BASE_WIDTH) * 0.95;
      const scaleY = (window.innerHeight / BASE_HEIGHT) * 0.95;
      setScale(Math.min(scaleX, scaleY, 1));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [device]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === 'battle' && battle.active && battle.timer > 0 && !battle.isTransitioning) {
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
  }, [screen, battle.active, battle.timer, turn, playerSide, roomID, battle.isTransitioning]);

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

  useEffect(() => {
      if (player) {
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
          });
      }
  }, [player?.score, screen]); 

  const handleBotMove = (move: 'correct' | 'wrong') => {
      if (!battle.active) return;
      
      const myDmg = calcStats(player!).atk;
      const botStats = botDifficulty;
      let nb = { ...battle };
      let pDmg = 0;

      const botDmg = 30 + (botStats.itemLvl * 10);
      const hit = move === 'correct';

      if (hit) {
          pDmg = botDmg;
          notify(`${botStats.name} Doğru Bildi! -${botDmg} Can`, 'error');
      } else {
          notify(`${botStats.name} Bilemedi!`, 'success');
      }

      const np = {...player!};
      np.hp -= pDmg;
      setPlayer(np);

      if (np.hp <= 0) {
          np.hp = calcStats(np).maxHp; saveGame(np);
          setBattle({...nb, active:false}); notify("KAYBETTİN...", "error"); setScreen('menu'); return;
      }

      setTurn('p1');
      setBattle({...nb, timer: 20});
  };

  const handleAuth = () => {
    playSound('click');
    if (!authName || !authPass) return notify("Boş alan bırakma!", "error");
    const key = `edb_final_v25_${authName}`;
    
    if (authName === "admin" && authPass === "1234") {
        const admin: Player = { name: "ADMIN", pass: "1234", hp: 9999, maxHp: 9999, gold: 99999, xp: 0, maxXp: 100, lvl: 99, baseAtk: 999, inventory: [], equipped: {wep:null,arm:null,acc:null}, jokers: {'5050':99,'heal':99,'skip':99,'time':99}, mistakes: [], score: 9999, unlockedRegions: ['tut','r1','r2','r3','r4'], regionProgress: {'tut':2,'r1':4,'r2':4,'r3':4,'r4':3}, unlockedCostumes: Object.keys(costumeDB), currentCostume: 'default', tutorialSeen: true };
        setPlayer(admin); update(ref(db, 'users/' + authName), { name: authName, score: 9999 }); setScreen('menu'); return;
    }

    if (isRegister) {
      if (localStorage.getItem(key)) return notify("Bu isim dolu!", "error");
      const newP: Player = { name: authName, pass: authPass, hp: 100, maxHp: 100, gold: 0, xp: 0, maxXp: 100, lvl: 1, baseAtk: 20, inventory: [], equipped: {wep:null,arm:null,acc:null}, jokers: {'5050':1,'heal':1,'skip':1,'time':1}, mistakes: [], score: 0, unlockedRegions: ['tut'], regionProgress: {'tut': 0}, unlockedCostumes: ['default'], currentCostume: 'default', tutorialSeen: false };
      localStorage.setItem(key, JSON.stringify(newP));
      update(ref(db, 'users/' + authName), { name: authName, score: 0 });
      setIsRegister(false); notify("Kayıt Başarılı!", "success");
    } else {
      const d = localStorage.getItem(key);
      if (!d) return notify("Kayıt bulunamadı!", "error");
      const p = JSON.parse(d);
      if (p.pass !== authPass) return notify("Şifre yanlış!", "error");
      if(!p.unlockedRegions) p.unlockedRegions = ['tut'];
      update(ref(db, 'users/' + authName), { name: authName, score: p.score });
      setPlayer(p); setScreen('menu'); if(!p.tutorialSeen) setShowTutorial(true);
    }
  };

  const saveGame = (p: Player) => {
    if(p.name !== "ADMIN") {
        localStorage.setItem(`edb_final_v25_${p.name}`, JSON.stringify(p));
        update(ref(db, 'users/' + p.name), { score: p.score });
    }
    setPlayer({...p});
  };

  const findMatch = async () => {
      if (!player) return;
      playSound('click');
      setArenaSearching(true);
      const botTimeout = setTimeout(() => {
          setArenaSearching(false);
          startBotMatch();
      }, 5000);
  };

  const startBotMatch = () => {
      if(!player) return;
      setIsBotMatch(true);
      setPlayerSide('p1'); 
      setTurn('p1');

      const botStats = { speed: 3000, acc: 0.5, name: 'Acemi Bot', itemLvl: 0 };
      setBotDifficulty(botStats);
      const myStats = calcStats(player);
      setBattle({
          active: true, isArena: true,
          region: { id:'arena', name:'Online Arena', desc:'', x:0, y:0, type:'all', bg:'/arena_bg.png', levels:[] },
          level: { id:'bot', t:'Bot Savaşı', hp: myStats.maxHp, en: botStats.name + ` (Eşya: +${botStats.itemLvl})`, ico:'🤖', diff:'PvE', isBoss:true },
          qs: shuffleQuestions([...expandedQPool.all]).slice(0, 10),
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
        setTimeout(() => { processAnswer(correct); }, 1000); 
    } else {
        processAnswer(correct);
    }
  };

  const processAnswer = (correct: boolean) => {
      let nb = { ...battle, isTransitioning: false };
      
      if (nb.isArena && isBotMatch) {
          const myDmg = calcStats(player!).atk;
          const botStats = botDifficulty;
          if (correct) {
              nb.enemyHp -= myDmg;
              nb.dmgText = { val: myDmg, color: '#00ff66', id: Date.now() };
          } else {
              nb.shaking = true;
          }
          
          if (nb.enemyHp <= 0) {
              playSound('win');
              const np = {...player!}; np.score += 50; np.gold += 50; np.hp = calcStats(np).maxHp; saveGame(np);
              setBattle({...nb, active:false}); notify("BOTU YENDİN! +50 SKOR", "success"); setScreen('menu'); return;
          }

          setTurn('p2');
          nb.qIndex++; 
          if(nb.qIndex >= nb.qs.length) nb.qIndex = 0;
          nb.timer = 20; 
          setBattle(nb);
          return;
      }

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
        
        // --- BÖLÜM GEÇME MANTIĞI ---
        if (nb.region && nb.level) {
            const currentProgress = np.regionProgress[nb.region.id] || 0;
            const levelIndex = nb.region.levels.findIndex(l => l.id === nb.level!.id);
            
            if(levelIndex === currentProgress) {
                np.regionProgress[nb.region.id] = currentProgress + 1;
            }

            if(nb.level.isBoss) {
                if(nb.region.unlockC && !np.unlockedCostumes.includes(nb.region.unlockC)) {
                    np.unlockedCostumes.push(nb.region.unlockC);
                    notify(`KOSTÜM KAZANDIN: ${costumeDB[nb.region.unlockC].name}`, "success");
                }
                const rIdx = regions.findIndex(r => r.id === nb.region!.id);
                if(rIdx < regions.length - 1) {
                    const nextR = regions[rIdx + 1].id;
                    if(!np.unlockedRegions.includes(nextR)) {
                        np.unlockedRegions.push(nextR);
                        np.regionProgress[nextR] = 0;
                        notify("YENİ BÖLGE AÇILDI!", "success");
                    }
                }
            }
        }
        
        saveGame(np); setBattle({...nb, active:false}); notify("ZAFER! +100 ALTIN", "success"); setScreen('map'); return;
      }

      if (np.hp <= 0) { np.hp = 20; saveGame(np); setBattle({...nb, active:false}); notify("KAYBETTİN!", "error"); setScreen('menu'); return; }
      if (!correct || nb.enemyHp > 0) { nb.qIndex++; nb.timer=20; nb.fiftyUsed=false; }
      if (nb.qIndex >= nb.qs.length) {
          nb.qs = shuffleQuestions(nb.qs);
          nb.qIndex = 0;
      }
      setBattle(nb); saveGame(np);
  };

  const buyItem = (id:string) => { playSound('click'); const it=itemDB[id]; if(player!.gold>=it.cost){let np={...player!}; np.gold-=it.cost; if(it.type==='joker') np.jokers[it.jokerId!]=(np.jokers[it.jokerId!]||0)+1; else np.inventory.push({...it, uid:Date.now()}); saveGame(np); notify("Satın Alındı!", "success");}else notify("Para Yetersiz!", "error"); };
  const equipItem = (idx:number) => { playSound('click'); if(!player) return; const np={...player}; const it=np.inventory[idx]; if (it.type === 'joker') return notify("Jokerler kuşanılamaz!", "error"); const type = it.type as 'wep' | 'arm' | 'acc'; if(np.equipped[type]) np.inventory.push(np.equipped[type]!); np.equipped[type]=it; np.inventory.splice(idx,1); saveGame(np); notify("Kuşanıldı", "success"); };
  const unequipItem = (type: 'wep' | 'arm' | 'acc') => { playSound('click'); if(!player || !player.equipped[type]) return; const np = { ...player }; np.inventory.push(np.equipped[type]!); np.equipped[type] = null; saveGame(np); notify("Çıkarıldı", "success"); };
  
  const useJoker = (type: string) => { 
      playSound('click'); 
      if(!player || !battle.active) return; 
      if((player.jokers[type]||0)<=0) return notify("Jokerin Kalmadı!", "error");
      
      let np = {...player}; 
      np.jokers[type]--; 
      
      if(type==='heal') {
          np.hp = Math.min(np.hp+50, calcStats(np).maxHp);
          notify("Can Yenilendi! (+50)", "success");
      }
      if(type==='skip') { 
          setBattle(prev=>({...prev, enemyHp:0})); 
          setTimeout(()=>handleAnswer(true), 100); 
          notify("Bölüm Geçildi!", "success");
      } 
      if(type==='time') {
          setBattle(prev=>({...prev, timer:prev.timer+20})); 
          notify("Ek Süre Eklendi!", "success");
      }
      if(type==='5050') {
          setBattle(prev=>({...prev, fiftyUsed:true})); 
          notify("%50 Kullanıldı!", "success");
      }
      
      saveGame(np); 
  };

  const sellItem = (idx:number) => { playSound('click'); if(!player)return; const np={...player}; np.gold+=np.inventory[idx].cost/2; np.inventory.splice(idx,1); saveGame(np); notify("Satıldı", "success"); };

  const isArenaUnlocked = () => {
      const finalRegion = regions.find(r => r.id === 'r4');
      if(!player || !finalRegion) return false;
      return (player.regionProgress['r4'] || 0) >= finalRegion.levels.length;
  };

  const handleRegionClick = (r: Region) => {
      playSound('click');
      if (!player!.unlockedRegions.includes(r.id)) return notify("Önceki bölgeleri tamamla!", "error");
      setSelectedRegion(r);
      setShowRegionModal(true);
  };

  const startBattle = (r: Region, l: Level) => {
    playSound('click');
    setShowRegionModal(false);
    let rawQs = r.type === 'all' ? [...expandedQPool.all] : [...(expandedQPool[r.type] || [])];
    rawQs = [...rawQs, ...rawQs]; 
    rawQs.sort(() => Math.random() - 0.5);
    const shuffledQs = shuffleQuestions(rawQs);
    setBattle({
      active: true, region: r, level: l, qs: shuffledQs, qIndex: 0,
      enemyHp: l.hp, maxEnemyHp: l.hp, timer: 20, combo: 0,
      shaking: false, fiftyUsed: false, dmgText: null, isArena: false, isTransitioning: false
    });
    setScreen('battle');
  };

  if (!device) {
      return (
          <div style={{position:'fixed', inset:0, background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'30px', zIndex:99999}}>
              <h1 style={{fontSize:'40px', color:'#00eaff', textAlign:'center'}}>CİHAZINI SEÇ</h1>
              <div style={{display:'flex', gap:'30px', flexDirection: 'column'}}>
                  <button onClick={() => { setDevice('mobile'); toggleFullScreen(true); }} style={{...actionBtnStyle, background:'#ffcc00', padding:'30px 60px', fontSize:'30px'}}>📱 TELEFON</button>
                  <button onClick={() => setDevice('pc')} style={{...actionBtnStyle, padding:'30px 60px', fontSize:'30px'}}>💻 BİLGİSAYAR</button>
              </div>
          </div>
      )
  }

  if (screen === 'auth') {
    return (
      <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999}}>
        <NotificationComponent />
        <div style={{...cardStyle, width: device==='mobile' ? '90%' : '450px', maxWidth: '450px'}}>
          <h1 style={{fontSize: device==='mobile'?'35px':'50px', color:'#00eaff', margin:0, textShadow:'0 0 10px #00eaff'}}>EDEBİYAT<br/>EFSANELERİ V5</h1>
          <input style={{padding:'15px', borderRadius:'10px', border:'none', background:'rgba(255,255,255,0.1)', color:'white', width:'100%'}} placeholder="Kullanıcı Adı" value={authName} onChange={e=>setAuthName(e.target.value)} />
          <input style={{padding:'15px', borderRadius:'10px', border:'none', background:'rgba(255,255,255,0.1)', color:'white', width:'100%'}} type="password" placeholder="Şifre" value={authPass} onChange={e=>setAuthPass(e.target.value)} />
          <button style={{...successBtnStyle, width:'100%'}} onClick={handleAuth}>{isRegister ? 'KAYIT OL' : 'GİRİŞ YAP'}</button>
          <p style={{color:'#aaa', cursor:'pointer', fontSize:'18px', textDecoration:'underline'}} onClick={()=>setIsRegister(!isRegister)}>{isRegister ? 'Giriş Yap' : 'Yeni Hesap Oluştur'}</p>
        </div>
      </div>
    );
  }

  if(!mounted) return <div style={{color:'white', fontSize:'30px', background:'black', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Yükleniyor...</div>;

  return (
    <>
      <NotificationComponent />
      
      <div style={{position:'fixed', top:'10px', left:'10px', zIndex:99999, background:'rgba(0,0,0,0.5)', borderRadius:'50%', padding:'10px', cursor:'pointer'}} onClick={()=>setIsMuted(!isMuted)}>
          <span style={{fontSize:'30px'}}>{isMuted ? '🔇' : '🔊'}</span>
      </div>

      {showTutorial && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{width: device==='mobile'?'95%':'800px', background:'#111', border:'4px solid #ffcc00', padding:'30px', borderRadius:'30px', textAlign:'center', color:'white'}}><h1 style={{fontSize:'40px', color:'#ffcc00'}}>HOŞGELDİN MACERACI!</h1><button style={{...successBtnStyle, width:'100%'}} onClick={()=>{setShowTutorial(false); const np={...player!, tutorialSeen:true}; saveGame(np);}}>BAŞLA</button></div></div>)}
      {showLevelUp && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{background:'#111', border:'5px solid #00ff66', padding:'50px', borderRadius:'30px', textAlign:'center', color:'white'}}><h1 style={{fontSize:'60px', color:'#00ff66', margin:0}}>SEVİYE ATLADIN!</h1><button style={{...actionBtnStyle, marginTop:'30px'}} onClick={()=>setShowLevelUp(false)}>DEVAM ET</button></div></div>)}
      {showWardrobe && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{width: device==='mobile'?'95%':'800px', height:'700px', background:'#111', border:'4px solid #ffcc00', padding:'30px', borderRadius:'30px', display:'flex', flexDirection:'column', color:'white'}}><h1 style={{fontSize:'40px', color:'#ffcc00', textAlign:'center', margin:0}}>DOLAP</h1><div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr 1fr':'1fr 1fr 1fr', gap:'20px', overflowY:'auto', flex:1, padding:'20px'}}>{Object.keys(costumeDB).map(k=>(<div key={k} style={{border:'2px solid #444', padding:'20px', borderRadius:'20px', textAlign:'center', background:player!.currentCostume===k?'#222':'transparent', color:'white'}}><div style={{fontSize:'60px'}}>{costumeDB[k].icon}</div><h3>{costumeDB[k].name}</h3>{player!.unlockedCostumes.includes(k)?<button style={{...btnStyle, background:player!.currentCostume===k?'#00ff66':'#00eaff', color:'black', justifyContent:'center', width:'100%'}} onClick={()=>{saveGame({...player!, currentCostume:k}); setShowWardrobe(false)}}>GİY</button>:<div style={{color:'red', fontWeight:'bold'}}>KİLİTLİ</div>}</div>))}</div><button style={{...dangerBtnStyle, fontSize:'20px', padding:'15px'}} onClick={()=>setShowWardrobe(false)}>KAPAT</button></div></div>)}
      
      {confirmAction && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <div style={{background:'#111', border:'4px solid #ff0055', padding:'30px', borderRadius:'30px', textAlign:'center', color:'white', maxWidth:'500px', width:'90%'}}>
                  <h2 style={{fontSize:'30px', color:'#ff0055', marginBottom:'20px'}}>EMİN MİSİN?</h2>
                  <div style={{display:'flex', gap:'20px', justifyContent:'center'}}>
                      <button style={{...btnStyle, background:'#ff0055', color:'white', border:'none', fontSize:'20px'}} onClick={async()=>{
                          if(confirmAction==='surrender') {
                              if(battle.isArena && roomID) { await update(ref(db, `arena_rooms/${roomID}`), { gameOver:true, winner: playerSide==='p1'?'p2':'p1' }); }
                              const np={...player!}; np.hp=calcStats(np).maxHp; saveGame(np); setBattle(prev=>({...prev, active:false})); setScreen('menu'); notify("Teslim Oldun!", "error");
                          } else {
                              window.location.reload();
                          }
                          setConfirmAction(null);
                      }}>EVET</button>
                      <button style={{...btnStyle, background:'#00ff66', color:'black', border:'none', fontSize:'20px'}} onClick={()=>setConfirmAction(null)}>HAYIR</button>
                  </div>
              </div>
          </div>
      )}

      {showRegionModal && selectedRegion && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <div style={{width: device==='mobile'?'95%':'700px', background:'#111', border:'4px solid #00eaff', padding:'30px', borderRadius:'30px', color:'white', textAlign:'center'}}>
                  <h2 style={{fontSize:'40px', color:'#00eaff'}}>{selectedRegion.name}</h2>
                  <div style={{display:'flex', flexDirection:'column', gap:'15px', maxHeight:'400px', overflowY:'auto'}}>
                      {selectedRegion.levels.map((lvl, idx) => {
                          const unlocked = (player!.regionProgress[selectedRegion.id] || 0) >= idx;
                          return (
                              <div key={lvl.id} style={{padding:'20px', border:'2px solid', borderColor: unlocked?(lvl.isBoss?'#ff0055':'#00ff66'):'#333', borderRadius:'15px', background:unlocked?'#222':'#111', display:'flex', alignItems:'center', justifyContent:'space-between', opacity:unlocked?1:0.5}}>
                                  <div>{lvl.t} - {lvl.diff}</div>
                                  {unlocked ? <button style={{...btnStyle, background:lvl.isBoss?'#ff0055':'#00eaff', color:'white'}} onClick={()=>startBattle(selectedRegion, lvl)}>SAVAŞ</button> : <div>🔒</div>}
                              </div>
                          )
                      })}
                  </div>
                  <button style={{...dangerBtnStyle, fontSize:'20px', marginTop:'30px'}} onClick={()=>setShowRegionModal(false)}>KAPAT</button>
              </div>
          </div>
      )}

      <div style={containerStyle}>
        <div style={{height: device==='mobile'?'60px':'90px', background:'rgba(255,255,255,0.05)', borderBottom:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px'}}>
            <div style={{fontSize: device==='mobile'?'16px':'24px', fontWeight:'bold', display:'flex', gap: device==='mobile'?'10px':'30px'}}><span style={{color:'#ffcc00'}}>⚡ {player?.lvl}</span><span style={{color:'#00ff66'}}>❤️ {player?.hp}/{pStats.maxHp}</span><span style={{color:'#00eaff'}}>💰 {player?.gold}</span></div>
            <button style={{...dangerBtnStyle, fontSize: device==='mobile'?'12px':'20px', padding: device==='mobile'?'5px 15px':'10px 30px'}} onClick={()=>setConfirmAction('logout')}>ÇIKIŞ</button>
        </div>

        <div style={{flex:1, position:'relative', overflow: device==='mobile'?'auto':'hidden', padding: screen === 'map' ? 0 : (device==='mobile'?'10px':'40px')}}>
            {screen === 'menu' && (
                <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100%', flexDirection: device === 'mobile' ? 'column' : 'row', gap: device === 'mobile' ? '20px' : '50px'}}>
                    
                    {/* SOL TARA: KARAKTER & İSTATİSTİK (PC ODAKLI YATAY DÜZEN) */}
                    <div style={{...cardStyle, width: device==='mobile'?'90%':'400px', border:'2px solid #00eaff'}}>
                         <div style={{textAlign:'center'}}>
                            <div style={{fontSize: device==='mobile'?'80px':'120px', cursor:'pointer'}} onClick={()=>setShowWardrobe(true)}>{costumeDB[player!.currentCostume].icon}</div>
                            <h2 style={{fontSize: device==='mobile'?'25px':'30px', color:'#00eaff', margin:'10px 0'}}>{player?.name}</h2>
                            <div style={{color:'#aaa', fontWeight:'bold', fontSize:'18px'}}>Dünya Sıralaması: #{userRank ? userRank : '-'}</div>
                         </div>
                         <div style={statsBoxStyle}>
                             <div style={{display:'flex', justifyContent:'space-between', fontSize:'18px'}}><span>⚔️ Saldırı:</span> <span style={{color:'#ff0055', fontWeight:'bold'}}>{pStats.atk}</span></div>
                             <div style={{display:'flex', justifyContent:'space-between', fontSize:'18px'}}><span>❤️ Can:</span> <span style={{color:'#00ff66', fontWeight:'bold'}}>{pStats.maxHp}</span></div>
                             <div style={{display:'flex', justifyContent:'space-between', fontSize:'18px'}}><span>🏆 Skor:</span> <span style={{color:'#ffcc00', fontWeight:'bold'}}>{player?.score}</span></div>
                         </div>
                    </div>

                    {/* SAĞ TARAF: BUTONLAR (GENİŞ) */}
                    <div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr 1fr':'repeat(2, 1fr)', gap:'20px', width: device==='mobile'?'90%':'600px'}}>
                        {[{id:'map',t:'MACERA',i:'🗺️'}, {id:'arena',t:'ARENA',i:'⚔️',check:true}, {id:'shop',t:'MARKET',i:'🛒'}, {id:'inv',t:'ÇANTA',i:'🎒'}, {id:'lib',t:'BİLGİ',i:'📚'}, {id:'mistake',t:'HATA',i:'📜'}].map(m => (
                            <div key={m.id} onClick={()=>{ playSound('click'); if(m.check && !isArenaUnlocked()) return notify("Arena için Son Boss'u (Cehalet Kalesi) yenmelisin!", "error"); if(m.id==='arena') fetchLeaderboard(); setScreen(m.id as any); }} style={{...btnStyle, flexDirection:'column', height:'160px', background: 'rgba(255,255,255,0.05)', opacity: (m.check && !isArenaUnlocked()) ? 0.3 : 1, fontSize:'20px'}}>
                                <div style={{fontSize:'50px'}}>{(m.check && !isArenaUnlocked()) ? '🔒' : m.i}</div>
                                <div style={{marginTop:'10px'}}>{m.t}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {screen === 'map' && (<div style={{height:'100%', width: '100%', position:'relative', background:'url(https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000) center/cover', overflow:'hidden', boxShadow:'inset 0 0 100px black'}}><button style={{...dangerBtnStyle, position:'absolute', top:'20px', right:'20px', zIndex:10}} onClick={()=>setScreen('menu')}>GERİ</button><svg style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}>{regions.map((r, i) => {if (i === regions.length - 1) return null;const next = regions[i+1];const unlocked = player!.unlockedRegions.includes(next.id);return <line key={i} x1={`${r.x}%`} y1={`${r.y}%`} x2={`${next.x}%`} y2={`${next.y}%`} stroke={unlocked?'#333':'#888'} strokeWidth="4" strokeDasharray="10" />})}</svg>{regions.map((r) => {const unlocked = player!.unlockedRegions.includes(r.id);return (<div key={r.id} onClick={()=>handleRegionClick(r)} style={{position:'absolute', left:`${r.x}%`, top:`${r.y}%`, transform:'translate(-50%, -50%)', cursor: unlocked ? 'pointer' : 'not-allowed', textAlign:'center', zIndex:5, opacity: unlocked ? 1 : 0.6, filter: unlocked ? 'none' : 'grayscale(100%)'}}><div style={{fontSize: device==='mobile'?'40px':'50px', background: unlocked ? '#f4e4bc' : '#555', width: device==='mobile'?'70px':'90px', height: device==='mobile'?'70px':'90px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', border:'4px solid #5c4033', boxShadow: unlocked ? '0 0 20px #8b4513' : 'none', transition:'0.3s', animation: unlocked ? 'pop 2s infinite alternate' : 'none', color:'black'}}>{unlocked ? (r.type==='iletisim'?'📡':r.type==='hikaye'?'🌲':r.type==='siir'?'🎭':r.id==='tut'?'🎓':'🐲') : '🔒'}</div><div style={{background:'rgba(255,255,255,0.9)', padding:'5px 15px', borderRadius:'10px', marginTop:'10px', color:'black', fontWeight:'bold', border:'1px solid #5c4033', whiteSpace:'nowrap', fontSize: device==='mobile'?'12px':'16px'}}>{r.name}</div></div>)})})</div>)}

            {screen === 'battle' && (battle.region || battle.isArena) && (
                <div style={{height:'100%', display:'flex', flexDirection:'column', background:`linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(${battle.isArena ? (battle.region?.bg || "https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=1000") : (battle.region?.bg || battle.level?.ico)}) center/cover`}}>
                    <div style={{flex: 1, display: 'flex', justifyContent: 'space-between', padding: '20px', alignItems: 'flex-start'}}>
                         <button style={{...dangerBtnStyle, padding:'10px 20px', fontSize:'14px'}} onClick={() => setConfirmAction('surrender')}>{battle.isArena ? '🏳️ TESLİM' : '❌ ÇIK'}</button>
                         {/* SÜRE ÇUBUĞU */}
                         <div style={{width:'50%', height:'20px', background:'#333', borderRadius:'10px', overflow:'hidden', border:'2px solid white'}}>
                            <div style={{width:`${(battle.timer/20)*100}%`, height:'100%', background: battle.timer<5?'red':'#00eaff', transition:'1s linear'}}></div>
                         </div>
                    </div>

                    {/* SAVAŞ ALANI (FERAHLATILMIŞ) */}
                    <div style={{flex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-around'}}>
                         {/* RAKİP */}
                         <div style={{textAlign:'center', animation: battle.shaking ? 'shake 0.3s' : ''}}>
                            <div style={{fontSize: device==='mobile'?'80px':'120px'}}>{battle.isArena ? '🤺' : battle.level?.ico}</div>
                            <div style={{background:'red', height:'10px', width:'100px', margin:'0 auto', borderRadius:'5px'}}><div style={{width:`${(battle.enemyHp/battle.maxEnemyHp)*100}%`, background:'#00ff66', height:'100%'}}></div></div>
                            <div style={{background:'rgba(0,0,0,0.6)', padding:'5px', borderRadius:'5px', marginTop:'5px'}}>{battle.level?.en}</div>
                         </div>

                         {/* ORTA BİLGİ */}
                         <div style={{textAlign:'center'}}>
                            {battle.isArena && turn === 'p2' ? (
                                <div style={{fontSize:'30px', color:'#ffcc00', animation:'pulse 1s infinite'}}>BOT DÜŞÜNÜYOR...<br/>🤔</div>
                            ) : (
                                <div style={{fontSize:'50px', fontWeight:'bold', color:'rgba(255,255,255,0.2)'}}>VS</div>
                            )}
                         </div>

                         {/* OYUNCU */}
                         <div style={{textAlign:'center'}}>
                            <div style={{fontSize: device==='mobile'?'80px':'120px'}}>{costumeDB[player!.currentCostume].icon}</div>
                            <div style={{background:'red', height:'10px', width:'100px', margin:'0 auto', borderRadius:'5px'}}><div style={{width:`${(player!.hp/pStats.maxHp)*100}%`, background:'#00ff66', height:'100%'}}></div></div>
                            <div style={{background:'rgba(0,0,0,0.6)', padding:'5px', borderRadius:'5px', marginTop:'5px'}}>{player?.name}</div>
                         </div>
                    </div>

                    <div style={{flex: 2, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)', borderTop:'1px solid rgba(255,255,255,0.2)', padding:'20px', display:'flex', flexDirection:'column'}}>
                        
                        {/* JOKERLER */}
                        {device==='pc' && !battle.isArena && (
                            <div style={{display:'flex', gap:'20px', justifyContent:'center', marginBottom:'20px'}}>
                                <button onClick={()=>useJoker('heal')} style={btnStyle}>❤️ ({player!.jokers['heal']||0})</button>
                                <button onClick={()=>useJoker('5050')} style={btnStyle}>½ ({player!.jokers['5050']||0})</button>
                                <button onClick={()=>useJoker('skip')} style={btnStyle}>⏩ ({player!.jokers['skip']||0})</button>
                                <button onClick={()=>useJoker('time')} style={btnStyle}>⏳ ({player!.jokers['time']||0})</button>
                            </div>
                        )}

                        {battle.isArena && turn !== playerSide ? (
                             <div style={{textAlign:'center', fontSize:'24px', color:'#aaa', marginTop:'20px'}}>Sıra Rakipte, Lütfen Bekle...</div>
                        ) : (
                            <>
                                <div style={{fontSize: device==='mobile'?'18px':'24px', fontWeight:'bold', textAlign:'center', marginBottom:'20px', color:'#fff'}}>{battle.qs[battle.qIndex]?.q}</div>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                                    {battle.qs[battle.qIndex]?.o.map((o,i)=>(<button key={i} onClick={()=>handleAnswer(battle.qs[battle.qIndex].a === i)} disabled={battle.isTransitioning} style={{...btnStyle, opacity: battle.fiftyUsed && i!==battle.qs[battle.qIndex].a && i%2!==0 ? 0.1 : 1, background: battle.isTransitioning ? (battle.qs[battle.qIndex].a === i ? '#00ff66' : '#ff0055') : 'rgba(255,255,255,0.1)', color: battle.isTransitioning ? 'black' : 'white'}}>{o}</button>))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {(screen==='shop'||screen==='inv'||screen==='lib'||screen==='mistake'||screen==='arena') && (
                <div style={{height:'100%', overflowY:'auto', padding:'20px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px'}}>
                        <h1 style={{fontSize:'30px', margin:0, color:'#00eaff'}}>{screen==='inv'?'ÇANTA':screen==='lib'?'KÜTÜPHANE':screen==='arena'?'ARENA':screen==='mistake'?'HATA':'MARKET'}</h1>
                        <button style={{...dangerBtnStyle, padding:'10px 20px', fontSize:'16px'}} onClick={()=>setScreen('menu')}>GERİ</button>
                    </div>
                    
                    {screen==='shop' && (
                        <div style={{display:'flex', gap:'10px', marginBottom:'20px', justifyContent:'center'}}>
                            {['buy','joker','sell'].map(m=><button key={m} onClick={()=>setShopMode(m as any)} style={{...btnStyle, background:shopMode===m?'#00eaff':'#333', color:shopMode===m?'black':'white', flex:1}}>{m.toUpperCase()}</button>)}
                        </div>
                    )}
                    
                    {screen==='shop' && (
                        <div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr 1fr':'repeat(auto-fit, minmax(200px, 1fr))', gap:'20px'}}>
                             {shopMode==='buy' && Object.keys(itemDB).filter(k=>itemDB[k].type!=='joker').map(k=>(<div key={k} style={{...cardStyle, alignItems:'center', textAlign:'center'}}><div style={{fontSize:'40px'}}>{itemDB[k].icon}</div><div style={{fontWeight:'bold'}}>{itemDB[k].name}</div><div style={{fontSize:'12px', color:'#aaa'}}>{itemDB[k].type==='wep'?'⚔️ +'+itemDB[k].val+' SALDIRI':itemDB[k].type==='arm'?'🛡️ +'+itemDB[k].val+' CAN':'🎯 +'+itemDB[k].val+' KRİTİK'}</div><div style={{color:'#00eaff'}}>{itemDB[k].cost} G</div><button style={{...successBtnStyle, width:'100%', fontSize:'14px'}} onClick={()=>buyItem(k)}>AL</button></div>))}
                             {shopMode==='joker' && Object.keys(itemDB).filter(k=>itemDB[k].type==='joker').map(k=>(<div key={k} style={{...cardStyle, alignItems:'center', textAlign:'center'}}><div style={{fontSize:'40px'}}>{itemDB[k].icon}</div><div style={{fontWeight:'bold'}}>{itemDB[k].name}</div><div>{itemDB[k].cost} G</div><button style={{...successBtnStyle, width:'100%', fontSize:'14px'}} onClick={()=>buyItem(k)}>AL</button></div>))}
                             {shopMode==='sell' && player!.inventory.map((it,i)=>(<div key={i} style={{...cardStyle, alignItems:'center', textAlign:'center'}}><div style={{fontSize:'40px'}}>{it.icon}</div><div style={{fontWeight:'bold'}}>{it.name}</div><button style={{...actionBtnStyle, background:'#ffcc00', width:'100%', fontSize:'14px'}} onClick={()=>sellItem(i)}>SAT ({it.cost/2})</button></div>))}
                        </div>
                    )}

                    {screen==='inv' && (
                        <div style={{display:'flex', flexDirection: device==='mobile'?'column':'row', gap:'40px'}}>
                            <div style={{width: device==='mobile'?'100%':'300px'}}>
                                <h3 style={{color:'#00eaff', textAlign:'center'}}>KUŞANILANLAR</h3>
                                <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                                    {['wep','arm','acc'].map(t=>(<div key={t} onClick={() => unequipItem(t as any)} style={{width:'80px', height:'80px', border:'2px solid #444', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'30px', cursor:'pointer', background: player?.equipped[t as 'wep'] ? '#1a1a20' : 'transparent', color:'white'}}>{player?.equipped[t as 'wep'] ? player.equipped[t as 'wep']!.icon : (t==='wep'?'⚔️':t==='arm'?'🛡️':'💍')}</div>))}
                                </div>
                            </div>
                            <div style={{flex:1, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'20px', alignContent:'start'}}>{player!.inventory.map((it,i)=>(<div key={i} style={{...cardStyle, alignItems:'center', textAlign:'center'}}><div style={{fontSize:'40px'}}>{it.icon}</div><div style={{fontWeight:'bold'}}>{it.name}</div><div style={{fontSize:'12px', color:'#aaa'}}>{it.type==='wep'?'⚔️ +'+it.val:it.type==='arm'?'🛡️ +'+it.val:'🎯 +'+it.val}</div><button style={{...actionBtnStyle, width:'100%', fontSize:'12px'}} onClick={()=>equipItem(i)}>KUŞAN</button></div>))}</div>
                        </div>
                    )}

                    {screen === 'lib' && (
                        <div style={{display:'grid', gap:'20px', gridTemplateColumns: device==='mobile'?'1fr':'1fr 1fr'}}>
                            {libraryDB.map((l, i) => (<div key={i} style={{background:'rgba(255,255,255,0.05)', borderLeft:'4px solid #00eaff', padding:'20px', borderRadius:'0 15px 15px 0', color:'white'}}><h3 style={{color:'#ffcc00', fontSize:'20px', margin:'0 0 10px 0'}}>{l.t}</h3><p style={{fontSize:'16px', lineHeight:'1.5', color:'#ddd'}}>{l.c}</p></div>))}
                        </div>
                    )}
                    {screen === 'mistake' && (
                        <div style={{display:'grid', gap:'15px'}}>
                            {player!.mistakes.length === 0 && <div style={{textAlign:'center', fontSize:'20px', color:'#888', marginTop:'50px'}}>Harika! Hiç hata yapmadın.</div>}
                            {player!.mistakes.map((m, i) => (<div key={i} style={{background:'rgba(255,0,85,0.1)', border:'1px solid #ff0055', padding:'15px', borderRadius:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white', flexDirection: device==='mobile'?'column':'row', textAlign: device==='mobile'?'center':'left'}}><div style={{marginBottom: device==='mobile'?'10px':'0'}}><div style={{fontSize:'20px', fontWeight:'bold', marginBottom:'5px'}}>{m.q}</div><div style={{fontSize:'18px', color:'#00ff66'}}>Doğru: {m.a}</div></div><button style={{...btnStyle, background:'#ff0055', border:'none'}} onClick={()=>{const np={...player!}; np.mistakes.splice(i,1); saveGame(np);}}>SİL</button></div>))}
                        </div>
                    )}
                    {screen==='arena' && (
                        <div style={{textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center'}}>
                            <h2 style={{color:'#ffcc00', fontSize:'40px', marginBottom:'30px'}}>LİDERLİK TABLOSU</h2>
                            <div style={{width: device==='mobile'?'100%':'600px', background:'rgba(0,0,0,0.3)', borderRadius:'15px', padding:'10px', marginBottom:'20px', maxHeight:'300px', overflowY:'auto'}}>
                                {leaderboard.length === 0 ? <div style={{color:'white', padding:'20px'}}>Yükleniyor...</div> : leaderboard.map((b,i)=> (
                                    <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid rgba(255,255,255,0.1)', fontSize:'18px', color: b.name===player!.name ? '#00eaff' : 'white', fontWeight: b.name===player!.name ? 'bold' : 'normal', background: b.name===player!.name ? 'rgba(0,234,255,0.1)' : 'transparent'}}><span>#{i+1} {b.name}</span><span>{b.score} LP</span></div>
                                ))}
                            </div>
                            
                            {userRank && userRank > 50 && (
                                <div style={{width: device==='mobile'?'100%':'600px', background:'rgba(0,234,255,0.1)', border:'1px solid #00eaff', borderRadius:'10px', padding:'10px', display:'flex', justifyContent:'space-between', fontSize:'18px', color:'#00eaff', fontWeight:'bold', marginBottom:'30px'}}>
                                    <span>#{userRank} {player?.name} (SEN)</span>
                                    <span>{player?.score} LP</span>
                                </div>
                            )}

                            {arenaSearching ? <div style={{fontSize:'24px', color:'#00eaff', animation:'pulse 1s infinite'}}>RAKİP ARANIYOR...</div> : <button style={{...actionBtnStyle, background:'#00ff66', color:'black'}} onClick={findMatch}>RAKİP BUL</button>}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </>
  );
}