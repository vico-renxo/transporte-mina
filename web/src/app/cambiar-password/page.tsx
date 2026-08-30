'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// PANTALLA DE CAMBIO DE CONTRASENA
//
// El endpoint POST /api/auth/cambiar-password existia hace rato pero no habia
// forma de llegar a el desde la app: quedaba muerto. Esta es esa forma.
//
// Sirve para los tres roles con una sola pantalla. El proyecto guarda la
// sesion de cada panel en una clave distinta de localStorage (admin, conductor
// y pasajero por separado, ver MAPA_DUPLICADOS.md), asi que en vez de asumir
// una, buscamos las tres y usamos la que exista.

// next.config.js ya le da valor a NEXT_PUBLIC_API_URL en tiempo de build
// (con web/.env.production apuntando a Render), asi que un `|| 'https://...'`
// aca seria codigo muerto que ademas tapa el default a localhost del config.
const BASE = process.env.NEXT_PUBLIC_API_URL;

// El origen viaja en la URL (?de=conductor) porque las tres sesiones pueden
// convivir en el mismo navegador: elegir 'la primera que exista' le cambiaba
// la contrasena al usuario equivocado.
const SESIONES = [
  { id: 'admin',     token: 'tm_token',           user: 'tm_user',           panel: '/transporte/dashboard/', nombre: 'el panel' },
  { id: 'conductor', token: 'tm_conductor_token', user: 'tm_conductor_user', panel: '/transporte/conductor/', nombre: 'mi turno' },
  { id: 'pasajero',  token: 'tm_pasajero_token',  user: 'tm_pasajero_user',  panel: '/transporte/pasajero/',  nombre: 'mi viaje' },
];

const MIN_LARGO = 8;

export default function CambiarPasswordPage() {
  const [sesion,   setSesion]   = useState<typeof SESIONES[0] | null>(null);
  const [quien,    setQuien]    = useState('');
  const [actual,   setActual]   = useState('');
  const [nueva,    setNueva]    = useState('');
  const [repetir,  setRepetir]  = useState('');
  const [ver,      setVer]      = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo,    setListo]    = useState(false);

  useEffect(() => {
    // De donde vino: el link de cada panel manda ?de=admin|conductor|pasajero.
    const de = new URLSearchParams(window.location.search).get('de');
    const s  = SESIONES.find(x => x.id === de && localStorage.getItem(x.token))
            ?? SESIONES.find(x => localStorage.getItem(x.token));
    if (!s) { window.location.href = '/transporte/login/'; return; }
    setSesion(s);

    // El nombre para saludar. El admin no guarda 'tm_user': su usuario vive
    // dentro del blob de zustand ('tm-auth'), asi que hay que buscarlo ahi.
    try {
      const propio = JSON.parse(localStorage.getItem(s.user) || '{}');
      if (propio.nombre || propio.email) { setQuien(propio.nombre || propio.email); return; }
      const zustand = JSON.parse(localStorage.getItem('tm-auth') || '{}');
      const u = zustand?.state?.usuario;
      if (u) setQuien(u.nombre || u.email || '');
    } catch { /* si el JSON esta roto, seguimos sin el nombre */ }
  }, []);

  // Motivo por el que el boton esta bloqueado, o null si se puede enviar.
  const problema = (): string | null => {
    if (!actual)                    return 'Escribi tu contrasena actual';
    if (nueva.length < MIN_LARGO)   return `La nueva necesita al menos ${MIN_LARGO} caracteres`;
    if (nueva === actual)           return 'La nueva tiene que ser distinta de la actual';
    if (repetir && nueva !== repetir) return 'Las dos nuevas no coinciden';
    if (!repetir)                   return 'Repeti la contrasena nueva';
    return null;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const mal = problema();
    if (mal) { toast.error(mal); return; }
    if (!sesion) return;

    setEnviando(true);
    try {
      const r = await fetch(`${BASE}/api/auth/cambiar-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(sesion.token)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva }),
      });
      if (r.status === 401) {
        // Token vencido: quedarse en el formulario es una trampa, nunca va a
        // andar por mas que reintente.
        toast.error('Tu sesion vencio. Entra de nuevo.');
        setTimeout(() => { window.location.href = '/transporte/login/'; }, 1500);
        return;
      }
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => ({}));
        throw new Error(cuerpo.error || `No se pudo cambiar (error ${r.status})`);
      }

      setListo(true);
      toast.success('Contrasena cambiada');

      // Se cierra la sesion EN ESTE navegador y nada mas. Los JWT del proyecto
      // duran 7 dias y no hay lista de revocacion, asi que una sesion abierta en
      // otro telefono sigue viva hasta que vence, aunque la contrasena cambie.
      // Para el caso 'me entraron a la cuenta' eso no alcanza: haria falta
      // versionar el token del lado del servidor. Anotado en HANDOFF.md.
      setTimeout(() => {
        SESIONES.forEach(s => { localStorage.removeItem(s.token); localStorage.removeItem(s.user); });
        localStorage.removeItem('tm-auth');
        window.location.href = '/transporte/login/';
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || 'No se pudo cambiar la contrasena');
    } finally {
      setEnviando(false);
    }
  };

  if (!sesion) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Cargando...</p>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-black text-white mb-2">Contrasena cambiada</h1>
          <p className="text-slate-400 text-sm">
            Te llevamos al login para que entres con la nueva.
          </p>
        </div>
      </div>
    );
  }

  const mal = problema();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🔑</div>
          <h1 className="text-2xl font-black text-white">Cambiar contrasena</h1>
          <p className="text-slate-500 text-xs tracking-widest uppercase mt-1">
            {quien ? quien : 'Tu cuenta'}
          </p>
        </div>

        <form onSubmit={enviar} className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Contrasena actual</label>
            <input type={ver ? 'text' : 'password'} value={actual} onChange={e => setActual(e.target.value)}
              autoComplete="current-password" placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Contrasena nueva</label>
            <input type={ver ? 'text' : 'password'} value={nueva} onChange={e => setNueva(e.target.value)}
              autoComplete="new-password" placeholder={`Minimo ${MIN_LARGO} caracteres`}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Repetir la nueva</label>
            <input type={ver ? 'text' : 'password'} value={repetir} onChange={e => setRepetir(e.target.value)}
              autoComplete="new-password" placeholder="••••••••"
              className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none transition-colors ${
                repetir && nueva !== repetir ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-green-500'
              }`}
            />
          </div>

          <button type="button" onClick={() => setVer(v => !v)}
            className="text-slate-500 hover:text-slate-300 text-xs underline transition-colors">
            {ver ? 'Ocultar las contrasenas' : 'Ver lo que escribo'}
          </button>

          <button type="submit" disabled={enviando || mal !== null}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors mt-2">
            {enviando ? 'Cambiando...' : 'Cambiar contrasena'}
          </button>

          <p className="text-center text-xs h-4 text-slate-500">{mal || ''}</p>
        </form>

        <div className="mt-4 text-center">
          <a href={sesion.panel} className="text-slate-500 hover:text-slate-300 text-xs underline transition-colors">
            ← Volver a {sesion.nombre}
          </a>
        </div>

        <p className="text-slate-600 text-[11px] text-center mt-6 leading-relaxed">
          Al cambiarla se cierra la sesion en este dispositivo.<br />
          Vas a tener que entrar de nuevo con la contrasena nueva.
        </p>
      </div>
    </div>
  );
}
