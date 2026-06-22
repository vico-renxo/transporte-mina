'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API = 'http://localhost:3001';

/* ── tipos ── */
interface Pasajero { id: string; nombre: string; paraderoNombre: string; estado: string; checkin?: boolean }
interface Paradero  { id: string; nombre: string; orden: number; lat: number; lng: number; pasajeros: Pasajero[] }
interface Ejecucion { id: string; rutaNombre: string; conductorNombre: string; vehiculoPlaca: string; paraderoActual: number; totalParaderos: number; pasajerosAbordo: number; ultimaLat: number | null; ultimaLng: number | null }

/* ── Login ── */
function LoginForm({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [email, setEmail] = useState('conductor1@empresa.com');
  const [pass,  setPass]  = useState('cond123');
  const [err,   setErr]   = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const d = await r.json();
      if (!r.ok || d.usuario?.rol !== 'CONDUCTOR') { setErr(d.error || 'Solo conductores'); return; }
      onLogin(d.token, d.usuario);
    } catch { setErr('Error de conexión'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0e1a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:16, padding:32, width:340 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🚌</div>
          <h1 style={{ color:'#f9fafb', fontSize:20, fontWeight:700, margin:0 }}>TransporteMina</h1>
          <p style={{ color:'#6b7280', fontSize:13, margin:'4px 0 0' }}>Panel del Conductor</p>
        </div>
        {err && <div style={{ background:'#450a0a', border:'1px solid #7f1d1d', borderRadius:8, padding:10, color:'#fca5a5', fontSize:13, marginBottom:16 }}>{err}</div>}
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required
            style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#f9fafb', fontSize:14, outline:'none' }}/>
          <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="Contraseña" required
            style={{ background:'#1f2937', border:'1px solid #374151', borderRadius:8, padding:'10px 12px', color:'#f9fafb', fontSize:14, outline:'none' }}/>
          <button disabled={loading} style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:8, padding:'11px 0', fontWeight:700, fontSize:15, cursor:'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p style={{ textAlign:'center', color:'#4b5563', fontSize:11, marginTop:14 }}>
          Demo: conductor1@empresa.com / cond123<br/>
          También: hector.chavez@empresa.com / aqpcond123
        </p>
      </div>
    </div>
  );
}

/* ── Vista principal ── */
function VistaConductor({ token, usuario }: { token: string; usuario: any }) {
  const [ejecucion,  setEjecucion]  = useState<Ejecucion | null>(null);
  const [paraderos,  setParaderos]  = useState<Paradero[]>([]);
  const [checkins,   setCheckins]   = useState<Record<string,boolean>>({});
  const [log,        setLog]        = useState<string[]>([]);
  const [gpsActivo,  setGpsActivo]  = useState(false);
  const [paraderoIdx,setParaderoIdx]= useState(0);
  const [pasAbordo,  setPasAbordo]  = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const gpsRef    = useRef<NodeJS.Timeout | null>(null);
  const hdrs = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };

  function addLog(msg: string) { setLog(p => [`${new Date().toLocaleTimeString('es-PE')} — ${msg}`, ...p].slice(0,30)); }

  /* cargar ejecución activa */
  async function cargarEjecucion() {
    const r = await fetch(`${API}/api/rutas/activas`, { headers: hdrs }).then(r=>r.json());
    const ej = r.ejecuciones?.find((e: any) => e.conductorId === usuario.conductorId || true);
    if (!ej) { addLog('Sin ruta activa asignada'); return; }
    setEjecucion(ej);
    // cargar paraderos con pasajeros
    const rutaId = await fetch(`${API}/api/rutas/activas`, { headers: hdrs })
      .then(r=>r.json())
      .then(d => d.ejecuciones?.[0]?.id);
    // obtener paraderos de la ruta
    const checkinData = await fetch(`${API}/api/checkin/${ej.id}`, { headers: hdrs }).then(r=>r.json());
    const ckMap: Record<string,boolean> = {};
    if (Array.isArray(checkinData)) checkinData.forEach((c:any) => { ckMap[c.pasajeroId] = c.subio; });
    setCheckins(ckMap);
    addLog(`✅ Ruta activa: ${ej.rutaNombre}`);
  }

  /* conectar socket */
  useEffect(() => {
    const s = io(API, { auth: { token } });
    socketRef.current = s;
    s.on('connect', () => { addLog('Socket conectado'); s.emit('conductor:join'); });
    s.on('pasajero:en-paradero', (d: any) => {
      addLog(`🔔 ${d.nombre} está esperando en paradero`);
    });
    s.on('disconnect', () => addLog('Socket desconectado'));
    cargarEjecucion();
    return () => { s.disconnect(); if (gpsRef.current) clearInterval(gpsRef.current); };
  }, []);

  /* enviar GPS automático mientras está activo */
  function toggleGPS() {
    if (gpsActivo) {
      if (gpsRef.current) clearInterval(gpsRef.current);
      setGpsActivo(false);
      addLog('GPS detenido');
      return;
    }
    if (!ejecucion) { addLog('Sin ruta activa'); return; }
    setGpsActivo(true);
    addLog('GPS iniciado — enviando cada 5s');
    let step = 0;
    // coordenadas simuladas: Terminal Cayma → Parque Industrial (AQP-1)
    const ruta = [
      { lat:-16.3595, lng:-71.5478, vel:0,  label:'Terminal Cayma (inicio)' },
      { lat:-16.3670, lng:-71.5450, vel:38, label:'Av. Cayma' },
      { lat:-16.3740, lng:-71.5430, vel:45, label:'Puente Grau' },
      { lat:-16.3810, lng:-71.5400, vel:42, label:'Bajando a Yanahuara' },
      { lat:-16.3900, lng:-71.5390, vel:28, label:'Frenando — Yanahuara' },
      { lat:-16.4043, lng:-71.5448, vel:0,  label:'Paradero Av. Ejército (parada #2)' },
      { lat:-16.4100, lng:-71.5430, vel:35, label:'Saliendo de Yanahuara' },
      { lat:-16.4028, lng:-71.5367, vel:42, label:'Hacia Óvalo Vallecito' },
      { lat:-16.4028, lng:-71.5367, vel:0,  label:'Paradero Óvalo Vallecito (parada #3)' },
      { lat:-16.4100, lng:-71.5300, vel:50, label:'Ruta a Parque Industrial' },
      { lat:-16.4200, lng:-71.5150, vel:55, label:'Av. Porongoche' },
      { lat:-16.4270, lng:-71.5050, vel:0,  label:'Parque Industrial (destino)' },
    ];
    gpsRef.current = setInterval(async () => {
      const p = ruta[step % ruta.length];
      try {
        await fetch(`${API}/api/gps/coordenada`, {
          method:'POST', headers: hdrs,
          body: JSON.stringify({ rutaEjecucionId: ejecucion.id, lat: p.lat, lng: p.lng, velocidad: p.vel })
        });
        addLog(`📡 GPS: ${p.label} · ${p.vel} km/h`);
        setParaderoIdx(step % ruta.length);
        step++;
      } catch { addLog('Error enviando GPS'); }
    }, 4000);
  }

  /* registrar checkin */
  async function registrarCheckin(pasajeroId: string, paraderoId: string, subio: boolean) {
    if (!ejecucion) return;
    await fetch(`${API}/api/checkin`, {
      method:'POST', headers: hdrs,
      body: JSON.stringify({ rutaEjecucionId: ejecucion.id, paraderoId, pasajeroId, subio })
    });
    setCheckins(p => ({ ...p, [pasajeroId]: subio }));
    setPasAbordo(p => subio ? p+1 : p);
    addLog(subio ? `✅ Pasajero subió` : `❌ Pasajero no estaba`);
  }

  /* finalizar ruta */
  async function finalizarRuta() {
    if (!ejecucion) return;
    await fetch(`${API}/api/rutas/${ejecucion.id}/finalizar`, { method:'POST', headers: hdrs });
    addLog('🏁 Ruta finalizada');
    setEjecucion(null);
    if (gpsRef.current) clearInterval(gpsRef.current);
    setGpsActivo(false);
  }

  const style = {
    root: { minHeight:'100vh', background:'#0a0e1a', fontFamily:'system-ui,sans-serif', color:'#f9fafb', padding:16 } as const,
    card: { background:'#111827', border:'1px solid #1f2937', borderRadius:12, padding:16, marginBottom:12 } as const,
    badge: (col: string) => ({ background:col+'22', color:col, border:`1px solid ${col}44`, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }),
    btn:  (col: string, disabled=false) => ({ background:col, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontWeight:700, fontSize:13, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1 } as const),
  };

  return (
    <div style={style.root}>
      {/* cabecera */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <div style={{ fontSize:32 }}>🚌</div>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:800 }}>TransporteMina — Conductor</h1>
          <p style={{ margin:0, color:'#6b7280', fontSize:13 }}>Hola, {usuario.nombre}</p>
        </div>
        <span style={{ marginLeft:'auto', ...style.badge('#10b981') }}>EN LÍNEA</span>
      </div>

      {/* ruta activa */}
      {ejecucion ? (
        <div style={style.card}>
          <p style={{ margin:'0 0 4px', color:'#9ca3af', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Ruta asignada</p>
          <h2 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700, color:'#f9fafb' }}>{ejecucion.rutaNombre}</h2>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <span style={style.badge('#f59e0b')}>🚐 {ejecucion.vehiculoPlaca}</span>
            <span style={style.badge('#60a5fa')}>📍 Parada {ejecucion.paraderoActual}/{ejecucion.totalParaderos}</span>
            <span style={style.badge('#a78bfa')}>👥 {pasAbordo || ejecucion.pasajerosAbordo} abordo</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={style.btn(gpsActivo ? '#dc2626' : '#16a34a')} onClick={toggleGPS}>
              {gpsActivo ? '⏹ Detener GPS' : '▶ Iniciar GPS'}
            </button>
            <button style={style.btn('#dc2626')} onClick={finalizarRuta}>🏁 Finalizar ruta</button>
            <button style={style.btn('#374151')} onClick={cargarEjecucion}>🔄</button>
          </div>
        </div>
      ) : (
        <div style={{ ...style.card, textAlign:'center', padding:32 }}>
          <p style={{ color:'#6b7280', margin:'0 0 12px' }}>Sin ruta activa</p>
          <button style={style.btn('#2563eb')} onClick={cargarEjecucion}>🔄 Verificar</button>
        </div>
      )}

      {/* checkins rápidos */}
      {ejecucion && (
        <div style={style.card}>
          <p style={{ margin:'0 0 12px', color:'#9ca3af', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Registro de pasajeros — Parada actual</p>
          <PassajeroCheckin token={token} ejecucionId={ejecucion.id} checkins={checkins} onCheckin={registrarCheckin} addLog={addLog}/>
        </div>
      )}

      {/* log de eventos */}
      <div style={style.card}>
        <p style={{ margin:'0 0 8px', color:'#9ca3af', fontSize:11, fontWeight:700, textTransform:'uppercase' }}>Log de actividad</p>
        <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
          {log.length === 0 && <p style={{ color:'#4b5563', fontSize:13, margin:0 }}>Sin actividad</p>}
          {log.map((l, i) => (
            <p key={i} style={{ margin:0, fontSize:12, color: i===0 ? '#f9fafb' : '#6b7280', fontFamily:'monospace' }}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-componente: checkin por pasajero ── */
function PassajeroCheckin({ token, ejecucionId, checkins, onCheckin, addLog }: {
  token: string; ejecucionId: string; checkins: Record<string,boolean>;
  onCheckin: (pasId: string, parId: string, subio: boolean) => void; addLog: (m:string)=>void
}) {
  const [estados, setEstados] = useState<any[]>([]);
  const hdrs = { Authorization:`Bearer ${token}` };

  useEffect(() => {
    // cargar estados-hoy de todas las rutas activas
    fetch(`${API}/api/rutas/activas`, { headers: hdrs })
      .then(r=>r.json())
      .then(async d => {
        const ej = d.ejecuciones?.[0];
        if (!ej) return;
        // obtener ruta para saber el rutaId
        const rutaInfo = await fetch(`${API}/api/rutas/activas`, { headers: hdrs }).then(r=>r.json());
        // usar el primer rutaId disponible (simplificación)
      });
  }, []);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <p style={{ color:'#4b5563', fontSize:12, margin:0 }}>
        Haz clic en ✅ cuando el pasajero suba, ❌ si no está en el paradero.
      </p>
      {/* Paraderos AQP-1 con sus pasajeros */}
      {[
        { paraderoId:'cmqo2lvd10004159ey6065a9b', nombre:'Av. Ejército — Yanahuara', pasajeros:[
          { id:'cmqo2oemb0003cxntka5u1rxm', nombre:'Carmen Quispe Huanca' },
          { id:'cmqo2oeqy000bcxntquvsnrtb', nombre:'Roberto Villanueva Paz' }
        ]},
        { paraderoId:'cmqo2lvd10005159ezrabrmpq', nombre:'Óvalo Vallecito', pasajeros:[] },
      ].map(par => (
        <div key={par.paraderoId} style={{ background:'#1f2937', borderRadius:8, padding:12 }}>
          <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:13, color:'#e5e7eb' }}>📍 {par.nombre}</p>
          {par.pasajeros.length === 0 && <p style={{ color:'#4b5563', fontSize:12, margin:0 }}>Sin pasajeros registrados</p>}
          {par.pasajeros.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
              <span style={{ flex:1, fontSize:13, color: checkins[p.id] !== undefined ? (checkins[p.id] ? '#4ade80' : '#f87171') : '#9ca3af' }}>
                {checkins[p.id] !== undefined ? (checkins[p.id] ? '✅' : '❌') : '⏳'} {p.nombre}
              </span>
              {checkins[p.id] === undefined && (
                <>
                  <button onClick={() => onCheckin(p.id, par.paraderoId, true)}
                    style={{ background:'#14532d', color:'#4ade80', border:'1px solid #166534', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer', fontWeight:700 }}>
                    ✅ Subió
                  </button>
                  <button onClick={() => onCheckin(p.id, par.paraderoId, false)}
                    style={{ background:'#450a0a', color:'#f87171', border:'1px solid #7f1d1d', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer', fontWeight:700 }}>
                    ❌ No está
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Root ── */
export default function ConductorPage() {
  const [token,   setToken]   = useState<string | null>(null);
  const [usuario, setUsuario] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('tm_conductor_token');
    const u = localStorage.getItem('tm_conductor_user');
    if (t && u) { setToken(t); setUsuario(JSON.parse(u)); }
  }, []);

  function handleLogin(t: string, u: any) {
    localStorage.setItem('tm_conductor_token', t);
    localStorage.setItem('tm_conductor_user', JSON.stringify(u));
    setToken(t); setUsuario(u);
  }

  if (!token) return <LoginForm onLogin={handleLogin}/>;
  return <VistaConductor token={token} usuario={usuario}/>;
}
