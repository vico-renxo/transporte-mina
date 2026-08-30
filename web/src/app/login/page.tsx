'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { loginApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// LOGIN UNIFICADO — un solo formulario para los 3 roles.
// Según las credenciales, el sistema te lleva a tu panel:
//   ADMIN / SUPERVISOR / GERENCIA → /dashboard
//   CONDUCTOR                     → /conductor
//   PASAJERO                      → /pasajero
export default function LoginPage() {
  const [email, setEmail]     = useState('');
  const [pass,  setPass]      = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth }           = useAuthStore();
  const router                = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await loginApi(email, pass);

      // Limpiar las sesiones de los OTROS roles antes de guardar la nueva.
      // Este proyecto guarda cada panel en claves distintas, y ninguna se
      // borraba al entrar con otro usuario: quedaban dos tokens vivos a la vez
      // y la pantalla de cambiar contrasena elegia el primero que encontraba,
      // que podia ser el del usuario anterior.
      ['tm_token', 'tm_user', 'tm_conductor_token', 'tm_conductor_user',
       'tm_pasajero_token', 'tm_pasajero_user'].forEach(k => localStorage.removeItem(k));
      const rol = data.usuario.rol;

      if (['ADMIN', 'SUPERVISOR', 'GERENCIA'].includes(rol)) {
        setAuth(data.usuario, data.token);
        toast.success(`Bienvenido, ${data.usuario.nombre}`);
        router.push('/dashboard');
      } else if (rol === 'CONDUCTOR') {
        localStorage.setItem('tm_conductor_token', data.token);
        localStorage.setItem('tm_conductor_user', JSON.stringify(data.usuario));
        window.location.href = '/transporte/conductor/';
      } else if (rol === 'PASAJERO') {
        localStorage.setItem('tm_pasajero_token', data.token);
        localStorage.setItem('tm_pasajero_user', JSON.stringify(data.usuario));
        window.location.href = '/transporte/pasajero/';
      } else {
        throw new Error('Rol desconocido: ' + rol);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Error al ingresar');
    } finally {
      setLoading(false);
    }
  };

  const fill = (em: string) => { setEmail(em); setPass('admin123'); };

  const DEMOS = [
    { email: 'admin@empresa.com',     rol: 'ADMIN',     cls: 'text-green-400 bg-green-400/10',  destino: 'Panel Supervisor' },
    { email: 'conductor@empresa.com', rol: 'CONDUCTOR', cls: 'text-amber-400 bg-amber-400/10',  destino: 'Panel Conductor'  },
    { email: 'pasajero@empresa.com',  rol: 'PASAJERO',  cls: 'text-blue-400 bg-blue-400/10',    destino: 'Panel Pasajero'   },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🚌</div>
          <h1 className="text-2xl font-black text-white">TransporteMina</h1>
          <p className="text-slate-500 text-xs tracking-widest uppercase mt-1">Ingreso único — el sistema te lleva a tu panel</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="tu@empresa.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Contraseña</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} required
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors mt-2"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <p className="text-center text-slate-500 text-xs">
            ¿Eres pasajero nuevo?{' '}
            <a href="/transporte/registro/" className="text-green-400 underline hover:text-green-300">Regístrate aquí</a>
          </p>
        </form>

        {/* Credenciales demo — clic para autocompletar */}
        <div className="mt-4 bg-slate-900 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Credenciales demo (clic para usar)</p>
          <div className="space-y-2 text-xs">
            {DEMOS.map(d => (
              <button key={d.rol} type="button" onClick={() => fill(d.email)}
                className="w-full flex items-center justify-between hover:bg-slate-800 rounded-lg px-2 py-2 transition-colors text-left">
                <div>
                  <p className="text-slate-300 font-mono">{d.email}</p>
                  <p className="text-slate-600">→ {d.destino}</p>
                </div>
                <span className={`${d.cls} text-xs font-semibold px-2 py-1 rounded`}>{d.rol}</span>
              </button>
            ))}
          </div>
          <p className="text-slate-600 text-[11px] mt-3">Password de los 3: <span className="font-mono">admin123</span> · Demo automática: <a href="/transporte/simulacion.html" className="text-slate-400 underline">simulación</a></p>
        </div>
      </div>
    </div>
  );
}
