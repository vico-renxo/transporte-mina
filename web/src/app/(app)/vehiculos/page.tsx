'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getVehiculos, crearVehiculo, actualizarVehiculo } from '@/lib/api';
import { badgeEstado, cn } from '@/lib/utils';

interface Vehiculo {
  id: string; placa: string; marca: string; modelo: string; anio: number;
  capacidad: number; estado: 'ACTIVO' | 'INACTIVO' | 'MANTENIMIENTO';
}

function Modal({ open, onClose, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormVehiculo({ v, onSave, onClose }: { v?: Vehiculo; onSave: () => void; onClose: () => void }) {
  const [placa,     setPlaca]     = useState(v?.placa     || '');
  const [marca,     setMarca]     = useState(v?.marca     || '');
  const [modelo,    setModelo]    = useState(v?.modelo    || '');
  const [anio,      setAnio]      = useState(v?.anio      || new Date().getFullYear());
  const [capacidad, setCapacidad] = useState(v?.capacidad || 20);
  const [estado,    setEstado]    = useState<string>(v?.estado || 'ACTIVO');
  const [saving,    setSaving]    = useState(false);

  const handleSave = async () => {
    if (!placa || !marca || !modelo) { toast.error('Completa los campos obligatorios'); return; }
    setSaving(true);
    try {
      const payload = { placa: placa.toUpperCase(), marca, modelo, anio, capacidad, estado };
      if (v) await actualizarVehiculo(v.id, payload);
      else   await crearVehiculo(payload);
      toast.success(v ? 'Vehículo actualizado' : 'Vehículo registrado');
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-white">{v ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
      <div className="grid grid-cols-2 gap-4">
        {[
          ['Placa *', placa, setPlaca, 'text', 'uppercase'],
          ['Marca *', marca, setMarca, 'text', ''],
          ['Modelo *', modelo, setModelo, 'text', ''],
          ['Año', anio, setAnio, 'number', ''],
          ['Capacidad (pasajeros)', capacidad, setCapacidad, 'number', ''],
        ].map(([label, val, setter, type, cls]: any) => (
          <div key={label}>
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</label>
            <input type={type} value={val} onChange={e => setter(type === 'number' ? +e.target.value : e.target.value)}
              className={cn('mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500', cls)}
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500">
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="MANTENIMIENTO">Mantenimiento</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
          {saving ? 'Guardando...' : (v ? 'Actualizar' : 'Registrar')}
        </button>
      </div>
    </div>
  );
}

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal,   setModal]       = useState(false);
  const [selV,    setSelV]        = useState<Vehiculo | null>(null);
  const [filtro,  setFiltro]      = useState('');

  const cargar = async () => {
    try { const d = await getVehiculos(); setVehiculos(d.vehiculos || d); }
    catch { toast.error('Error al cargar vehículos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const filtrados = vehiculos.filter(v =>
    v.placa.toLowerCase().includes(filtro.toLowerCase()) ||
    v.marca.toLowerCase().includes(filtro.toLowerCase()) ||
    v.modelo.toLowerCase().includes(filtro.toLowerCase())
  );

  const ESTADO_ICON: Record<string, string> = { ACTIVO: '🟢', INACTIVO: '🔴', MANTENIMIENTO: '🟡' };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Vehículos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{vehiculos.length} registrados</p>
        </div>
        <button onClick={() => { setSelV(null); setModal(true); }}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          + Nuevo vehículo
        </button>
      </div>
      <input value={filtro} onChange={e => setFiltro(e.target.value)}
        placeholder="🔍 Buscar por placa, marca o modelo..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-green-500 mb-5"
      />
      <div className="grid grid-cols-3 gap-4 mb-6">
        {['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'].map(st => {
          const n = vehiculos.filter(v => v.estado === st).length;
          const cfg = badgeEstado(st);
          return (
            <div key={st} className={cn('rounded-xl p-4 border', cfg.bg, 'border-transparent')}>
              <p className={cn('text-2xl font-black', cfg.text)}>{n}</p>
              <p className="text-slate-400 text-xs mt-0.5">{cfg.label}</p>
            </div>
          );
        })}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Vehículo</th>
              <th className="text-left px-5 py-3">Placa</th>
              <th className="text-left px-5 py-3">Año</th>
              <th className="text-left px-5 py-3">Capacidad</th>
              <th className="text-left px-5 py-3">Estado</th>
              <th className="text-right px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? <tr><td colSpan={6} className="py-12 text-center text-slate-600">Cargando...</td></tr>
            : filtrados.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-600">Sin resultados</td></tr>
            : filtrados.map(v => {
              const cfg = badgeEstado(v.estado);
              return (
                <tr key={v.id} className="hover:bg-slate-800/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{ESTADO_ICON[v.estado] || '🚌'}</span>
                      <p className="text-white font-semibold text-sm">{v.marca} {v.modelo}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-white font-mono font-bold">{v.placa}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-sm">{v.anio}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-sm">{v.capacidad} pasajeros</td>
                  <td className="px-5 py-3.5">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => { setSelV(v); setModal(true); }}
                      className="text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={() => setModal(false)}>
        <FormVehiculo v={selV ?? undefined} onSave={() => { setModal(false); cargar(); }} onClose={() => setModal(false)} />
      </Modal>
    </div>
  );
}
