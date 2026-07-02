'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

// viczul.com/transporte → punto de entrada ÚNICO.
// Si ya hay sesión (de cualquier rol) va directo a su panel; si no, al login unificado.
export default function RootPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  useEffect(() => {
    if (usuario) { router.replace('/dashboard'); return; }
    if (localStorage.getItem('tm_conductor_token')) { router.replace('/conductor'); return; }
    if (localStorage.getItem('tm_pasajero_token'))  { router.replace('/pasajero');  return; }
    router.replace('/login');
  }, [usuario, router]);
  return null;
}
