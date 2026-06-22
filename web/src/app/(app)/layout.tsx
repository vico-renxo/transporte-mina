'use client';
import { useEffect, useState } from 'react';
import { useRouter }        from 'next/navigation';
import Sidebar              from '@/components/Sidebar';
import AlertPanel           from '@/components/AlertPanel';
import { useAuthStore, useAlertasStore } from '@/lib/store';
import { getSocket }        from '@/lib/socket';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const { usuario, token } = useAuthStore();
  const { push } = useAlertasStore();
  // Esperar a que Zustand hidrate desde localStorage antes de verificar auth
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Usar onFinishHydration si aún no hidrató, o marcar inmediatamente si ya lo hizo
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!usuario || !token) { router.replace('/login'); return; }

    const socket = getSocket();
    socket.emit('supervisor:join');

    socket.on('alerta:gps-perdido',   (d: any) => push({ tipo: 'gps_perdido', mensaje: d.mensaje || `GPS sin señal: ${d.conductorNombre || ''}`, rutaId: d.rutaEjecucionId }));
    socket.on('alerta:emergencia',    (d: any) => push({ tipo: 'emergencia',  mensaje: d.mensaje, rutaId: d.rutaEjecucionId }));
    socket.on('alerta:ausente',       (d: any) => push({ tipo: 'ausente',     mensaje: `Pasajero no abordó en ${d.paraderoNombre || 'paradero'}` }));

    return () => {
      socket.off('alerta:gps-perdido');
      socket.off('alerta:emergencia');
      socket.off('alerta:ausente');
    };
  }, [hydrated, usuario, token, router, push]);

  // Mientras hidrata no renderizar nada (evita flash de login)
  if (!hydrated) return null;
  if (!usuario || !token) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-[var(--sidebar-w)] flex-1 overflow-auto">
        <div className="page-fade">{children}</div>
      </main>
      <AlertPanel />
    </div>
  );
}
