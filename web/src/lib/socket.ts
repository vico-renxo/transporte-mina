import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tm_token') : '';
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
