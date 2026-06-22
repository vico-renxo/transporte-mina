'use client';
import { useAlertasStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const TIPO_CONFIG = {
  gps_perdido: { bg: 'bg-orange-500/20 border-orange-500/30', icon: '📡', label: 'GPS perdido' },
  emergencia:  { bg: 'bg-red-500/20 border-red-500/30',    icon: '🚨', label: 'Emergencia' },
  ausente:     { bg: 'bg-yellow-500/20 border-yellow-500/30', icon: '⚠️', label: 'Pasajero ausente' },
  info:        { bg: 'bg-blue-500/20 border-blue-500/30',  icon: 'ℹ️',  label: 'Info' },
};

export default function AlertPanel() {
  const { alertas, dismiss } = useAlertasStore();
  if (alertas.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {alertas.slice(0, 5).map(a => {
        const cfg = TIPO_CONFIG[a.tipo];
        return (
          <div key={a.id} className={cn('flex gap-3 items-start p-3 rounded-lg border text-sm', cfg.bg)}>
            <span className="text-base shrink-0">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200 text-xs uppercase tracking-wider">{cfg.label}</p>
              <p className="text-slate-300 mt-0.5 text-xs">{a.mensaje}</p>
            </div>
            <button onClick={() => dismiss(a.id)} className="text-slate-500 hover:text-slate-300 shrink-0 text-xs">✕</button>
          </div>
        );
      })}
    </div>
  );
}
