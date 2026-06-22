'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { getRutasActivas, getReporteDiario } from '@/lib/api';
import { formatHora, badgeEstado, cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface KPI { rutas_activas: number; conductores_en_ruta: number; pasajeros_en_ruta: number; puntualidad_promedio: number; }
interface RutaActiva {
  id: string; rutaNombre: string; conductorNombre: string; vehiculoPlaca: string;
  paraderoActual: number; totalParaderos: number; pasajerosAbordo: number;
  ultimaActualizacion: string; estado: string;
}

function KPICard({ valor, label, color, icon }: { valor: string | number; label: string; color: string; icon: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">{label}</p>
          <p className={cn('text-3xl font-black mt-1', color)}>{valor}</p>
        </div>
        <span className="text-3xl opacity-60">{icon}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [kpis,   setKpis]   = useState<KPI>({ rutas_activas: 0, conductores_en_ruta: 0, pasajeros_en_ruta: 0, puntualidad_promedio: 0 });
  const [activas, setActivas]= useState<RutaActiva[]>([]);
  const [reporte, setReporte]= useState<any>(null);
  const [loading, setLoading]= useState(true);

  const cargar = useCallback(async () => {
    try {
      const [acResult, repResult] = await Promise.allSettled([getRutasActivas(), getReporteDiario()]);
      const ac  = acResult.status  === 'fulfilled' ? acResult.value  : null;
      const rep = repResult.status === 'fulfilled' ? repResult.value : null;
      const ejecuciones: RutaActiva[] = ac?.ejecuciones || [];
      setActivas(ejecuciones);
      if (rep) setReporte(rep);
      setKpis({
        rutas_activas:        ejecuciones.length,
        conductores_en_ruta:  ejecuciones.length,
        pasajeros_en_ruta:    ejecuciones.reduce((s, e) => s + (e.pasajerosAbordo || 0), 0),
        puntualidad_promedio: rep?.resumen?.puntualidadPromedio ?? 0,
      });
    } catch { /* demo */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    cargar();
    const socket = getSocket();
    socket.on('supervisor:gps-update', () => cargar());
    socket.on('ruta:finalizada', () => cargar());
    return () => { socket.off('supervisor:gps-update'); socket.off('ruta:finalizada'); };
  }, [cargar]);

  const chartData = reporte?.detalle?.map((e: any) => ({
    name: e.rutaNombre?.slice(0, 12) || 'Ruta',
    puntualidad: e.puntualidad || 0,
    recogidos: e.recogidos || 0,
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link href="/mapa"
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          🗺️ Ver mapa en vivo
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard valor={kpis.rutas_activas}        label="Rutas activas"        color="text-green-400"  icon="🛣️" />
        <KPICard valor={kpis.conductores_en_ruta}   label="Conductores en ruta"  color="text-blue-400"   icon="👨‍✈️" />
        <KPICard valor={kpis.pasajeros_en_ruta}     label="Pasajeros abordo"     color="text-purple-400" icon="👥" />
        <KPICard valor={`${kpis.puntualidad_promedio.toFixed(0)}%`} label="Puntualidad hoy" color={kpis.puntualidad_promedio >= 90 ? 'text-green-400' : kpis.puntualidad_promedio >= 70 ? 'text-yellow-400' : 'text-red-400'} icon="⏱️" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <h2 className="font-bold text-white">Rutas en curso</h2>
            <Link href="/rutas" className="text-green-400 text-xs hover:underline">Ver todas →</Link>
          </div>
          <div className="divide-y divide-slate-800">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Cargando...</div>
            ) : activas.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Sin rutas activas en este momento</div>
            ) : activas.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center text-green-400 text-xs font-bold shrink-0">🚌</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{r.rutaNombre}</p>
                  <p className="text-slate-500 text-xs">{r.conductorNombre} · {r.vehiculoPlaca}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-xs font-semibold">{r.paraderoActual}/{r.totalParaderos} paradas</p>
                  <p className="text-slate-500 text-[10px]">{r.pasajerosAbordo} abordo · {formatHora(r.ultimaActualizacion)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="font-bold text-white">Puntualidad por ruta — hoy</h2>
          </div>
          <div className="p-4 h-64">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">Sin datos para hoy</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 700 }}
                    itemStyle={{ color: '#94a3b8' }}
                    formatter={(v: any) => [`${v}%`, 'Puntualidad']}
                  />
                  <Bar dataKey="puntualidad" radius={[4, 4, 0, 0]}>
                    {chartData.map((e: any, i: number) => (
                      <Cell key={i} fill={e.puntualidad >= 90 ? '#22c55e' : e.puntualidad >= 70 ? '#eab308' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
