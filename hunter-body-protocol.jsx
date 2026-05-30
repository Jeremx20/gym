import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "hunter_body_v3";
const START_DATE  = "2026-06-08";
const KG_TO_LBS   = 2.20462;

const PROGRAM = {
  Lundi:    { label:"PUSH",          color:"#ff4444", icon:"🔥", exercises:[
    {name:"Développé couché",           sets:4, reps:"6-10",       rest:150, restLabel:"2-3 min"},
    {name:"Développé incliné haltères", sets:3, reps:"8-12",       rest:105, restLabel:"90-120 sec"},
    {name:"Dips",                       sets:3, reps:"8-12 ou max",rest:90,  restLabel:"90 sec"},
    {name:"Élévations latérales",       sets:4, reps:"12-20",      rest:60,  restLabel:"60 sec"},
    {name:"Triceps pushdown",           sets:3, reps:"10-15",      rest:68,  restLabel:"60-75 sec"},
    {name:"Extension triceps au-dessus",sets:2, reps:"10-15",      rest:68,  restLabel:"60-75 sec"},
  ]},
  Mardi:    { label:"PULL",          color:"#4488ff", icon:"⚡", exercises:[
    {name:"Tractions / tirage vertical",sets:4, reps:"6-10",  rest:120, restLabel:"2 min"},
    {name:"Rowing barre ou machine",    sets:4, reps:"8-12",  rest:105, restLabel:"90-120 sec"},
    {name:"Tirage horizontal",          sets:3, reps:"10-12", rest:90,  restLabel:"90 sec"},
    {name:"Face pull",                  sets:3, reps:"12-20", rest:60,  restLabel:"60 sec"},
    {name:"Curl biceps barre",          sets:3, reps:"8-12",  rest:68,  restLabel:"60-75 sec"},
    {name:"Curl incliné ou marteau",    sets:2, reps:"10-12", rest:68,  restLabel:"60-75 sec"},
  ]},
  Mercredi: { label:"REPOS",         color:"#444",    icon:"💤", exercises:[] },
  Jeudi:    { label:"LEGS",          color:"#aa44ff", icon:"💪", exercises:[
    {name:"Squat",            sets:4, reps:"6-10",  rest:150, restLabel:"2-3 min"},
    {name:"Leg press",        sets:3, reps:"10-15", rest:90,  restLabel:"90 sec"},
    {name:"Romanian deadlift",sets:3, reps:"8-12",  rest:105, restLabel:"90-120 sec"},
    {name:"Leg curl",         sets:3, reps:"10-15", rest:68,  restLabel:"60-75 sec"},
    {name:"Mollets",          sets:4, reps:"12-20", rest:53,  restLabel:"45-60 sec"},
    {name:"Abdos",            sets:3, reps:"12-20", rest:53,  restLabel:"45-60 sec"},
  ]},
  Vendredi: { label:"HAUT DU CORPS", color:"#ffaa00", icon:"⚔️", exercises:[
    {name:"Développé incliné",          sets:3, reps:"8-12",  rest:105, restLabel:"90-120 sec"},
    {name:"Tractions / tirage vertical",sets:3, reps:"8-12",  rest:90,  restLabel:"90 sec"},
    {name:"Rowing",                     sets:3, reps:"8-12",  rest:90,  restLabel:"90 sec"},
    {name:"Élévations latérales",       sets:4, reps:"12-20", rest:60,  restLabel:"60 sec"},
    {name:"Curl biceps",                sets:3, reps:"10-12", rest:60,  restLabel:"60 sec"},
    {name:"Triceps pushdown",           sets:3, reps:"10-12", rest:60,  restLabel:"60 sec"},
  ]},
  Samedi:   { label:"CARDIO LÉGER",  color:"#00ccaa", icon:"🏃", cardioOnly:true, exercises:[
    {name:"Marche rapide / jogging",sets:1, reps:"20-30 min",rest:0, restLabel:"—"},
    {name:"Vélo ou elliptique",     sets:1, reps:"15-20 min",rest:0, restLabel:"—"},
    {name:"Abdos",                  sets:3, reps:"15-20",    rest:45, restLabel:"45 sec"},
    {name:"Étirements / mobilité",  sets:1, reps:"10-15 min",rest:0, restLabel:"—"},
  ]},
  Dimanche: { label:"REPOS",         color:"#444",    icon:"💤", exercises:[] },
};

const DAYS  = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MEALS = [
  {id:"pre",   label:"Pré-workout",   icon:"🍌", kcal:200,  hour:7},
  {id:"post",  label:"Post-workout",  icon:"🥛", kcal:900,  hour:9},
  {id:"lunch", label:"Déjeuner",      icon:"🍚", kcal:600,  hour:12},
  {id:"snack", label:"Collation",     icon:"🥜", kcal:300,  hour:16},
  {id:"dinner",label:"Dîner",         icon:"🍖", kcal:700,  hour:20},
  {id:"sleep", label:"Avant-sommeil", icon:"🥛", kcal:200,  hour:22},
];

const DELOAD_EVERY = 6; // weeks

const DEFAULT = {
  unit:"kg", heightCm:178, currentWeight:57, targetWeight:67.5,
  weightHistory:[], sessions:{}, sessionLogs:{}, sessionNotes:{},
  meals:{}, calorieLog:{}, charges:{}, measurements:{}, measureHistory:[],
  notifEnabled:false, weeksSinceDeload:0,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const toKg  = (v,u) => u==="lbs" ? v/KG_TO_LBS : v;
const toDisp= (kg,u)=> u==="lbs" ? +(kg*KG_TO_LBS).toFixed(1) : +kg.toFixed(1);
const uLabel= u => u==="lbs"?"lbs":"kg";
const tKey  = ()=> new Date().toISOString().split("T")[0];
const dayName=()=>["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][new Date().getDay()];
const bmi   = (w,h)=> (w/((h/100)**2)).toFixed(1);
const tdee  = (w,h)=> Math.round((10*w+6.25*h-5*22+5)*1.55);
const weeksLeft=(c,t)=> t<=c?0:Math.ceil((t-c)/0.3);
const daysToStart=()=>{ const d=new Date(START_DATE)-new Date(tKey()); return Math.max(0,Math.ceil(d/86400000)); };
const isBeforeStart=()=> tKey()<START_DATE;

function getRank(w,t){
  const p=((w-57)/(t-57))*100;
  if(p>=100) return {rank:"S",color:"#ffd700",glow:"#ffd70088"};
  if(p>=80)  return {rank:"A",color:"#ff4444",glow:"#ff444488"};
  if(p>=60)  return {rank:"B",color:"#aa44ff",glow:"#aa44ff88"};
  if(p>=40)  return {rank:"C",color:"#4488ff",glow:"#4488ff88"};
  if(p>=20)  return {rank:"D",color:"#00ccaa",glow:"#00ccaa88"};
  return {rank:"E",color:"#888888",glow:"#88888844"};
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [data,setData]=useState(()=>{
    try{ const s=localStorage.getItem(STORAGE_KEY); return s?{...DEFAULT,...JSON.parse(s)}:DEFAULT; }
    catch{ return DEFAULT; }
  });
  const [tab,setTab]=useState("dashboard");
  const [selDay,setSelDay]=useState(dayName());
  const [histEx,setHistEx]=useState(null); // exercise name for history modal
  const [chargeModal,setChargeModal]=useState(null);
  const [timerEx,setTimerEx]=useState(null);
  const [timerSec,setTimerSec]=useState(0);
  const [timerRunning,setTimerRunning]=useState(false);
  const [modal,setModal]=useState(null); // "weight"|"measure"|"cal"|"note"|"notif"
  const [noteText,setNoteText]=useState("");
  const [inputs,setInputs]=useState({weight:"",charge:"",reps:"",cal:"",chest:"",waist:"",arm:"",thigh:""});
  const [particles]=useState(()=>Array.from({length:25},(_,i)=>({id:i,x:Math.random()*100,y:Math.random()*100,s:Math.random()*2.5+1,sp:Math.random()*18+8,d:Math.random()*4})));
  const timerRef=useRef(null);
  const notifTimeouts=useRef([]);

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); },[data]);

  // ── Timer ──
  useEffect(()=>{
    if(timerRunning && timerSec>0){
      timerRef.current=setTimeout(()=>setTimerSec(s=>s-1),1000);
    } else if(timerRunning && timerSec===0){
      setTimerRunning(false);
      if(data.notifEnabled) sendNotif("⏱ Repos terminé !","C'est reparti pour la prochaine série 💪");
    }
    return ()=>clearTimeout(timerRef.current);
  },[timerRunning,timerSec]);

  // ── Notification scheduler ──
  useEffect(()=>{
    notifTimeouts.current.forEach(clearTimeout);
    notifTimeouts.current=[];
    if(!data.notifEnabled) return;
    const now=new Date();
    MEALS.forEach(m=>{
      const target=new Date(); target.setHours(m.hour,0,0,0);
      const diff=target-now;
      if(diff>0){
        const t=setTimeout(()=>{
          const todayMeals=data.meals[tKey()]||{};
          if(!todayMeals[m.id]) sendNotif(`🍽 Heure du ${m.label}`,`N'oublie pas ton repas — ${m.kcal} kcal`);
        },diff);
        notifTimeouts.current.push(t);
      }
    });
    // Séance reminder at 7h
    const seanceTarget=new Date(); seanceTarget.setHours(7,30,0,0);
    const seanceDiff=seanceTarget-now;
    const todayProg=PROGRAM[dayName()];
    if(seanceDiff>0 && todayProg.exercises.length>0){
      const t=setTimeout(()=>sendNotif(`⚔️ Séance du jour: ${todayProg.label}`,"Hunter Protocol activé — en route pour la salle"),seanceDiff);
      notifTimeouts.current.push(t);
    }
    return()=>notifTimeouts.current.forEach(clearTimeout);
  },[data.notifEnabled,data.meals]);

  function sendNotif(title,body){
    if(Notification.permission==="granted") new Notification(title,{body,icon:"https://img.icons8.com/fluency/48/dumbbell.png"});
  }

  async function toggleNotif(){
    if(!data.notifEnabled){
      const perm=await Notification.requestPermission();
      if(perm==="granted") setData(d=>({...d,notifEnabled:true}));
      else alert("Active les notifications dans les réglages de ton navigateur.");
    } else {
      setData(d=>({...d,notifEnabled:false}));
    }
  }

  const save=useCallback(fn=>setData(d=>({...d,...fn(d)})),[]);
  const inp=(k,v)=>setInputs(i=>({...i,[k]:v}));

  // ── Derived ──
  const {rank,color:rc,glow:rg}=getRank(data.currentWeight,data.targetWeight);
  const progPct=Math.min(100,Math.max(0,((data.currentWeight-57)/(data.targetWeight-57))*100));
  const wl=weeksLeft(data.currentWeight,data.targetWeight);
  const today=dayName();
  const dk=tKey();
  const todayProg=PROGRAM[today];
  const todaySess=data.sessions[dk]||{};
  const todayMeals=data.meals[dk]||{};
  const todayCal=data.calorieLog[dk]||0;
  const todayNote=data.sessionNotes[dk]||"";
  const myTdee=tdee(data.currentWeight,data.heightCm);
  const targetCal=myTdee+400;
  const calPct=Math.min(100,Math.round((todayCal/targetCal)*100));
  const mealsDone=Object.values(todayMeals).filter(Boolean).length;
  const exDone=Object.values(todaySess).filter(Boolean).length;
  const totalEx=todayProg.exercises.length;
  const sessPct=totalEx>0?Math.round((exDone/totalEx)*100):0;
  const dayLog=(data.sessionLogs[dk])||{};
  const totalVolKg=Object.values(dayLog).flat().reduce((s,e)=>s+e.weight*(e.reps||1),0);
  const totalSetsToday=Object.values(dayLog).reduce((s,a)=>s+a.length,0);

  // Streak
  const streak=(()=>{
    let s=0; const d=new Date();
    for(let i=0;i<42;i++){
      const k=d.toISOString().split("T")[0];
      const dn=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][d.getDay()];
      const p=PROGRAM[dn];
      if(p.exercises.length===0){d.setDate(d.getDate()-1);continue;}
      const ss=data.sessions[k]||{};
      if(Object.values(ss).filter(Boolean).length>=p.exercises.length*0.5) s++;
      else break;
      d.setDate(d.getDate()-1);
    }
    return s;
  })();

  // Deload check
  const weekNumber=Math.floor((new Date()-new Date(START_DATE))/604800000)+1;
  const needsDeload=weekNumber>0 && weekNumber%DELOAD_EVERY===0;

  // Charge helpers
  const allSets=ex=>(data.charges[ex]||[]);
  const lastSet=ex=>{ const h=allSets(ex); return h.length?h[h.length-1]:null; };
  const prSet  =ex=>{ const h=allSets(ex); return h.length?h.reduce((m,e)=>e.weight>m.weight?e:m,h[0]):null; };
  const todaySetsFor=ex=>(dayLog[ex]||[]);

  function nextReco(ex,repRange){
    const sets=todaySetsFor(ex);
    const ref=sets.length?sets:allSets(ex).filter(e=>e.date===allSets(ex).slice(-1)[0]?.date);
    if(!ref.length){ const lc=lastSet(ex); return lc?{weight:lc.weight,up:false,note:"Même charge"}:null; }
    const top=parseInt((repRange||"").split("-")[1])||10;
    const allTop=ref.every(s=>s.reps&&s.reps>=top);
    const avg=ref.reduce((s,e)=>s+e.weight,0)/ref.length;
    const inc=data.unit==="lbs"?toKg(5,"lbs"):2.5;
    return allTop?{weight:avg+inc,up:true,note:`Top reps → +${data.unit==="lbs"?"5 lbs":"2.5 kg"} 🔥`}:{weight:avg,up:false,note:"Consolide d'abord"};
  }

  function logSet(){
    const c=parseFloat(inputs.charge); const r=parseInt(inputs.reps);
    if(isNaN(c)||c<=0) return;
    const wkg=toKg(c,data.unit);
    save(d=>{
      const ex=chargeModal;
      const prev=d.charges[ex]||[];
      return {
        sessionLogs:{...d.sessionLogs,[dk]:{...(d.sessionLogs[dk]||{}),[ex]:[...(d.sessionLogs[dk]?.[ex]||[]),{weight:wkg,reps:r||null}]}},
        charges:{...d.charges,[ex]:[...prev,{date:dk,weight:wkg,reps:r||null}].slice(-200)},
      };
    });
    inp("charge",""); inp("reps","");
  }

  function removeLastSet(ex){
    save(d=>{
      const sets=[...(d.sessionLogs[dk]?.[ex]||[])];
      sets.pop();
      return {sessionLogs:{...d.sessionLogs,[dk]:{...(d.sessionLogs[dk]||{}),[ex]:sets}}};
    });
  }

  function startTimer(ex,secs){
    setTimerEx(ex); setTimerSec(secs); setTimerRunning(true);
  }

  // ─── RENDER HELPERS ──────────────────────────────────────────────────────
  const u=data.unit;

  function StatCard({label,value,sub,color}){
    return(
      <div style={S.statCard}>
        <div style={{fontSize:9,color:color||rc,fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:5}}>{label}</div>
        <div style={{fontSize:21,fontWeight:900,color:"#fff",fontFamily:"'Orbitron',monospace"}}>{value}</div>
        {sub&&<div style={{fontSize:11,color:"#ffffff55",fontFamily:"'Rajdhani',sans-serif",marginTop:2}}>{sub}</div>}
      </div>
    );
  }

  function ProgBar({pct,color,height=5}){
    return(
      <div style={{height,background:"#ffffff0a",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:3,transition:"width .7s ease"}}/>
      </div>
    );
  }

  // ─── PRE-START BANNER ────────────────────────────────────────────────────
  const PreBanner=isBeforeStart()&&(
    <div style={{padding:"11px 14px",borderRadius:10,background:"#0d0d18",border:"1px solid #ffffff11",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0}}>
      <div>
        <div style={{fontSize:9,color:"#ffffff22",fontFamily:"'Orbitron',monospace",letterSpacing:3}}>DÉMARRAGE</div>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:13,color:"#ffffff55",marginTop:2}}>Lundi 8 juin · Premier jour salle 📦</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:30,fontWeight:900,color:"#fff",lineHeight:1}}>{daysToStart()}</div>
        <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:10,color:"#ffffff33",letterSpacing:2}}>JOURS</div>
      </div>
    </div>
  );

  // ─── TIMER OVERLAY ───────────────────────────────────────────────────────
  const TimerOverlay=timerRunning||timerSec>0?(
    <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:500,background:"#0f0f1a",border:`2px solid ${rc}`,borderRadius:16,padding:"14px 24px",display:"flex",alignItems:"center",gap:16,boxShadow:`0 0 30px ${rg}`}}>
      <div>
        <div style={{fontSize:9,color:rc,fontFamily:"'Orbitron',monospace",letterSpacing:2}}>REPOS — {timerEx}</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:32,color:timerSec<=10?"#ff4444":rc,fontWeight:900}}>
          {Math.floor(timerSec/60)}:{String(timerSec%60).padStart(2,"0")}
        </div>
      </div>
      <button onClick={()=>{setTimerRunning(false);setTimerSec(0);}} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${rc}44`,background:"transparent",color:rc,fontFamily:"'Orbitron',monospace",fontSize:10,cursor:"pointer"}}>SKIP</button>
    </div>
  ):null;

  // ─── TABS ────────────────────────────────────────────────────────────────
  const TABS=[["dashboard","⬡","DASH"],["today","⚔","SÉANCE"],["meals","🍖","REPAS"],["history","📋","HISTO"],["progress","📈","STATS"]];

  // ═══════════════════════════════════════════════════════════════════════════
  return(
    <div style={S.root}>
      {/* Particles */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
        {particles.map(p=>(
          <div key={p.id} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,width:p.s,height:p.s,borderRadius:"50%",background:rc,opacity:.1,animation:`floatP ${p.sp}s ${p.d}s infinite alternate ease-in-out`}}/>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0a0a0f;}::-webkit-scrollbar-thumb{background:${rc}44;border-radius:2px;}
        @keyframes floatP{from{transform:translateY(0) scale(1);}to{transform:translateY(-18px) scale(1.3);}}
        @keyframes pulse{0%,100%{box-shadow:0 0 12px ${rg};}50%{box-shadow:0 0 30px ${rg},0 0 55px ${rg};}}
        @keyframes scan{0%{transform:translateY(-100%);}100%{transform:translateY(100vh);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
        .btn{transition:all .15s;cursor:pointer;}.btn:hover{opacity:.8;transform:scale(.97);}
        .row{transition:all .2s;cursor:pointer;}.row:hover{background:#ffffff0a!important;transform:translateX(3px);}
        .dBtn{transition:all .15s;cursor:pointer;}.dBtn:hover{border-color:${rc}!important;}
        input[type=number]{-moz-appearance:textfield;}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
      `}</style>

      {/* Scanline */}
      <div style={{position:"fixed",top:0,left:0,right:0,height:"2px",background:`linear-gradient(90deg,transparent,${rc}44,transparent)`,animation:"scan 8s linear infinite",pointerEvents:"none",zIndex:999}}/>

      {TimerOverlay}

      <div style={S.wrap}>

        {/* ── HEADER ── */}
        <div style={S.header}>
          <div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:rc,letterSpacing:4,marginBottom:3}}>HUNTER BODY PROTOCOL</div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:19,color:"#fff",fontWeight:900,letterSpacing:2}}>JEREMIE</div>
            <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:"#ffffff44",marginTop:2}}>{data.heightCm}cm · BMI {bmi(data.currentWeight,data.heightCm)} · TDEE ~{myTdee} kcal</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <div style={{...S.rankBadge,borderColor:rc,animation:"pulse 3s infinite"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:28,fontWeight:900,color:rc}}>{rank}</div>
              <div style={{fontSize:8,color:"#ffffff44",fontFamily:"'Rajdhani',sans-serif",letterSpacing:2}}>RANK</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="btn" onClick={()=>setData(d=>({...d,unit:d.unit==="kg"?"lbs":"kg"}))} style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${rc}55`,background:`${rc}15`,color:rc,fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:1}}>{u.toUpperCase()} ⇄</button>
              <button className="btn" onClick={toggleNotif} style={{padding:"3px 9px",borderRadius:5,border:`1px solid ${data.notifEnabled?"#00ff8855":"#ffffff22"}`,background:data.notifEnabled?"#00ff8815":"#ffffff08",color:data.notifEnabled?"#00ff88":"#ffffff44",fontSize:13}}>🔔</button>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{display:"flex",gap:5,marginBottom:13}}>
          {TABS.map(([id,icon,label])=>(
            <button key={id} className="btn" onClick={()=>setTab(id)} style={{flex:1,padding:"8px 2px",borderRadius:8,border:`1px solid ${tab===id?rc:"#ffffff15"}`,background:tab===id?`${rc}18`:"#ffffff06",color:tab===id?rc:"#ffffff44",fontFamily:"'Rajdhani',sans-serif",fontSize:10,fontWeight:700,letterSpacing:.5,cursor:"pointer"}}>
              <div>{icon}</div><div>{label}</div>
            </button>
          ))}
        </div>

        {/* ════════════════ DASHBOARD ════════════════ */}
        {tab==="dashboard"&&(
          <div style={S.col} className="fadeIn">
            {PreBanner}

            {/* Deload warning */}
            {needsDeload&&(
              <div style={{padding:"11px 14px",borderRadius:10,background:"#ffaa0010",border:"1px solid #ffaa0044",fontFamily:"'Rajdhani',sans-serif",fontSize:13,color:"#ffaa00"}}>
                ⚠️ Semaine {weekNumber} — C'est ta semaine de <b>décharge</b>. Réduis les charges de 40-50%, récupère.
              </div>
            )}

            {/* Stats grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
              <StatCard label="POIDS ACTUEL" value={`${toDisp(data.currentWeight,u)} ${uLabel(u)}`} sub={`Départ: ${toDisp(57,u)} ${uLabel(u)}`}/>
              <StatCard label="OBJECTIF" value={`${toDisp(data.targetWeight,u)} ${uLabel(u)}`} sub={`${toDisp(Math.max(0,data.targetWeight-data.currentWeight),u)} ${uLabel(u)} restants`}/>
              <StatCard label="STREAK" value={`${streak}j`} sub="séances conséc."/>
              <StatCard label="~SEMAINES" value={`${wl}`} sub="avant objectif"/>
            </div>

            {/* Rank progress */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={S.cardLbl}>PROGRESSION RANG {rank}</span>
                <span style={{color:rc,fontFamily:"'Orbitron',monospace",fontSize:12}}>{progPct.toFixed(1)}%</span>
              </div>
              <ProgBar pct={progPct} color={rc} height={6}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontFamily:"'Rajdhani',sans-serif",fontSize:10,color:"#ffffff33"}}>
                <span>{toDisp(57,u)} {uLabel(u)}</span><span>{toDisp(data.targetWeight,u)} {uLabel(u)}</span>
              </div>
              <div style={{display:"flex",gap:5,marginTop:10}}>
                {["E","D","C","B","A","S"].map((r,i)=>{
                  const active=i<=["E","D","C","B","A","S"].indexOf(rank);
                  return <div key={r} style={{flex:1,textAlign:"center",padding:"3px 0",borderRadius:4,background:active?`${rc}22`:"#ffffff08",border:`1px solid ${active?rc:"#ffffff11"}`,fontFamily:"'Orbitron',monospace",fontSize:10,color:active?rc:"#ffffff22"}}>{r}</div>;
                })}
              </div>
            </div>

            {/* Calories */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={S.cardLbl}>CALORIES DU JOUR</span>
                <button className="btn" onClick={()=>setModal("cal")} style={S.smBtn(rc)}>+ LOG</button>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"baseline",marginBottom:7}}>
                <span style={{fontFamily:"'Orbitron',monospace",fontSize:22,color:todayCal>=targetCal?"#00ff88":"#fff"}}>{todayCal||"—"}</span>
                <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:"#ffffff33"}}>/ {targetCal} kcal</span>
              </div>
              <ProgBar pct={calPct} color={calPct>=100?"#00ff88":rc}/>
              <div style={{marginTop:5,fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:"#ffffff33"}}>TDEE {myTdee} + 400 surplus</div>
            </div>

            {/* Today preview */}
            <div style={S.card}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:28}}>{todayProg.icon}</div>
                <div style={{flex:1}}>
                  <div style={S.cardLbl}>{today.toUpperCase()}</div>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,color:todayProg.color,fontWeight:700,marginTop:3}}>{todayProg.label}</div>
                  {totalEx>0&&<div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:"#ffffff66",marginTop:2}}>{exDone}/{totalEx} exos · Vol: {toDisp(totalVolKg,u).toLocaleString()} {uLabel(u)}</div>}
                </div>
                {totalEx>0&&(
                  <div style={{position:"relative",width:46,height:46,flexShrink:0}}>
                    <svg width="46" height="46"><circle cx="23" cy="23" r="19" fill="none" stroke={`${todayProg.color}22`} strokeWidth="3"/><circle cx="23" cy="23" r="19" fill="none" stroke={todayProg.color} strokeWidth="3" strokeDasharray={`${sessPct*1.194} 119.4`} strokeLinecap="round" transform="rotate(-90 23 23)"/></svg>
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Orbitron',monospace",fontSize:9,color:todayProg.color}}>{sessPct}%</div>
                  </div>
                )}
              </div>
              {/* Note du jour */}
              {todayNote&&<div style={{marginTop:10,padding:"8px 10px",borderRadius:7,background:"#ffffff06",fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:"#ffffff66",borderLeft:`2px solid ${rc}44`}}>📝 {todayNote}</div>}
            </div>

            {/* Repas du jour mini */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={S.cardLbl}>REPAS</span>
                <span style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:mealsDone===MEALS.length?"#00ff88":rc}}>{mealsDone}/{MEALS.length}</span>
              </div>
              <div style={{display:"flex",gap:5}}>
                {MEALS.map(m=>{
                  const done=!!todayMeals[m.id];
                  return <div key={m.id} style={{flex:1,textAlign:"center",padding:"4px 0",borderRadius:5,background:done?"#00ff8820":"#ffffff08",border:`1px solid ${done?"#00ff8844":"#ffffff0f"}`,fontSize:14}}>{m.icon}</div>;
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
              <button className="btn" onClick={()=>setModal("weight")} style={S.actionBtn(rc)}>⚖ POIDS</button>
              <button className="btn" onClick={()=>setModal("measure")} style={S.actionBtn("#ffffff44","#ffffff08","#ffffff11")}>📏 MENSUR.</button>
              <button className="btn" onClick={()=>{setNoteText(todayNote);setModal("note");}} style={S.actionBtn("#ffffff44","#ffffff08","#ffffff11")}>📝 NOTE SÉANCE</button>
              <button className="btn" onClick={()=>setTab("history")} style={S.actionBtn("#ffffff44","#ffffff08","#ffffff11")}>📋 HISTORIQUE</button>
            </div>
          </div>
        )}

        {/* ════════════════ SÉANCE ════════════════ */}
        {tab==="today"&&(
          <div style={S.col}>
            {/* Day selector + unit toggle */}
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{display:"flex",gap:5,flex:1,flexWrap:"wrap"}}>
                {DAYS.map(d=>(
                  <button key={d} className="dBtn" onClick={()=>setSelDay(d)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${selDay===d?PROGRAM[d].color:"#ffffff1a"}`,background:selDay===d?`${PROGRAM[d].color}20`:"#ffffff08",color:selDay===d?PROGRAM[d].color:"#ffffff55",fontFamily:"'Rajdhani',sans-serif",fontSize:11,fontWeight:600}}>
                    {d===today?`★${d.slice(0,2)}`:d.slice(0,2)}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={()=>setData(d=>({...d,unit:d.unit==="kg"?"lbs":"kg"}))} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${rc}55`,background:`${rc}15`,color:rc,fontFamily:"'Orbitron',monospace",fontSize:9,flexShrink:0}}>{u.toUpperCase()} ⇄</button>
            </div>

            {/* Note button for today */}
            {selDay===today&&(
              <button className="btn" onClick={()=>{setNoteText(todayNote);setModal("note");}} style={{...S.actionBtn("#ffffff44","#ffffff08","#ffffff11"),width:"100%",padding:"9px"}}>
                📝 {todayNote?"Modifier la note":"Ajouter une note de séance"}
              </button>
            )}

            <div style={{...S.card,borderColor:`${PROGRAM[selDay].color}33`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <span style={{fontSize:24}}>{PROGRAM[selDay].icon}</span>
                <div>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,color:PROGRAM[selDay].color,fontWeight:700}}>{PROGRAM[selDay].label}</div>
                  <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:"#ffffff44"}}>{selDay}{selDay===today?" — AUJOURD'HUI":""}</div>
                </div>
              </div>

              {PROGRAM[selDay].exercises.length===0?(
                <div style={{textAlign:"center",padding:"24px 0",color:"#ffffff33",fontFamily:"'Rajdhani',sans-serif"}}>
                  <div style={{fontSize:32}}>💤</div><div style={{marginTop:6}}>Récupération</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {PROGRAM[selDay].exercises.map((ex,i)=>{
                    const done=selDay===today?!!(data.sessions[dk]||{})[ex.name]:false;
                    const pr=prSet(ex.name);
                    const sets=todaySetsFor(ex.name);
                    const next=nextReco(ex.name,ex.reps);
                    const vol=sets.reduce((s,e)=>s+e.weight*(e.reps||1),0);
                    const col=PROGRAM[selDay].color;
                    return(
                      <div key={ex.name} style={{borderRadius:8,border:`1px solid ${done?col+"55":"#ffffff0f"}`,background:done?`${col}0d`:"#ffffff04",overflow:"hidden"}}>
                        {/* Header row */}
                        <div className="row" onClick={()=>selDay===today&&save(d=>({sessions:{...d.sessions,[dk]:{...(d.sessions[dk]||{}),[ex.name]:!(d.sessions[dk]||{})[ex.name]}}}))}
                          style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px"}}>
                          <div style={{width:21,height:21,borderRadius:5,border:`2px solid ${done?col:"#ffffff2a"}`,background:done?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:done?"#000":"#ffffff2a",flexShrink:0}}>{done?"✓":i+1}</div>
                          <div style={{flex:1}}>
                            <div style={{fontFamily:"'Rajdhani',sans-serif",fontWeight:600,color:"#fff",fontSize:13}}>{ex.name}</div>
                            <div style={{fontSize:10,color:"#ffffff33",fontFamily:"'Rajdhani',sans-serif"}}>{ex.sets}×{ex.reps} · {ex.restLabel}</div>
                          </div>
                          {pr&&<div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:8,color:"#ffd70055",fontFamily:"'Orbitron',monospace"}}>🏆PR</div>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:"#ffd700"}}>{toDisp(pr.weight,u)}{uLabel(u)}{pr.reps?`×${pr.reps}`:""}</div>
                          </div>}
                        </div>

                        {/* Sets logged */}
                        {sets.length>0&&(
                          <div style={{padding:"0 12px 6px"}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>
                              {sets.map((s,si)=>(
                                <div key={si} style={{padding:"3px 7px",borderRadius:4,background:`${col}1a`,border:`1px solid ${col}33`,fontFamily:"'Orbitron',monospace",fontSize:9,color:col}}>
                                  S{si+1} {toDisp(s.weight,u)}{uLabel(u)}{s.reps?`×${s.reps}`:""}
                                </div>
                              ))}
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:"#ffffff33"}}>Vol: <span style={{color:"#ffffffcc"}}>{toDisp(vol,u).toLocaleString()} {uLabel(u)}</span></span>
                              <button onClick={()=>removeLastSet(ex.name)} style={{background:"none",border:"none",color:"#ff444455",cursor:"pointer",fontSize:11,fontFamily:"'Rajdhani',sans-serif"}}>✕ annuler</button>
                            </div>
                          </div>
                        )}

                        {/* Next recommendation */}
                        {next&&selDay===today&&(
                          <div style={{margin:"0 12px 6px",padding:"6px 10px",borderRadius:6,background:next.up?"#00ff8808":"#ffffff06",border:`1px solid ${next.up?"#00ff8822":"#ffffff0a"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{fontSize:10,color:"#ffffff44",fontFamily:"'Rajdhani',sans-serif"}}>{next.note}</span>
                            <span style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:next.up?"#00ff88":"#ffffff66"}}>→ {toDisp(next.weight,u)}{uLabel(u)}</span>
                          </div>
                        )}

                        {/* Actions: + série + timer */}
                        {selDay===today&&!ex.cardioOnly&&(
                          <div style={{display:"flex",gap:6,padding:"4px 12px 10px"}}>
                            <button className="btn" onClick={()=>setChargeModal(ex.name)} style={S.smBtn(col)}>+ SÉRIE {sets.length>0?`(S${sets.length+1})`:""}</button>
                            {ex.rest>0&&<button className="btn" onClick={()=>startTimer(ex.name,ex.rest)} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #ffffff1a",background:"#ffffff08",color:"#ffffff55",fontFamily:"'Orbitron',monospace",fontSize:9,cursor:"pointer"}}>⏱ {ex.restLabel}</button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Session summary */}
              {selDay===today&&totalEx>0&&(
                <div style={{marginTop:12,padding:"12px",borderRadius:8,background:"#ffffff06"}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,color:sessPct===100?"#00ff88":PROGRAM[selDay].color,marginBottom:totalSetsToday>0?8:0}}>
                    {sessPct===100?"SÉANCE COMPLÈTE ⚡":`${exDone}/${totalEx} exercices`}
                  </div>
                  {totalSetsToday>0&&(
                    <div style={{display:"flex",gap:14}}>
                      <div>
                        <div style={{fontSize:8,color:"#ffffff33",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>SÉRIES</div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:16,color:"#fff"}}>{totalSetsToday}</div>
                      </div>
                      <div style={{borderLeft:"1px solid #ffffff0f",paddingLeft:14}}>
                        <div style={{fontSize:8,color:"#ffffff33",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>VOLUME TOTAL</div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:16,color:rc}}>{toDisp(totalVolKg,u).toLocaleString()} {uLabel(u)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ REPAS ════════════════ */}
        {tab==="meals"&&(
          <div style={S.col}>
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={S.cardLbl}>NUTRITION — {today.toUpperCase()}</div>
                  <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:"#ffffff33",marginTop:2}}>Objectif {targetCal} kcal · TDEE {myTdee}+400</div>
                </div>
                <span style={{fontFamily:"'Orbitron',monospace",fontSize:14,color:mealsDone===MEALS.length?"#00ff88":rc}}>{mealsDone}/{MEALS.length}</span>
              </div>
              <ProgBar pct={Math.round((mealsDone/MEALS.length)*100)} color={mealsDone===MEALS.length?"#00ff88":rc}/>
              <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:12}}>
                {MEALS.map(m=>{
                  const done=!!todayMeals[m.id];
                  const now=new Date().getHours();
                  const missed=!done&&now>m.hour+1;
                  return(
                    <div key={m.id} className="row" onClick={()=>save(d=>({meals:{...d.meals,[dk]:{...(d.meals[dk]||{}),[m.id]:!(d.meals[dk]||{})[m.id]}}}))}
                      style={{display:"flex",alignItems:"center",gap:11,padding:"12px 13px",borderRadius:8,background:done?"#00ff8810":missed?"#ff444408":"#ffffff06",border:`1px solid ${done?"#00ff8844":missed?"#ff444422":"#ffffff0f"}`}}>
                      <span style={{fontSize:17}}>{m.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"'Rajdhani',sans-serif",fontWeight:600,fontSize:13,color:done?"#fff":missed?"#ff4444aa":"#ffffffbb"}}>{m.label}{missed?" ⚠️":""}</div>
                        <div style={{fontSize:10,color:"#ffffff33",fontFamily:"'Rajdhani',sans-serif"}}>{m.kcal} kcal · {m.hour}h00</div>
                      </div>
                      <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${done?"#00ff88":missed?"#ff444444":"#ffffff22"}`,background:done?"#00ff8820":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:done?"#00ff88":"#ffffff22"}}>{done?"✓":"○"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardLbl}>RÈGLES PROTOCOLE</div>
              {[["⚖","Poids stable 2 sem → +300 kcal/jour"],["🥛","Post-workout = repas le plus important"],["📅","Pèse-toi 2×/sem au réveil, regarde la moyenne"],["💪","Toutes les séries top → augmente la charge"],["😴","7-9h de sommeil pour construire du muscle"]].map(([ic,r])=>(
                <div key={r} style={{display:"flex",gap:9,padding:"8px 0",borderBottom:"1px solid #ffffff08"}}>
                  <span style={{flexShrink:0}}>{ic}</span>
                  <span style={{color:"#ffffff66",fontFamily:"'Rajdhani',sans-serif",fontSize:12,lineHeight:1.5}}>{r}</span>
                </div>
              ))}
            </div>
            <button className="btn" onClick={()=>setModal("cal")} style={S.actionBtn(rc)}>🔥 LOGGER LES CALORIES DU JOUR</button>
          </div>
        )}

        {/* ════════════════ HISTORIQUE ════════════════ */}
        {tab==="history"&&(
          <div style={S.col}>
            {/* Exercise history selector */}
            <div style={S.card}>
              <div style={S.cardLbl}>HISTORIQUE PAR EXERCICE</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                {[...new Set(Object.values(PROGRAM).flatMap(d=>d.exercises.map(e=>e.name)))].map(ex=>{
                  const lc=lastSet(ex);
                  const pr=prSet(ex);
                  const hist=allSets(ex);
                  return(
                    <div key={ex} className="row" onClick={()=>setHistEx(histEx===ex?null:ex)}
                      style={{padding:"10px 12px",borderRadius:8,background:histEx===ex?`${rc}12`:"#ffffff06",border:`1px solid ${histEx===ex?rc+"44":"#ffffff0f"}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontFamily:"'Rajdhani',sans-serif",fontWeight:600,color:"#fff",fontSize:13}}>{ex}</div>
                          <div style={{fontSize:10,color:"#ffffff33",fontFamily:"'Rajdhani',sans-serif"}}>{hist.length} entrées</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          {lc&&<div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:"#ffffffcc"}}>{toDisp(lc.weight,u)}{uLabel(u)}{lc.reps?`×${lc.reps}`:""}</div>}
                          {pr&&<div style={{fontSize:9,color:"#ffd700",fontFamily:"'Orbitron',monospace"}}>🏆 {toDisp(pr.weight,u)}{uLabel(u)}{pr.reps?`×${pr.reps}`:""}</div>}
                        </div>
                      </div>
                      {/* Expanded history */}
                      {histEx===ex&&hist.length>0&&(
                        <div style={{marginTop:10,borderTop:"1px solid #ffffff0a",paddingTop:10}}>
                          {/* Mini chart */}
                          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:50,marginBottom:8}}>
                            {hist.slice(-20).map((e,i)=>{
                              const arr=hist.slice(-20);
                              const mn=Math.min(...arr.map(x=>x.weight));
                              const mx=Math.max(...arr.map(x=>x.weight));
                              const rng=mx-mn||0.5;
                              const h=Math.max(8,((e.weight-mn)/rng)*42+8);
                              return <div key={i} style={{flex:1,height:h,background:i===arr.length-1?`linear-gradient(0deg,${rc}88,${rc})`:`linear-gradient(0deg,${rc}22,${rc}44)`,borderRadius:"2px 2px 0 0",marginTop:"auto"}}/>;
                            })}
                          </div>
                          {/* Last 8 entries */}
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {hist.slice(-8).reverse().map((e,i)=>(
                              <div key={i} style={{display:"flex",justifyContent:"space-between",fontFamily:"'Rajdhani',sans-serif",fontSize:11,color:"#ffffff66",padding:"3px 0",borderBottom:"1px solid #ffffff06"}}>
                                <span>{e.date}</span>
                                <span style={{color:"#fff",fontFamily:"'Orbitron',monospace",fontSize:11}}>{toDisp(e.weight,u)}{uLabel(u)}{e.reps?` × ${e.reps} reps`:""}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Séances passées par jour */}
            <div style={S.card}>
              <div style={S.cardLbl}>JOURNAL DES SÉANCES</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                {Object.entries(data.sessions).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,14).map(([date,sess])=>{
                  const doneCnt=Object.values(sess).filter(Boolean).length;
                  const dn=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][new Date(date+"T12:00:00").getDay()];
                  const prog=PROGRAM[dn];
                  const pct=prog.exercises.length?Math.round((doneCnt/prog.exercises.length)*100):0;
                  const vol=(data.sessionLogs[date]||{});
                  const volKg=Object.values(vol).flat().reduce((s,e)=>s+e.weight*(e.reps||1),0);
                  const note=data.sessionNotes[date];
                  return(
                    <div key={date} style={{padding:"10px 12px",borderRadius:8,background:"#ffffff06",border:"1px solid #ffffff0a"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontFamily:"'Rajdhani',sans-serif",fontWeight:600,fontSize:13,color:"#fff"}}>{dn} <span style={{color:"#ffffff44",fontWeight:400}}>{date}</span></div>
                          <div style={{fontSize:10,color:prog.color,fontFamily:"'Orbitron',monospace",marginTop:2}}>{prog.label}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:pct===100?"#00ff88":rc}}>{pct}%</div>
                          {volKg>0&&<div style={{fontSize:10,color:"#ffffff44",fontFamily:"'Rajdhani',sans-serif"}}>{toDisp(volKg,u).toLocaleString()} {uLabel(u)}</div>}
                        </div>
                      </div>
                      {note&&<div style={{marginTop:6,fontSize:11,color:"#ffffff55",fontFamily:"'Rajdhani',sans-serif",borderTop:"1px solid #ffffff08",paddingTop:6}}>📝 {note}</div>}
                    </div>
                  );
                })}
                {Object.keys(data.sessions).length===0&&(
                  <div style={{textAlign:"center",padding:"20px 0",color:"#ffffff22",fontFamily:"'Rajdhani',sans-serif"}}>Aucune séance encore enregistrée</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ STATS ════════════════ */}
        {tab==="progress"&&(
          <div style={S.col}>

            {/* Mensurations */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={S.cardLbl}>MENSURATIONS (cm)</span>
                <button className="btn" onClick={()=>setModal("measure")} style={S.smBtn(rc)}>+ UPDATE</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[{k:"chest",l:"POITRINE",i:"💪"},{k:"waist",l:"TAILLE",i:"⚡"},{k:"arm",l:"BRAS",i:"🔥"},{k:"thigh",l:"CUISSE",i:"💎"}].map(m=>{
                  const val=data.measurements[m.k];
                  const hist=data.measureHistory.filter(e=>e[m.k]);
                  const prev=hist.length>=2?hist[hist.length-2][m.k]:null;
                  const diff=val&&prev?(val-prev).toFixed(1):null;
                  return(
                    <div key={m.k} style={{background:"#ffffff08",borderRadius:8,padding:"11px 12px",border:"1px solid #ffffff0a"}}>
                      <div style={{fontSize:8,color:"#ffffff33",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>{m.l}</div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,color:val?"#fff":"#ffffff22",marginTop:3}}>{val||"—"}{val&&<span style={{fontSize:10,color:"#ffffff44"}}> cm</span>}</div>
                      {diff&&<div style={{fontSize:10,fontFamily:"'Rajdhani',sans-serif",color:parseFloat(diff)>0?"#00ff88":"#ff4444",marginTop:2}}>{parseFloat(diff)>0?"▲":"▼"} {Math.abs(diff)} cm</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Poids graph */}
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={S.cardLbl}>COURBE DE POIDS</span>
                <button className="btn" onClick={()=>setModal("weight")} style={S.smBtn(rc)}>+ POIDS</button>
              </div>
              {data.weightHistory.length<2?(
                <div style={{textAlign:"center",padding:"20px 0",color:"#ffffff22",fontFamily:"'Rajdhani',sans-serif",fontSize:12}}>Enregistre ton poids pour voir la courbe</div>
              ):(
                <>
                  <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80,marginBottom:5}}>
                    {data.weightHistory.slice(-20).map((e,i,arr)=>{
                      const mn=Math.min(...arr.map(x=>x.weight));
                      const mx=Math.max(...arr.map(x=>x.weight));
                      const rng=mx-mn||0.5;
                      const h=Math.max(8,((e.weight-mn)/rng)*65+8);
                      const isLast=i===arr.length-1;
                      return(
                        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                          {isLast&&<div style={{fontSize:8,color:rc,fontFamily:"'Orbitron',monospace"}}>{toDisp(e.weight,u)}</div>}
                          <div style={{width:"100%",height:h,background:isLast?`linear-gradient(0deg,${rc}88,${rc})`:`linear-gradient(0deg,${rc}1a,${rc}44)`,borderRadius:"2px 2px 0 0",marginTop:"auto"}}/>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",color:"#ffffff22",fontSize:10,fontFamily:"'Rajdhani',sans-serif"}}>
                    <span>{data.weightHistory.slice(-20)[0]?.date?.slice(5)}</span><span>Aujourd'hui</span>
                  </div>
                </>
              )}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                {[{l:"BMI",v:bmi(data.currentWeight,data.heightCm),s:parseFloat(bmi(data.currentWeight,data.heightCm))<18.5?"Sous-poids":"Normal"},{l:"TDEE",v:myTdee,s:"kcal maintien"},{l:"SURPLUS",v:"+400",s:"kcal cible"}].map(s=>(
                  <div key={s.l} style={{flex:1,background:"#ffffff08",borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:8,color:rc,fontFamily:"'Orbitron',monospace",letterSpacing:1}}>{s.l}</div>
                    <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,color:"#fff",marginTop:3}}>{s.v}</div>
                    <div style={{fontSize:10,color:"#ffffff33",fontFamily:"'Rajdhani',sans-serif"}}>{s.s}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Volume hebdo */}
            <div style={S.card}>
              <div style={S.cardLbl}>VOLUME HEBDOMADAIRE (7 jours)</div>
              <div style={{display:"flex",gap:5,marginTop:10}}>
                {Array.from({length:7},(_,i)=>{
                  const d=new Date(); d.setDate(d.getDate()-(6-i));
                  const k=d.toISOString().split("T")[0];
                  const dn=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][d.getDay()];
                  const prog=PROGRAM[dn];
                  const sess=data.sessions[k]||{};
                  const done=Object.values(sess).filter(Boolean).length;
                  const isRest=prog.exercises.length===0;
                  const pct=isRest?0:prog.exercises.length?done/prog.exercises.length:0;
                  const vol=Object.values(data.sessionLogs[k]||{}).flat().reduce((s,e)=>s+e.weight*(e.reps||1),0);
                  return(
                    <div key={i} style={{flex:1,textAlign:"center"}}>
                      <div style={{fontSize:9,color:rc,fontFamily:"'Orbitron',monospace",marginBottom:3}}>{vol>0?Math.round(toDisp(vol,u)/1000)+"k":""}</div>
                      <div style={{height:36,borderRadius:6,background:isRest?"#ffffff06":pct>=1?`${prog.color}66`:pct>0?`${prog.color}22`:"#ffffff08",border:`1px solid ${isRest?"#ffffff0a":pct>=1?prog.color+"66":"#ffffff0a"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>
                        {isRest?"💤":pct>=1?"✓":pct>0?"~":"✗"}
                      </div>
                      <div style={{fontSize:9,color:"#ffffff33",fontFamily:"'Rajdhani',sans-serif",marginTop:3}}>
                        {["D","L","M","Me","J","V","S"][d.getDay()]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Projection */}
            <div style={S.card}>
              <div style={S.cardLbl}>PROJECTION</div>
              <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:7}}>
                {[
                  {l:"Rythme conservateur (+0.3kg/sem)",v:`~${wl} sem`},
                  {l:"Rythme optimal (+0.45kg/sem)",v:`~${Math.ceil((data.targetWeight-data.currentWeight)/0.45)} sem`},
                  {l:"Date estimée",v:(()=>{const d=new Date();d.setDate(d.getDate()+wl*7);return d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});})()},
                  {l:"Rang actuel",v:rank,c:rc},
                  {l:"Prochain rang",v:rank==="S"?"MAX 👑":["D","C","B","A","S"][["E","D","C","B","A"].indexOf(rank)]||"?"},
                  {l:"Semaine de décharge dans",v:`${DELOAD_EVERY-(weekNumber>0?((weekNumber-1)%DELOAD_EVERY):DELOAD_EVERY)} sem`},
                ].map(item=>(
                  <div key={item.l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #ffffff07"}}>
                    <span style={{color:"#ffffff44",fontFamily:"'Rajdhani',sans-serif",fontSize:12}}>{item.l}</span>
                    <span style={{color:item.c||"#fff",fontFamily:"'Orbitron',monospace",fontSize:12}}>{item.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* All-time PRs */}
            <div style={S.card}>
              <div style={S.cardLbl}>RECORDS PERSONNELS 🏆</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:10}}>
                {[...new Set(Object.values(PROGRAM).flatMap(d=>d.exercises.map(e=>e.name)))].map(ex=>{
                  const pr=prSet(ex);
                  const lc=lastSet(ex);
                  if(!pr) return null;
                  const improved=lc&&lc.date===pr.date;
                  return(
                    <div key={ex} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:7,background:"#ffffff06",border:`1px solid ${improved?"#ffd70022":"#ffffff0a"}`}}>
                      <div style={{fontFamily:"'Rajdhani',sans-serif",fontSize:12,color:"#ffffffbb"}}>{ex}</div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:"#ffd700"}}>{toDisp(pr.weight,u)}{uLabel(u)}{pr.reps?`×${pr.reps}`:""}{improved?" ✨":""}</div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════ MODALS ════════════════ */}

      {/* Weight */}
      {modal==="weight"&&(
        <Overlay onClose={()=>setModal(null)} rc={rc} rg={rg} title="MISE À JOUR POIDS" sub={`Actuel: ${toDisp(data.currentWeight,u)} ${uLabel(u)} · Saisir en ${uLabel(u)}`}>
          <input type="number" value={inputs.weight} onChange={e=>inp("weight",e.target.value)} placeholder={u==="lbs"?"Ex: 128.5":"Ex: 58.5"} style={IS(rc)} autoFocus/>
          <MBtns onClose={()=>setModal(null)} onOk={()=>{
            const w=parseFloat(inputs.weight); if(isNaN(w)||w<20||w>500) return;
            const wkg=toKg(w,u);
            save(d=>({currentWeight:wkg,weightHistory:[...d.weightHistory,{date:tKey(),weight:wkg}].slice(-90)}));
            inp("weight",""); setModal(null);
          }} rc={rc}/>
        </Overlay>
      )}

      {/* Calories */}
      {modal==="cal"&&(
        <Overlay onClose={()=>setModal(null)} rc={rc} rg={rg} title="CALORIES DU JOUR" sub={`Objectif: ${targetCal} kcal · Actuel: ${todayCal}`}>
          <input type="number" value={inputs.cal} onChange={e=>inp("cal",e.target.value)} placeholder={`Ex: ${targetCal}`} style={IS(rc)} autoFocus/>
          <MBtns onClose={()=>setModal(null)} onOk={()=>{
            const c=parseInt(inputs.cal); if(isNaN(c)||c<=0) return;
            save(d=>({calorieLog:{...d.calorieLog,[dk]:c}}));
            inp("cal",""); setModal(null);
          }} rc={rc}/>
        </Overlay>
      )}

      {/* Mensurations */}
      {modal==="measure"&&(
        <Overlay onClose={()=>setModal(null)} rc={rc} rg={rg} title="MENSURATIONS" sub="En centimètres">
          {[["chest","Poitrine"],["waist","Taille"],["arm","Bras (biceps)"],["thigh","Cuisse"]].map(([k,l])=>(
            <input key={k} type="number" value={inputs[k]} onChange={e=>inp(k,e.target.value)} placeholder={`${l} cm (actuel: ${data.measurements[k]||"—"})`} style={{...IS(rc),marginBottom:7}}/>
          ))}
          <MBtns onClose={()=>setModal(null)} onOk={()=>{
            const entry={date:tKey(),...Object.fromEntries(["chest","waist","arm","thigh"].map(k=>[k,parseFloat(inputs[k])||data.measurements[k]||null]))};
            save(d=>({measurements:{...entry},measureHistory:[...d.measureHistory,entry].slice(-50)}));
            setInputs(i=>({...i,chest:"",waist:"",arm:"",thigh:""})); setModal(null);
          }} rc={rc}/>
        </Overlay>
      )}

      {/* Note séance */}
      {modal==="note"&&(
        <Overlay onClose={()=>setModal(null)} rc={rc} rg={rg} title="NOTE DE SÉANCE" sub={today}>
          <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Ex: Courbatures dos, bien dormi, PR développé couché..." style={{...IS(rc),height:90,resize:"none",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.6}}/>
          <MBtns onClose={()=>setModal(null)} onOk={()=>{
            save(d=>({sessionNotes:{...d.sessionNotes,[dk]:noteText}}));
            setModal(null);
          }} rc={rc}/>
        </Overlay>
      )}

      {/* Charge / séries */}
      {chargeModal&&(()=>{
        const ex=chargeModal;
        const sets=todaySetsFor(ex);
        const lc=lastSet(ex);
        const pr=prSet(ex);
        const exObj=Object.values(PROGRAM).flatMap(d=>d.exercises).find(e=>e.name===ex);
        const next=nextReco(ex,exObj?.reps);
        return(
          <Overlay onClose={()=>{setChargeModal(null);inp("charge","");inp("reps","");}} rc={rc} rg={rg} title={`SÉRIE ${sets.length+1}`} sub={ex}>
            {/* Reference */}
            {(lc||pr)&&(
              <div style={{display:"flex",gap:10,marginBottom:12,padding:"8px 11px",borderRadius:8,background:"#ffffff08",border:"1px solid #ffffff0a"}}>
                {lc&&<div style={{flex:1}}><div style={{fontSize:8,color:"#ffffff33",fontFamily:"'Orbitron',monospace"}}>DERNIÈRE FOIS</div><div style={{fontFamily:"'Orbitron',monospace",fontSize:14,color:"#fff",marginTop:2}}>{toDisp(lc.weight,u)}{uLabel(u)}{lc.reps?`×${lc.reps}`:""}</div></div>}
                {pr&&<div style={{flex:1,borderLeft:"1px solid #ffffff0f",paddingLeft:10}}><div style={{fontSize:8,color:"#ffd70055",fontFamily:"'Orbitron',monospace"}}>🏆 PR</div><div style={{fontFamily:"'Orbitron',monospace",fontSize:14,color:"#ffd700",marginTop:2}}>{toDisp(pr.weight,u)}{uLabel(u)}{pr.reps?`×${pr.reps}`:""}</div></div>}
              </div>
            )}
            {/* Today's sets */}
            {sets.length>0&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:8,color:"#ffffff33",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:5}}>SÉRIES AUJOURD'HUI</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {sets.map((s,i)=>(
                    <div key={i} style={{padding:"3px 7px",borderRadius:4,background:`${rc}1a`,border:`1px solid ${rc}33`,fontFamily:"'Orbitron',monospace",fontSize:9,color:rc}}>
                      S{i+1} {toDisp(s.weight,u)}{uLabel(u)}{s.reps?`×${s.reps}`:""}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Recommendation */}
            {next&&sets.length>0&&(
              <div style={{marginBottom:10,padding:"6px 10px",borderRadius:6,background:next.up?"#00ff8808":"#ffffff06",border:`1px solid ${next.up?"#00ff8822":"#ffffff0a"}`,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:10,color:"#ffffff44",fontFamily:"'Rajdhani',sans-serif"}}>{next.note}</span>
                <span style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:next.up?"#00ff88":"#ffffff66"}}>→ {toDisp(next.weight,u)}{uLabel(u)}</span>
              </div>
            )}
            {/* Input */}
            <div style={{display:"flex",gap:7,marginBottom:7}}>
              <input type="number" value={inputs.charge} onChange={e=>inp("charge",e.target.value)} placeholder={u==="lbs"?"135 lbs":"60 kg"} style={{...IS(rc),flex:2,marginBottom:0}} autoFocus/>
              <input type="number" value={inputs.reps} onChange={e=>inp("reps",e.target.value)} placeholder="reps" style={{...IS(rc),flex:1,marginBottom:0}}/>
            </div>
            <div style={{display:"flex",gap:7}}>
              <button onClick={()=>{setChargeModal(null);inp("charge","");inp("reps","");}} style={{flex:1,padding:"11px",borderRadius:8,border:"1px solid #ffffff1a",background:"transparent",color:"#ffffff55",fontFamily:"'Rajdhani',sans-serif",cursor:"pointer",fontSize:13}}>Terminer</button>
              <button className="btn" onClick={()=>{logSet(); if(exObj?.rest>0) startTimer(ex,exObj.rest);}} style={{flex:2,padding:"11px",borderRadius:8,border:`1px solid ${rc}`,background:`${rc}22`,color:rc,fontFamily:"'Orbitron',monospace",fontSize:11,letterSpacing:1}}>
                ✓ S{sets.length+1} + TIMER
              </button>
            </div>
          </Overlay>
        );
      })()}
    </div>
  );
}

// ─── REUSABLE COMPONENTS ─────────────────────────────────────────────────────
function Overlay({children,onClose,rc,rg,title,sub}){
  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:18}}>
      <div style={{background:"#0e0e1a",border:`1px solid ${rc}55`,borderRadius:16,padding:22,width:"100%",maxWidth:340,boxShadow:`0 0 40px ${rg}`,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:rc,marginBottom:3}}>{title}</div>
        <div style={{color:"#ffffff44",fontSize:11,fontFamily:"'Rajdhani',sans-serif",marginBottom:16}}>{sub}</div>
        {children}
      </div>
    </div>
  );
}

function MBtns({onClose,onOk,rc}){
  return(
    <div style={{display:"flex",gap:8,marginTop:4}}>
      <button onClick={onClose} style={{flex:1,padding:"11px",borderRadius:8,border:"1px solid #ffffff1a",background:"transparent",color:"#ffffff55",fontFamily:"'Rajdhani',sans-serif",cursor:"pointer",fontSize:13}}>Annuler</button>
      <button onClick={onOk} style={{flex:1,padding:"11px",borderRadius:8,border:`1px solid ${rc}`,background:`${rc}22`,color:rc,fontFamily:"'Orbitron',monospace",fontSize:11,cursor:"pointer",letterSpacing:1}}>CONFIRMER</button>
    </div>
  );
}

function IS(rc){ return{width:"100%",background:"#ffffff08",border:`1px solid ${rc}33`,borderRadius:8,padding:"11px 13px",color:"#fff",fontFamily:"'Rajdhani',sans-serif",fontSize:15,outline:"none",display:"block",marginBottom:0}; }

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S={
  root:{minHeight:"100vh",background:"#07070e",color:"#fff",position:"relative",overflow:"hidden"},
  wrap:{maxWidth:480,margin:"0 auto",padding:"18px 14px 60px",position:"relative",zIndex:1},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,padding:"13px 16px",background:"linear-gradient(135deg,#0e0e1a,#111118)",borderRadius:14,border:"1px solid #ffffff0d"},
  rankBadge:{width:62,height:62,borderRadius:13,border:"2px solid",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#07070e"},
  col:{display:"flex",flexDirection:"column",gap:11},
  card:{background:"linear-gradient(135deg,#0e0e1a,#0a0a12)",border:"1px solid #ffffff0d",borderRadius:12,padding:"14px"},
  statCard:{background:"linear-gradient(135deg,#0e0e1a,#0a0a12)",border:"1px solid #ffffff0d",borderRadius:12,padding:"12px 13px"},
  cardLbl:{fontFamily:"'Orbitron',monospace",fontSize:9,color:"#ffffff33",letterSpacing:3},
  smBtn:rc=>({padding:"4px 10px",borderRadius:5,border:`1px solid ${rc}44`,background:`${rc}15`,color:rc,fontFamily:"'Orbitron',monospace",fontSize:9,cursor:"pointer",letterSpacing:1}),
  actionBtn:(c,bg="#ffffff08",b="#ffffff11")=>({padding:"12px",borderRadius:11,border:`1px solid ${b}`,background:bg,color:c,fontFamily:"'Orbitron',monospace",fontSize:11,cursor:"pointer",letterSpacing:1,textAlign:"center",width:"100%"}),
};
