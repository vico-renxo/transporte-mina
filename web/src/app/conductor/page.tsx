'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://transporte-mina.onrender.com';

// OJO: el socket NO usa la misma URL que la API. La API va por Cloudflare
// (viczul.com/api/*, que el Worker enruta a Render), pero el Worker enruta
// SOLO /api/*: socket.io pide /socket.io/, que por ese camino cae en la web
// estatica y da 404. El WebSocket va derecho a Render.
const SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://transporte-mina.onrender.com';

/* ── tipos ── */
interface PasajeroEstado { id: string; nombre: string; estado: 'NORMAL' | 'POR_MIS_MEDIOS' | 'AUSENTE'; declaradoEn: string | null }
interface ParaderoHoy   { paraderoId: string; nombre: string; orden: number; pasajeros: PasajeroEstado[] }
interface Ejecucion {
  id: string; rutaId: string; conductorId: string;
  rutaNombre: string; vehiculoPlaca: string;
  paraderoActual: number; totalParaderos: number; pasajerosAbordo: number;
}

/* ── helper de sesión ── */
function cerrarSesion() {
  localStorage.removeItem('tm_conductor_token');
  localStorage.removeItem('tm_conductor_user');
  window.location.href = '/transporte/login/';
}

/* fetch con manejo de 401 (sesión expirada) */
async function authFetch(url: string, token: string, init: RequestInit = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) }
  });
  if (r.status === 401) { cerrarSesion(); throw new Error('Sesión expirada'); }
  return r;
}

/* ── ruta demo simulada (Arequipa: Terminal Cayma → Parque Industrial) ── */
const RUTA_DEMO = [
  { lat:-16.3595, lng:-71.5478, vel:0,  label:'Terminal Cayma (inicio)' },
  { lat:-16.3670, lng:-71.5450, vel:38, label:'Av. Cayma' },
  { lat:-16.3740, lng:-71.5430, vel:45, label:'Puente Grau' },
  { lat:-16.3810, lng:-71.5400, vel:42, label:'Bajando a Yanahuara' },
  { lat:-16.3900, lng:-71.5390, vel:28, label:'Frenando — Yanahuara' },
  { lat:-16.4043, lng:-71.5448, vel:0,  label:'Paradero Av. Ejército' },
  { lat:-16.4100, lng:-71.5430, vel:35, label:'Saliendo de Yanahuara' },
  { lat:-16.4028, lng:-71.5367, vel:42, label:'Hacia Óvalo Vallecito' },
  { lat:-16.4028, lng:-71.5367, vel:0,  label:'Paradero Óvalo Vallecito' },
  { lat:-16.4100, lng:-71.5300, vel:50, label:'Ruta a Parque Industrial' },
  { lat:-16.4200, lng:-71.5150, vel:55, label:'Av. Porongoche' },
  { lat:-16.4270, lng:-71.5050, vel:0,  label:'Parque Industrial (destino)' },
];

/* ── Vista principal ── */
function VistaConductor({ token, usuario }: { token: string; usuario: any }) {
  const [ejecucion,  setEjecucion]  = useState<Ejecucion | null>(null);
  const [paraderos,  setParaderos]  = useState<ParaderoHoy[]>([]);
  const [checkins,   setCheckins]   = useState<Record<string, boolean>>({});
  const [log,        setLog]        = useState<string[]>([]);
  const [gpsActivo,  setGpsActivo]  = useState(false);
  const [gpsDemo,    setGpsDemo]    = useState(false);
  const [cargando,   setCargando]   = useState(true);
  const socketRef  = useRef<Socket | null>(null);
  const demoRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef   = useRef<number | null>(null);
  const lastSent   = useRef(0);
  const ejecucionRef = useRef<Ejecucion | null>(null);
  ejecucionRef.current = ejecucion;

  const addLog = useCallback((msg: string) => {
    setLog(p => [`${new Date().toLocaleTimeString('es-PE')} — ${msg}`, ...p].slice(0, 30));
  }, []);

  /* cargar ejecución activa + paraderos reales de la ruta */
  const cargarEjecucion = useCallback(async () => {
    setCargando(true);
    try {
      const r = await authFetch(`${API}/api/rutas/activas`, token).then(r => r.json());
      // FIX: filtrar por el conductorId real (antes tenía `|| true` y tomaba cualquiera)
      const ej: Ejecucion | undefined = usuario.conductorId
        ? r.ejecuciones?.find((e: any) => e.conductorId === usuario.conductorId)
        : r.ejecuciones?.[0]; // fallback para sesiones antiguas sin conductorId
      if (!ej) {
        setEjecucion(null); setParaderos([]);
        addLog('Sin ruta activa asignada a ti');
        return;
      }
      setEjecucion(ej);
      addLog(`✅ Ruta activa: ${ej.rutaNombre}`);

      // FIX: paraderos y pasajeros reales desde la API (antes IDs hardcodeados)
      const [estadosHoy, checkinData] = await Promise.all([
        authFetch(`${API}/api/pasajeros/estados-hoy/${ej.rutaId}`, token).then(r => r.json()),
        authFetch(`${API}/api/checkin/${ej.id}`, token).then(r => r.json()),
      ]);
      setParaderos(Array.isArray(estadosHoy) ? estadosHoy : []);
      const ckMap: Record<string, boolean> = {};
      if (Array.isArray(checkinData)) checkinData.forEach((c: any) => { ckMap[c.pasajeroId] = c.subio; });
      setCheckins(ckMap);
    } catch (e: any) {
      if (e.message !== 'Sesión expirada') addLog('⚠️ Error cargando datos');
    } finally { setCargando(false); }
  }, [token, usuario.conductorId, addLog]);

  /* socket */
  useEffect(() => {
    const s = io(SOCKET, { auth: { token } });
    socketRef.current = s;
    s.on('connect', () => { addLog('Socket conectado'); s.emit('conductor:join'); });
    s.on('pasajero:en-paradero', (d: any) => addLog(`🔔 ${d.nombre} está esperando en su paradero`));
    s.on('disconnect', () => addLog('Socket desconectado'));
    cargarEjecucion();
    return () => {
      s.disconnect();
      if (demoRef.current) clearInterval(demoRef.current);
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviarCoordenada(lat: number, lng: number, velocidad: number, label?: string) {
    const ej = ejecucionRef.current;
    if (!ej) return;
    try {
      await authFetch(`${API}/api/gps/coordenada`, token, {
        method: 'POST',
        body: JSON.stringify({ rutaEjecucionId: ej.id, lat, lng, velocidad })
      });
      addLog(`📡 GPS${label ? `: ${label}` : ''} · ${Math.round(velocidad)} km/h`);
    } catch { addLog('⚠️ Error enviando GPS'); }
  }

  function detenerGPS() {
    if (demoRef.current) { clearInterval(demoRef.current); demoRef.current = null; }
    if (watchRef.current !== null) { navigator.geolocation?.clearWatch(watchRef.current); watchRef.current = null; }
    setGpsActivo(false);
    addLog('GPS detenido');
  }

  function iniciarGPS() {
    if (!ejecucion) { addLog('Sin ruta activa'); return; }
    if (gpsDemo || !('geolocation' in navigator)) {
      // Modo demo: recorre la ruta simulada de Arequipa
      let step = 0;
      demoRef.current = setInterval(() => {
        const p = RUTA_DEMO[step % RUTA_DEMO.length];
        enviarCoordenada(p.lat, p.lng, p.vel, p.label);
        step++;
      }, 4000);
      addLog('GPS DEMO iniciado — ruta simulada AQP');
    } else {
      // GPS real del teléfono
      watchRef.current = navigator.geolocation.watchPosition(
        pos => {
          const now = Date.now();
          if (now - lastSent.current < 4000) return; // máx. 1 envío cada 4s
          lastSent.current = now;
          enviarCoordenada(pos.coords.latitude, pos.coords.longitude, (pos.coords.speed || 0) * 3.6);
        },
        err => { addLog(`⚠️ GPS: ${err.message} — usa modo demo`); detenerGPS(); },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
      addLog('GPS real iniciado — enviando posición');
    }
    setGpsActivo(true);
  }

  async function registrarCheckin(pasajeroId: string, paraderoId: string, subio: boolean) {
    if (!ejecucion) return;
    try {
      await authFetch(`${API}/api/checkin`, token, {
        method: 'POST',
        body: JSON.stringify({ rutaEjecucionId: ejecucion.id, paraderoId, pasajeroId, subio })
      });
      setCheckins(p => ({ ...p, [pasajeroId]: subio }));
      addLog(subio ? '✅ Pasajero abordó' : '❌ Pasajero no estaba');
    } catch { addLog('⚠️ Error registrando checkin'); }
  }

  async function finalizarRuta() {
    if (!ejecucion || !confirm('¿Finalizar la ruta? Esta acción no se puede deshacer.')) return;
    try {
      await authFetch(`${API}/api/rutas/${ejecucion.id}/finalizar`, token, { method: 'POST' });
      addLog('🏁 Ruta finalizada');
      detenerGPS();
      setEjecucion(null); setParaderos([]); setCheckins({});
    } catch { addLog('⚠️ Error finalizando ruta'); }
  }

  async function reportarIncidencia() {
    if (!ejecucion) return;
    const mensaje = prompt('Describe la incidencia (avería, accidente, bloqueo…):');
    if (!mensaje) return;
    try {
      await authFetch(`${API}/api/rutas/${ejecucion.id}/incidencia`, token, {
        method: 'POST', body: JSON.stringify({ mensaje })
      });
      addLog('🚨 Incidencia reportada — supervisor y pasajeros notificados');
      detenerGPS();
      setEjecucion(null);
    } catch { addLog('⚠️ Error reportando incidencia'); }
  }

  const abordo = Object.values(checkins).filter(Boolean).length;
  const totalPasajeros = paraderos.reduce((s, p) => s + p.pasajeros.length, 0);

  const ESTADO_BADGE: Record<string, { txt: string; cls: string }> = {
    POR_MIS_MEDIOS: { txt: '🚶 Por sus medios', cls: 'bg-yellow-500/15 text-yellow-400' },
    AUSENTE:        { txt: '🙅 No viene hoy',   cls: 'bg-red-500/15 text-red-400' },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-8">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">🚌</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight truncate">TransporteMina · Conductor</p>
          <p className="text-slate-500 text-xs truncate">Hola, {usuario.nombre}</p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${gpsActivo ? 'bg-green-600/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${gpsActivo ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
          {gpsActivo ? 'GPS ON' : 'GPS OFF'}
        </span>
        <a href="/transporte/cambiar-password/?de=conductor" title="Cambiar contraseña"
          className="text-slate-500 hover:text-green-400 text-lg px-1 transition-colors">🔑</a>
        <button onClick={cerrarSesion} title="Cerrar sesión"
          className="text-slate-500 hover:text-red-400 text-lg px-1 transition-colors">⏻</button>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {/* Ruta activa */}
        {ejecucion ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Ruta asignada</p>
            <h2 className="font-bold text-lg">{ejecucion.rutaNombre}</h2>
            <div className="flex flex-wrap gap-2 mt-2 mb-3">
              <span className="bg-amber-500/15 text-amber-400 rounded-full px-3 py-1 text-xs font-bold">🚐 {ejecucion.vehiculoPlaca}</span>
              <span className="bg-blue-500/15 text-blue-400 rounded-full px-3 py-1 text-xs font-bold">📍 Parada {ejecucion.paraderoActual}/{ejecucion.totalParaderos}</span>
              <span className="bg-purple-500/15 text-purple-400 rounded-full px-3 py-1 text-xs font-bold">👥 {abordo}/{totalPasajeros} abordo</span>
            </div>
            {/* Progreso */}
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-amber-500 transition-all duration-700"
                style={{ width: `${ejecucion.totalParaderos ? (ejecucion.paraderoActual / ejecucion.totalParaderos) * 100 : 0}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={gpsActivo ? detenerGPS : iniciarGPS}
                className={`${gpsActivo ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} font-bold py-3 rounded-xl text-sm transition-colors`}>
                {gpsActivo ? '⏹ Detener GPS' : '▶ Iniciar GPS'}
              </button>
              <button onClick={finalizarRuta}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold py-3 rounded-xl text-sm transition-colors">
                🏁 Finalizar
              </button>
              <button onClick={reportarIncidencia}
                className="bg-red-950 hover:bg-red-900 border border-red-800/50 text-red-300 font-bold py-3 rounded-xl text-sm transition-colors">
                🚨 Incidencia
              </button>
              <button onClick={cargarEjecucion}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold py-3 rounded-xl text-sm transition-colors">
                🔄 Actualizar
              </button>
            </div>
            {/* Toggle modo demo */}
            <label className="flex items-center gap-2 mt-3 text-xs text-slate-500 cursor-pointer select-none">
              <input type="checkbox" checked={gpsDemo} onChange={e => setGpsDemo(e.target.checked)}
                disabled={gpsActivo} className="accent-amber-500" />
              Modo demo (ruta simulada de Arequipa, sin GPS del teléfono)
            </label>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3 opacity-40">🛣️</div>
            <p className="text-slate-400 font-semibold">{cargando ? 'Buscando tu ruta…' : 'Sin ruta activa'}</p>
            <p className="text-slate-600 text-xs mt-1 mb-4">El supervisor debe iniciar la ruta y asignarte</p>
            <button onClick={cargarEjecucion} disabled={cargando}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
              🔄 Verificar de nuevo
            </button>
          </div>
        )}

        {/* Checkin por paradero (dinámico) */}
        {ejecucion && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Registro de pasajeros</p>
            {paraderos.length === 0 && (
              <p className="text-slate-600 text-sm">Esta ruta no tiene paraderos con pasajeros registrados.</p>
            )}
            <div className="space-y-3">
              {paraderos.map(par => (
                <div key={par.paraderoId} className="bg-slate-800/60 rounded-xl p-3">
                  <p className="font-bold text-sm mb-2 text-slate-200">📍 {par.orden}. {par.nombre}</p>
                  {par.pasajeros.length === 0 && <p className="text-slate-600 text-xs">Sin pasajeros en este paradero</p>}
                  <div className="space-y-2">
                    {par.pasajeros.map(p => {
                      const ck = checkins[p.id];
                      const badge = ESTADO_BADGE[p.estado];
                      return (
                        <div key={p.id} className="flex items-center gap-2 flex-wrap">
                          <span className={`flex-1 min-w-0 text-sm truncate ${ck === true ? 'text-green-400' : ck === false ? 'text-red-400' : 'text-slate-300'}`}>
                            {ck === true ? '✅' : ck === false ? '❌' : '⏳'} {p.nombre}
                          </span>
                          {badge && <span className={`${badge.cls} rounded-full px-2 py-0.5 text-[10px] font-bold`}>{badge.txt}</span>}
                          {ck === undefined && p.estado !== 'AUSENTE' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => registrarCheckin(p.id, par.paraderoId, true)}
                                className="bg-green-900/60 hover:bg-green-800 text-green-300 border border-green-800 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors">
                                ✅ Subió
                              </button>
                              <button onClick={() => registrarCheckin(p.id, par.paraderoId, false)}
                                className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-900 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors">
                                ❌ No está
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Actividad</p>
          <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
            {log.length === 0 && <p className="text-slate-600">Sin actividad</p>}
            {log.map((l, i) => (
              <p key={i} className={i === 0 ? 'text-slate-200' : 'text-slate-600'}>{l}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Root ── */
// LOGIN UNIFICADO: esta página ya no tiene formulario propio.
// Si no hay sesión de conductor, manda a viczul.com/transporte/login/
export default function ConductorPage() {
  const [token,   setToken]   = useState<string | null>(null);
  const [usuario, setUsuario] = useState<any>(null);
  const [listo,   setListo]   = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('tm_conductor_token');
    const u = localStorage.getItem('tm_conductor_user');
    if (t && u) { setToken(t); setUsuario(JSON.parse(u)); setListo(true); }
    else { window.location.href = '/transporte/login/'; }
  }, []);

  if (!listo || !token) return null;
  return <VistaConductor token={token} usuario={usuario} />;
}
