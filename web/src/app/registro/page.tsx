'use client';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://transporte-mina.onrender.com';

// REGISTRO DE PASAJEROS — POST /api/auth/registro-pasajero
// NUEVO: el pasajero comparte su DOMICILIO por GPS. El supervisor lo ve al aprobar
// y el sistema le sugiere el paradero más cercano a su casa.
export default function RegistroPage() {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '', direccion: '' });
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function capturarGPS() {
    if (!('geolocation' in navigator)) { setGpsMsg('Tu navegador no soporta GPS'); return; }
    setGpsMsg('Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setGps({ lat, lng });
        setGpsMsg(`✅ Ubicación guardada (±${Math.round(pos.coords.accuracy)}m)`);
        // Dirección aproximada (OpenStreetMap Nominatim, gratis) — editable por el usuario
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`,
            { headers: { 'Accept-Language': 'es' } });
          const d = await r.json();
          if (d.display_name) setForm(f => ({ ...f, direccion: f.direccion || d.display_name.split(',').slice(0, 3).join(',') }));
        } catch {}
      },
      e => setGpsMsg('⚠️ No se pudo obtener: ' + e.message + '. Puedes escribir tu dirección igual.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const r = await fetch(`${API}/api/auth/registro-pasajero`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, domicilioLat: gps?.lat, domicilioLng: gps?.lng })
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
            Tu supervisor validará tu domicilio y te asignará el paradero más cercano.
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

          {/* Domicilio por GPS */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tu domicilio (para asignarte paradero)</p>
            <button type="button" onClick={capturarGPS}
              className={`w-full ${gps ? 'bg-green-900/40 border-green-700 text-green-300' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'} border font-bold py-2.5 rounded-lg text-sm transition-colors`}>
              {gps ? '📍 Ubicación capturada — volver a intentar' : '📍 Usar mi ubicación actual (GPS)'}
            </button>
            {gpsMsg && <p className="text-xs text-slate-400">{gpsMsg}</p>}
            <input type="text" value={form.direccion} onChange={set('direccion')}
              placeholder="Dirección (calle, número, distrito)"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-green-500 transition-colors" />
          </div>

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
