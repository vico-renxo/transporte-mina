'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { loginApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

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
      const rolesPermitidos = ['ADMIN', 'SUPERVISOR', 'GERENCIA'];
      if (!rolesPermitidos.includes(data.usuario.rol)) {
        throw new Error('Acceso solo para supervisores y administradores');
      }
      setAuth(data.usuario, data.token);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Error al ingresar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🚌</div>
          <h1 className="text-2xl font-black text-white">TransporteMina</h1>
          <p className="text-slate-500 text-xs tracking-widest uppercase mt-1">Panel Supervisor</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="supervisor@empresa.com"
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
        </form>
        <p className="text-center text-slate-600 text-xs mt-4">Demo: admin@empresa.com / admin123</p>
      </div>
    </div>
  );
}
