'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket, type BusPosition } from '@/lib/socket';
import { getRutasActivas } from '@/lib/api';
import { formatHora, cn } from '@/lib/utils';

declare global {
  interface Window { L: any; }
}

export default function MapaPage() {
  const mapRef     = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markers    = useRef<Map<string, any>>(new Map());
  const [buses,    setBuses]    = useState<BusPosition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [satelite, setSatelite] = useState(false);
  const [cargando, setCargando] = useState(true);
  const tileLayer  = useRef<any>(null);

  useEffect(() => {
    if (window.L) { initMap(); return; }

    const link = document.createElement('link');
    link.rel   = 'stylesheet';
    link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = initMap;
    document.head.appendChild(script);

    return () => {
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initMap() {
    if (!mapRef.current || leafletMap.current) return;
    const L = window.L;
    leafletMap.current = L.map(mapRef.current, { zoomControl: true }).setView([-16.409, -71.537], 12);
    tileLayer.current = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap contributors', maxZoom: 19 }
    ).addTo(leafletMap.current);
    setCargando(false);
  }

  useEffect(() => {
    if (!leafletMap.current || !window.L) return;
    const L = window.L;
    if (tileLayer.current) { leafletMap.current.removeLayer(tileLayer.current); }
    tileLayer.current = satelite
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: '© Esri', maxZoom: 19 }).addTo(leafletMap.current)
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(leafletMap.current);
  }, [satelite]);

  const busIcon = useCallback(() => {
    if (!window.L) return null;
    return window.L.divIcon({
      html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">🚌</div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }, []);

  const updateBus = useCallback((pos: BusPosition) => {
    setBuses(prev => {
      const idx = prev.findIndex(b => b.conductorId === pos.conductorId);
      if (idx >= 0) { const n = [...prev]; n[idx] = pos; return n; }
      return [...prev, pos];
    });
    if (!leafletMap.current || !window.L) return;
    const L = window.L;
    const existing = markers.current.get(pos.conductorId);
    if (existing) {
      existing.setLatLng([pos.lat, pos.lng]);
      existing.getPopup()?.setContent(buildPopup(pos));
    } else {
      const m = L.marker([pos.lat, pos.lng], { icon: busIcon() })
        .addTo(leafletMap.current)
        .bindPopup(buildPopup(pos), { className: 'dark-popup' });
      m.on('click', () => setSelected(pos.conductorId));
      markers.current.set(pos.conductorId, m);
    }
  }, [busIcon]);

  useEffect(() => {
    getRutasActivas().then(data => {
      (data.ejecuciones || []).forEach((e: any) => {
        if (e.ultimaLat && e.ultimaLng) {
          updateBus({ conductorId: e.conductorId, lat: e.ultimaLat, lng: e.ultimaLng,
            speed: 0, timestamp: e.ultimaActualizacion, rutaEjecucionId: e.id,
            conductorNombre: e.conductorNombre, rutaNombre: e.rutaNombre, vehiculoPlaca: e.vehiculoPlaca });
        }
      });
    }).catch(() => {});
  }, [updateBus]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('supervisor:join');
    socket.on('supervisor:gps-update', (pos: BusPosition) => updateBus(pos));
    socket.on('ruta:finalizada', (d: any) => {
      const m = markers.current.get(d.conductorId);
      if (m && leafletMap.current) { leafletMap.current.removeLayer(m); markers.current.delete(d.conductorId); }
      setBuses(prev => prev.filter(b => b.conductorId !== d.conductorId));
    });
    return () => { socket.off('supervisor:gps-update'); socket.off('ruta:finalizada'); };
  }, [updateBus]);

  const centrarEnBus = (conductorId: string) => {
    const m = markers.current.get(conductorId);
    const b = buses.find(x => x.conductorId === conductorId);
    if (m && leafletMap.current && b) {
      leafletMap.current.setView([b.lat, b.lng], 15, { animate: true });
      m.openPopup();
      setSelected(conductorId);
    }
  };

  return (
    <div className="flex h-[calc(100vh-0px)]">
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden shrink-0">
        <div className="px-4 py-4 border-b border-slate-800">
          <h2 className="font-bold text-white">Buses en ruta</h2>
          <p className="text-slate-500 text-xs mt-0.5">{buses.length} activo{buses.length !== 1 ? 's' : ''}</p>
        </div>
        {buses.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm px-4 text-center">
            No hay buses en ruta en este momento
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
            {buses.map(b => (
              <button key={b.conductorId} onClick={() => centrarEnBus(b.conductorId)}
                className={cn('w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors',
                  selected === b.conductorId && 'bg-slate-800 border-l-2 border-green-500')}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5">🚌</span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{b.rutaNombre}</p>
                    <p className="text-slate-400 text-xs">{b.conductorNombre}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{b.vehiculoPlaca} · {b.speed?.toFixed(0) ?? 0} km/h</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">Actualizado {formatHora(b.timestamp)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-800">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-2">Tipo de mapa</p>
          <div className="flex gap-2">
            <button onClick={() => setSatelite(false)}
              className={cn('flex-1 py-1.5 rounded text-xs font-semibold transition-colors',
                !satelite ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
              🗺️ Mapa
            </button>
            <button onClick={() => setSatelite(true)}
              className={cn('flex-1 py-1.5 rounded text-xs font-semibold transition-colors',
                satelite ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}>
              🛰️ Satélite
            </button>
          </div>
          <p className="text-slate-700 text-[9px] mt-2 text-center">OpenStreetMap · Gratis</p>
        </div>
      </div>
      <div className="flex-1 relative">
        {cargando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-bounce">🗺️</div>
              <p className="text-slate-400 text-sm">Cargando mapa...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
      </div>
      <style>{`
        .dark-popup .leaflet-popup-content-wrapper { background: #1e293b; color: #f1f5f9; border: 1px solid #334155; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.5); }
        .dark-popup .leaflet-popup-tip { background: #1e293b; }
        .dark-popup .leaflet-popup-content { margin: 10px 14px; }
        .leaflet-container { background: #0f172a; }
      `}</style>
    </div>
  );
}

function buildPopup(pos: BusPosition) {
  return `<div style="font-family:sans-serif;min-width:180px">
    <p style="font-weight:800;margin:0 0 6px;font-size:14px">${pos.rutaNombre || 'Ruta activa'}</p>
    <p style="color:#94a3b8;font-size:12px;margin:0">👨‍✈️ ${pos.conductorNombre || '—'}</p>
    <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">🚌 ${pos.vehiculoPlaca || '—'} · ${(pos.speed || 0).toFixed(0)} km/h</p>
  </div>`;
}
