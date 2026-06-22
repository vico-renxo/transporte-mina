import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL: `${BASE}/api` });

// Inyectar token en cada request
api.interceptors.request.use(cfg => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tm_token') : null;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Si 401 → redirigir a login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('tm_token');
      localStorage.removeItem('tm_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// --- Auth ---
export const loginApi = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then(r => r.data);

// --- Dashboard ---
export const getDashboard = () =>
  api.get('/reportes/dashboard').then(r => r.data);

// --- Rutas ---
export const getRutas        = ()         => api.get('/rutas').then(r => r.data);
export const getRuta         = (id: string)=> api.get(`/rutas/${id}`).then(r => r.data);
export const crearRuta       = (data: any) => api.post('/rutas', data).then(r => r.data);
export const actualizarRuta  = (id: string, data: any) => api.patch(`/rutas/${id}`, data).then(r => r.data);
export const getRutasActivas = ()         => api.get('/rutas/activas').then(r => r.data);
export const getHistorialRutas= (params?: any) => api.get('/rutas/historial', { params }).then(r => r.data);
export const iniciarRutaApi  = (id: string, conductorId: string, vehiculoId: string) =>
  api.post(`/rutas/${id}/iniciar`, { conductorId, vehiculoId }).then(r => r.data);
export const finalizarRutaApi= (id: string) => api.post(`/rutas/${id}/finalizar`).then(r => r.data);

// --- Conductores ---
export const getConductores    = ()          => api.get('/conductores').then(r => r.data);
export const getConductor      = (id: string) => api.get(`/conductores/${id}`).then(r => r.data);
export const crearConductor    = (data: any)  => api.post('/conductores', data).then(r => r.data);
export const actualizarConductor = (id: string, data: any) => api.put(`/conductores/${id}`, data).then(r => r.data);

// --- Vehículos ---
export const getVehiculos   = ()          => api.get('/vehiculos').then(r => r.data);
export const crearVehiculo  = (data: any)  => api.post('/vehiculos', data).then(r => r.data);
export const actualizarVehiculo = (id: string, data: any) => api.put(`/vehiculos/${id}`, data).then(r => r.data);

// --- Pasajeros ---
export const getPasajeros   = ()          => api.get('/pasajeros').then(r => r.data);
export const getPendientes  = ()          => api.get('/pasajeros/pendientes').then(r => r.data);
export const aprobarPasajero= (id: string) => api.post(`/pasajeros/${id}/aprobar`).then(r => r.data);
export const getEstadosHoy  = (rutaId: string) => api.get(`/pasajeros/estados/${rutaId}`).then(r => r.data);

// --- Checkins ---
export const getCheckins    = (ejecucionId: string) => api.get(`/checkin/${ejecucionId}`).then(r => r.data);
export const getResumenCheckin=(ejecucionId: string) => api.get(`/checkin/${ejecucionId}/resumen`).then(r => r.data);

// --- Alertas ---
export const enviarEmergencia = (ejecucionId: string, mensaje: string) =>
  api.post('/alertas/emergencia', { rutaEjecucionId: ejecucionId, mensaje }).then(r => r.data);

// --- Reportes ---
export const getReporteDiario  = (fecha?: string) => api.get('/reportes/diario', { params: { fecha } }).then(r => r.data);
export const getReporteSemanal = (semana?: string) => api.get('/reportes/semanal', { params: { semana } }).then(r => r.data);
export const descargarExcel    = async (fecha?: string) => {
  const res = await api.get('/reportes/diario/excel', {
    params: { fecha }, responseType: 'blob'
  });
  const url = URL.createObjectURL(res.data);
  const a   = document.createElement('a');
  a.href    = url;
  a.download= `reporte-${fecha || 'hoy'}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

// --- GPS ---
export const getUltimaCoordenada = (conductorId: string) =>
  api.get(`/gps/ultima/${conductorId}`).then(r => r.data);
