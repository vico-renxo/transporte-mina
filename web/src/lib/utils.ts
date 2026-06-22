import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatFecha(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('es-PE', opts ?? {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function puntualidadColor(pct: number) {
  if (pct >= 90) return 'text-green-400';
  if (pct >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

export function badgeEstado(estado: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    ACTIVA:          { bg: 'bg-green-500/20',  text: 'text-green-400',  label: 'Activa' },
    COMPLETADA:      { bg: 'bg-slate-500/20',  text: 'text-slate-400',  label: 'Completada' },
    CANCELADA:       { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'Cancelada' },
    NORMAL:          { bg: 'bg-green-500/20',  text: 'text-green-400',  label: 'Normal' },
    POR_MIS_MEDIOS:  { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Por mis medios' },
    AUSENTE:         { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'Ausente' },
    PENDIENTE:       { bg: 'bg-blue-500/20',   text: 'text-blue-400',   label: 'Pendiente' },
    ACTIVO:          { bg: 'bg-green-500/20',  text: 'text-green-400',  label: 'Activo' },
    INACTIVO:        { bg: 'bg-slate-500/20',  text: 'text-slate-400',  label: 'Inactivo' },
    MANTENIMIENTO:   { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Mantenimiento' },
  };
  return map[estado] ?? { bg: 'bg-slate-700', text: 'text-slate-300', label: estado };
}
