'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie,
} from 'recharts';
import { getReporteDiario, getReporteSemanal, descargarExcel } from '@/lib/api';
import { formatFecha, puntualidadColor, cn } from '@/lib/utils';

type Tab = 'diario' | 'semanal';
const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle:   { color: '#f1f5f9', fontWeight: 700 },
  itemStyle:    { color: '#94a3b8' },
};

function StatCard({ label, valor, sub, color }: { label: string; valor: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">{label}</p>
      <p className={cn('text-3xl font-black mt-1', color || 'text-white')}>{valor}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportesPage() {
  const [tab,      setTab]      = useState<Tab>('diario');
  const [fecha,    setFecha]    = useState(new Date().toISOString().slice(0, 10));
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [exporting,setExporting]= useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = tab === 'diario' ? await getReporteDiario(fecha) : await getReporteSemanal(fecha);
      setData(res);
    } catch { toast.error('Error al cargar reporte'); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, [tab, fecha]);

  const handleExcel = async () => {
    setExporting(true);
    try { await descargarExcel(fecha); toast.success('Excel descargado'); }
    catch { toast.error('Error al exportar'); }
    finally { setExporting(false); }
  };

  const barData = data?.detalle?.map((e: any) => ({
    name: e.rutaNombre?.slice(0, 14) || 'Ruta',
    recogidos: e.recogidos || 0, ausentes: e.ausentes || 0, puntualidad: e.puntualidad || 0,
  })) || [];

  const totales = data?.resumen;
  const pieData = totales ? [
    { name: 'Recogidos',  value: totales.totalRecogidos || 0, fill: '#22c55e' },
    { name: 'Por medios', value: totales.totalPorMedios || 0, fill: '#eab308' },
    { name: 'Ausentes',   value: totales.totalAusentes  || 0, fill: '#ef4444' },
  ] : [];

  const lineData = data?.dias?.map((d: any) => ({
    name: new Date(d.fecha).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' }),
    puntualidad: d.puntualidad || 0, rutas: d.rutas || 0, pasajeros: d.pasajeros || 0,
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Reportes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Análisis de operaciones</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            {(['diario', 'semanal'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-4 py-2 text-sm font-semibold transition-colors',
                  tab === t ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-slate-200')}>
                {t === 'diario' ? '📅 Diario' : '📆 Semanal'}
              </button>
            ))}
          </div>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-green-500"
          />
          <button onClick={handleExcel} disabled={exporting}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            {exporting ? '⏳' : '📥'} Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">Cargando reporte...</div>
      ) : !data ? (
        <div className="flex items-center justify-center py-20 text-slate-600">Sin datos para esta fecha</div>
      ) : tab === 'diario' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Rutas ejecutadas"    valor={totales?.totalEjecuciones || 0} color="text-blue-400" />
            <StatCard label="Pasajeros recogidos" valor={totales?.totalRecogidos   || 0} color="text-green-400" />
            <StatCard label="Ausencias"           valor={totales?.totalAusentes    || 0} color="text-red-400" />
            <StatCard label="Puntualidad promedio" valor={`${(totales?.puntualidadPromedio || 0).toFixed(1)}%`}
              color={puntualidadColor(totales?.puntualidadPromedio || 0)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-4">Pasajeros por ruta</h3>
              <div className="h-64">
                {barData.length === 0 ? <div className="flex items-center justify-center h-full text-slate-600 text-sm">Sin datos</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} /><Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                      <Bar dataKey="recogidos" name="Recogidos" fill="#22c55e" radius={[4,4,0,0]} />
                      <Bar dataKey="ausentes"  name="Ausentes"  fill="#ef4444" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="font-bold text-white mb-4">Distribución de estados</h3>
              <div className="h-48">
                {pieData.every(d => d.value === 0) ? <div className="flex items-center justify-center h-full text-slate-600 text-sm">Sin datos</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-1.5 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                      <span className="text-slate-400">{d.name}</span>
                    </span>
                    <span className="text-slate-200 font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Rutas totales"      valor={data.resumen?.totalEjecuciones || 0} color="text-blue-400" />
            <StatCard label="Pasajeros movidos"  valor={data.resumen?.totalPasajeros   || 0} color="text-green-400" />
            <StatCard label="Ausencias"          valor={data.resumen?.totalAusentes    || 0} color="text-red-400" />
            <StatCard label="Puntualidad semana" valor={`${(data.resumen?.puntualidadPromedio || 0).toFixed(1)}%`}
              color={puntualidadColor(data.resumen?.puntualidadPromedio || 0)} />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-bold text-white mb-4">Tendencia semanal</h3>
            <div className="h-72">
              {lineData.length === 0 ? <div className="flex items-center justify-center h-full text-slate-600 text-sm">Sin datos</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 4, right: 16, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} /><Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                    <Line type="monotone" dataKey="puntualidad" name="Puntualidad %" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
                    <Line type="monotone" dataKey="pasajeros"   name="Pasajeros"    stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
