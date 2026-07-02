'use client';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://transporte-mina.onrender.com';

// REGISTRO DE PASAJEROS — usa POST /api/auth/registro-pasajero (ya existía en el backend).
// Flujo: el pasajero se registra → queda PENDIENTE → el supervisor lo aprueba en
// el panel admin (Pasajeros) asignándole su paradero → recién puede ver su bus.
export default function RegistroPage() {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/auth/registro-pasajero`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error en el registro');
      setOk(true);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  if (ok) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-green-800/50 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-white font-bold text-lg">¡Registro enviado!</h1>
          <p className="text-slate-400 text-sm mt-2">
            Tu supervisor revisará tu solicitud y te asignará una ruta y paradero.
            Cuando te apruebe, podrás ingresar con tu email y contraseña.
          </p>
          <a href="/transporte/login/"
            className="inline-block mt-5 bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Ir al ingreso
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚌</div>
          <h1 className="text-2xl font-black text-white">TransporteMina</h1>
          <p className="text-slate-500 text-xs tracking-widest uppercase mt-1">Registro de pasajero</p>
        </div>
        <form onSubmit={submit} className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-4">
          {[
            { k: 'nombre',   label: 'Nombre completo', type: 'text',     ph: 'María López'        },
            { k: 'email',    label: 'Email',           type: 'email',    ph: 'maria@empresa.com'  },
            { k: 'telefono', label: 'Teléfono',        type: 'tel',      ph: '987654321'          },
            { k: 'password', label: 'Contraseña',      type: 'password', ph: '••••••••'           },
          ].map(f => (
            <div key={f.k}>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">{f.label}</label>
              <input type={f.type} value={(form as any)[f.k]} onChange={set(f.k)} required placeholder={f.ph}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors" />
            </div>
          ))}
          {err && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{err}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors">
            {loading ? 'Enviando…' : 'Registrarme'}
          </button>
          <p className="text-center text-slate-500 text-xs">
            ¿Ya tienes cuenta? <a href="/transporte/login/" className="text-green-400 underline">Ingresa aquí</a>
          </p>
        </form>
        <p className="text-slate-600 text-[11px] text-center mt-4">
          Los conductores no se registran aquí — los crea el supervisor en el panel admin.
        </p>
      </div>
    </div>
  );
}
