'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function RootPage() {
  const router   = useRouter();
  const { usuario } = useAuthStore();
  useEffect(() => {
    router.replace(usuario ? '/dashboard' : '/login');
  }, [usuario, router]);
  return null;
}
