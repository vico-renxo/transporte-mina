'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getConductores, crearConductor, actualizarConductor } from '@/lib/api';
import { badgeEstado, cn } from '@/lib/utils';
import { cached, bust, hasCache } from '@/lib/cache';

interface Conductor {
  id: string;
  licencia: string;
  telefono: string;
  estado: 'ACTIVO' | 'INACTIVO';
  usuario: { nombre: string; email: string };
  _count?: { ejecuciones: number };
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

function FormConductor({ cond, onSave, onClose }: { cond?: Conductor; onSave: () => void; onClose: () => void }) {
  const [nombre,   setNombre]   = useState(cond?.usuario?.nombre || '');
  const [email,    setEmail]    = useState(cond?.usuario?.email  || '');
  const [password, setPassword] = useState('');
  const [licencia, setLicencia] = useState(cond?.licencia || '');
  const [telefono, setTelefono] = useState(cond?.telefono || '');
  const [estado,   setEstado]   = useState(cond?.estado || 'ACTIVO');
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    if (!nombre || !email || !licencia) { toast.error('Completa los campos obligatorios'); return; }
    if (!cond && !password) { toast.error('La contrasena es obligatoria para nuevos conductores'); return; }
    setSaving(true);
    try {
      const payload = { nombre, email, password: password || undefined, licencia, telefono, estado };
      if (cond) await actualizarConductor(cond.id, payload);
      else       await crearConductor(payload);
      toast.success(cond ? 'Conductor actualizado' : 'Conductor creado');
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const fields = [
    ['Nombre completo *', nombre, setNombre, 'text'],
    ['Email *', email, setEmail, 'email'],
    ['Contrasena' + (cond ? ' (dejar vacio = sin cambio)' : ' *'), password, setPassword, 'password'],
    ['N Licencia *', licencia, setLicencia, 'text'],
    ['Telefono', telefono, setTelefono, 'tel'],
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-white">{cond ? 'Editar conductor' : 'Nuevo conductor'}</h2>
      {fields.map(([label, val, setter, type]: any) => (
        <div key={label}>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</label>
          <input type={type} value={val} onChange={e => setter(e.target.value)} placeholder={type === 'password' ? '**' : ''}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500"
          />
        </div>
      ))}
      {cond && (
        <div>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value as any)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-green-500">
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </select>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
          {saving ? 'Guardando...' : (cond ? 'Actualizar' : 'Crear conductor')}
        </button>
      </div>
    </div>
  );
}

export default function ConductoresPage() {
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loading,  setLoading]  = useState(!hasCache('conductores'));
  const [modal,    setModal]    = useState(false);
  const [selCond,  setSelCond]  = useState<Conductor | null>(null);
  const [filtro,   setFiltro]   = useState('');

  const cargar = async () => {
    try {
      const d = await cached('conductores', () => getConductores());
      setConductores(d.conductores || d);
    } catch { toast.error('Error al cargar conductores'); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const filtrados = conductores.filter(c =>
    c.usuario?.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    c.licencia?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Conductores</h1>
          <p className="text-slate-500 text-sm mt-0.5">{conductores.length} registrados</p>
        </div>
        <button onClick={() => { setSelCond(null); setModal(true); }}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors">
          + Nuevo conductor
        </button>
      </div>

      <input value={filtro} onChange={e => setFiltro(e.target.value)}
        placeholder="Buscar por nombre o licencia..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-green-500 mb-5"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-slate-500 col-span-3 text-center py-12">Cargando...</p>
        ) : filtrados.map(c => {
          const cfg = badgeEstado(c.estado);
          return (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-lg">
                  {c.usuario?.nombre?.[0] ?? '?'}
                </div>
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</span>
              </div>
              <p className="text-white font-bold">{c.usuario?.nombre}</p>
              <p className="text-slate-500 text-sm">{c.usuario?.email}</p>
              <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-slate-500">Licencia</p><p className="text-slate-300 font-semibold">{c.licencia}</p></div>
                <div><p className="text-slate-500">Telefono</p><p className="text-slate-300 font-semibold">{c.telefono || '-'}</p></div>
                <div><p className="text-slate-500">Rutas realizadas</p><p className="text-slate-300 font-semibold">{c._count?.ejecuciones ?? 0}</p></div>
              </div>
              <button onClick={() => { setSelCond(c); setModal(true); }}
                className="mt-4 w-full py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors">
                Editar
              </button>
            </div>
          );
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)}>
        <FormConductor cond={selCond ?? undefined} onSave={() => { bust('conductores'); setModal(false); cargar(); }} onClose={() => setModal(false)} />
      </Modal>
    </div>
  );
}
