'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { distKm } from '@/lib/geo';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://transporte-mina.onrender.com';

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

// FIX: manejo de sesión expirada — limpia tokens propios del pasajero y vuelve al login
function cerrarSesion() {
  localStorage.removeItem('tm_pasajero_token');
  localStorage.removeItem('tm_pasajero_user');
  window.location.href = '/transporte/login/';
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

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;
      const map = L.map(mapContainerRef.current).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      const busIcon = L.divIcon({
        html: '<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">🚌</div>',
        className: '', iconAnchor: [14, 14]
      });
      busMarkerRef.current = L.marker([lat, lng], { icon: busIcon }).addTo(map)
        .bindPopup('<b>Tu bus</b><br>En camino…').openPopup();

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
  const [avisado, setAvisado] = useState(false);
  const [avisando, setAvisando] = useState(false);
  const [ubicMsg, setUbicMsg] = useState('');
  const [actualizandoUbic, setActualizandoUbic] = useState(false);
  const socketRef = useRef<any>(null);
  const pollRef = useRef<any>(null);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const cargarPerfil = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/pasajeros/mi-perfil`, { headers });
      if (r.status === 401) { cerrarSesion(); return; } // FIX: sesión expirada
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

  const iniciarPoll = useCallback((ejecucionId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}/api/gps/ultima/${ejecucionId}`, { headers });
        if (r.status === 401) { cerrarSesion(); return; } // FIX: sesión expirada
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
      const r = await fetch(`${BASE}/api/pasajeros/estado`, {
        method: 'POST', headers,
        body: JSON.stringify({ estado })
      });
      if (r.status === 401) { cerrarSesion(); return; }
      if (!r.ok) throw new Error();
      setEstadoHoy(estado);
    } catch (e) { alert('Error al declarar estado'); }
    finally { setEnviandoEstado(false); }
  };

  // NUEVO: avisar al conductor que estoy esperando en el paradero
  const avisarEnParadero = async () => {
    setAvisando(true);
    try {
      const r = await fetch(`${BASE}/api/pasajeros/en-paradero`, { method: 'POST', headers });
      if (r.status === 401) { cerrarSesion(); return; }
      if (!r.ok) throw new Error();
      setAvisado(true);
    } catch { alert('No se pudo avisar al conductor'); }
    finally { setAvisando(false); }
  };

  // NUEVO: el pasajero actualiza su domicilio desde su panel (PATCH /pasajeros/mi-domicilio)
  const actualizarUbicacion = () => {
    if (!('geolocation' in navigator)) { setUbicMsg('Tu navegador no soporta GPS'); return; }
    setActualizandoUbic(true); setUbicMsg('Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const r = await fetch(`${BASE}/api/pasajeros/mi-domicilio`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ domicilioLat: pos.coords.latitude, domicilioLng: pos.coords.longitude })
          });
          if (r.status === 401) { cerrarSesion(); return; }
          if (!r.ok) throw new Error();
          setUbicMsg(`✅ Domicilio actualizado (±${Math.round(pos.coords.accuracy)}m). Tu supervisor lo verá al revisar tu paradero.`);
        } catch { setUbicMsg('⚠️ No se pudo guardar, intenta de nuevo'); }
        finally { setActualizandoUbic(false); }
      },
      e => { setUbicMsg('⚠️ GPS: ' + e.message); setActualizandoUbic(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
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
          <button onClick={cerrarSesion}
            className="mt-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const { pasajero, ejecucionActiva } = perfil;
  const distancia = busPos && pasajero.paradero?.lat
    ? distKm(busPos, pasajero.paradero)
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
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${ejecucionActiva ? 'bg-green-600/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ejecucionActiva ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
            {ejecucionActiva ? 'Bus en ruta' : 'Sin servicio activo'}
          </div>
          <a href="/transporte/cambiar-password/?de=pasajero" title="Cambiar contraseña"
            className="text-slate-500 hover:text-green-400 text-lg px-1 transition-colors">🔑</a>
          <button onClick={cerrarSesion} title="Cerrar sesión"
            className="text-slate-500 hover:text-red-400 text-lg px-1 transition-colors">⏻</button>
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

        {/* Avisar al conductor (solo con bus en ruta) */}
        {ejecucionActiva && (
          avisado ? (
            <div className="bg-green-600/15 border border-green-700/40 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-bold text-sm">📢 Conductor avisado — sabe que estás esperando</p>
            </div>
          ) : (
            <button onClick={avisarEnParadero} disabled={avisando}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm">
              {avisando ? 'Avisando…' : '📢 Estoy en el paradero — avisar al conductor'}
            </button>
          )
        )}

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

        {/* Mi ubicación — actualizar domicilio */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Mi domicilio</p>
          <button onClick={actualizarUbicacion} disabled={actualizandoUbic}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 font-bold py-3 rounded-xl text-sm transition-colors">
            {actualizandoUbic ? 'Actualizando…' : '📍 Actualizar mi ubicación (GPS)'}
          </button>
          {ubicMsg && <p className="text-xs text-slate-400 mt-2">{ubicMsg}</p>}
          <p className="text-slate-600 text-[11px] mt-2">Si te mudaste, actualiza tu ubicación para que el supervisor reasigne tu paradero.</p>
        </div>

        <p className="text-center text-slate-700 text-xs pb-4">
          Actualización en tiempo real vía socket · TransporteMina
        </p>
      </div>
    </div>
  );
}

// ---------- Root ----------
// LOGIN UNIFICADO: sin formulario propio — redirige a viczul.com/transporte/login/
export default function PasajeroPage() {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<any>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('tm_pasajero_token');
    const u = localStorage.getItem('tm_pasajero_user');
    if (t && u) { setToken(t); setUsuario(JSON.parse(u)); setListo(true); }
    else { window.location.href = '/transporte/login/'; }
  }, []);

  if (!listo || !token) return null;
  return <VistaPasajero token={token} usuario={usuario} />;
}
