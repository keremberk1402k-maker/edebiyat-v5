// name=Game.tsx
import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update } from "firebase/database";

// --- FIREBASE ---
const firebaseConfig = { apiKey: "AIzaSyD-Your-Key-Here", authDomain: "edebiyat-efsaneleri.firebaseapp.com", databaseURL: "https://edebiyat-efsaneleri-default-rtdb.europe-west1.firebasedatabase.app", projectId: "edebiyat-efsaneleri", storageBucket: "edebiyat-efsaneleri.appspot.com", messagingSenderId: "123456789", appId: "1:123456789:web:abcdef" };
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);
const SAVE_KEY = "edb_v47_ultra_fix";

// --- TİPLER ---
type Item = { id:string; name:string; type:'wep'|'arm'|'acc'|'joker'; val:number; cost:number; icon:string; jokerId?:string; uid?:number };
type Region = { id:string; name:string; x:number; y:number; type:string; bg:string; unlockC:string; levels:Level[] };
type Level = { id:string; t:string; hp:number; en:string; ico:string; diff:string; isBoss?:boolean };
type Player = { name:string; pass:string; hp:number; maxHp:number; gold:number; xp:number; maxXp:number; lvl:number; inventory:Item[]; equipped:{wep:Item|null;arm:Item|null}; jokers:{[k:string]:number}; mistakes:any[]; score:number; unlockedRegions:string[]; regionProgress:{[k:string]:number}; unlockedCostumes:string[]; currentCostume:string; tutorialSeen:boolean };

// --- İÇERİK (SIKIŞTIRILMIŞ) ---
const ITEMS: {[k:string]:Item} = {
  'w1':{id:'w1',name:'Paslı Kalem',type:'wep',val:20,cost:50,icon:'✏️'}, 'w2':{id:'w2',name:'Dolma Kalem',type:'wep',val:45,cost:250,icon:'✒️'}, 'w3':{id:'w3',name:'Efsanevi Asa',type:'wep',val:120,cost:1500,icon:'🪄'},
  'a1':{id:'a1',name:'Eski Defter',type:'arm',val:50,cost:50,icon:'📓'}, 'a2':{id:'a2',name:'Ansiklopedi',type:'arm',val:250,cost:500,icon:'📚'}, 'a3':{id:'a3',name:'Çelik Zırh',type:'arm',val:600,cost:2000,icon:'🛡️'},
  'j1':{id:'j1',name:'Can İksiri',type:'joker',val:0,cost:100,icon:'🧪',jokerId:'heal'}, 'j2':{id:'j2',name:'%50 Şans',type:'joker',val:0,cost:100,icon:'½',jokerId:'5050'}, 'j3':{id:'j3',name:'Pas Geç',type:'joker',val:0,cost:150,icon:'⏩',jokerId:'skip'}
};
const COSTUMES: {[k:string]:{n:string,i:string}} = { 'default':{n:'Öğrenci',i:'🧑‍🎓'}, 'prince':{n:'Prens',i:'🤴'}, 'divan':{n:'Divan Şairi',i:'👳'}, 'halk':{n:'Ozan',i:'🎸'}, 'king':{n:'Kral',i:'👑'} };
const REGIONS: Region[] = [
  {id:'tut',name:'Başlangıç',x:20,y:80,type:'iletisim',bg:'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=1000',unlockC:'default',levels:[{id:'l1',t:'Tanışma',hp:50,en:'Çırak',ico:'👶',diff:'Kolay'},{id:'l2',t:'Söz Savaşı',hp:80,en:'Kalfa',ico:'👦',diff:'Orta',isBoss:true}]},
  {id:'r1',name:'İletişim Vadisi',x:40,y:60,type:'iletisim',bg:'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=1000',unlockC:'prince',levels:[{id:'l3',t:'Kodlar',hp:150,en:'Hatip',ico:'🗣️',diff:'Orta'},{id:'b1',t:'Büyük İletişimci',hp:300,en:'Uzman',ico:'📡',diff:'Zor',isBoss:true}]},
  {id:'r2',name:'Hikaye Ormanı',x:60,y:40,type:'hikaye',bg:'https://images.unsplash.com/photo-1448375240586-dfd8d395ea6c?w=1000',unlockC:'halk',levels:[{id:'l4',t:'Olay Örgüsü',hp:250,en:'Yazar',ico:'📝',diff:'Zor'},{id:'b2',t:'Dede Korkut',hp:500,en:'Bilge',ico:'👴',diff:'Boss',isBoss:true}]},
  {id:'r3',name:'Arena',x:80,y:20,type:'all',bg:'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1000',unlockC:'king',levels:[{id:'b4',t:'SON SAVAŞ',hp:1200,en:'Cehalet',ico:'🐲',diff:'Final',isBoss:true}]}
];

// Geliştirilmiş soru yapısı: topic eklendi
type Q = { q:string; o:string[]; a:number; topic:string };
const QUESTIONS: Q[] = [
  // İLETİŞİM
  {q:"İletişimi başlatan öğe?",o:["Alıcı","Kanal","Gönderici","Dönüt"],a:2,topic:'iletisim'},
  {q:"Sözlü iletişim türü?",o:["Mektup","Panel","Dilekçe","Roman"],a:1,topic:'iletisim'},
  {q:"Kitle iletişim aracı örneği?",o:["Radyo","Mektup","Günlük","Roman"],a:0,topic:'iletisim'},
  // HİKAYE / ROMAN
  {q:"Olay hikayesi temsilcisi?",o:["Sait Faik","Ömer Seyfettin","Memduh Şevket","Nurullah Ataç"],a:1,topic:'hikaye'},
  {q:"İlk yerli roman?",o:["Taaşşuk-ı Talat","İntibah","Eylül","Cezmi"],a:0,topic:'hikaye'},
  {q:"Çalıkuşu yazarı?",o:["Reşat Nuri","Halide Edip","Yakup Kadri","Refik Halit"],a:1,topic:'hikaye'},
  // ŞİİR
  {q:"Divan edebiyatı nazım birimi?",o:["Dörtlük","Beyit","Bent","Kıta"],a:1,topic:'siir'},
  {q:"Halk şiirinde 11'li ölçü?",o:["Koşma","Mani","Semai","Destan"],a:0,topic:'siir'},
  {q:"Sessiz Gemi kimin?",o:["Yahya Kemal","Ahmet Haşim","Necip Fazıl","Akif Ersoy"],a:0,topic:'siir'},
  // GENEL / TARİH
  {q:"İlk tarihi roman?",o:["Cezmi","İntibah","Vatan","Eylül"],a:0,topic:'genel'},
  {q:"Milli Edebiyat öncüsü?",o:["Ziya Gökalp","Namık Kemal","Fuzuli","Baki"],a:0,topic:'genel'},
  {q:"Beş Hececiler'den biri?",o:["Faruk Nafiz","Orhan Veli","Cemal Süreya","Nazım Hikmet"],a:0,topic:'genel'},
  // Daha fazla soru (çeşitlilik)
  {q:"Garip Akımı kurucusu?",o:["Orhan Veli","Cemal Süreya","Edip Cansever","Turgut Uyar"],a:0,topic:'siir'},
  {q:"İkinci Yeni şairi?",o:["Cemal Süreya","Orhan Veli","Oktay Rifat","Melih Cevdet"],a:0,topic:'siir'},
  {q:"Yaban romanı kime ait?",o:["Yakup Kadri","Reşat Nuri","Halide Edip","Peyami Safa"],a:0,topic:'hikaye'},
  {q:"Dede Korkut hikaye sayısı?",o:["12","10","14","8"],a:0,topic:'hikaye'},
  {q:"Divan edebiyatı nesri?",o:["Düzyazı","İnşa","Münşeat","Nesir"],a:1,topic:'genel'},
  {q:"Halk edebiyatı ölçüsü?",o:["Hece","Aruz","Serbest","Karışık"],a:0,topic:'genel'},
  // Ek genel sorular
  {q:"Vatan şairi kimdir?",o:["Namık Kemal","Ziya Paşa","Şinasi","Tevfik Fikret"],a:0,topic:'genel'},
  {q:"İstiklal Marşı vezni?",o:["Hece","Aruz","Serbest","Syllabic"],a:1,topic:'genel'}
];

// --- STİLLER ---
const S = {
  glass: {background:'rgba(16, 20, 24, 0.88)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',boxShadow:'0 18px 40px rgba(0,0,0,0.5)',color:'white'},
  btn: {background:'linear-gradient(135deg, #00c6ff, #0072ff)',border:'none',color:'white',padding:'12px 15px',borderRadius:'12px',cursor:'pointer',fontWeight:'700',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'0.18s',boxShadow:'0 6px 18px rgba(0,114,255,0.18)',textTransform:'uppercase' as const,fontSize:'14px'},
  btnDanger: {background:'linear-gradient(135deg, #ff416c, #ff4b2b)',boxShadow:'0 6px 15px rgba(255,75,43,0.28)'},
  btnSuccess: {background:'linear-gradient(135deg, #11998e, #38ef7d)',boxShadow:'0 6px 15px rgba(56,239,125,0.28)'},
  neon: (c:string)=>({color:c,textShadow:`0 0 10px ${c}, 0 0 18px ${c}`}),
  bar: {height:'12px',background:'#222',borderRadius:'6px',overflow:'hidden',marginTop:'8px',border:'1px solid rgba(255,255,255,0.12)'}
};

export default function Game() {
  const [screen, setScreen] = useState<'auth'|'menu'|'battle'|'map'|'shop'|'inv'>('auth');
  const [player, setPlayer] = useState<Player|null>(null);
  const [auth, setAuth] = useState({user:'',pass:'',reg:false});
  const [battle, setBattle] = useState<any>({active:false});
  const [modal, setModal] = useState<any>(null);
  const [notif, setNotif] = useState<string|null>(null);
  const [botMatch, setBotMatch] = useState(false);
  const [turn, setTurn] = useState<'p1'|'p2'>('p1');
  const [mounted, setMounted] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<{idx:number|null,correct:boolean|null}>({idx:null,correct:null}); // görsel geri bildirim

  // Ses ve Bildirim
  const notify = (m:string) => { setNotif(m); setTimeout(()=>setNotif(null),3000); };
  const playSound = (t:'click'|'win'|'hit') => {
    if(typeof window==='undefined') return;
    try { new Audio(t==='click'?'https://cdn.pixabay.com/audio/2022/03/24/audio_78c2cb5739.mp3':t==='win'?'https://cdn.pixabay.com/audio/2021/08/09/audio_88447e769f.mp3':'https://cdn.pixabay.com/audio/2021/08/04/audio_c6ccf3232f.mp3').play().catch(()=>{}); } catch(e){}
  };
  const getStats = (p:Player) => {
    let atk=25+(p.lvl*10), hp=120+(p.lvl*30);
    if(p.equipped.wep) atk+=p.equipped.wep.val; if(p.equipped.arm) hp+=p.equipped.arm.val;
    return {atk, maxHp:hp};
  };
  const save = (p:Player) => {
    if(p.name!=='ADMIN'){ try { localStorage.setItem(SAVE_KEY+p.name,JSON.stringify(p)); update(ref(db,'users/'+p.name),{score:p.score}).catch(()=>{}); } catch(e){} }
    setPlayer({...p});
  };

  useEffect(() => { setMounted(true); }, []);

  // Yardımcı: shuffle
  const shuffle = (arr:any[]) => arr.slice().sort(()=>Math.random()-0.5);

  // --- ARENA BOT MANTIĞI (ÖNEMLİ DÜZELTME) ---
  useEffect(() => {
    if(battle.active && botMatch && turn==='p2' && !battle.wait) {
      const timer = setTimeout(() => {
        const hit = Math.random() > 0.4; // %60 bot vurma şansı
        handleMove(hit, true);
      }, 1400 + Math.random()*1400); // 1.4-2.8 saniye düşünme süresi (daha doğal)
      return () => clearTimeout(timer);
    }
  }, [battle, turn, botMatch]);

  // Auth
  const handleAuth = () => {
    if(!auth.user || !auth.pass) return notify("Boş bırakma!");
    const key = SAVE_KEY+auth.user;
    if(auth.user==='admin' && auth.pass==='1234') {
        setPlayer({name:'ADMIN',pass:'1234',hp:9999,maxHp:9999,gold:99999,xp:0,maxXp:100,lvl:99,inventory:[],equipped:{wep:null,arm:null},jokers:{'heal':99,'5050':99,'skip':99},mistakes:[],score:9999,unlockedRegions:['tut','r1','r2','r3'],regionProgress:{'tut':2,'r1':2,'r2':2,'r3':1},unlockedCostumes:Object.keys(COSTUMES),currentCostume:'king',tutorialSeen:true});
        setScreen('menu'); return;
    }
    if(auth.reg) {
        if(localStorage.getItem(key)) return notify("Kullanıcı zaten var!");
        const newP:Player = {name:auth.user,pass:auth.pass,hp:100,maxHp:100,gold:0,xp:0,maxXp:100,lvl:1,inventory:[],equipped:{wep:null,arm:null},jokers:{'heal':1,'5050':1,'skip':1},mistakes:[],score:0,unlockedRegions:['tut'],regionProgress:{'tut':0},unlockedCostumes:['default'],currentCostume:'default',tutorialSeen:false};
        localStorage.setItem(key,JSON.stringify(newP)); setAuth({...auth, reg:false}); notify("Kayıt Oldun!");
    } else {
        const d = localStorage.getItem(key);
        if(!d) return notify("Kullanıcı yok!");
        const p = JSON.parse(d);
        if(p.pass !== auth.pass) return notify("Şifre yanlış!");
        setPlayer(p); setScreen('menu');
    }
  };

  // Savaş Başlatma (geliştirilmiş soru havuzu)
  const startBattle = (r:Region, l:Level, isBot:boolean=false) => {
    playSound('click'); setModal(null); setBotMatch(isBot); setTurn('p1'); setLastAnswer({idx:null,correct:null});
    const stats = getStats(player!);

    // Bölgeye göre uygun soru havuzu
    let pool = QUESTIONS.slice();
    if(r && r.type && r.type !== 'all') {
      pool = QUESTIONS.filter(q => q.topic === r.type || q.topic === 'genel');
    }
    const count = isBot ? 25 : 15;
    const qs = shuffle(pool).slice(0, Math.min(count, pool.length));
    setBattle({ active:true, region:r, level:l, enemyHp:l.hp, maxEnemyHp:l.hp, qs, qIdx:0, timer:20, combo:0, log:null, wait:false, dmgText:null, shaking:false });
    setScreen('battle');
  };

  // Cevap / Vuruş
  const handleMove = (correct:boolean, fromBot:boolean=false) => {
    if(!battle.active) return;
    let nb = {...battle};
    const currentTurn = turn; // capture current turn reliably
    const pStats = getStats(player!);
    const dmg = (botMatch && currentTurn==='p2') || (botMatch && fromBot) ? 35 + (player!.lvl*2) : pStats.atk;

    // Görsel feedback için hangi soru indexi cevaplandı
    const answeredIdx = nb.qIdx;

    // Vuruş Efekti
    playSound(correct ? 'hit' : 'hit');
    nb.dmgText = correct ? {val:dmg, c:'#0f6'} : {val:20, c:'#f05'};

    if(correct) {
      if(currentTurn==='p1') { // SEN VURDUN
        nb.enemyHp -= dmg; nb.log = `SÜPER! ${dmg} Hasar!`; nb.combo = (nb.combo||0) + 1;
        if(nb.enemyHp <= 0) { // KAZANDIN
          playSound('win'); notify("ZAFER! +100 Altın");
          const np = {...player!}; np.gold+=100; np.xp+=30; np.score+=50; np.hp=pStats.maxHp;
          if(np.xp>=np.maxXp) { np.lvl++; np.xp=0; np.maxXp=Math.floor(np.maxXp*1.2); notify("SEVİYE ATLADIN!"); }
          if(nb.level.isBoss && nb.region) {
             if(nb.region.unlockC && !np.unlockedCostumes.includes(nb.region.unlockC)) np.unlockedCostumes.push(nb.region.unlockC);
             const rIdx = REGIONS.findIndex(r=>r.id===nb.region.id);
             if(rIdx < REGIONS.length-1) { const nextR = REGIONS[rIdx+1].id; if(!np.unlockedRegions.includes(nextR)) np.unlockedRegions.push(nextR); }
             const cp = np.regionProgress[nb.region.id]||0; const lIdx = nb.region.levels.findIndex((ll:Level)=>ll.id===nb.level.id); if(lIdx===cp) np.regionProgress[nb.region.id]=cp+1;
          }
          save(np); setBattle({active:false}); setScreen('menu'); return;
        }
      } else { // BOT VURDU
        const np = {...player!}; np.hp -= dmg; setPlayer(np); nb.log = `BOT VURDU: ${dmg}!`;
        if(np.hp <= 0) { // KAYBETTİN
          np.hp=pStats.maxHp; save(np); notify("YENİLDİN..."); setBattle({active:false}); setScreen('menu'); return;
        }
      }
    } else { // YANLIŞ CEVAP
      if(currentTurn==='p1') {
        const np = {...player!}; np.hp -= 25; setPlayer(np); nb.log = "HATALI! -25 Can"; nb.combo=0;
        if(np.hp <= 0) { np.hp=pStats.maxHp; save(np); notify("YENİLDİN..."); setBattle({active:false}); setScreen('menu'); return; }
      } else {
        nb.log = "BOT ISKALADI!";
      }
    }

    // Soru ilerlemesi
    nb.qIdx = (nb.qIdx+1) % nb.qs.length;
    setBattle(nb);

    // Görsel geri bildirim (buton renkleri vs)
    setLastAnswer({idx:answeredIdx, correct});
    setTimeout(()=>setLastAnswer({idx:null,correct:null}),900);

    // turn toggling: use functional update to avoid stale state
    setTurn(prev => prev === 'p1' ? 'p2' : 'p1');
  };

  // Jokerler
  const useJoker = (id:string) => {
      if(!battle.active || player!.jokers[id]<=0) return;
      const np={...player!}; np.jokers[id]--;
      if(id==='heal') { np.hp=Math.min(np.hp+50, getStats(np).maxHp); notify("Can Yenilendi"); save(np); return; }
      if(id==='skip') { // skip: oyuncuysa doğru kabul et, botsa sadece ilerlet
        if(turn==='p1') { handleMove(true); notify("Soru Geçildi"); }
        else { const nb = {...battle}; nb.qIdx = (nb.qIdx+1)%nb.qs.length; setBattle(nb); notify("Rakip soru geçti"); }
      }
      save(np);
  };

  if(!mounted) return <div style={{height:'100vh',background:'#000'}}></div>;

  // Stil animasyonlar için küçük CSS
  const globalStyles = `
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
    @keyframes float { 0% { transform: translateY(0); opacity:1; } 100% { transform: translateY(-50px); opacity:0; } }
    .answer-btn.correct { background: linear-gradient(90deg,#0f6,#00eaff) !important; transform: translateY(-4px); box-shadow: 0 14px 30px rgba(0,255,170,0.12); }
    .answer-btn.wrong { background: linear-gradient(90deg,#ff6b6b,#ff4b2b) !important; transform: translateY(-4px); box-shadow: 0 14px 30px rgba(255,80,80,0.12); }
    .dim { opacity:0.4; pointer-events:none; }
    .floating-dmg { position:absolute; left:50%; transform:translateX(-50%); font-size:72px; font-weight:800; text-shadow:0 0 30px black; animation:float 1s forwards; }
  `;

  // --- LOGIN EKRANI ---
  if(screen==='auth') return (
    <div style={{height:'100vh',background:'#050505',display:'flex',justifyContent:'center',alignItems:'center',color:'white',fontFamily:'sans-serif'}}>
      <style>{globalStyles}</style>
      <div style={{...S.glass,padding:'40px',width:'420px',textAlign:'center'}}>
        <h1 style={{...S.neon('#00eaff'),fontSize:'44px',marginBottom:'20px'}}>EDEBİYAT<br/>EFSANELERİ</h1>
        <input style={{width:'100%',padding:'12px',marginBottom:'12px',borderRadius:'10px',border:'none',background:'rgba(255,255,255,0.06)',color:'white'}} placeholder="Kullanıcı Adı" value={auth.user} onChange={e=>setAuth({...auth,user:e.target.value})}/>
        <input style={{width:'100%',padding:'12px',marginBottom:'18px',borderRadius:'10px',border:'none',background:'rgba(255,255,255,0.06)',color:'white'}} type="password" placeholder="Şifre" value={auth.pass} onChange={e=>setAuth({...auth,pass:e.target.value})}/>
        <button style={{...S.btn,...S.btnSuccess,width:'100%',fontSize:'16px'}} onClick={handleAuth}>{auth.reg?'KAYIT OL':'GİRİŞ YAP'}</button>
        <p style={{marginTop:'16px',cursor:'pointer',color:'#aaa'}} onClick={()=>setAuth({...auth,reg:!auth.reg})}>{auth.reg?'Giriş Yap':'Kayıt Ol'}</p>
        {notif && <div style={{color:'#f05',marginTop:'12px',fontWeight:'bold'}}>{notif}</div>}
      </div>
    </div>
  );

  return (
    <div style={{height:'100vh',background:'radial-gradient(circle at center, #1a1a2e, #000)',color:'white',fontFamily:'Segoe UI, sans-serif',overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <style>{globalStyles}</style>

      {/* ÜST BAR */}
      <div style={{...S.glass,margin:'15px',padding:'15px 25px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:'18px',fontSize:'18px',fontWeight:'700',alignItems:'center'}}>
            <span style={{fontSize:'24px'}}>{COSTUMES[player!.currentCostume].i}</span>
            <span style={S.neon('#fc0')}>⚡ {player?.lvl}</span>
            <span style={S.neon('#0f6')}>❤️ {player?.hp}</span>
            <span style={S.neon('#00eaff')}>💰 {player?.gold}</span>
        </div>
        <div style={{display:'flex',gap:12}}>
          <button style={{...S.btn, padding:'8px 14px', fontSize:13}} onClick={()=>{playSound('click'); setScreen('map');}}>HARİTA</button>
          <button style={{...S.btn,...S.btnDanger,padding:'10px 18px',fontSize:14}} onClick={()=>setScreen('auth')}>ÇIKIŞ</button>
        </div>
      </div>

      {notif && <div style={{position:'absolute',top:80,left:'50%',transform:'translateX(-50%)',background:'#0f6',padding:'12px 22px',borderRadius:'12px',color:'#000',zIndex:999,fontWeight:'700',boxShadow:'0 0 20px #0f6'}}>{notif}</div>}

      {/* ANA MENÜ */}
      {screen==='menu' && (
        <div style={{flex:1,display:'flex',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:'28px',padding:'20px'}}>
           <div style={{...S.glass,padding:'36px',textAlign:'center',width:'380px',height:'500px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
               <div style={{fontSize:'96px',cursor:'pointer',animation:'pulse 2s infinite'}} onClick={()=>setModal('wardrobe')}>{COSTUMES[player!.currentCostume].i}</div>
               <h2 style={{...S.neon('#fff'),fontSize:'30px',margin:'8px 0'}}>{player?.name}</h2>
               <div style={{color:'#aaa',marginBottom:'18px'}}>{COSTUMES[player!.currentCostume].n}</div>
               <div style={{background:'rgba(255,255,255,0.03)',padding:'12px',borderRadius:'12px',textAlign:'left'}}>
                   <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span>⚔️ Saldırı</span><span style={{color:'#f05',fontWeight:'700'}}>{getStats(player!).atk}</span></div>
                   <div style={{display:'flex',justifyContent:'space-between'}}><span>🛡️ Can</span><span style={{color:'#0f6',fontWeight:'700'}}>{getStats(player!).maxHp}</span></div>
               </div>
           </div>
           <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',width:'620px'}}>
               {[{id:'map',t:'MACERA',i:'🗺️',c:'#fc0'},{id:'arena',t:'ARENA',i:'⚔️',c:'#f05'},{id:'shop',t:'MARKET',i:'🛒',c:'#0f6'},{id:'inv',t:'ÇANTA',i:'🎒',c:'#00eaff'}].map(m=>(
                   <div key={m.id} onClick={()=>{
                       playSound('click');
                       if(m.id==='arena'){
                         setSearching(true);
                         setTimeout(()=>{
                           setSearching(false);
                           // Düzeltme: startBattle çağrısı kullanılıyor
                           startBattle({id:'arena',name:'ARENA',x:0,y:0,type:'all',bg:'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1000',unlockC:'king',levels:[]},{id:'pvp',t:'PvP',hp:getStats(player!).maxHp,en:'Rakip',ico:'🤖',diff:'PvP'},true);
                         },1400);
                       } else setScreen(m.id as any);
                     }} style={{...S.glass,height:'210px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',border:`1px solid ${m.c}`,background:searching&&m.id==='arena'?'rgba(255,0,85,0.12)':'rgba(20,20,30,0.84)'}}>
                       {searching&&m.id==='arena' ? <div style={{color:'#f05',fontSize:'22px',animation:'pulse 0.5s infinite'}}>ARANIYOR...</div> : <><div style={{fontSize:'64px',marginBottom:'14px'}}>{m.i}</div><div style={{...S.neon(m.c),fontSize:'20px',fontWeight:'800'}}>{m.t}</div></>}
                   </div>
               ))}
           </div>
        </div>
      )}

      {/* SAVAŞ EKRANI */}
      {screen==='battle' && (
        <div style={{flex:1,display:'flex',flexDirection:'column',background:`linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.9)), url(${battle.region?.bg}) center/cover`}}>
           <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'space-around',position:'relative'}}>
               {battle.dmgText && <div className="floating-dmg" style={{top:'38%',color:battle.dmgText.c}}>{battle.dmgText.val}</div>}
               
               {/* RAKİP */}
               <div style={{textAlign:'center',transform:battle.shaking?'translateX(5px)':''}}>
                   <div style={{fontSize:'120px',filter:'drop-shadow(0 0 30px #f05)'}}>{battle.level?.ico}</div>
                   <div style={{...S.glass,padding:'10px 20px',marginTop:'10px',display:'inline-block'}}>
                       <div style={{fontWeight:'800',fontSize:'20px'}}>{battle.level?.en}</div>
                       <div style={S.bar}><div style={{width:`${Math.max(0,(battle.enemyHp/battle.maxEnemyHp)*100)}%`,height:'100%',background:'linear-gradient(90deg, #f05, #ff8)'}}></div></div>
                   </div>
               </div>

               {/* ORTA */}
               <div style={{textAlign:'center'}}>
                   <div style={{marginBottom:'16px',fontSize:'22px',fontWeight:'700',color:'#fc0'}}>{battle.log}</div>
                   {botMatch && turn!=='p1' ? <div style={{...S.neon('#f05'),fontSize:'28px',animation:'pulse 1s infinite'}}>BOT DÜŞÜNÜYOR...</div> : <div style={{...S.neon('#0f6'),fontSize:'34px'}}>SENİN SIRAN</div>}
               </div>

               {/* OYUNCU */}
               <div style={{textAlign:'center'}}>
                   <div style={{fontSize:'120px',filter:'drop-shadow(0 0 30px #00eaff)'}}>{COSTUMES[player!.currentCostume].i}</div>
                   <div style={{...S.glass,padding:'10px 20px',marginTop:'10px',display:'inline-block'}}>
                       <div style={{fontWeight:'800',fontSize:'20px'}}>{player?.name}</div>
                       <div style={S.bar}><div style={{width:`${(player!.hp/getStats(player!).maxHp)*100}%`,height:'100%',background:'linear-gradient(90deg, #0f6, #00eaff)'}}></div></div>
                   </div>
               </div>
           </div>

           {/* SORU ALANI */}
           <div style={{...S.glass,margin:'22px',padding:'22px',border:'1px solid #00eaff',minHeight:'260px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
               {botMatch && turn!=='p1' ? <div style={{textAlign:'center',fontSize:'22px',color:'#aaa'}}>Rakibin hamlesi bekleniyor...</div> : (
                   <>
                     <div style={{textAlign:'center',marginBottom:'18px',fontSize:'22px',fontWeight:'800'}}>{battle.qs[battle.qIdx].q}</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                         {battle.qs[battle.qIdx].o.map((o:string,i:number)=>{
                            const isAnswered = lastAnswer.idx === battle.qIdx;
                            const className = isAnswered ? (lastAnswer.correct ? 'answer-btn correct' : 'answer-btn wrong') : 'answer-btn';
                            const disabled = (botMatch && turn!=='p1') || (isAnswered && lastAnswer.idx === battle.qIdx);
                            return (
                              <button key={i} className={className} style={{...S.btn, padding:'14px', fontSize:15, width:'100%', textTransform:'none'}} onClick={()=>handleMove(i===battle.qs[battle.qIdx].a)} disabled={disabled}>
                                {o}
                              </button>
                            )
                         })}
                     </div>
                     <div style={{display:'flex',justifyContent:'center',gap:'12px',marginTop:'18px',flexWrap:'wrap'}}>
                         {Object.keys(player!.jokers).map(k=>(
                           <button key={k} style={{...S.btn,background:'#444',fontSize:'13px',opacity:player!.jokers[k]===0?0.5:1}} onClick={()=>useJoker(k)} disabled={player!.jokers[k]===0}>
                             {k==='heal'?'❤️':k==='skip'?'⏩':'½'} ({player!.jokers[k]})
                           </button>
                         ))}
                         <button style={{...S.btn,...S.btnDanger}} onClick={()=>{setScreen('menu'); setBattle({active:false});}}>PES ET</button>
                     </div>
                   </>
               )}
           </div>
        </div>
      )}

      {/* HARİTA MODU */}
      {screen==='map' && (
        <div style={{flex:1,position:'relative',background:'url(https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1000) center/cover'}}>
            <button style={{...S.btn,...S.btnDanger,position:'absolute',top:20,right:20,zIndex:10}} onClick={()=>setScreen('menu')}>GERİ</button>
            {REGIONS.map(r=>{
                const u = player!.unlockedRegions.includes(r.id);
                return (
                    <div key={r.id} onClick={()=>{if(u){setModal(r);playSound('click')}else notify("Önceki Bölümü Bitir!")}} style={{position:'absolute',left:`${r.x}%`,top:`${r.y}%`,transform:'translate(-50%,-50%)',cursor:u?'pointer':'not-allowed',textAlign:'center',opacity:u?1:0.5,filter:u?'drop-shadow(0 0 20px #00eaff)':'grayscale(100%)'}}>
                        <div style={{fontSize:'70px',animation:u?'pulse 2s infinite':''}}>{r.type==='iletisim'?'📡':r.type==='hikaye'?'🌲':r.type==='siir'?'🎭':r.id==='tut'?'🎓':'🐲'}</div>
                        <div style={{...S.glass,padding:'6px 16px',fontSize:'14px'}}>{r.name}</div>
                    </div>
                )
            })}
        </div>
      )}

      {/* MARKET & ÇANTA */}
      {(screen==='shop' || screen==='inv') && (
          <div style={{flex:1,padding:'30px',overflowY:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'26px',alignItems:'center'}}>
                  <h1 style={S.neon('#00eaff')}>{screen==='shop'?'MARKET':'ÇANTA'}</h1>
                  <button style={{...S.btn,...S.btnDanger}} onClick={()=>setScreen('menu')}>GERİ</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'18px'}}>
                  {screen==='shop' ? Object.values(ITEMS).map(it=>(
                      <div key={it.id} style={{...S.glass,padding:'18px',textAlign:'center'}}>
                          <div style={{fontSize:'46px',marginBottom:'8px'}}>{it.icon}</div>
                          <div style={{fontWeight:'800',fontSize:'16px'}}>{it.name}</div>
                          <div style={{color:'#fc0',margin:'8px 0'}}>{it.cost} G</div>
                          <div style={{fontSize:'12px',color:'#aaa',marginBottom:'10px'}}>+{it.val} Güç</div>
                          <button style={{...S.btn,...S.btnSuccess,width:'100%'}} onClick={()=>{ notify('SATIN ALMA EKLENECEK') }}>SATIN AL</button>
                      </div>
                  )) : player!.inventory.map((it,i)=>(
                      <div key={i} style={{...S.glass,padding:'16px',textAlign:'center'}}>
                          <div style={{fontSize:'40px'}}>{it.icon}</div><div style={{fontWeight:700}}>{it.name}</div>
                          {it.type!=='joker' && <button style={{...S.btn,marginTop:'10px',width:'100%'}} onClick={()=>{ notify('KUŞANMA EKLENECEK') }}>KUŞAN</button>}
                          <button style={{...S.btn,marginTop:'8px',width:'100%',background:'#fc0',color:'black'}} onClick={()=>{ notify('SATMA EKLENECEK') }}>SAT</button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* MODALLER */}
      {modal && modal!=='wardrobe' && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:100,display:'flex',justifyContent:'center',alignItems:'center'}}>
              <div style={{...S.glass,padding:'36px',width:'640px',textAlign:'center',border:'2px solid #00eaff'}}>
                  <h2 style={S.neon('#00eaff')}>{modal.name}</h2>
                  <div style={{margin:'24px 0',maxHeight:'400px',overflowY:'auto'}}>
                      {modal.levels.map((l:Level,i:number)=>(
                          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'12px',marginBottom:'10px',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'10px',alignItems:'center',background:player!.regionProgress[modal.id]>=i?'rgba(0,255,100,0.06)':'rgba(0,0,0,0.28)'}}>
                              <div style={{textAlign:'left'}}>
                                  <div style={{fontWeight:'800',fontSize:'17px'}}>{l.t}</div>
                                  <div style={{fontSize:'12px',color:'#aaa'}}>{l.diff} - {l.hp} HP</div>
                              </div>
                              {player!.regionProgress[modal.id]>=i ? <button style={S.btn} onClick={()=>startBattle(modal,l)}>SAVAŞ</button> : <span>🔒</span>}
                          </div>
                      ))}
                  </div>
                  <button style={{...S.btn,...S.btnDanger,width:'100%'}} onClick={()=>setModal(null)}>KAPAT</button>
              </div>
          </div>
      )}

      {modal === 'wardrobe' && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:100,display:'flex',justifyContent:'center',alignItems:'center'}}>
              <div style={{...S.glass,padding:'32px',width:'700px',height:'600px',textAlign:'center'}}>
                  <h2 style={S.neon('#fc0')}>DOLAP</h2>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'18px',margin:'22px 0',overflowY:'auto',height:'420px'}}>
                      {Object.keys(COSTUMES).map(k=>(
                          <div key={k} style={{border:`2px solid ${player!.currentCostume===k?'#0f6':'#444'}`,padding:'18px',borderRadius:'12px',background:player!.currentCostume===k?'rgba(0,255,100,0.06)':'transparent'}}>
                              <div style={{fontSize:'56px'}}>{COSTUMES[k].i}</div>
                              <div style={{fontWeight:'800',marginTop:'8px'}}>{COSTUMES[k].n}</div>
                              {player!.unlockedCostumes.includes(k) ? 
                                  <button style={{...S.btn,marginTop:'10px',width:'100%',background:player!.currentCostume===k?'#0f6':'#0072ff'}} onClick={()=>{save({...player!,currentCostume:k});setModal(null)}}>GİY</button> : 
                                  <div style={{color:'#f05',marginTop:'10px',fontWeight:'800'}}>KİLİTLİ</div>
                              }
                          </div>
                      ))}
                  </div>
                  <button style={{...S.btn,...S.btnDanger,width:'100%'}} onClick={()=>setModal(null)}>KAPAT</button>
              </div>
          </div>
      )}
    </div>
  );
}