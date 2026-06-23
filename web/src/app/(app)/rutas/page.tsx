'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getRutas, crearRuta, actualizarRuta, getConductores, getVehiculos, iniciarRutaApi, finalizarRutaApi } from '@/lib/api';
import { cached, bust, hasCache } from '@/lib/cache';
import { badgeEstado, formatHora, cn } from '@/lib/utils';

interface Paradero { nombre: string; lat: number; lng: number; orden: number; }
interface Ruta {
  id: string; nombre: string; origen: string; destino: string; horaInicio: string;
  dias: string[]; estado: 'ACTIVA' | 'INACTIVA';
  _count?: { pasajeros: number; paraderos: number };
  ejecucionActiva?: { id: string; estado: string } | null;
}
interface NominatimResult { place_id: number; display_name: string; lat: string; lon: string; }

const DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

function BuscadorDireccion({
  label, value, onChange
}: { label: string; value: string; onChange: (val: string) => void }) {
  const [query,       setQuery]       = useState(value);
  const [resultados,  setResultados]  = useState<NominatimResult[]>([]);
  const [buscando,    setBuscando]    = useState(false);
  const [abierto,     setAbierto]     = useState(false);
  const timerRef = useRef<any>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buscar = useCallback((q: string) => {
    if (q.length < 3) { setResultados([]); setAbierto(false); return; }
    setBuscando(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=pe&limit=5&addressdetails=0`)
      .then(r => r.json())
      .then((data: NominatimResult[]) => {
        setResultados(data);
        setAbierto(data.length > 0);
      })
      .catch(() => {})
      .finally(() => setBuscando(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(val), 400);
  };

  const seleccionar = (r: NominatimResult) => {
    const nombre = r.display_name.split(',').slice(0, 2).join(',').trim();
    setQuery(nombre);
    onChange(nombre);
    setResultados([]);
    setAbierto(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1">{label}</label>
      <div className="relative">
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          placeholder="Escribe una dirección..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pr-8 text-slate-100 text-sm focus:outline-none focus:border-green-500"
        />
        {buscando && (
          <span className="absolute right-2.5 top-3 text-slate-500 text-xs animate-spin">⟳</span>
        )}
      </div>
      {abierto && resultados.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {resultados.map(r => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => seleccionar(r)}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
              >
                <span className="text-slate-400 mr-1.5">📍</span>
                {r.display_name.split(',').slice(0, 3).join(',')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormRuta({ ruta, onSave, onClose }: { ruta?: Ruta; onSave: () => void; onClose: () => void }) {
  const [nombre,     setNombre]     = useState(ruta?.nombre     || '');
  const [origen,     setOrigen]     = useState(ruta?.origen     || '');
  const [destino,    setDestino]    = useState(ruta?.destino    || '');
  const [horaInicio, setHoraInicio] = useState(ruta?.horaInicio || '05:30');
  const [dias,       setDias]       = useState<string[]>(ruta?.dias || ['LUN', 'MAR', 'MIE', 'JUE', 'VIE']);
  const [paraderos,  setParaderos]  = useState<Paradero[]>([
    { nombre: '', lat: 0, lng: 0, orden: 1 }
  ]);
  const [saving, setSaving] = useState(false);

  const toggleDia = (d: string) =>
    setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const addParadero = () =>
    setParaderos(prev => [...prev, { nombre: '', lat: 0, lng: 0, orden: prev.length + 1 }]);

  const handleSave = async () => {
    if (!nombre || !origen || !destino) { toast.error('Completa los campos obligatorios'); return; }
    setSaving(true);
    try {
      const payload = { nombre, origen, destino, horaInicio, dias, paraderos: paraderos.filter(p => p.nombre) };
      if (ruta) await actualizarRuta(ruta.id, payload);
      else       await crearRuta(payload);
      toast.success(ruta ? 'Ruta actualizada' : 'Ruta creada');
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-black text-white">{ruta ? 'Editar ruta' : 'Nueva ruta'}</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Nombre de ruta</label>
          <input className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500"
            value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>
        <BuscadorDireccion label="Origen" value={origen} onChange={setOrigen} />
        <BuscadorDireccion label="Destino" value={destino} onChange={setDestino} />
        <div>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Hora de inicio</label>
          <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500" />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-2">Días de servicio</label>
        <div className="flex gap-2 flex-wrap">
          {DIAS.map(d => (
            <button key={d} onClick={() => toggleDia(d)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                dias.includes(d) ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')}
            >{d}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Paraderos</label>
          <button onClick={addParadero} className="text-xs text-green-400 hover:text-green-300">+ Agregar</button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {paraderos.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-slate-600 text-xs w-5 text-right">{i + 1}.</span>
              <input placeholder="Nombre del paradero"
                value={p.nombre} onChange={e => {
                  const n = [...paraderos]; n[i] = { ...n[i], nombre: e.target.value }; setParaderos(n);
                }}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-green-500"
              />
              {i > 0 && <button onClick={() => setParaderos(prev => prev.filter((_, j) => j !== i))}
                className="text-slate-600 hover:text-red-400 text-sm">✕</button>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
          {saving ? 'Guardando...' : (ruta ? 'Actualizar' : 'Crear ruta')}
        </button>
      </div>
    </div>
  );
}

function ModalIniciar({ ruta, onClose, onIniciar }: { ruta: Ruta; onClose: () => void; onIniciar: () => void }) {
  const [conductores, setConductores] = useState<any[]>([]);
  const [vehiculos,   setVehiculos]   = useState<any[]>([]);
  const [conductorId, setConductorId] = useState('');
  const [vehiculoId,  setVehiculoId]  = useState('');
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    Promise.all([
      cached('conductores', getConductores),
      cached('vehiculos', getVehiculos),
    ]).then(([c, v]) => {
      setConductores(c.conductores || c);
      setVehiculos(v.vehiculos || v);
    });
  }, []);

  const handleIniciar = async () => {
    if (!conductorId || !vehiculoId) { toast.error('Selecciona conductor y vehículo'); return; }
    setLoading(true);
    try {
      await iniciarRutaApi(ruta.id, conductorId, vehiculoId);
      toast.success(`Ruta "${ruta.nombre}" iniciada`);
      onIniciar();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al iniciar');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-black text-white">Iniciar ruta</h2>
      <p className="text-slate-400 text-sm">{ruta.nombre} · {ruta.horaInicio}</p>

      <div>
        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Conductor</label>
        <select value={conductorId} onChange={e => setConductorId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500">
          <option value="">Seleccionar conductor</option>
          {conductores.map((c: any) => <option key={c.id} value={c.id}>{c.usuario?.nombre || c.nombre} — Lic. {c.licencia}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Vehículo</label>
        <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500">
          <option value="">Seleccionar vehículo</option>
          {vehiculos.map((v: any) => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo} ({v.capacidad} pas.)</option>)}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">Cancelar</button>
        <button onClick={handleIniciar} disabled={loading}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
          {loading ? 'Iniciando...' : '▶ Iniciar ruta'}
        </button>
      </div>
    </div>
  );
}

export default function RutasPage() {
  const [rutas,      setRutas]      = useState<Ruta[]>([]);
  const [loading,    setLoading]    = useState(!hasCache('rutas'));
  const [modalForm,  setModalForm]  = useState(false);
  const [modalIni,   setModalIni]   = useState(false);
  const [selRuta,    setSelRuta]    = useState<Ruta | null>(null);
  const [filtro,     setFiltro]     = useState('');

  const cargar = async () => {
    try { const data = await cached('rutas', getRutas); setRutas(data.rutas || data); }
    catch { toast.error('Error al cargar rutas'); }
    finally { setLoading(false); }
  };

  const recargar = () => { bust('rutas'); cargar(); };

  useEffect(() => { cargar(); }, []);

  const filtradas = rutas.filter(r =>
    r.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    r.origen.toLowerCase().includes(filtro.toLowerCase()) ||
    r.destino.toLowerCase().includes(filtro.toLowerCase())
  );

  const handleFinalizar = async (ruta: Ruta) => {
    if (!ruta.ejecucionActiva) return;
    if (!confirm(`¿Finalizar la ruta "${ruta.nombre}"?`)) return;
    try {
      await finalizarRutaApi(ruta.ejecucionActiva.id);
      toast.success('Ruta finalizada');
      bust('rutas');
      cargar();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error'); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Rutas</h1>
          <p className="text-slate-500 text-sm mt-0.5">{rutas.length} rutas configuradas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={recargar} title="Actualizar" className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm px-3 py-2.5 rounded-lg transition-colors">↻</button>
          <button onClick={() => { setSelRuta(null); setModalForm(true); }}
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2">
            + Nueva ruta
          </button>
        </div>
      </div>

      <input value={filtro} onChange={e => setFiltro(e.target.value)}
        placeholder="🔍 Buscar ruta, origen o destino..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-green-500 mb-5"
      />

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Ruta</th>
              <th className="text-left px-5 py-3">Trayecto</th>
              <th className="text-left px-5 py-3">Horario</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-left px-5 py-3">Pasajeros</th>
              <th className="text-right px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-600">Cargando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-600">Sin resultados</td></tr>
            ) : filtradas.map(r => {
              const cfg = badgeEstado(r.ejecucionActiva ? 'ACTIVA' : r.estado);
              return (
                <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-white font-semibold text-sm">{r.nombre}</p>
                    <p className="text-slate-500 text-xs">{r.dias?.join(' · ') || '—'}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-slate-300 text-sm">{r.origen}</p>
                    <p className="text-slate-500 text-xs">→ {r.destino}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 text-sm">{r.horaInicio}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
                      {r.ejecucionActiva ? '● En curso' : cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-sm">{r._count?.pasajeros ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.ejecucionActiva ? (
                        <button onClick={() => handleFinalizar(r)}
                          className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                          ■ Finalizar
                        </button>
                      ) : (
                        <button onClick={() => { setSelRuta(r); setModalIni(true); }}
                          className="text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                          ▶ Iniciar
                        </button>
                      )}
                      <button onClick={() => { setSelRuta(r); setModalForm(true); }}
                        className="text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modalForm} onClose={() => setModalForm(false)}>
        <FormRuta ruta={selRuta ?? undefined} onSave={() => { bust('rutas'); setModalForm(false); cargar(); }} onClose={() => setModalForm(false)} />
      </Modal>
      <Modal open={modalIni && !!selRuta} onClose={() => setModalIni(false)}>
        {selRuta && <ModalIniciar ruta={selRuta} onClose={() => setModalIni(false)} onIniciar={() => { bust('rutas'); setModalIni(false); cargar(); }} />}
      </Modal>
    </div>
  );
}
