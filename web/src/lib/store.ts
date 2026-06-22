import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'SUPERVISOR' | 'GERENCIA';
}

interface AuthState {
  usuario: Usuario | null;
  token:   string | null;
  setAuth: (usuario: Usuario, token: string) => void;
  logout:  () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      token:   null,
      setAuth: (usuario, token) => {
        localStorage.setItem('tm_token', token);
        set({ usuario, token });
      },
      logout: () => {
        localStorage.removeItem('tm_token');
        localStorage.removeItem('tm_user');
        set({ usuario: null, token: null });
      },
    }),
    { name: 'tm-auth', partialize: (s) => ({ usuario: s.usuario, token: s.token }) }
  )
);

// Store para notificaciones en tiempo real
interface Alerta {
  id: string;
  tipo: 'gps_perdido' | 'emergencia' | 'ausente' | 'info';
  mensaje: string;
  rutaId?: string;
  ts: number;
}

interface AlertasState {
  alertas: Alerta[];
  push:    (a: Omit<Alerta, 'id' | 'ts'>) => void;
  dismiss: (id: string) => void;
  clear:   () => void;
}

export const useAlertasStore = create<AlertasState>((set) => ({
  alertas: [],
  push: (a) => set(s => ({
    alertas: [{ ...a, id: crypto.randomUUID(), ts: Date.now() }, ...s.alertas].slice(0, 20)
  })),
  dismiss: (id) => set(s => ({ alertas: s.alertas.filter(a => a.id !== id) })),
  clear:   ()   => set({ alertas: [] }),
}));
