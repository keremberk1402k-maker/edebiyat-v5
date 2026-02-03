'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, update, query, orderByChild, limitToLast, get } from "firebase/database";

// -----------------------------------------------------------------------------
// 1. FIREBASE AYARLARI
// -----------------------------------------------------------------------------
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
const SAVE_KEY = "edb_v51_silent";

// -----------------------------------------------------------------------------
// 2. TİPLER VE VERİLER
// -----------------------------------------------------------------------------
type ItemType = 'wep' | 'arm' | 'joker';
type Item = { id:string; name:string; type:ItemType; val:number; cost:number; icon:string; jokerId?:string; desc:string };
type Region = { id:string; name:string; x:number; y:number; type:string; bg:string; unlockC:string; levels:Level[] };
type Level = { id:string; t:string; hp:number; en:string; ico:string; diff:string; isBoss?:boolean };
type Player = { 
    name:string; pass:string; hp:number; maxHp:number; gold:number; xp:number; maxXp:number; lvl:number; 
    inventory: string[]; 
    equipped: { wep: string | null; arm: string | null }; 
    jokers: {[k:string]:number}; 
    mistakes:any[]; score:number; 
    unlockedRegions:string[]; regionProgress:{[k:string]:number}; 
    unlockedCostumes:string[]; currentCostume:string; tutorialSeen:boolean;
    isAdmin?: boolean; 
};

// --- HIZLI RESİMLER ---
const IMGS = {
  bg_arena: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&q=50",
  bg_main: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=50",
  bg_story: "https://images.unsplash.com/photo-1448375240586-dfd8d395ea6c?w=600&q=50"
};

// --- EŞYALAR ---
const ITEMS: {[key:string]: Item} = {
  'w1':{id:'w1',name:'Paslı Kalem',type:'wep',val:20,cost:50,icon:'✏️',desc:'Başlangıç silahı.'}, 
  'w2':{id:'w2',name:'Dolma Kalem',type:'wep',val:45,cost:250,icon:'✒️',desc:'Daha iyi yazar.'},
  'w3':{id:'w3',name:'Efsanevi Asa',type:'wep',val:120,cost:1500,icon:'🪄',desc:'Büyülü güçler.'},
  'a1':{id:'a1',name:'Eski Defter',type:'arm',val:50,cost:50,icon:'📓',desc:'Hafif koruma.'}, 
  'a2':{id:'a2',name:'Ansiklopedi',type:'arm',val:250,cost:500,icon:'📚',desc:'Bilgi korur.'},
  'a3':{id:'a3',name:'Çelik Zırh',type:'arm',val:600,cost:2000,icon:'🛡️',desc:'Delinmez.'},
  'j1':{id:'j1',name:'Can İksiri',type:'joker',val:0,cost:100,icon:'🧪',jokerId:'heal',desc:'+50 Can'}, 
  'j2':{id:'j2',name:'%50 Şans',type:'joker',val:0,cost:100,icon:'½',jokerId:'5050',desc:'İki şıkkı eler'},
  'j3':{id:'j3',name:'Pas Geç',type:'joker',val:0,cost:150,icon:'⏩',jokerId:'skip',desc:'Soruyu atlar'}
};

const COSTUMES: any = { 'default':{n:'Öğrenci',i:'🧑‍🎓'}, 'prince':{n:'Prens',i:'🤴'}, 'divan':{n:'Divan Şairi',i:'👳'}, 'halk':{n:'Ozan',i:'🎸'}, 'king':{n:'Kral',i:'👑'} };

const REGIONS: Region[] = [
  {id:'tut',name:'Başlangıç',x:20,y:80,type:'iletisim',bg:IMGS.bg_main,unlockC:'default',levels:[{id:'l1',t:'Tanışma',hp:50,en:'Çırak',ico:'👶',diff:'Kolay'},{id:'l2',t:'Söz Savaşı',hp:80,en:'Kalfa',ico:'👦',diff:'Orta',isBoss:true}]},
  {id:'r1',name:'İletişim Vadisi',x:40,y:60,type:'iletisim',bg:IMGS.bg_main,unlockC:'prince',levels:[{id:'l3',t:'Kodlar',hp:150,en:'Hatip',ico:'🗣️',diff:'Orta'},{id:'b1',t:'Büyük İletişimci',hp:300,en:'Uzman',ico:'📡',diff:'Zor',isBoss:true}]},
  {id:'r2',name:'Hikaye Ormanı',x:60,y:40,type:'hikaye',bg:IMGS.bg_story,unlockC:'halk',levels:[{id:'l4',t:'Olay Örgüsü',hp:250,en:'Yazar',ico:'📝',diff:'Zor'},{id:'b2',t:'Dede Korkut',hp:500,en:'Bilge',ico:'👴',diff:'Boss',isBoss:true}]},
  {id:'r3',name:'Arena',x:80,y:20,type:'all',bg:IMGS.bg_arena,unlockC:'king',levels:[{id:'b4',t:'SON SAVAŞ',hp:1200,en:'Cehalet',ico:'🐲',diff:'Final',isBoss:true}]}
];

const QUESTIONS = [
  {q:"İletişimi başlatan öğe?",o:["Alıcı","Kanal","Gönderici","Dönüt"],a:2,t:"iletisim"},
  {q:"Sözlü iletişim türü?",o:["Mektup","Panel","Dilekçe","Roman"],a:1,t:"iletisim"},
  {q:"Olay hikayesi temsilcisi?",o:["Sait Faik","Ömer Seyfettin","Memduh Şevket","Nurullah Ataç"],a:1,t:"hikaye"},
  {q:"İlk yerli roman?",o:["Taaşşuk-ı Talat","İntibah","Eylül","Cezmi"],a:0,t:"hikaye"},
  {q:"Vatan şairi kimdir?",o:["Namık Kemal","Ziya Paşa","Şinasi","Tevfik Fikret"],a:0,t:"genel"},
  {q:"İstiklal Marşı vezni?",o:["Hece","Aruz","Serbest","Syllabic"],a:1,t:"siir"},
  {q:"Milli Edebiyat öncüsü?",o:["Ziya Gökalp","Namık Kemal","Fuzuli","Baki"],a:0,t:"genel"},
  {q:"Çalıkuşu yazarı?",o:["Reşat Nuri","Halide Edip","Yakup Kadri","Refik Halit"],a:0,t:"hikaye"},
  {q:"Beş Hececiler'den biri?",o:["Faruk Nafiz","Orhan Veli","Cemal Süreya","Nazım Hikmet"],a:0,t:"siir"},
  {q:"Kaldırımlar şairi?",o:["Necip Fazıl","Nazım Hikmet","Yahya Kemal","Attila İlhan"],a:0,t:"siir"}
];

// --- 3. TASARIM ---
const S = {
  glass: {background:'rgba(15, 20, 25, 0.95)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'16px',boxShadow:'0 10px 30px rgba(0,0,0,0.5)',color:'white'},
  btn: {background:'linear-gradient(135deg, #00c6ff, #0072ff)',border:'none',color:'white',padding:'12px',borderRadius:'10px',cursor:'pointer',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',boxShadow:'0 4px 15px rgba(0,114,255,0.3)',transition:'0.1s',fontSize:'14px',textTransform:'uppercase' as const},
  btnD: {background:'linear-gradient(135deg, #ff416c, #ff4b2b)',boxShadow:'0 4px 15px rgba(255,75,43,0.3)'},
  btnS: {background:'linear-gradient(135deg, #11998e, #38ef7d)',boxShadow:'0 4px 15px rgba(56,239,125,0.3)'},
  neon: (c:string)=>({color:c,textShadow:`0 0 10px ${c}`})
};

// --- 4. ANA OYUN ---
export default function Game() {
  const [screen, setScreen] = useState('auth');
  const [player, setPlayer] = useState<Player|null>(null);
  const [auth, setAuth] = useState({user:'',pass:'',reg:false});
  const [battle, setBattle] = useState<any>({active:false});
  const [modal, setModal] = useState<any>(null);
  const [notif, setNotif] = useState<string|null>(null);
  const [botMatch, setBotMatch] = useState(false);
  const [turn, setTurn] = useState('p1');
  const [shopTab, setShopTab] = useState<ItemType>('wep');
  const [mounted, setMounted] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  const notify = useCallback((m:string) => { setNotif(m); setTimeout(()=>setNotif(null),3000); }, []);
  
  // 🔥 SES FONKSİYONU KALDIRILDI 🔥
  
  const fireConfetti = () => {
    const cvs = confettiRef.current; if(!cvs) return;
    const ctx = cvs.getContext('2d'); if(!ctx) return;
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    let particles:any[] = [];
    for(let i=0; i<80; i++) particles.push({x:cvs.width/2, y:cvs.height/2, vx:(Math.random()-0.5)*10, vy:(Math.random()-0.5)*10, c:`hsl(${Math.random()*360},100%,50%)`, l:100});
    const loop = () => {
      ctx.clearRect(0,0,cvs.width,cvs.height);
      particles.forEach((p,i) => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.l--; ctx.fillStyle=p.c; ctx.fillRect(p.x,p.y,5,5); if(p.l<0) particles.splice(i,1); });
      if(particles.length>0) requestAnimationFrame(loop);
    };
    loop();
  };

  const getStats = useCallback((p:Player) => {
    let atk = 20 + (p.lvl * 5);
    let hp = 100 + (p.lvl * 20);
    if (p.equipped.wep && ITEMS[p.equipped.wep]) atk += ITEMS[p.equipped.wep].val;
    if (p.equipped.arm && ITEMS[p.equipped.arm]) hp += ITEMS[p.equipped.arm].val;
    return { atk, maxHp: hp };
  }, []);

  const save = (p:Player) => { 
    if(!p.isAdmin){ 
      localStorage.setItem(SAVE_KEY+p.name, JSON.stringify(p)); 
      update(ref(db,'users/'+p.name), {score:p.score}).catch(()=>{}); 
    } 
    setPlayer({...p}); 
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if(battle.active && botMatch && turn==='p2' && !battle.wait) {
      const t = setTimeout(() => { handleMove(Math.random()>0.35); }, 2000);
      return () => clearTimeout(t);
    }
  }, [battle, turn, botMatch]);

  const handleAuth = () => {
    if(!auth.user || !auth.pass) return notify("Boş alan bırakma!");
    if(auth.user==='admin' && auth.pass==='1234') { 
        setPlayer({name:'ADMIN', pass:'1234', hp:9999, maxHp:9999, gold:99999, xp:0, maxXp:100, lvl:99, inventory:[], equipped:{wep:null,arm:null}, jokers:{'heal':99,'5050':99}, mistakes:[], score:9999, unlockedRegions:['tut','r1','r2','r3'], regionProgress:{'tut':2,'r1':2,'r2':2,'r3':1}, unlockedCostumes:Object.keys(COSTUMES), currentCostume:'king', tutorialSeen:true, isAdmin:true}); 
        setScreen('menu'); return; 
    }
    const key = SAVE_KEY+auth.user;
    if(auth.reg) {
        if(localStorage.getItem(key)) return notify("Kullanıcı zaten var!");
        const newP: Player = {name:auth.user, pass:auth.pass, hp:100, maxHp:100, gold:0, xp:0, maxXp:100, lvl:1, inventory:[], equipped:{wep:null,arm:null}, jokers:{'heal':1,'5050':1}, mistakes:[], score:0, unlockedRegions:['tut'], regionProgress:{'tut':0}, unlockedCostumes:['default'], currentCostume:'default', tutorialSeen:false};
        localStorage.setItem(key,JSON.stringify(newP)); setAuth({...auth,reg:false}); notify("Kayıt Başarılı!");
    } else {
        const d=localStorage.getItem(key); if(!d) return notify("Kullanıcı yok!");
        const p=JSON.parse(d); if(p.pass!==auth.pass) return notify("Şifre yanlış!");
        setPlayer(p); setScreen('menu');
    }
  };

  const buyItem = (itemId: string) => {
      if(!player) return;
      const item = ITEMS[itemId];
      let np = {...player};
      if(item.type !== 'joker' && np.inventory.includes(itemId)) return notify("Zaten sahipsin!");
      if(np.gold < item.cost && !np.isAdmin) return notify("Yetersiz Altın!");
      if(!np.isAdmin) np.gold -= item.cost;
      if(item.type === 'joker') { if(!np.jokers[item.jokerId!]) np.jokers[item.jokerId!] = 0; np.jokers[item.jokerId!] += 1; } 
      else { np.inventory.push(itemId); }
      notify(`${item.name} Alındı!`); save(np);
  };

  const toggleEquip = (itemId: string) => {
      if(!player) return;
      const item = ITEMS[itemId];
      let np = {...player};
      const slot = item.type;
      if(slot === 'wep' || slot === 'arm') {
          np.equipped[slot] = np.equipped[slot] === itemId ? null : itemId;
          notify(np.equipped[slot] ? "Kuşanıldı!" : "Çıkarıldı.");
          save(np);
      }
  };

  const startBattle = (r:any, l:any, isBot:boolean=false) => {
    setModal(null); setBotMatch(isBot); setTurn('p1');
    const qs = QUESTIONS.filter(q=>r.id==='arena' || q.t==='genel' || q.t===r.type).sort(()=>Math.random()-0.5).slice(0,10);
    setBattle({ active:true, region:r, level:l, enemyHp:l.hp, maxEnemyHp:l.hp, qs, qIdx:0, timer:20, combo:0, log:null, dmgText:null, shaking:false });
    setScreen('battle');
  };

  const handleMove = (correct:boolean) => {
    if(!battle.active) return;
    let nb = {...battle};
    const ps = getStats(player!);
    const dmg = botMatch && turn==='p2' ? 30+(player!.lvl*2) : ps.atk;
    
    nb.dmgText = correct ? {val:dmg,c:'#0f6'} : {val:20,c:'#f05'};
    
    if(correct) {
      if(turn==='p1') { 
        nb.enemyHp-=dmg; nb.log=`Vurdun: ${dmg}!`; nb.combo++;
        if(nb.enemyHp<=0) {
          fireConfetti(); notify("ZAFER! +100 Altın");
          const np={...player!}; np.gold+=100; np.xp+=30; np.score+=50; np.hp=ps.maxHp;
          if(np.xp>=np.maxXp){ np.lvl++; np.xp=0; np.maxXp=Math.floor(np.maxXp*1.2); notify("SEVİYE ATLADIN!"); }
          if(nb.level.isBoss && nb.region) {
             const rIdx = REGIONS.findIndex(r=>r.id===nb.region.id);
             if(rIdx<REGIONS.length-1) { const nr=REGIONS[rIdx+1].id; if(!np.unlockedRegions.includes(nr)) np.unlockedRegions.push(nr); }
             const cp=np.regionProgress[nb.region.id]||0; const li=nb.region.levels.findIndex((ll:any)=>ll.id===nb.level.id); if(li===cp) np.regionProgress[nb.region.id]=cp+1;
          }
          save(np); setBattle({active:false}); setScreen('menu'); return;
        }
      } else { 
        const np={...player!}; np.hp-=dmg; setPlayer(np); nb.log=`Bot Vurdu: ${dmg}`;
        if(np.hp<=0) { np.hp=ps.maxHp; save(np); notify("YENİLDİN..."); setBattle({active:false}); setScreen('menu'); return; }
      }
    } else { 
      if(turn==='p1') {
        const np={...player!}; np.hp-=20; setPlayer(np); nb.log="Yanlış! -20 Can"; nb.combo=0;
        if(np.hp<=0) { np.hp=ps.maxHp; save(np); notify("YENİLDİN..."); setBattle({active:false}); setScreen('menu'); return; }
      } else nb.log="Bot Iskalamadı!";
    }
    nb.qIdx = (nb.qIdx+1)%nb.qs.length; setBattle(nb);
    if(botMatch) setTurn(prev=>prev==='p1'?'p2':'p1');
  };

  const useJoker = (id:string) => {
      if(!battle.active || player!.jokers[id]<=0) return;
      const np={...player!}; np.jokers[id]--;
      if(id==='heal') { np.hp=Math.min(np.hp+50,getStats(np).maxHp); notify("Can Yenilendi"); }
      if(id==='5050') notify("İki şık elendi!");
      save(np);
  };

  if(!mounted) return <div style={{height:'100vh',background:'#000'}}></div>;

  return (
    <div style={{height:'100vh',background:'radial-gradient(circle at center, #111, #000)',color:'white',fontFamily:'Segoe UI, sans-serif',overflow:'hidden',display:'flex',flexDirection:'column'}}>
      <canvas ref={confettiRef} style={{position:'absolute',top:0,left:0,pointerEvents:'none',zIndex:999}} />
      <style>{`@keyframes pulse { 0% {transform:scale(1)} 50% {transform:scale(1.05)} 100% {transform:scale(1)} } .dmg { position:absolute; top:40%; left:50%; transform:translateX(-50%); font-size:60px; font-weight:800; animation:float 1s forwards; text-shadow:0 0 20px black; }`}</style>

      {screen!=='auth' && (
        <div style={{...S.glass,margin:'10px',padding:'12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',gap:'15px',fontWeight:'bold',fontSize:'16px'}}>
             <span>{COSTUMES[player!.currentCostume].i}</span> <span style={S.neon('#fc0')}>⚡ {player!.lvl}</span> <span style={S.neon('#0f6')}>❤️ {player!.hp}</span> <span style={S.neon('#00eaff')}>💰 {player!.gold}</span>
          </div>
          <button style={{...S.btn,...S.btnD,padding:'8px 12px'}} onClick={()=>setScreen('auth')}>ÇIKIŞ</button>
        </div>
      )}

      {notif && <div style={{position:'absolute',top:80,left:'50%',transform:'translateX(-50%)',background:'#0f6',padding:'10px 20px',borderRadius:'10px',color:'black',zIndex:999,fontWeight:'bold',boxShadow:'0 0 20px #0f6'}}>{notif}</div>}

      {screen==='auth' && (
        <div style={{height:'100%',display:'flex',justifyContent:'center',alignItems:'center'}}>
          <div style={{...S.glass,padding:'40px',width:'400px',textAlign:'center'}}>
            <h1 style={{...S.neon('#00eaff'),fontSize:'40px',marginBottom:'20px'}}>EDEBİYAT<br/>EFSANELERİ</h1>
            <input style={{width:'100%',padding:'12px',marginBottom:'10px',borderRadius:'8px',border:'none',background:'rgba(255,255,255,0.1)',color:'white'}} placeholder="Kullanıcı Adı" value={auth.user} onChange={e=>setAuth({...auth,user:e.target.value})}/>
            <input style={{width:'100%',padding:'12px',marginBottom:'20px',borderRadius:'8px',border:'none',background:'rgba(255,255,255,0.1)',color:'white'}} type="password" placeholder="Şifre" value={auth.pass} onChange={e=>setAuth({...auth,pass:e.target.value})}/>
            <button style={{...S.btn,...S.btnS,width:'100%'}} onClick={handleAuth}>{auth.reg?'KAYIT OL':'GİRİŞ YAP'}</button>
            <p style={{marginTop:'15px',cursor:'pointer',color:'#aaa'}} onClick={()=>setAuth({...auth,reg:!auth.reg})}>{auth.reg?'Giriş Yap':'Kayıt Ol'}</p>
          </div>
        </div>
      )}

      {screen==='menu' && (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'30px',padding:'20px'}}>
           <div style={{...S.glass,padding:'30px',width:'320px',textAlign:'center'}}>
               <div style={{fontSize:'80px',cursor:'pointer',animation:'pulse 2s infinite'}} onClick={()=>setModal('wardrobe')}>{COSTUMES[player!.currentCostume].i}</div>
               <h2 style={{...S.neon('#fff'),margin:'10px 0'}}>{player!.name}</h2>
               <div style={{background:'rgba(255,255,255,0.05)',padding:'10px',borderRadius:'10px',textAlign:'left'}}>
                   <div style={{display:'flex',justifyContent:'space-between'}}><span>⚔️ Saldırı</span><span style={{color:'#f05',fontWeight:'bold'}}>{getStats(player!).atk}</span></div>
                   <div style={{display:'flex',justifyContent:'space-between'}}><span>🛡️ Can</span><span style={{color:'#0f6',fontWeight:'bold'}}>{getStats(player!).maxHp}</span></div>
               </div>
           </div>
           <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'15px',width:'500px'}}>
               {[{id:'map',t:'MACERA',i:'🗺️',c:'#fc0'},{id:'arena',t:'ARENA',i:'⚔️',c:'#f05'},{id:'shop',t:'MARKET',i:'🛒',c:'#0f6'},{id:'inv',t:'ÇANTA',i:'🎒',c:'#00eaff'}].map(m=>{
                   const isArenaLocked = m.id === 'arena' && !player!.unlockedRegions.includes('r3') && !player!.isAdmin;
                   return (
                   <div key={m.id} 
                        onClick={()=>{
                            if(isArenaLocked) return notify("Önce Hikaye Modunu Bitir!");
                            if(m.id==='arena'){ setTimeout(()=>startBattle({id:'arena',name:'ARENA',x:0,y:0,type:'all',bg:IMGS.bg_arena,unlockC:'king',levels:[]},{id:'pvp',t:'PvP',hp:getStats(player!).maxHp,en:'Rakip',ico:'🤖',diff:'PvP'},true),1000) } 
                            else setScreen(m.id as any)
                        }} 
                        style={{...S.glass,height:'180px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:isArenaLocked?'not-allowed':'pointer',border:`1px solid ${isArenaLocked?'#444':m.c}`,opacity:isArenaLocked?0.5:1}}>
                       <div style={{fontSize:'50px',marginBottom:'10px'}}>{isArenaLocked ? '🔒' : m.i}</div>
                       <div style={{...S.neon(isArenaLocked?'#888':m.c),fontSize:'20px',fontWeight:'bold'}}>{m.t}</div>
                   </div>
               )})}
           </div>
        </div>
      )}

      {screen==='battle' && (
        <div style={{flex:1,display:'flex',flexDirection:'column',background:`linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.9)), url(${battle.region?.bg}) center/cover`}}>
           <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'space-around',position:'relative'}}>
               {battle.dmgText && <div className="dmg" style={{color:battle.dmgText.c}}>{battle.dmgText.val}</div>}
               <div style={{textAlign:'center',transform:battle.shaking?'translateX(5px)':''}}>
                   <div style={{fontSize:'100px',filter:'drop-shadow(0 0 30px #f05)'}}>{battle.level?.ico}</div>
                   <div style={{...S.glass,padding:'5px 15px',marginTop:'10px'}}>
                       <div style={{fontWeight:'bold'}}>{battle.level?.en}</div>
                       <div style={{height:'8px',width:'100px',background:'#333',borderRadius:'4px'}}><div style={{width:`${Math.max(0,(battle.enemyHp/battle.maxEnemyHp)*100)}%`,height:'100%',background:'#f05'}}></div></div>
                   </div>
               </div>
               <div style={{textAlign:'center'}}>
                   <div style={{marginBottom:'10px',fontSize:'20px',fontWeight:'bold',color:'#fc0'}}>{battle.log}</div>
                   {botMatch && turn!=='p1' ? <div style={{...S.neon('#f05'),fontSize:'24px',animation:'pulse 1s infinite'}}>BOT DÜŞÜNÜYOR...</div> : <div style={{...S.neon('#0f6'),fontSize:'30px'}}>SENİN SIRAN</div>}
               </div>
               <div style={{textAlign:'center'}}>
                   <div style={{fontSize:'100px',filter:'drop-shadow(0 0 30px #00eaff)'}}>{COSTUMES[player!.currentCostume].i}</div>
                   <div style={{...S.glass,padding:'5px 15px',marginTop:'10px'}}>
                       <div style={{fontWeight:'bold'}}>{player!.name}</div>
                       <div style={{height:'8px',width:'100px',background:'#333',borderRadius:'4px'}}><div style={{width:`${(player!.hp/getStats(player!).maxHp)*100}%`,height:'100%',background:'#0f6'}}></div></div>
                   </div>
               </div>
           </div>
           <div style={{...S.glass,margin:'20px',padding:'20px',border:'1px solid #00eaff',minHeight:'200px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
               {botMatch && turn!=='p1' ? <div style={{textAlign:'center',fontSize:'20px',color:'#aaa'}}>Rakibin hamlesi bekleniyor...</div> : (
                   <>
                     <div style={{textAlign:'center',marginBottom:'15px',fontSize:'20px',fontWeight:'bold'}}>{battle.qs[battle.qIdx].q}</div>
                     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                         {battle.qs[battle.qIdx].o.map((o:string,i:number)=>(<button key={i} style={S.btn} onClick={()=>handleMove(i===battle.qs[battle.qIdx].a)}>{o}</button>))}
                     </div>
                     <div style={{display:'flex',justifyContent:'center',gap:'10px',marginTop:'15px'}}>
                         {Object.keys(player!.jokers).map(k=>(<button key={k} style={{...S.btn,background:'#444',fontSize:'12px'}} onClick={()=>useJoker(k)} disabled={player!.jokers[k]===0}>{k} ({player!.jokers[k]})</button>))}
                         <button style={{...S.btn,...S.btnD}} onClick={()=>{setScreen('menu');setBattle({active:false})}}>PES ET</button>
                     </div>
                   </>
               )}
           </div>
        </div>
      )}

      {screen==='map' && (
        <div style={{flex:1,position:'relative',background:`url(${IMGS.bg_main}) center/cover`}}>
            <button style={{...S.btn,...S.btnD,position:'absolute',top:20,right:20,zIndex:10}} onClick={()=>setScreen('menu')}>GERİ</button>
            {REGIONS.map(r=>{
                const u=player!.unlockedRegions.includes(r.id);
                return (<div key={r.id} onClick={()=>{if(u){setModal(r);}else notify("Önceki Bölümü Bitir!")}} style={{position:'absolute',left:`${r.x}%`,top:`${r.y}%`,transform:'translate(-50%,-50%)',cursor:u?'pointer':'not-allowed',textAlign:'center',opacity:u?1:0.5,filter:u?'drop-shadow(0 0 20px #00eaff)':'grayscale(100%)'}}>
                    <div style={{fontSize:'60px',animation:u?'pulse 2s infinite':''}}>{u ? (r.type==='iletisim'?'📡':r.type==='hikaye'?'🌲':r.type==='siir'?'🎭':r.id==='tut'?'🎓':'🐲') : '🔒'}</div>
                    <div style={{...S.glass,padding:'5px',fontSize:'12px'}}>{r.name}</div>
                </div>)
            })}
        </div>
      )}

      {screen==='shop' && (
          <div style={{flex:1,padding:'30px',overflowY:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'20px',alignItems:'center'}}>
                  <h1 style={S.neon('#00eaff')}>MARKET</h1>
                  <div style={{display:'flex',gap:'10px'}}>
                      <button style={{...S.btn,background:shopTab==='wep'?'#00eaff':'#333'}} onClick={()=>setShopTab('wep')}>⚔️</button>
                      <button style={{...S.btn,background:shopTab==='arm'?'#00eaff':'#333'}} onClick={()=>setShopTab('arm')}>🛡️</button>
                      <button style={{...S.btn,background:shopTab==='joker'?'#00eaff':'#333'}} onClick={()=>setShopTab('joker')}>🧪</button>
                  </div>
                  <button style={{...S.btn,...S.btnD}} onClick={()=>setScreen('menu')}>GERİ</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'15px'}}>
                  {Object.values(ITEMS).filter((it:any)=>it.type===shopTab).map((it:any)=>{
                      const owned = player!.inventory.includes(it.id);
                      return (
                      <div key={it.id} style={{...S.glass,padding:'15px',textAlign:'center',border:`1px solid ${owned?'#0f6':'#333'}`}}>
                          <div style={{fontSize:'40px',marginBottom:'10px'}}>{it.icon}</div>
                          <div style={{fontWeight:'bold'}}>{it.name}</div>
                          <div style={{fontSize:'12px',color:'#aaa',margin:'5px 0'}}>{it.desc}</div>
                          <div style={{color:'#fc0',fontWeight:'bold'}}>{player!.isAdmin ? 'ÜCRETSİZ' : `${it.cost} G`}</div>
                          {owned && it.type!=='joker' ? 
                              <div style={{color:'#0f6',fontWeight:'bold',marginTop:'10px'}}>SAHİPSİN</div> : 
                              <button style={{...S.btn,...S.btnS,width:'100%',marginTop:'10px'}} onClick={()=>buyItem(it.id)}>AL</button>
                          }
                      </div>
                  )})}
              </div>
          </div>
      )}

      {screen==='inv' && (
          <div style={{flex:1,padding:'30px',overflowY:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'20px'}}>
                  <h1 style={S.neon('#00eaff')}>ÇANTA</h1><button style={{...S.btn,...S.btnD}} onClick={()=>setScreen('menu')}>GERİ</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'15px'}}>
                  {player!.inventory.map((itemId,i)=>{
                      const it = ITEMS[itemId];
                      if(!it) return null;
                      const isEquipped = player!.equipped.wep === itemId || player!.equipped.arm === itemId;
                      return (
                      <div key={i} style={{...S.glass,padding:'15px',textAlign:'center',border:isEquipped?'2px solid #0f6':'1px solid #444'}}>
                          <div style={{fontSize:'40px',marginBottom:'10px'}}>{it.icon}</div>
                          <div style={{fontWeight:'bold'}}>{it.name}</div>
                          <div style={{fontSize:'12px',color:'#aaa',margin:'5px 0'}}>{it.type==='wep'?'⚔️':'🛡️'} +{it.val}</div>
                          <button style={{...S.btn,marginTop:'10px',width:'100%',background:isEquipped?'#444':'#00eaff'}} onClick={()=>toggleEquip(itemId)}>
                              {isEquipped ? 'ÇIKAR' : 'KUŞAN'}
                          </button>
                      </div>
                  )})}
                  {player!.inventory.length === 0 && <div style={{color:'#888'}}>Çantan boş. Marketten eşya al!</div>}
              </div>
          </div>
      )}

      {modal && modal!=='wardrobe' && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:100,display:'flex',justifyContent:'center',alignItems:'center'}}>
          <div style={{...S.glass,padding:'30px',width:'500px',textAlign:'center',border:'2px solid #00eaff'}}>
            <h2 style={S.neon('#00eaff')}>{modal.name}</h2>
            <div style={{margin:'20px 0',maxHeight:'300px',overflowY:'auto'}}>
              {modal.levels.map((l:any,i:number)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px',marginBottom:'8px',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',background:player!.regionProgress[modal.id]>=i?'rgba(0,255,100,0.1)':'rgba(0,0,0,0.3)'}}>
                  <div style={{textAlign:'left'}}><div style={{fontWeight:'bold'}}>{l.t}</div></div>
                  {player!.regionProgress[modal.id]>=i ? <button style={S.btn} onClick={()=>startBattle(modal,l)}>GİR</button> : <span>🔒</span>}
                </div>
              ))}
            </div>
            <button style={{...S.btn,...S.btnD,width:'100%'}} onClick={()=>setModal(null)}>KAPAT</button>
          </div>
        </div>
      )}

      {modal==='wardrobe' && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:100,display:'flex',justifyContent:'center',alignItems:'center'}}>
          <div style={{...S.glass,padding:'30px',width:'600px',height:'500px',textAlign:'center'}}>
            <h2 style={S.neon('#fc0')}>DOLAP</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'15px',margin:'20px 0',overflowY:'auto',height:'350px'}}>
              {Object.keys(COSTUMES).map(k=>(
                <div key={k} style={{border:`1px solid ${player!.currentCostume===k?'#0f6':'#444'}`,padding:'15px',borderRadius:'10px',background:player!.currentCostume===k?'rgba(0,255,100,0.1)':'transparent'}}>
                  <div style={{fontSize:'50px'}}>{COSTUMES[k].i}</div><div style={{fontWeight:'bold'}}>{COSTUMES[k].n}</div>
                  {player!.unlockedCostumes.includes(k) ? <button style={{...S.btn,marginTop:'10px',width:'100%',fontSize:'12px',background:player!.currentCostume===k?'#0f6':'#0072ff'}} onClick={()=>{save({...player!,currentCostume:k});setModal(null)}}>GİY</button> : <div style={{color:'#f05',marginTop:'10px',fontWeight:'bold'}}>KİLİTLİ</div>}
                </div>
              ))}
            </div>
            <button style={{...S.btn,...S.btnD,width:'100%'}} onClick={()=>setModal(null)}>KAPAT</button>
          </div>
        </div>
      )}
    </div>
  );
}