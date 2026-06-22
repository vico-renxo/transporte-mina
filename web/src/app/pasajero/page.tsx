'use client';
import { useEffect, useState, useRef, useCallback } from 'react';

const BASE = 'http://localhost:3001';

// ---------- tipos ----------
interface Perfil {
  pasajero: {
    id: string;
    aprobado: boolean;
    ruta: { id: string; nombre: string; horaInicio: string; origen: string; destino: string };
    paradero: { id: string; nombre: string; lat: number; lng: number; orden: number };
    usuario: { nombre: string; email: string };
  };
  ejecucionActiva: {
    id: string; estado: string;
    conductorNombre: string; vehiculo: string;
    ultimaLat: number | null; ultimaLng: number | null;
    ultimaActualizacion: string;
  } | null;
}

// ---------- helpers ----------
function deg2rad(d: number) { return d * Math.PI / 180; }
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------- Login ----------
function LoginForm({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !pass) { setErr('Completa todos los campos'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Credenciales incorrectas');
      if (data.usuario?.rol !== 'PASAJERO') throw new Error('Esta vista es solo para pasajeros');
      onLogin(data.token, data.usuario);
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-green-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚌</div>
          <h1 className="text-2xl font-black text-white">TransporteMina</h1>
          <p className="text-slate-400 text-sm mt-1">Seguimiento de tu bus</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-white font-bold text-lg mb-5">Ingresa tu cuenta</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="tu@email.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Contraseña</label>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            {err && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {err}
              </div>
            )}
            <button onClick={handleLogin} disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">
          ¿No tienes cuenta? Contacta a tu supervisor
        </p>
      </div>
    </div>
  );
}

// ---------- Mapa Leaflet (lazy) ----------
function MapaBus({ lat, lng, paraderoLat, paraderoLng, paraderoNombre }: {
  lat: number; lng: number;
  paraderoLat?: number; paraderoLng?: number; paraderoNombre?: string;
}) {
  const mapRef = useRef<any>(null);
  const busMarkerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    // Cargar Leaflet dinámicamente
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      const map = L.map(mapContainerRef.current).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      // Icono bus
      const busIcon = L.divIcon({
        html: '<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">🚌</div>',
        className: '', iconAnchor: [14, 14]
      });
      busMarkerRef.current = L.marker([lat, lng], { icon: busIcon }).addTo(map)
        .bindPopup('<b>Tu bus</b><br>En camino…').openPopup();

      // Paradero
      if (paraderoLat && paraderoLng) {
        const stopIcon = L.divIcon({
          html: '<div style="font-size:22px">📍</div>',
          className: '', iconAnchor: [11, 22]
        });
        L.marker([paraderoLat, paraderoLng], { icon: stopIcon }).addTo(map)
          .bindPopup(`<b>Tu paradero</b><br>${paraderoNombre || ''}`);
        L.polyline([[lat, lng], [paraderoLat, paraderoLng]], {
          color: '#16a34a', weight: 2, dashArray: '6,6', opacity: 0.7
        }).addTo(map);
      }

      mapRef.current = map;
    };
    document.head.appendChild(script);
    return () => {};
  }, []);

  // Actualizar posición del bus
  useEffect(() => {
    if (!busMarkerRef.current || !mapRef.current) return;
    busMarkerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng], { animate: true, duration: 1 });
  }, [lat, lng]);

  return <div ref={mapContainerRef} className="w-full h-full rounded-xl" />;
}

// ---------- Vista principal del pasajero ----------
function VistaPasajero({ token, usuario }: { token: string; usuario: any }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [busPos, setBusPos] = useState<{ lat: number; lng: number; velocidad: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estadoHoy, setEstadoHoy] = useState<string | null>(null);
  const [enviandoEstado, setEnviandoEstado] = useState(false);
  const socketRef = useRef<any>(null);
  const pollRef = useRef<any>(null);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const cargarPerfil = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/pasajeros/mi-perfil`, { headers });
      if (!r.ok) throw new Error('No se pudo cargar tu perfil');
      const data: Perfil = await r.json();
      setPerfil(data);
      if (data.ejecucionActiva?.ultimaLat && data.ejecucionActiva?.ultimaLng) {
        setBusPos({ lat: data.ejecucionActiva.ultimaLat, lng: data.ejecucionActiva.ultimaLng, velocidad: 0 });
      }
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [token]);

  // Conectar socket para actualizaciones en tiempo real
  const conectarSocket = useCallback((ejecucionId: string) => {
    if (socketRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.onload = () => {
      const io = (window as any).io;
      const socket = io(BASE, { transports: ['websocket', 'polling'] });
      socket.on('connect', () => {
        socket.emit('pasajero:join', { rutaEjecucionId: ejecucionId });
      });
      socket.on('ruta:posicion', (data: any) => {
        setBusPos({ lat: data.lat, lng: data.lng, velocidad: data.velocidad || 0 });
      });
      socket.on('ruta:finalizada', () => {
        setPerfil(prev => prev ? { ...prev, ejecucionActiva: null } : null);
        setBusPos(null);
      });
      socketRef.current = socket;
    };
    document.head.appendChild(script);
  }, []);

  // Poll fallback cada 15s
  const iniciarPoll = useCallback((ejecucionId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}/api/gps/ultima/${ejecucionId}`, { headers });
        if (r.ok) {
          const d = await r.json();
          setBusPos({ lat: d.lat, lng: d.lng, velocidad: d.velocidad || 0 });
        }
      } catch {}
    }, 15000);
  }, [token]);

  useEffect(() => {
    cargarPerfil();
    return () => {
      socketRef.current?.disconnect();
      clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (perfil?.ejecucionActiva?.id) {
      conectarSocket(perfil.ejecucionActiva.id);
      iniciarPoll(perfil.ejecucionActiva.id);
    }
  }, [perfil?.ejecucionActiva?.id]);

  const declararEstado = async (estado: string) => {
    if (!perfil?.pasajero) return;
    setEnviandoEstado(true);
    try {
      await fetch(`${BASE}/api/pasajeros/estado`, {
        method: 'POST', headers,
        body: JSON.stringify({
          pasajeroId: perfil.pasajero.id,
          rutaId: perfil.pasajero.ruta.id,
          estado
        })
      });
      setEstadoHoy(estado);
    } catch (e) { alert('Error al declarar estado'); }
    finally { setEnviandoEstado(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">🚌</div>
          <p className="text-slate-400">Cargando tu información…</p>
        </div>
      </div>
    );
  }

  if (error || !perfil) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-800/50 rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400 font-semibold">{error || 'No se encontró tu perfil de pasajero'}</p>
          <p className="text-slate-500 text-sm mt-2">Contacta a tu supervisor para que te registre en el sistema.</p>
        </div>
      </div>
    );
  }

  const { pasajero, ejecucionActiva } = perfil;
  const distancia = busPos && pasajero.paradero?.lat
    ? distKm(busPos.lat, busPos.lng, pasajero.paradero.lat, pasajero.paradero.lng)
    : null;
  const etaMin = distancia && busPos?.velocidad
    ? Math.round((distancia / busPos.velocidad) * 60)
    : null;

  const ESTADO_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    NORMAL:        { label: 'Abordo / En paradero', icon: '✅', color: 'bg-green-600' },
    POR_MIS_MEDIOS:{ label: 'Voy por mis medios',  icon: '🚶', color: 'bg-yellow-600' },
    AUSENTE:       { label: 'No voy hoy',           icon: '❌', color: 'bg-red-600'    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚌</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">TransporteMina</p>
            <p className="text-slate-500 text-xs">Hola, {pasajero.usuario.nombre.split(' ')[0]}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${ejecucionActiva ? 'bg-green-600/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ejecucionActiva ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
          {ejecucionActiva ? 'Bus en ruta' : 'Sin servicio activo'}
        </div>
      </div>

      {/* Mapa */}
      <div className="h-[45vh] bg-slate-900 relative">
        {busPos ? (
          <MapaBus
            lat={busPos.lat} lng={busPos.lng}
            paraderoLat={pasajero.paradero?.lat} paraderoLng={pasajero.paradero?.lng}
            paraderoNombre={pasajero.paradero?.nombre}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <span className="text-5xl opacity-30">🗺️</span>
            <p className="text-slate-600 text-sm">Sin ubicación disponible</p>
            {!ejecucionActiva && <p className="text-slate-700 text-xs">El servicio aún no ha iniciado</p>}
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="p-4 space-y-3 overflow-y-auto">

        {/* Ruta info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Tu ruta</p>
              <p className="text-white font-bold">{pasajero.ruta.nombre}</p>
              <p className="text-slate-400 text-sm">{pasajero.ruta.origen} → {pasajero.ruta.destino}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Salida</p>
              <p className="text-green-400 font-bold text-lg">{pasajero.ruta.horaInicio}</p>
            </div>
          </div>
        </div>

        {/* Paradero */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Tu paradero</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📍</span>
              <div>
                <p className="text-white font-semibold">{pasajero.paradero?.nombre || '—'}</p>
                <p className="text-slate-500 text-xs">Parada #{pasajero.paradero?.orden}</p>
              </div>
            </div>
            {distancia !== null && (
              <div className="text-right">
                <p className="text-white font-bold">{distancia < 1 ? `${Math.round(distancia * 1000)}m` : `${distancia.toFixed(1)}km`}</p>
                <p className="text-slate-500 text-xs">del bus</p>
              </div>
            )}
          </div>
        </div>

        {/* Bus info */}
        {ejecucionActiva && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Bus asignado</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Conductor</p>
                <p className="text-white text-sm font-semibold">{ejecucionActiva.conductorNombre}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Vehículo</p>
                <p className="text-white text-sm font-semibold">{ejecucionActiva.vehiculo}</p>
              </div>
              {busPos && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Velocidad</p>
                  <p className="text-white text-sm font-semibold">{busPos.velocidad} km/h</p>
                </div>
              )}
              {etaMin !== null && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">ETA a tu parada</p>
                  <p className="text-green-400 text-sm font-bold">~{etaMin} min</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Declarar estado */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
            Declarar mi estado para hoy
          </p>
          {estadoHoy ? (
            <div className={`${ESTADO_LABELS[estadoHoy]?.color || 'bg-slate-700'} bg-opacity-20 border border-current/30 rounded-xl p-3 text-center`}>
              <span className="text-xl">{ESTADO_LABELS[estadoHoy]?.icon}</span>
              <p className="text-white font-semibold mt-1">{ESTADO_LABELS[estadoHoy]?.label}</p>
              <p className="text-slate-400 text-xs mt-0.5">Estado declarado ✓</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ESTADO_LABELS).map(([key, val]) => (
                <button key={key} onClick={() => declararEstado(key)} disabled={enviandoEstado}
                  className="flex flex-col items-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">
                  <span className="text-xl">{val.icon}</span>
                  <span className="text-xs text-slate-300 text-center leading-tight">{val.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-slate-700 text-xs pb-4">
          Actualización en tiempo real vía socket · TransporteMina
        </p>
      </div>
    </div>
  );
}

// ---------- Root ----------
export default function PasajeroPage() {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('tm_pasajero_token');
    const u = localStorage.getItem('tm_pasajero_user');
    if (t && u) { setToken(t); setUsuario(JSON.parse(u)); }
  }, []);

  const handleLogin = (t: string, u: any) => {
    localStorage.setItem('tm_pasajero_token', t);
    localStorage.setItem('tm_pasajero_user', JSON.stringify(u));
    setToken(t); setUsuario(u);
  };

  if (!token) return <LoginForm onLogin={handleLogin} />;
  return <VistaPasajero token={token} usuario={usuario} />;
}
