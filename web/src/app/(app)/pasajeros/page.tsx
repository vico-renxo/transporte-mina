'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getPasajeros, getPendientes, aprobarPasajero, getRutas } from '@/lib/api';
import { badgeEstado, formatFecha, cn } from '@/lib/utils';
import { cached, bust, hasCache } from '@/lib/cache';

interface Pasajero {
  id: string;
  usuario: { nombre: string; email: string; telefono?: string };
  paradero: { id?: string; nombre: string } | null;
  ruta: { id?: string; nombre: string } | null;
  paraderoId?: string | null;
  rutaId?: string | null;
  aprobado: boolean;
  activo: boolean;
  creadoEn: string;
  estadoHoy?: string;
  // Domicilio declarado por GPS al registrarse
  domicilioLat?: number | null;
  domicilioLng?: number | null;
  direccion?: string;
}
interface ParaderoR { id: string; nombre: string; orden: number; lat: number; lng: number }
interface Ruta { id: string; nombre: string; paraderos: ParaderoR[] }

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, d2r = (d: number) => d * Math.PI / 180;
  const dLat = d2r(b.lat - a.lat), dLng = d2r(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(d2r(a.lat)) * Math.cos(d2r(b.lat)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

export default function PasajerosPage() {
  const [pasajeros,  setPasajeros]  = useState<Pasajero[]>([]);
  const [pendientes, setPendientes] = useState<Pasajero[]>([]);
  const [rutas,      setRutas]      = useState<Ruta[]>([]);
  const [loading,    setLoading]    = useState(!hasCache('pasajeros'));
  const [tab,        setTab]        = useState<'todos' | 'pendientes'>('todos');
  const [filtro,     setFiltro]     = useState('');
  // Modal de aprobación
  const [aprobando,  setAprobando]  = useState<Pasajero | null>(null);
  const [rutaSel,    setRutaSel]    = useState('');
  const [paraderoSel, setParaderoSel] = useState('');
  const [enviando,   setEnviando]   = useState(false);

  const cargar = async () => {
    try {
      const [pas, pen, rts] = await Promise.all([
        cached('pasajeros', () => getPasajeros()),
        cached('pendientes', () => getPendientes()),
        cached('rutas', () => getRutas()),
      ]);
      setPasajeros(pas.pasajeros || pas);
      setPendientes(pen.pendientes || pen);
      setRutas(rts.rutas || rts);
    } catch { toast.error('Error al cargar'); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  /* Abrir modal: preseleccionar ruta y paradero MÁS CERCANO al domicilio */
  const abrirAprobacion = (p: Pasajero) => {
    setAprobando(p);
    let mejorRuta = rutas[0]?.id || '';
    let mejorParadero = rutas[0]?.paraderos?.[0]?.id || '';
    if (p.paraderoId) {
      // El pasajero eligió paradero al registrarse (o ya tiene uno asignado) → preseleccionarlo
      const r = rutas.find(rt => rt.paraderos?.some(par => par.id === p.paraderoId));
      if (r) { setRutaSel(r.id); setParaderoSel(p.paraderoId); return; }
    }
    if (p.domicilioLat && p.domicilioLng) {
      let min = Infinity;
      for (const r of rutas) for (const par of (r.paraderos || [])) {
        if (!par.lat || !par.lng) continue;
        const d = distKm({ lat: p.domicilioLat, lng: p.domicilioLng }, par);
        if (d < min) { min = d; mejorRuta = r.id; mejorParadero = par.id; }
      }
    }
    setRutaSel(mejorRuta);
    setParaderoSel(mejorParadero);
  };

  const confirmarAprobacion = async () => {
    if (!aprobando || !paraderoSel) { toast.error('Selecciona un paradero'); return; }
    setEnviando(true);
    try {
      await aprobarPasajero(aprobando.id, paraderoSel);
      toast.success(`${aprobando.usuario?.nombre} ${aprobando.aprobado ? 'actualizado' : 'aprobado'} ✓`);
      bust('pasajeros', 'pendientes');
      setAprobando(null);
      cargar();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error al aprobar'); }
    finally { setEnviando(false); }
  };

  const rutaActiva = rutas.find(r => r.id === rutaSel);
  const domicilio = aprobando?.domicilioLat && aprobando?.domicilioLng
    ? { lat: aprobando.domicilioLat, lng: aprobando.domicilioLng } : null;
  const paraderosOrdenados = (rutaActiva?.paraderos || [])
    .map(par => ({ ...par, dist: domicilio && par.lat ? distKm(domicilio, par) : null }))
    .sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999));

  const lista = tab === 'pendientes' ? pendientes : pasajeros;
  const filtrados = lista.filter(p =>
    p.usuario?.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    p.ruta?.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    p.paradero?.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Pasajeros</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {pasajeros.length} registrados &middot; {pendientes.length} pendientes de aprobacion
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {(['todos', 'pendientes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              tab === t ? 'bg-green-600 text-white' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:bg-slate-800')}>
            {t === 'todos' ? `Todos (${pasajeros.length})` : `Pendientes (${pendientes.length})`}
            {t === 'pendientes' && pendientes.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full inline-flex items-center justify-center font-bold">{pendientes.length}</span>
            )}
          </button>
        ))}
      </div>

      <input value={filtro} onChange={e => setFiltro(e.target.value)}
        placeholder="Buscar por nombre, ruta o paradero..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-green-500 mb-5"
      />

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Pasajero</th>
              <th className="text-left px-5 py-3">Ruta</th>
              <th className="text-left px-5 py-3">Paradero</th>
              <th className="text-left px-5 py-3">Domicilio</th>
              <th className="text-left px-5 py-3">Registro</th>
              <th className="text-right px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-600">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-600">Sin resultados</td></tr>
            ) : filtrados.map(p => (
              <tr key={p.id} className="hover:bg-slate-800/50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 text-sm font-bold shrink-0">
                      {p.usuario?.nombre?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{p.usuario?.nombre}</p>
                      <p className="text-slate-500 text-xs">{p.usuario?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-300 text-sm">{p.ruta?.nombre || <span className="text-amber-500/70 text-xs">sin asignar</span>}</td>
                <td className="px-5 py-3.5 text-slate-300 text-sm">
                  {p.paradero?.nombre
                    ? (!p.aprobado
                        ? <span className="text-blue-400 text-xs font-semibold">🚏 {p.paradero.nombre} <span className="text-slate-500 font-normal">(eligió)</span></span>
                        : p.paradero.nombre)
                    : <span className="text-amber-500/70 text-xs">sin asignar</span>}
                </td>
                <td className="px-5 py-3.5 text-sm">
                  {p.domicilioLat && p.domicilioLng ? (
                    <a href={`https://www.openstreetmap.org/?mlat=${p.domicilioLat}&mlon=${p.domicilioLng}#map=17/${p.domicilioLat}/${p.domicilioLng}`}
                      target="_blank" rel="noreferrer"
                      className="text-green-400 hover:text-green-300 text-xs underline" title={p.direccion || ''}>
                      📍 ver mapa
                    </a>
                  ) : p.direccion ? (
                    <span className="text-slate-400 text-xs" title={p.direccion}>{p.direccion.slice(0, 24)}…</span>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">{formatFecha(p.creadoEn)}</td>
                <td className="px-5 py-3.5 text-right">
                  {!p.aprobado ? (
                    <button onClick={() => abrirAprobacion(p)}
                      className="text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                      Aprobar
                    </button>
                  ) : (
                    <button onClick={() => abrirAprobacion(p)}
                      className="text-xs bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                      ✎ Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal de aprobación: asignar ruta + paradero (sugiere el más cercano al domicilio) ── */}
      {aprobando && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !enviando && setAprobando(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-bold text-lg">{aprobando.aprobado ? 'Editar asignación' : 'Aprobar pasajero'}</h2>
            <p className="text-slate-400 text-sm mt-0.5 mb-4">
              Asigna ruta y paradero a <span className="text-white font-semibold">{aprobando.usuario?.nombre}</span>
            </p>

            {/* Domicilio declarado */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Domicilio declarado</p>
              {domicilio ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-300 text-xs flex-1">{aprobando.direccion || 'Sin dirección escrita'}</p>
                  <a href={`https://www.openstreetmap.org/?mlat=${domicilio.lat}&mlon=${domicilio.lng}#map=17/${domicilio.lat}/${domicilio.lng}`}
                    target="_blank" rel="noreferrer"
                    className="text-green-400 text-xs font-bold underline shrink-0 hover:text-green-300">
                    📍 Verificar en mapa
                  </a>
                </div>
              ) : (
                <p className="text-slate-500 text-xs">{aprobando.direccion || 'No compartió ubicación GPS — asigna manualmente.'}</p>
              )}
            </div>

            {/* Ruta */}
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Ruta</label>
            <select value={rutaSel}
              onChange={e => { setRutaSel(e.target.value); const r = rutas.find(x => x.id === e.target.value); setParaderoSel(r?.paraderos?.[0]?.id || ''); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500 mb-4">
              {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>

            {/* Paraderos ordenados por cercanía al domicilio */}
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
              Paradero {domicilio && <span className="text-green-500 normal-case">(ordenados por cercanía a su casa)</span>}
            </label>
            <div className="space-y-1.5 max-h-52 overflow-y-auto mb-5">
              {paraderosOrdenados.map((par, i) => (
                <button key={par.id} type="button" onClick={() => setParaderoSel(par.id)}
                  className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors',
                    paraderoSel === par.id
                      ? 'bg-green-600/15 border-green-600/60 text-green-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:border-slate-600')}>
                  <span className="text-sm">
                    {paraderoSel === par.id ? '✓ ' : ''}#{par.orden} · {par.nombre}
                    {par.id === aprobando.paraderoId && <span className="ml-2 text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">🚏 ELEGIDO POR ÉL</span>}
                    {i === 0 && par.dist !== null && par.id !== aprobando.paraderoId && <span className="ml-2 text-[10px] bg-green-600/20 text-green-400 px-1.5 py-0.5 rounded font-bold">MÁS CERCANO</span>}
                  </span>
                  {par.dist !== null && (
                    <span className="text-xs text-slate-500 shrink-0">
                      {par.dist < 1 ? `${Math.round(par.dist * 1000)} m` : `${par.dist.toFixed(1)} km`}
                    </span>
                  )}
                </button>
              ))}
              {paraderosOrdenados.length === 0 && <p className="text-slate-600 text-xs py-2">Esta ruta no tiene paraderos.</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAprobando(null)} disabled={enviando}
                className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold py-2.5 rounded-lg text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarAprobacion} disabled={enviando || !paraderoSel}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
                {enviando ? 'Guardando…' : aprobando.aprobado ? '✓ Guardar cambios' : '✓ Aprobar y asignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
