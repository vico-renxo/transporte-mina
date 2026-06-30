import { io, Socket } from 'socket.io-client';

// Use NEXT_PUBLIC_API_URL as fallback when SOCKET_URL is unset or stale (fly.dev)
let SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';
if (!SOCKET_URL || SOCKET_URL.includes('fly.dev') || SOCKET_URL.includes('localhost')) {
  SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://transporte-mina.onrender.com';
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Token stored by Zustand persist under tm-auth key
    let token = '';
    if (typeof window !== 'undefined') {
      try {
        const auth = JSON.parse(localStorage.getItem('tm-auth') || '{}');
        token = auth?.state?.token || '';
      } catch { token = ''; }
    }
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// Helpers de tipo
export type BusPosition = {
  conductorId: string;
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  rutaEjecucionId: string;
  conductorNombre: string;
  rutaNombre: string;
  vehiculoPlaca: string;
};
