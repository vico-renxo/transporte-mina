'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard',    icon: '📊', label: 'Dashboard' },
  { href: '/mapa',         icon: '🗺️',  label: 'Mapa en vivo' },
  { href: '/rutas',        icon: '🛣️',  label: 'Rutas' },
  { href: '/conductores',  icon: '👨‍✈️', label: 'Conductores' },
  { href: '/vehiculos',    icon: '🚌',  label: 'Vehículos' },
  { href: '/pasajeros',    icon: '👥',  label: 'Pasajeros' },
  { href: '/reportes',     icon: '📈',  label: 'Reportes' },
];

export default function Sidebar() {
  const pathname        = usePathname();
  const router          = useRouter();
  const { usuario, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[var(--sidebar-w)] bg-slate-900 border-r border-slate-800 flex flex-col z-20">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚌</span>
          <div>
            <p className="font-black text-white leading-none text-sm">TransporteMina</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">Panel Supervisor</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-green-600/20 text-green-400 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}
            >
              <span className="text-lg w-6 text-center">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-600/30 flex items-center justify-center text-green-400 font-bold text-sm">
            {usuario?.nombre?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-xs font-semibold truncate">{usuario?.nombre}</p>
            <p className="text-slate-500 text-[10px] truncate">{usuario?.rol}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full text-xs text-slate-500 hover:text-red-400 transition-colors text-left px-1"
        >
          ↗ Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
