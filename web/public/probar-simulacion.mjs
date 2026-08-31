// Prueba de web/public/simulacion.html SIN navegador ni backend.
//
// Esa pagina no pasa por el build de Next, asi que ni el CI ni los
// guardianes la miran. Esto es lo unico que la vigila.
//
//   node web/public/probar-simulacion.mjs
//
// Extrae el <script> de la pagina y lo corre con shims de DOM, Leaflet y
// fetch. Verifica comportamiento, no apariencia: que las dos direcciones
// sean realmente opuestas, que cada unidad tenga su propio conductor,
// vehiculo y ejecucion, y que el GPS salga repartido entre todas.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(aqui, 'simulacion.html'), 'utf8');
const bloques = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
const js = bloques[bloques.length - 1][1].replace(/\ninit\(\);\s*$/, '\n');

// ── Shims ──────────────────────────────────────────────────────────────
const nodos = new Map();
const nuevo = () => ({ innerHTML:'', textContent:'', value:'', className:'', style:{},
  children:[], onchange:null,
  classList:{ add(){}, remove(){} },
  appendChild(c){ this.children.push(c); },
  querySelector(){ return { style:{} }; } });
globalThis.document = {
  getElementById: id => { if(!nodos.has(id)) nodos.set(id, nuevo()); return nodos.get(id); },
  createElement: () => nuevo(),
};
const marcador = () => ({ setLatLng(){return this}, addTo(){return this}, bindPopup(){return this}, remove(){} });
globalThis.L = { map:()=>({setView(){return this}}), tileLayer:()=>({addTo(){}}),
  marker:()=>marcador(), divIcon:()=>({}), polyline:()=>({addTo(){}}) };
globalThis.io = () => ({ on(){} });
globalThis.window = { open(){} };
globalThis.alert = () => { throw new Error('alert() no deberia dispararse'); };

const llamadas = { iniciar:[], gps:[], finalizar:[] };
globalThis.fetch = async (url, opt={}) => {
  const u = String(url), m = opt.method || 'GET';
  const ok = d => ({ ok:true, status:200, json: async()=>d, text: async()=>JSON.stringify(d) });
  if (u.endsWith('/health')) return ok({ version:'1.0.0' });
  if (u.includes('/auth/login')) return ok({ token:'tok-'+JSON.parse(opt.body).email });
  if (u.includes('/api/rutas') && m==='GET')
    return ok({ rutas:[{id:'r-ida',nombre:'Ruta 1'},{id:'r-vuelta',nombre:'Ruta 2'}] });
  if (u.includes('/api/conductores')) return ok({ conductores:[1,2,3,4,5].map(i=>({id:'c'+i})) });
  if (u.includes('/api/vehiculos'))   return ok({ vehiculos:[1,2,3,4,5].map(i=>({id:'v'+i,placa:'ZZP-'+i})) });
  if (u.includes('/iniciar'))   { const id='e'+(llamadas.iniciar.length+1); llamadas.iniciar.push({url:u,body:JSON.parse(opt.body)}); return ok({id}); }
  if (u.includes('/finalizar')) { llamadas.finalizar.push(u); return ok({}); }
  if (u.includes('/gps/coordenada')) { llamadas.gps.push(JSON.parse(opt.body)); return ok({}); }
  return ok({});
};
let intervalos=[];
globalThis.setInterval = (f)=>{ intervalos.push(f); return intervalos.length; };
globalThis.clearInterval = ()=>{};
globalThis.setTimeout = (f,ms)=>{ if(ms<100) f(); return 0; };

const mod = new Function(js + '\nreturn {init,start,tick,stop,crearUnidades,posDe,pasoDe,idxDe,ROUTE,PARS,get unidades(){return unidades},get running(){return running}};');
const S = mod();

// ── Pruebas ────────────────────────────────────────────────────────────
let malos = 0;
const check = (nom, cond, extra='') => { console.log((cond?'  ✓ ':'  ✗ ')+nom+(cond?'':' <-- '+extra)); if(!cond) malos++; };

console.log('\n=== geometria de las dos direcciones ===');
const ida = {dir:1, step:0}, vta = {dir:-1, step:0};
check('la de ida arranca en Mina Central',
  S.posDe(ida)===S.ROUTE[0], JSON.stringify(S.posDe(ida)));
check('la de vuelta arranca en Plaza de Armas',
  S.posDe(vta)===S.ROUTE[S.ROUTE.length-1], JSON.stringify(S.posDe(vta)));
ida.step=11; vta.step=11;
check('la de ida termina en Plaza de Armas', S.posDe(ida)===S.ROUTE[11]);
check('la de vuelta termina en Mina Central', S.posDe(vta)===S.ROUTE[0]);
check('van en sentidos opuestos (paradero 1)',
  S.pasoDe({dir:1},S.PARS[1]) !== S.pasoDe({dir:-1},S.PARS[1]),
  S.pasoDe({dir:1},S.PARS[1])+' vs '+S.pasoDe({dir:-1},S.PARS[1]));
check('idxDe nunca se sale del trazado',
  [-5,0,50].every(p=>{const i=S.idxDe({dir:-1},p); return i>=0 && i<S.ROUTE.length;}));

await S.init();
console.log('\n=== arranque con 4 unidades ===');
await S.start();
const U = S.unidades;
check('crea 4 unidades', U.length===4, 'creo '+U.length);
check('2 de ida y 2 de vuelta',
  U.filter(u=>u.dir===1).length===2 && U.filter(u=>u.dir===-1).length===2);
check('conductores distintos', new Set(U.map(u=>u.cond.id)).size===4);
check('vehiculos distintos',  new Set(U.map(u=>u.veh.id)).size===4);
check('cada una en su ruta segun direccion',
  U.every(u=>u.dir===1 ? u.ruta.id==='r-ida' : u.ruta.id==='r-vuelta'));
check('salidas escalonadas', new Set(U.map(u=>u.step)).size===4, U.map(u=>u.step).join(','));
check('4 ejecuciones creadas en el backend', llamadas.iniciar.length===4, llamadas.iniciar.length);
check('cada ejecucion con su ejecId', U.every(u=>u.ejecId), U.map(u=>u.ejecId).join(','));

console.log('\n=== corrida completa ===');
const tick = intervalos[0];
let n=0;
while (S.running && n < 200) { await tick(); n++; }
check('todas completaron', U.every(u=>u.fin), U.map(u=>u.step).join(','));
check('la simulacion se detuvo sola', !S.running);
check('4 finalizaciones en el backend', llamadas.finalizar.length===4, llamadas.finalizar.length);
check('mando GPS de las 4 unidades',
  new Set(llamadas.gps.map(g=>g.rutaEjecucionId)).size===4,
  new Set(llamadas.gps.map(g=>g.rutaEjecucionId)).size);
check('GPS repartido parejo (>=10 por unidad)',
  [...new Set(llamadas.gps.map(g=>g.rutaEjecucionId))]
    .every(id=>llamadas.gps.filter(g=>g.rutaEjecucionId===id).length>=10));
const latsIda = llamadas.gps.filter(g=>g.rutaEjecucionId==='e1');
const latsVta = llamadas.gps.filter(g=>g.rutaEjecucionId==='e2');
check('la unidad de ida y la de vuelta empiezan en puntas opuestas',
  latsIda[0].lat!==latsVta[0].lat,
  latsIda[0].lat+' vs '+latsVta[0].lat);
check('ninguna coordenada es NaN',
  llamadas.gps.every(g=>Number.isFinite(g.lat)&&Number.isFinite(g.lng)));

console.log(malos ? `\nRESULTADO: ${malos} fallo(s)` : `\nRESULTADO: todo en verde (${llamadas.gps.length} pings GPS simulados)`);
process.exit(malos?1:0);
