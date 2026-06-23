'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getPasajeros, getPendientes, aprobarPasajero } from '@/lib/api';
import { badgeEstado, formatFecha, cn } from '@/lib/utils';
import { cached, bust, hasCache } from '@/lib/cache';

interface Pasajero {
  id: string;
  usuario: { nombre: string; email: string };
  paradero: { nombre: string };
  ruta: { nombre: string };
  aprobado: boolean;
  activo: boolean;
  fechaRegistro: string;
  estadoHoy?: string;
}

export default function PasajerosPage() {
  const [pasajeros,  setPasajeros]  = useState<Pasajero[]>([]);
  const [pendientes, setPendientes] = useState<Pasajero[]>([]);
  const [loading,    setLoading]    = useState(!hasCache('pasajeros'));
  const [tab,        setTab]        = useState<'todos' | 'pendientes'>('todos');
  const [filtro,     setFiltro]     = useState('');

  const cargar = async () => {
    try {
      const [pas, pen] = await Promise.all([
        cached('pasajeros', () => getPasajeros()),
        cached('pendientes', () => getPendientes()),
      ]);
      setPasajeros(pas.pasajeros || pas);
      setPendientes(pen.pendientes || pen);
    } catch { toast.error('Error al cargar'); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  const handleAprobar = async (id: string, nombre: string) => {
    try {
      await aprobarPasajero(id);
      toast.success(`${nombre} aprobado`);
      bust('pasajeros', 'pendientes');
      cargar();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error'); }
  };

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
          <p className="text-slate-500 text-sm mt-0.5">{pasajeros.length} registrados · {pendientes.length} pendientes de aprobacion</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {('todos', 'pendientes'] as const).map(t => (
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
              <th className="text-left px-5 py-3">Estado hoy</th>
              <th className="text-left px-5 py-3">Registro</th>
              <th className="text-right px-5 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-600">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-600">Sin resultados</td></tr>
            ) : filtrados.map(p => {
              const cfg = badgeEstado(p.estadoHoy || (p.aprobado ? 'ACTIVO' : 'PENDIENTE'));
              return (
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
                  <td className="px-5 py-3.5 text-slate-300 text-sm">{p.ruta?.nombre || '-'}</td>
                  <td className="px-5 py-3.5 text-slate-300 text-sm">{p.paradero?.nombre || '-'}</td>
                  <td className="px-5 py-3.5">
                    {p.estadoHoy ? (
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', badgeEstado(p.estadoHoy).bg, badgeEstado(p.estadoHoy).text)}>
                        {badgeEstado(p.estadoHoy).label}
                      </span>
                    ) : <span className="text-slate-600 text-xs">-</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{formatFecha(p.fechaRegistro)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {!p.aprobado ? (
                      <button onClick={() => handleAprobar(p.id, p.usuario?.nombre)}
                        className="text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                        Aprobar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-600">Aprobado</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
