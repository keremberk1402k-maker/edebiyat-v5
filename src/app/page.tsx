'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { ref, set, onValue, update, push, get, remove, query, orderByChild, limitToLast } from "firebase/database";
import { Player, itemDB, costumeDB, regions, qPool, libraryDB, Question, Region, Level } from '../lib/gameData';

const BASE_WIDTH = 1200;
const BASE_HEIGHT = 850;
const FALLBACK_ARENA_BG = "https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=1000";

// --- YENİ SORULAR EKLENMİŞ HAVUZ ---
// Mevcut qPool'u genişletiyoruz.
const expandedQPool = {
    ...qPool,
    all: [
        ...qPool.all,
        { q: "İletişim şemasında 'gönderici'nin diğer adı nedir?", o: ["Kanal", "Kaynak", "Alıcı", "Dönüt"], a: 1 },
        { q: "Hangisi olay hikayesinin temsilcisidir?", o: ["Sait Faik", "Ömer Seyfettin", "Memduh Şevket", "Nurullah Ataç"], a: 1 },
        { q: "Divan edebiyatında şairlerin şiirlerini topladıkları esere ne denir?", o: ["Cönk", "Divan", "Hamse", "Tezkire"], a: 1 },
        { q: "Hangisi Fabl türünün özelliklerinden değildir?", o: ["Ders verme amacı güder", "Kahramanlar hayvanlardır", "Olağanüstü olaylar vardır", "Sadece gerçekler anlatılır"], a: 3 },
        { q: "'Vatan Yahut Silistre' kimin eseridir?", o: ["Namık Kemal", "Ziya Paşa", "Şinasi", "Tevfik Fikret"], a: 0 },
        { q: "Dede Korkut Hikayeleri kaç hikayeden oluşur (Dresden nüshası)?", o: ["10", "12", "15", "24"], a: 1 },
        { q: "Hangisi sözlü iletişim türüdür?", o: ["Mektup", "Panel", "Dilekçe", "Günlük"], a: 1 },
        { q: "Koşuk ve Sagu hangi döneme aittir?", o: ["İslamiyet Öncesi", "Divan", "Halk", "Tanzimat"], a: 0 },
        { q: "Hangisi 'Durum Hikayesi' yazarıdır?", o: ["Ömer Seyfettin", "Sait Faik Abasıyanık", "Reşat Nuri", "Yakup Kadri"], a: 1 },
        { q: "İstiklal Marşı hangi vezinle yazılmıştır?", o: ["Hece", "Aruz", "Serbest", "Syllabic"], a: 1 }
    ]
};

// Yardımcı Fonksiyonlar
const calcStats = (p: Player | null) => {
    if (!p) return { atk: 0, maxHp: 100 };
    let atk = p.baseAtk + (p.lvl * 5);
    let hpBonus = (p.lvl * 25);
    if (p.equipped.wep) atk += p.equipped.wep.val;
    if (p.equipped.arm) hpBonus += p.equipped.arm.val;
    return { atk, maxHp: 100 + hpBonus };
};

// ŞIK KARIŞTIRICI FONKSİYON
const shuffleQuestions = (qs: Question[]) => {
    return qs.map(q => {
        // Şıklar ve orijinal indexlerini paketle
        const optionsWithIndex = q.o.map((opt, i) => ({ val: opt, originalIndex: i }));
        // Karıştır (Fisher-Yates)
        for (let i = optionsWithIndex.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
        }
        // Yeni doğru cevabı bul
        const newAnswerIndex = optionsWithIndex.findIndex(item => item.originalIndex === q.a);
        return { ...q, o: optionsWithIndex.map(item => item.val), a: newAnswerIndex };
    });
};

export default function Game() {
  // --- STATE ---
  const [device, setDevice] = useState<'pc' | 'mobile' | null>(null);
  const [scale, setScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<'auth'|'menu'|'map'|'battle'|'shop'|'inv'|'lib'|'mistake'|'arena'>('auth');
  const [isRegister, setIsRegister] = useState(false);
  
  const [authName, setAuthName] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);

  // SES ve UI AYARLARI
  const [isMuted, setIsMuted] = useState(false);
  
  const pStats = calcStats(player);

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'logout' | 'surrender' | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  // --- ONLINE & BOT STATE ---
  const [roomID, setRoomID] = useState<string | null>(null);
  const [playerSide, setPlayerSide] = useState<'p1' | 'p2' | null>(null);
  const [turn, setTurn] = useState<'p1' | 'p2' | 'resolving'>('p1');
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState({ speed: 5000, acc: 0.5, name: 'Acemi Bot', itemLvl: 0 });

  const [battle, setBattle] = useState<{
    active: boolean; 
    region: Region | null; level: Level | null;
    qs: Question[]; qIndex: number;
    enemyHp: number; maxEnemyHp: number; timer: number; combo: number;
    shaking: boolean; fiftyUsed: boolean; isArena: boolean;
    dmgText: {val: number, color: string, id: number} | null;
    isTransitioning: boolean; // Delay için yeni state
  }>({
    active: false, region: null, level: null, qs: [], qIndex: 0, enemyHp: 0, maxEnemyHp: 0,
    timer: 0, combo: 0, shaking: false, fiftyUsed: false, dmgText: null, isArena: false, isTransitioning: false
  });

  const [shopMode, setShopMode] = useState<'buy' | 'joker' | 'sell'>('buy');
  const [leaderboard, setLeaderboard] = useState<{name:string, score:number}[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null); // Kullanıcının sırası
  const [arenaSearching, setArenaSearching] = useState(false);

  // --- SES SİSTEMİ ---
  const playSound = (type: 'click' | 'correct' | 'wrong' | 'win') => {
    if (isMuted) return;
    const sounds = {
        'click': '/sounds/tik.mp3',
        'correct': '/sounds/dogru.mp3',
        'wrong': '/sounds/yanlis.mp3',
        'win': '/sounds/zafer.mp3'
    };
    const audio = new Audio(sounds[type]);
    audio.volume = 0.4; 
    audio.play().catch(e => {}); // Dosya yoksa hata verme
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

  // SÜRE SAYACI
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === 'battle' && battle.active && battle.timer > 0 && !battle.isTransitioning) {
      interval = setInterval(() => {
        setBattle(prev => {
          if (prev.timer <= 1) { 
              if (battle.isArena && roomID && playerSide && turn === playerSide) {
                  handleAnswer(false);
              } else if (!battle.isArena) {
                  handleAnswer(false); 
              }
              return { ...prev, timer: 0 }; 
          }
          return { ...prev, timer: prev.timer - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, battle.active, battle.timer, turn, playerSide, roomID, battle.isTransitioning]);

  // BOT MANTIĞI (Arena)
  useEffect(() => {
      if (screen === 'battle' && battle.active && battle.isArena && isBotMatch && turn === 'p2' && !battle.isTransitioning) {
          // Bot düşünme süresi (Zorluğa göre değişir)
          const thinkTime = Math.max(1000, botDifficulty.speed - (Math.random() * 1000));
          
          const botTimer = setTimeout(() => {
              // Bot doğru bilecek mi?
              const isCorrect = Math.random() < botDifficulty.acc;
              
              if (isCorrect) {
                   // Bot doğru bildi
                   handleBotMove('correct');
              } else {
                   // Bot yanlış bildi
                   handleBotMove('wrong');
              }
          }, thinkTime);
          return () => clearTimeout(botTimer);
      }
  }, [turn, screen, battle.active, isBotMatch]);

  const handleBotMove = (move: 'correct' | 'wrong') => {
      if (!battle.active) return;
      const myMove = 'resolving'; // Bekleme
      // Round'u çöz
      // Eğer oyuncu daha cevap vermediyse beklemez, çünkü sıra tabanlı yaptık.
      // Bot hamlesini yaptı, şimdi sıra oyuncuya geçmez, sonuç hesaplanır.
      // V3'teki mantık: Herkes kendi ekranında hamle yapar.
      // Burada bot simülasyonu için basitçe: Bot hamlesini sunucuya yazmış gibi davranacağız.
      resolveRoundBot(move);
  };

  const resolveRoundBot = (botMove: string) => {
      // Bu fonksiyon bot oynadığında çalışmaz, bot sadece move bilgisini tutar.
      // Sıra tabanlı: P1 oynar -> P2 (Bot) oynar.
      // Biz P1 olarak oynadık, sıra P2'ye geçti.
      // P2 (Bot) şimdi oynadı.
      
      // Oyuncunun son hamlesi neydi?
      // Basitleştirmek için: Bot maçında sıra bekleme yok, eş zamanlı değil sıra tabanlı olsun.
      // P1 Cevaplar -> Sonuç -> P2 Cevaplar -> Sonuç (Klasik RPG)
      // AMA V3 yapımız eş zamanlı (taş kağıt makas gibi).
      
      // Bot simülasyonu için hile yapıyoruz:
      // Oyuncu cevabını verdiğinde, bot o an karar vermiş gibi sonucu hemen hesaplayacağız.
      // O yüzden yukarıdaki useEffect'e gerek yok, handleAnswer içinde halledeceğiz.
  };

  // LİDERLİK TABLOSU
  const fetchLeaderboard = () => {
      const usersRef = query(ref(db, 'users'), orderByChild('score'), limitToLast(100));
      get(usersRef).then((snapshot) => {
          if (snapshot.exists()) {
              const data = snapshot.val();
              const list = Object.values(data) as {name:string, score:number}[];
              list.sort((a, b) => b.score - a.score);
              setLeaderboard(list.slice(0, 50)); // İlk 50
              
              // Kendi sıranı bul
              if(player) {
                  const myRank = list.findIndex(u => u.name === player.name);
                  setUserRank(myRank + 1);
              }
          }
      });
  };

  useEffect(() => {
      if(screen === 'arena') {
          fetchLeaderboard();
      }
  }, [screen]);

  // Auth, Save, Item, vb. fonksiyonları
  const handleAuth = () => {
    playSound('click');
    if (!authName || !authPass) return notify("Boş alan bırakma!", "error");
    const key = `edb_final_v21_${authName}`;
    
    // Admin
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
        localStorage.setItem(`edb_final_v21_${p.name}`, JSON.stringify(p));
        update(ref(db, 'users/' + p.name), { score: p.score });
    }
    setPlayer({...p});
  };

  // --- BOT ZORLUK AYARLAYICI ---
  const calculateBotStats = (playerScore: number) => {
      // Puan arttıkça bot zorlaşır
      // 0 Puan: %50 doğruluk, 5sn hız
      // 1000 Puan: %70 doğruluk, 3sn hız
      // 5000 Puan: %90 doğruluk, 1.5sn hız
      
      let accuracy = 0.5 + (playerScore / 10000); 
      if (accuracy > 0.95) accuracy = 0.95;

      let speed = 5000 - (playerScore * 0.5);
      if (speed < 1500) speed = 1500;

      let name = "Acemi Çırak";
      let itemLvl = 0;

      if(playerScore > 500) { name = "Köy Ozanı"; itemLvl = 1; }
      if(playerScore > 1500) { name = "Saray Katibi"; itemLvl = 2; }
      if(playerScore > 3000) { name = "Divan Şairi"; itemLvl = 3; }
      if(playerScore > 5000) { name = "Edebiyat Üstadı"; itemLvl = 4; }

      return { acc: accuracy, speed, name, itemLvl };
  };

  const findMatch = async () => {
      if (!player) return;
      playSound('click');
      setArenaSearching(true);
      
      // BOT AKTİVASYONU: 5 Saniye içinde rakip bulamazsa bot ata
      const botTimeout = setTimeout(() => {
          setArenaSearching(false);
          startBotMatch();
      }, 5000);

      const roomsRef = ref(db, 'arena_rooms');
      const snapshot = await get(roomsRef);
      let joined = false;
      const myStats = calcStats(player);
      
      if (snapshot.exists()) {
          const rooms = snapshot.val();
          for (const rId in rooms) {
              if (rooms[rId].status === 'waiting') {
                  const host = rooms[rId].p1;
                  // Basit eşleştirme
                  if (true) { 
                      clearTimeout(botTimeout); // Bot iptal
                      const updates: any = {};
                      updates[`arena_rooms/${rId}/p2`] = { name: player.name, hp: myStats.maxHp, maxHp: myStats.maxHp, score: player.score };
                      updates[`arena_rooms/${rId}/status`] = 'playing';
                      updates[`arena_rooms/${rId}/turn`] = 'p1';
                      updates[`arena_rooms/${rId}/questionIndex`] = Math.floor(Math.random() * expandedQPool.all.length);
                      await update(ref(db), updates);
                      setRoomID(rId); setPlayerSide('p2'); joined = true;
                      listenToRoom(rId, 'p2'); notify("Rakip Bulundu!", "success");
                      break;
                  }
              }
          }
      }
      if (!joined) {
          const newRoomRef = push(roomsRef);
          const newRoomId = newRoomRef.key;
          if (newRoomId) {
              await set(newRoomRef, { p1: { name: player.name, hp: myStats.maxHp, maxHp: myStats.maxHp, score: player.score }, status: 'waiting' });
              setRoomID(newRoomId); setPlayerSide('p1'); listenToRoom(newRoomId, 'p1');
              // Bot timeout burada da çalışıyor, eğer p2 gelmezse 5sn sonra iptal edip bot başlatabiliriz
              // Ama basitlik için şimdilik sadece arayan kişi için bot başlattık.
              // Kurucu beklerken bot gelmesi için ayrı logic lazım, şimdilik basit tutalım.
          }
      }
  };

  const startBotMatch = () => {
      if(!player) return;
      setIsBotMatch(true);
      const botStats = calculateBotStats(player.score);
      setBotDifficulty(botStats);
      
      const myStats = calcStats(player);
      
      // Bot için sanal ortam
      setBattle({
          active: true,
          isArena: true,
          region: { id:'arena', name:'Online Arena', desc:'', x:0, y:0, type:'all', bg:'/arena_bg.png', levels:[] },
          level: { id:'bot', t:'Bot Savaşı', hp: myStats.maxHp, en: botStats.name + ` (Eşya: +${botStats.itemLvl})`, ico:'🤖', diff:'PvE', isBoss:true },
          qs: shuffleQuestions([...expandedQPool.all]).slice(0, 10), // 10 Soru
          qIndex: 0,
          enemyHp: myStats.maxHp, // Bot canı bizimkiyle aynı olsun
          maxEnemyHp: myStats.maxHp,
          timer: 20,
          combo: 0, shaking: false, fiftyUsed: false, dmgText: null, isTransitioning: false
      });
      setScreen('battle');
      notify(`Rakip: ${botStats.name}`, "success");
  };

  const listenToRoom = (rId: string, side: 'p1' | 'p2') => {
      const roomRef = ref(db, `arena_rooms/${rId}`);
      onValue(roomRef, (snapshot) => {
          const data = snapshot.val();
          if (!data) return;
          if (data.status === 'playing' && data.p1 && data.p2) {
              setArenaSearching(false);
              const me = side === 'p1' ? data.p1 : data.p2;
              const enemy = side === 'p1' ? data.p2 : data.p1;
              if (data.gameOver) {
                  if (data.winner === side) {
                      playSound('win'); notify("KAZANDIN! +100 SKOR", "success");
                      const np = {...player!}; np.score += 100; np.gold += 100; np.hp = calcStats(np).maxHp; saveGame(np);
                  } else if (data.winner === 'draw') {
                      notify("BERABERE!", "success");
                  } else {
                      notify("KAYBETTİN...", "error");
                      const np = {...player!}; np.hp = calcStats(np).maxHp; saveGame(np);
                  }
                  setBattle(prev => ({...prev, active: false})); setScreen('menu'); remove(roomRef); return;
              }
              setTurn(data.turn);
              const currentQ = expandedQPool.all[data.questionIndex || 0];
              // Online'da shuffle yapmıyoruz ki iki taraf aynı şıkkı görsün (senkron sorunu olmasın)
              setBattle(prev => ({
                  ...prev, active: true, isArena: true, enemyHp: enemy.hp, maxEnemyHp: enemy.maxHp,
                  region: { id:'arena', name:'Online Arena', desc:'', x:0, y:0, type:'all', bg:'/arena_bg.png', levels:[] },
                  level: { id:'pvp', t:'Online Düello', hp: enemy.hp, en: enemy.name, ico:'🤺', diff:'PvP', isBoss:true },
                  qs: [currentQ], qIndex: 0, timer: data.timer || 20, isTransitioning: false
              }));
              if (player) setPlayer(prev => ({...prev!, hp: me.hp}));
              setScreen('battle');
          }
      });
  };

  const handleAnswer = (correct: boolean) => {
    if (!player || battle.isTransitioning) return; // Geçiş varsa tıklamayı engelle
    
    // DELAY EKLEME: Önce sonucu göster, 1.5sn sonra işlemi yap
    // Bot maçında veya hikayede delay olsun
    // Online gerçek PvP'de delay olmasın (senkron kaymasın diye)
    
    if (correct) playSound('correct'); else playSound('wrong');

    if (!battle.isArena || isBotMatch) {
        setBattle(prev => ({ ...prev, isTransitioning: true })); // Butonları kilitle
        
        // Görsel efekt için bekleme
        setTimeout(() => {
            processAnswer(correct);
        }, 1500);
    } else {
        // Online PvP'de bekleme yok
        processAnswer(correct);
    }
  };

  const processAnswer = (correct: boolean) => {
      let nb = { ...battle, isTransitioning: false };
      
      // --- BOT ARENA MANTIĞI ---
      if (nb.isArena && isBotMatch) {
          const myDmg = calcStats(player!).atk;
          const botStats = botDifficulty;
          
          if (correct) {
              nb.enemyHp -= myDmg;
              nb.dmgText = { val: myDmg, color: '#00ff66', id: Date.now() };
          } else {
              nb.shaking = true;
          }

          // Bot da saldırıyor (Simüle ediyoruz)
          // Botun vurup vurmadığını burada hesaplayalım
          const botHits = Math.random() < botStats.acc;
          if (botHits) {
              const botDmg = 30 + (botStats.itemLvl * 10);
              const np = {...player!};
              np.hp -= botDmg;
              setPlayer(np);
              // Eğer öldüysek
              if (np.hp <= 0) {
                  np.hp = calcStats(np).maxHp; saveGame(np);
                  setBattle({...nb, active:false}); notify("KAYBETTİN...", "error"); setScreen('menu'); return;
              }
          }

          if (nb.enemyHp <= 0) {
              playSound('win');
              const np = {...player!}; np.score += 50; np.gold += 50; np.hp = calcStats(np).maxHp; saveGame(np);
              setBattle({...nb, active:false}); notify("BOTU YENDİN! +50 SKOR", "success"); setScreen('menu'); return;
          }
          
          nb.qIndex++; 
          if(nb.qIndex >= nb.qs.length) nb.qIndex = 0; // Sorular biterse başa dön
          nb.timer = 20; 
          setBattle(nb);
          return;
      }

      // --- ONLINE PVP MANTIĞI ---
      if (nb.isArena && roomID && playerSide) {
           // ... Eski online logic aynı kalıyor ...
           // Burayı kısa tutuyorum, mantık aynı
           if (turn !== playerSide) return;
           const myDmg = calcStats(player!).atk;
           const myMove = correct ? 'correct' : 'wrong';
           const updates: any = {};
           updates[`arena_rooms/${roomID}/${playerSide}_move`] = myMove;
           if (playerSide === 'p1') { updates[`arena_rooms/${roomID}/turn`] = 'p2'; } 
           else { updates[`arena_rooms/${roomID}/turn`] = 'resolving'; resolveRoundOnline(myMove); return; }
           update(ref(db), updates); return;
      }

      // --- HİKAYE MODU ---
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
            if(levelIndex === currentProgress) {
                np.regionProgress[nb.region.id] = currentProgress + 1;
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
        }
        saveGame(np); setBattle({...nb, active:false}); notify("ZAFER! +100 ALTIN", "success"); setScreen('map'); return;
      }

      if (np.hp <= 0) { np.hp = 20; saveGame(np); setBattle({...nb, active:false}); notify("KAYBETTİN!", "error"); setScreen('menu'); return; }
      if (!correct || nb.enemyHp > 0) { nb.qIndex++; nb.timer=20; nb.fiftyUsed=false; }
      // Sorular biterse tekrar karıştırıp başa sar (Sonsuz döngü)
      if (nb.qIndex >= nb.qs.length) {
          nb.qs = shuffleQuestions(nb.qs);
          nb.qIndex = 0;
      }
      setBattle(nb); saveGame(np);
  };

  const resolveRoundOnline = async (p2LastMove: string) => {
      // V3'teki kodun aynısı
      const roomRef = ref(db, `arena_rooms/${roomID}`);
      const snapshot = await get(roomRef);
      const data = snapshot.val();
      const p1Move = data.p1_move;
      const p2Move = p2LastMove;
      let p1Dmg = 0; let p2Dmg = 0; const baseDmg = 50;
      if (p1Move === 'correct' && p2Move === 'wrong') { p2Dmg = baseDmg; } 
      else if (p2Move === 'correct' && p1Move === 'wrong') { p1Dmg = baseDmg; } 
      else if (p1Move === 'correct' && p2Move === 'correct') { } 
      else { p1Dmg = 20; p2Dmg = 20; }
      const newP1Hp = Math.max(0, data.p1.hp - p1Dmg);
      const newP2Hp = Math.max(0, data.p2.hp - p2Dmg);
      const updates: any = {};
      updates[`arena_rooms/${roomID}/p1/hp`] = newP1Hp;
      updates[`arena_rooms/${roomID}/p2/hp`] = newP2Hp;
      if (newP1Hp <= 0 || newP2Hp <= 0) {
          updates[`arena_rooms/${roomID}/gameOver`] = true;
          updates[`arena_rooms/${roomID}/winner`] = newP1Hp > 0 ? 'p1' : (newP2Hp > 0 ? 'p2' : 'draw');
      } else {
          updates[`arena_rooms/${roomID}/turn`] = 'p1';
          updates[`arena_rooms/${roomID}/questionIndex`] = Math.floor(Math.random() * expandedQPool.all.length);
          updates[`arena_rooms/${roomID}/p1_move`] = null;
          updates[`arena_rooms/${roomID}/p2_move`] = null;
      }
      await update(ref(db), updates);
  };

  const buyItem = (id:string) => { playSound('click'); const it=itemDB[id]; if(player!.gold>=it.cost){let np={...player!}; np.gold-=it.cost; if(it.type==='joker') np.jokers[it.jokerId!]=(np.jokers[it.jokerId!]||0)+1; else np.inventory.push({...it, uid:Date.now()}); saveGame(np); notify("Satın Alındı!", "success");}else notify("Para Yetersiz!", "error"); };
  const equipItem = (idx:number) => { playSound('click'); if(!player) return; const np={...player}; const it=np.inventory[idx]; if (it.type === 'joker') return notify("Jokerler kuşanılamaz!", "error"); const type = it.type as 'wep' | 'arm' | 'acc'; if(np.equipped[type]) np.inventory.push(np.equipped[type]!); np.equipped[type]=it; np.inventory.splice(idx,1); saveGame(np); notify("Kuşanıldı", "success"); };
  const unequipItem = (type: 'wep' | 'arm' | 'acc') => { playSound('click'); if(!player || !player.equipped[type]) return; const np = { ...player }; np.inventory.push(np.equipped[type]!); np.equipped[type] = null; saveGame(np); notify("Çıkarıldı", "success"); };
  const useJoker = (type: string) => { playSound('click'); if(!player || battle.timer<=0 || (player.jokers[type]||0)<=0) return; if(battle.isArena && !isBotMatch) return notify("Arenada Joker Yasak!", "error"); let np = {...player}; np.jokers[type]--; if(type==='heal') np.hp = Math.min(np.hp+50, calcStats(np).maxHp); if(type==='skip') { setBattle(prev=>({...prev, enemyHp:0})); setTimeout(()=>handleAnswer(true), 100); } if(type==='time') setBattle(prev=>({...prev, timer:prev.timer+10})); if(type==='5050') setBattle(prev=>({...prev, fiftyUsed:true})); saveGame(np); };
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
    
    // 1. Soruları çek
    let rawQs = r.type === 'all' ? [...expandedQPool.all] : [...(expandedQPool[r.type] || [])];
    // 2. Çoğalt (Oyun hemen bitmesin)
    rawQs = [...rawQs, ...rawQs]; 
    // 3. Soruları karıştır
    rawQs.sort(() => Math.random() - 0.5);
    // 4. Şıkları karıştır
    const shuffledQs = shuffleQuestions(rawQs);
    
    setBattle({
      active: true, region: r, level: l, qs: shuffledQs, qIndex: 0,
      enemyHp: l.hp, maxEnemyHp: l.hp, timer: 20, combo: 0,
      shaking: false, fiftyUsed: false, dmgText: null, isArena: false, isTransitioning: false
    });
    setScreen('battle');
  };

  // --- RENDER ---
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
        <div style={{width: device==='mobile' ? '90%' : '450px', maxWidth: '450px', background:'#151515', border:'2px solid #00eaff', padding:'40px', borderRadius:'30px', textAlign:'center', display:'flex', flexDirection:'column', gap:'25px', overflow:'hidden'}}>
          <h1 style={{fontSize: device==='mobile'?'35px':'50px', color:'#00eaff', margin:0, textShadow:'0 0 10px #00eaff'}}>EDEBİYAT<br/>EFSANELERİ V4</h1>
          <input placeholder="Kullanıcı Adı" value={authName} onChange={e=>setAuthName(e.target.value)} />
          <input type="password" placeholder="Şifre" value={authPass} onChange={e=>setAuthPass(e.target.value)} />
          <button style={successBtnStyle} onClick={handleAuth}>{isRegister ? 'KAYIT OL' : 'GİRİŞ YAP'}</button>
          <p style={{color:'#aaa', cursor:'pointer', fontSize:'18px', textDecoration:'underline'}} onClick={()=>setIsRegister(!isRegister)}>{isRegister ? 'Giriş Yap' : 'Yeni Hesap Oluştur'}</p>
        </div>
      </div>
    );
  }

  if(!mounted) return <div style={{color:'white', fontSize:'30px', background:'black', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Yükleniyor...</div>;

  return (
    <>
      <NotificationComponent />
      
      {/* SES KONTROL BUTONU (SOL ÜST) */}
      <div style={{position:'fixed', top:'10px', left:'10px', zIndex:99999, background:'rgba(0,0,0,0.5)', borderRadius:'50%', padding:'10px', cursor:'pointer'}} onClick={()=>setIsMuted(!isMuted)}>
          <span style={{fontSize:'30px'}}>{isMuted ? '🔇' : '🔊'}</span>
      </div>

      {showTutorial && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{width: device==='mobile'?'95%':'800px', background:'#111', border:'4px solid #ffcc00', padding:'30px', borderRadius:'30px', textAlign:'center', color:'white'}}><h1 style={{fontSize:'40px', color:'#ffcc00'}}>HOŞGELDİN MACERACI!</h1><button style={{...successBtnStyle, width:'100%'}} onClick={()=>{setShowTutorial(false); const np={...player!, tutorialSeen:true}; saveGame(np);}}>BAŞLA</button></div></div>)}
      {showLevelUp && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{background:'#111', border:'5px solid #00ff66', padding:'50px', borderRadius:'30px', textAlign:'center', color:'white'}}><h1 style={{fontSize:'60px', color:'#00ff66', margin:0}}>SEVİYE ATLADIN!</h1><button style={{...actionBtnStyle, marginTop:'30px'}} onClick={()=>setShowLevelUp(false)}>DEVAM ET</button></div></div>)}
      {showWardrobe && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{width: device==='mobile'?'95%':'800px', height:'700px', background:'#111', border:'4px solid #ffcc00', padding:'30px', borderRadius:'30px', display:'flex', flexDirection:'column', color:'white'}}><h1 style={{fontSize:'40px', color:'#ffcc00', textAlign:'center', margin:0}}>DOLAP</h1><div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr 1fr':'1fr 1fr 1fr', gap:'20px', overflowY:'auto', flex:1, padding:'20px'}}>{Object.keys(costumeDB).map(k=>(<div key={k} style={{border:'2px solid #444', padding:'20px', borderRadius:'20px', textAlign:'center', background:player!.currentCostume===k?'#222':'transparent', color:'white'}}><div style={{fontSize:'60px'}}>{costumeDB[k].icon}</div><h3>{costumeDB[k].name}</h3>{player!.unlockedCostumes.includes(k)?<button style={{...btnStyle, background:player!.currentCostume===k?'#00ff66':'#00eaff', color:'black', justifyContent:'center', width:'100%'}} onClick={()=>{saveGame({...player!, currentCostume:k}); setShowWardrobe(false)}}>GİY</button>:<div style={{color:'red', fontWeight:'bold'}}>KİLİTLİ</div>}</div>))}</div><button style={{...dangerBtnStyle, fontSize:'20px', padding:'15px'}} onClick={()=>setShowWardrobe(false)}>KAPAT</button></div></div>)}
      
      {/* ÇIKIŞ ONAY MODALI */}
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
        <div style={{height: device==='mobile'?'60px':'90px', background:'#080808', borderBottom:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px'}}>
            <div style={{fontSize: device==='mobile'?'16px':'24px', fontWeight:'bold', display:'flex', gap: device==='mobile'?'10px':'30px'}}><span style={{color:'#ffcc00'}}>⚡ {player?.lvl}</span><span style={{color:'#00ff66'}}>❤️ {player?.hp}/{pStats.maxHp}</span><span style={{color:'#00eaff'}}>💰 {player?.gold}</span></div>
            <button style={{...dangerBtnStyle, fontSize: device==='mobile'?'12px':'20px', padding: device==='mobile'?'5px 15px':'10px 30px'}} onClick={()=>setConfirmAction('logout')}>ÇIKIŞ</button>
        </div>

        <div style={{flex:1, position:'relative', overflow: device==='mobile'?'auto':'hidden', padding: device==='mobile'?'10px':'40px'}}>
            {screen === 'menu' && (
                <div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr':'350px 1fr', height:'100%', gap:'20px'}}>
                    <div style={{textAlign:'center', borderRight: device==='mobile'?'none':'1px solid #333', paddingRight: device==='mobile'?'0':'40px', borderBottom: device==='mobile'?'1px solid #333':'none', paddingBottom: device==='mobile'?'20px':'0'}}>
                        <div style={{fontSize: device==='mobile'?'100px':'170px', cursor:'pointer'}} onClick={()=>setShowWardrobe(true)}>{costumeDB[player!.currentCostume].icon}</div>
                        <h2 style={{fontSize: device==='mobile'?'30px':'40px', color:'#00eaff', margin:'10px 0'}}>{player?.name}</h2>
                        <div style={{textAlign:'left', background:'#222', padding:'20px', borderRadius:'20px', fontSize: device==='mobile'?'16px':'20px', lineHeight:'1.5', color:'white'}}><div>⚔️ Güç: {pStats.atk}</div><div>🛡️ Can: {pStats.maxHp}</div><div>🏆 Skor: {player?.score}</div></div>
                    </div>
                    <div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr 1fr':'1fr 1fr', gap:'20px', paddingLeft: device==='mobile'?'0':'40px', alignContent:'center'}}>
                        {[{id:'map',t:'MACERA',i:'🗺️'}, {id:'arena',t:'ARENA',i:'⚔️',check:true}, {id:'shop',t:'MARKET',i:'🛒'}, {id:'inv',t:'ÇANTA',i:'🎒'}, {id:'lib',t:'BİLGİ',i:'📚'}, {id:'mistake',t:'HATA',i:'📜'}].map(m => (
                            <div key={m.id} onClick={()=>{ playSound('click'); if(m.check && !isArenaUnlocked()) return notify("Arena için Son Boss'u (Cehalet Kalesi) yenmelisin!", "error"); if(m.id==='arena') fetchLeaderboard(); setScreen(m.id as any); }} style={{background:'#1a1a20', border:'2px solid #333', borderRadius:'20px', height: device==='mobile'?'120px':'180px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'0.2s', color:'white', opacity: (m.check && !isArenaUnlocked()) ? 0.3 : 1}}>
                                <div style={{fontSize: device==='mobile'?'40px':'70px'}}>{(m.check && !isArenaUnlocked()) ? '🔒' : m.i}</div>
                                <div style={{fontSize: device==='mobile'?'16px':'24px', fontWeight:'bold', marginTop:'10px'}}>{m.t}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {screen === 'map' && (<div style={{height:'100%', minHeight: device==='mobile'?'500px':'100%', position:'relative', background:'url(https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000) center/cover', borderRadius:'20px', overflow:'hidden', boxShadow:'inset 0 0 100px black'}}><button style={{...dangerBtnStyle, position:'absolute', top:'20px', right:'20px', zIndex:10}} onClick={()=>setScreen('menu')}>GERİ</button><svg style={{position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none'}}>{regions.map((r, i) => {if (i === regions.length - 1) return null;const next = regions[i+1];const unlocked = player!.unlockedRegions.includes(next.id);return <line key={i} x1={`${r.x}%`} y1={`${r.y}%`} x2={`${next.x}%`} y2={`${next.y}%`} stroke={unlocked?'#333':'#888'} strokeWidth="4" strokeDasharray="10" />})}</svg>{regions.map((r) => {const unlocked = player!.unlockedRegions.includes(r.id);return (<div key={r.id} onClick={()=>handleRegionClick(r)} style={{position:'absolute', left:`${r.x}%`, top:`${r.y}%`, transform:'translate(-50%, -50%)', cursor: unlocked ? 'pointer' : 'not-allowed', textAlign:'center', zIndex:5, opacity: unlocked ? 1 : 0.6, filter: unlocked ? 'none' : 'grayscale(100%)'}}><div style={{fontSize: device==='mobile'?'40px':'50px', background: unlocked ? '#f4e4bc' : '#555', width: device==='mobile'?'70px':'90px', height: device==='mobile'?'70px':'90px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', border:'4px solid #5c4033', boxShadow: unlocked ? '0 0 20px #8b4513' : 'none', transition:'0.3s', animation: unlocked ? 'pop 2s infinite alternate' : 'none', color:'black'}}>{unlocked ? (r.type==='iletisim'?'📡':r.type==='hikaye'?'🌲':r.type==='siir'?'🎭':r.id==='tut'?'🎓':'🐲') : '🔒'}</div><div style={{background:'rgba(255,255,255,0.9)', padding:'5px 15px', borderRadius:'10px', marginTop:'10px', color:'black', fontWeight:'bold', border:'1px solid #5c4033', whiteSpace:'nowrap', fontSize: device==='mobile'?'12px':'16px'}}>{r.name}</div></div>)})})</div>)}

            {/* SAVAŞ EKRANI */}
            {screen === 'battle' && (battle.region || battle.isArena) && (
                <div style={{height:'100%', display:'flex', flexDirection:'column', background:`linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(${battle.isArena ? (battle.region?.bg || FALLBACK_ARENA_BG) : (battle.region?.bg || battle.level?.ico)}) center/cover`}}>
                    <div style={{flex: device === 'mobile' ? '0 0 auto' : 2, position:'relative', display: device === 'mobile' ? 'flex' : 'grid', flexDirection: device === 'mobile' ? 'column' : 'row', gridTemplateColumns: '1fr 1fr 1fr', justifyContent: 'center', alignItems: device === 'mobile' ? 'center' : 'end', padding: device === 'mobile' ? '10px 0' : '0 50px 20px 50px', gap: device === 'mobile' ? '5px' : '0'}}>
                        {battle.dmgText && <div style={{position:'absolute', left:'50%', top:'30%', fontSize:'80px', fontWeight:'bold', color:battle.dmgText.color, animation:'flyUp 0.8s forwards', zIndex:99}}> -{battle.dmgText.val} </div>}
                        <button style={{...dangerBtnStyle, fontSize:'14px', position:'absolute', top:0, left:0}} onClick={() => setConfirmAction('surrender')}>{battle.isArena ? '🏳️ TESLİM OL' : '❌ ÇIK'}</button>
                        <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%', order: device==='mobile'?1:3}}>
                            <div style={{background:'black', border:'2px solid white', borderRadius:'15px', height:'20px', width: device==='mobile'?'120px':'220px', marginBottom:'5px', overflow:'hidden', position:'relative'}}><div style={{width:`${(battle.enemyHp/battle.maxEnemyHp)*100}%`, height:'100%', background:'#ff0055', transition:'0.3s'}}></div><span style={{position:'absolute', inset:0, textAlign:'center', fontSize:'12px', fontWeight:'bold'}}>{Math.floor(battle.enemyHp)}</span></div>
                            <div style={{fontSize: device==='mobile'?'80px':'170px', filter:'drop-shadow(0 0 20px black)', lineHeight:'1'}}>{battle.isArena ? '🤺' : battle.level?.ico}</div>
                            <div style={{background:'rgba(0,0,0,0.7)', padding:'5px 15px', borderRadius:'10px', marginTop:'5px', color:'#ffcc00', fontWeight:'bold', fontSize:'24px'}}>{battle.level?.en}</div>
                        </div>
                        <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', order: 2, paddingBottom: device==='mobile'?'0':'50px'}}>
                            {device === 'pc' && !battle.isArena && (<div style={{display:'flex', gap:'25px', marginBottom:'10px', justifyContent:'center'}}>{[{id:'5050',i:'½'},{id:'heal',i:'❤️'},{id:'time',i:'⏳'},{id:'skip',i:'⏩'}].map(j=>(<button key={j.id} onClick={()=>useJoker(j.id)} style={{width:'90px', height:'90px', borderRadius:'50%', fontSize:'45px', background:'#222', border:'3px solid #666', cursor:'pointer', position:'relative', color:'white', display:'flex', alignItems:'center', justifyContent:'center'}}>{j.i}<span style={{position:'absolute', bottom:-5, right:-5, background:'red', borderRadius:'50%', width:'30px', height:'30px', fontSize:'16px', lineHeight:'30px', color:'white', border:'2px solid white'}}>{player!.jokers[j.id]||0}</span></button>))}</div>)}
                            <h1 style={{fontSize: device==='mobile'?'30px':'80px', color:'rgba(255,255,255,0.1)', fontWeight:'bold', margin:0}}>VS</h1>
                        </div>
                        <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%', animation: battle.shaking ? 'shake 0.3s' : '', order: device==='mobile'?3:1}}>
                            <div style={{fontSize: device==='mobile'?'80px':'170px', filter:'drop-shadow(0 0 20px black)', lineHeight:'1'}}>{costumeDB[player!.currentCostume].icon}</div>
                            <div style={{background:'black', border:'2px solid white', borderRadius:'15px', height:'20px', width: device==='mobile'?'120px':'220px', marginTop:'5px', overflow:'hidden', position:'relative'}}><div style={{width:`${(player!.hp/pStats.maxHp)*100}%`, height:'100%', background:'#00ff66', transition:'0.3s'}}></div><span style={{position:'absolute', inset:0, textAlign:'center', fontSize:'12px', fontWeight:'bold'}}>{player!.hp}</span></div>
                            <div style={{background:'rgba(0,0,0,0.7)', padding:'5px 15px', borderRadius:'10px', marginTop:'5px', color:'#00eaff', fontWeight:'bold', fontSize:'24px'}}>{player?.name}</div>
                        </div>
                    </div>
                    <div style={{flex:1, background:'rgba(10,10,15,0.95)', borderTop:'4px solid #00eaff', padding:'20px', display:'flex', flexDirection:'column'}}>
                        {device === 'mobile' && !battle.isArena && (<div style={{display:'flex', gap:'10px', justifyContent:'center', marginBottom:'10px'}}>{[{id:'5050',i:'½'},{id:'heal',i:'❤️'},{id:'time',i:'⏳'},{id:'skip',i:'⏩'}].map(j=>(<button key={j.id} onClick={()=>useJoker(j.id)} style={{width:'50px', height:'50px', borderRadius:'50%', fontSize:'24px', background:'#222', border:'2px solid #555', cursor:'pointer', position:'relative', color:'white'}}>{j.i}<span style={{position:'absolute', bottom:0, right:0, background:'red', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', lineHeight:'18px', color:'white'}}>{player!.jokers[j.id]||0}</span></button>))}</div>)}
                        <div style={{height:'10px', background:'#333', borderRadius:'10px', overflow:'hidden', marginBottom:'15px'}}>
                            <div style={{width:`${(battle.timer/20)*100}%`, height:'100%', background: battle.timer<5?'red':'#00eaff', transition:'1s linear'}}></div>
                        </div>
                        {battle.isArena && turn !== playerSide ? (
                            <div style={{textAlign:'center', padding:'20px', fontSize:'30px', color:'#ffcc00', animation:'pulse 1s infinite'}}>SIRA RAKİPTE... <br/><span style={{fontSize:'18px', color:'white'}}>Soru: {battle.qs[battle.qIndex]?.q}</span></div>
                        ) : (
                            <>
                                <div style={{fontSize: device==='mobile'?'18px':'32px', fontWeight:'bold', textAlign:'center', marginBottom:'15px', color:'#00eaff', lineHeight:'1.2'}}>{battle.qs[battle.qIndex]?.q}</div>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', flex:1}}>
                                    {battle.qs[battle.qIndex]?.o.map((o,i)=>(<button key={i} onClick={()=>handleAnswer(battle.qs[battle.qIndex].a === i)} disabled={battle.isTransitioning} style={{...btnStyle, textAlign:'left', fontSize: device==='mobile'?'14px':'22px', padding: device==='mobile'?'10px':'20px', opacity: battle.fiftyUsed && i!==battle.qs[battle.qIndex].a && i%2!==0 ? 0.1 : 1, background: battle.isTransitioning ? (battle.qs[battle.qIndex].a === i ? '#00ff66' : '#ff0055') : '#222', color: battle.isTransitioning ? 'black' : 'white'}}>{o}</button>))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {(screen==='shop'||screen==='inv'||screen==='lib'||screen==='mistake'||screen==='arena') && (
                <div style={{height:'100%', overflowY:'auto'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'30px', borderBottom:'2px solid #333', paddingBottom:'20px'}}>
                        <h1 style={{fontSize:'40px', margin:0}}>{screen==='inv'?'ÇANTA':screen==='lib'?'KÜTÜPHANE':screen==='arena'?'ARENA':screen==='mistake'?'HATA':'MARKET'}</h1>
                        {screen==='shop' && <div style={{display:'flex', gap:'20px'}}>{['buy','joker','sell'].map(m=><button key={m} onClick={()=>setShopMode(m as any)} style={{...btnStyle, background:shopMode===m?'#00eaff':'#333', color:shopMode===m?'black':'white'}}>{m.toUpperCase()}</button>)}</div>}
                        <button style={{...dangerBtnStyle, fontSize:'20px', padding:'10px 30px'}} onClick={()=>setScreen('menu')}>GERİ</button>
                    </div>
                    {screen==='shop' && (
                        <div style={{display:'grid', gridTemplateColumns: device==='mobile'?'1fr 1fr':'repeat(4, 1fr)', gap:'20px'}}>
                            {shopMode==='buy' && Object.keys(itemDB).filter(k=>itemDB[k].type!=='joker').map(k=>(<div key={k} style={{background:'#1a1a20', border:'2px solid #333', borderRadius:'20px', padding:'20px', textAlign:'center', color:'white'}}><div style={{fontSize:'40px'}}>{itemDB[k].icon}</div><h3 style={{fontSize:'16px'}}>{itemDB[k].name}</h3><div style={{color:'#aaa', marginBottom:'10px'}}>+{itemDB[k].val} Güç</div><button style={{...btnStyle, width:'100%', background:'white', color:'black', justifyContent:'center'}} onClick={()=>buyItem(k)}>{itemDB[k].cost} G</button></div>))}
                            {shopMode==='joker' && Object.keys(itemDB).filter(k=>itemDB[k].type==='joker').map(k=>(<div key={k} style={{background:'#1a1a20', border:'2px solid #333', borderRadius:'20px', padding:'20px', textAlign:'center', color:'white'}}><div style={{fontSize:'40px'}}>{itemDB[k].icon}</div><h3 style={{fontSize:'16px'}}>{itemDB[k].name}</h3><div style={{color:'#aaa', marginBottom:'10px'}}>Tek Seferlik</div><button style={{...btnStyle, width:'100%', background:'#00ff66', color:'black', justifyContent:'center'}} onClick={()=>buyItem(k)}>{itemDB[k].cost} G</button></div>))}
                            {shopMode==='sell' && player!.inventory.map((it,i)=>(<div key={i} style={{background:'#1a1a20', border:'2px solid #333', borderRadius:'20px', padding:'20px', textAlign:'center', color:'white'}}><div style={{fontSize:'40px'}}>{it.icon}</div><h3 style={{fontSize:'20px'}}>{it.name}</h3><button style={{...btnStyle, width:'100%', background:'#ffcc00', color:'black', justifyContent:'center'}} onClick={()=>sellItem(i)}>SAT ({it.cost/2})</button></div>))}
                        </div>
                    )}
                    {screen==='inv' && (
                        <div style={{display:'flex', flexDirection: device==='mobile'?'column':'row', gap:'40px'}}>
                            <div style={{width: device==='mobile'?'100%':'300px'}}>
                                <h3 style={{color:'#00eaff', textAlign:'center'}}>KUŞANILANLAR</h3>
                                <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                                    <div onClick={() => unequipItem('wep')} style={{width:'80px', height:'80px', border:'2px solid #444', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', cursor:'pointer', background: player?.equipped.wep ? '#1a1a20' : 'transparent', color:'white'}}>{player?.equipped.wep ? player.equipped.wep.icon : 'W'}</div>
                                    <div onClick={() => unequipItem('arm')} style={{width:'80px', height:'80px', border:'2px solid #444', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', cursor:'pointer', background: player?.equipped.arm ? '#1a1a20' : 'transparent', color:'white'}}>{player?.equipped.arm ? player.equipped.arm.icon : 'A'}</div>
                                    <div onClick={() => unequipItem('acc')} style={{width:'80px', height:'80px', border:'2px solid #444', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', cursor:'pointer', background: player?.equipped.acc ? '#1a1a20' : 'transparent', color:'white'}}>{player?.equipped.acc ? player.equipped.acc.icon : 'C'}</div>
                                </div>
                            </div>
                            <div style={{flex:1, display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'20px', alignContent:'start'}}>{player!.inventory.map((it,i)=>(<div key={i} style={{background:'#222', border:'2px solid #555', padding:'10px', borderRadius:'10px', textAlign:'center', color:'white'}}><div style={{fontSize:'30px'}}>{it.icon}</div><div style={{fontSize:'14px', color:'#aaa'}}>+{it.val} Güç</div><button style={{...btnStyle, width:'100%', marginTop:'5px', fontSize:'12px', padding:'5px', justifyContent:'center'}} onClick={()=>equipItem(i)}>KUŞAN</button></div>))}</div>
                        </div>
                    )}
                    {screen === 'lib' && (
                        <div style={{display:'grid', gap:'20px', gridTemplateColumns: device==='mobile'?'1fr':'1fr 1fr'}}>
                            {libraryDB.map((l, i) => (<div key={i} style={{background:'#1a1a20', borderLeft:'6px solid #00eaff', padding:'20px', borderRadius:'0 20px 20px 0', color:'white'}}><h3 style={{color:'#ffcc00', fontSize:'24px', margin:'0 0 10px 0'}}>{l.t}</h3><p style={{fontSize:'18px', lineHeight:'1.5'}}>{l.c}</p></div>))}
                        </div>
                    )}
                    {screen === 'mistake' && (
                        <div style={{display:'grid', gap:'20px'}}>
                            {player!.mistakes.length === 0 && <div style={{textAlign:'center', fontSize:'30px', color:'#888'}}>Henüz hata yok!</div>}
                            {player!.mistakes.map((m, i) => (<div key={i} style={{background:'#1a1a20', border:'2px solid #ff0055', padding:'20px', borderRadius:'20px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white', flexDirection: device==='mobile'?'column':'row', textAlign: device==='mobile'?'center':'left'}}><div style={{marginBottom: device==='mobile'?'10px':'0'}}><div style={{fontSize:'20px', fontWeight:'bold', marginBottom:'5px'}}>{m.q}</div><div style={{fontSize:'18px', color:'#00ff66'}}>Doğru: {m.a}</div></div><button style={{...btnStyle, background:'#ff0055', border:'none'}} onClick={()=>{const np={...player!}; np.mistakes.splice(i,1); saveGame(np);}}>SİL</button></div>))}
                        </div>
                    )}
                    {screen==='arena' && (
                        <div style={{textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center'}}>
                            <h2 style={{color:'#ffcc00', fontSize:'40px', marginBottom:'30px'}}>LİDERLİK TABLOSU</h2>
                            <div style={{width: device==='mobile'?'100%':'600px', background:'#1a1a20', border:'2px solid #333', borderRadius:'20px', padding:'20px', marginBottom:'20px', maxHeight:'400px', overflowY:'auto'}}>
                                {leaderboard.length === 0 ? <div style={{color:'white'}}>Yükleniyor...</div> : leaderboard.map((b,i)=> (
                                    <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'15px', borderBottom:'1px solid #333', fontSize:'24px', color: b.name===player!.name ? '#00eaff' : 'white', fontWeight: b.name===player!.name ? 'bold' : 'normal'}}><span>#{i+1} {b.name}</span><span>{b.score} LP</span></div>
                                ))}
                            </div>
                            
                            {/* SENİN SIRALAMAN ÖZEL ÇUBUK */}
                            {userRank && userRank > 50 && (
                                <div style={{width: device==='mobile'?'100%':'600px', background:'#222', border:'2px solid #00eaff', borderRadius:'10px', padding:'15px', display:'flex', justifyContent:'space-between', fontSize:'24px', color:'#00eaff', fontWeight:'bold', marginBottom:'40px'}}>
                                    <span>#{userRank} {player?.name} (SEN)</span>
                                    <span>{player?.score} LP</span>
                                </div>
                            )}

                            {arenaSearching ? <div style={{fontSize:'40px', color:'#00eaff', animation:'pulse 1s infinite'}}>RAKİP ARANIYOR...</div> : <button style={{...actionBtnStyle, background:'#00ff66', color:'black'}} onClick={findMatch}>RAKİP BUL</button>}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </>
  );
}