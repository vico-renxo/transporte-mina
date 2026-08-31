-- Datos de PRUEBA para simular la flota. Marca: zz-prueba-*@prueba.local, placas ZZP-.
-- Purga:  node prisma/purgar-pruebas.js --borrar
begin;

-- Ruta de VUELTA: mismos paraderos, orden invertido ─────────────────────────
insert into "Ruta" (id, nombre, origen, destino, "horaInicio", dias, activa)
values ('zzp-ruta-vuelta','Ruta 2 - Arequipa a Mina Central (prueba)',
        'Plaza de Armas','Mina Central','17:30',
        array['LUN','MAR','MIE','JUE','VIE','SAB'], true)
on conflict (id) do nothing;

insert into "Paradero" (id,"rutaId",nombre,direccion,lat,lng,orden)
select 'zzp-par-'||p.orden,'zzp-ruta-vuelta',p.nombre,p.direccion,p.lat,p.lng,
       (select count(*)+1 from "Paradero" x where x."rutaId"=p."rutaId")-p.orden
from "Paradero" p
where p."rutaId"=(select id from "Ruta" where id<>'zzp-ruta-vuelta' order by "creadoEn" limit 1)
on conflict (id) do nothing;

-- 4 conductores + 4 vehiculos ───────────────────────────────────────────────
insert into "Usuario" (id,nombre,email,password,rol,activo)
select 'zzp-u-cond'||n, nom||' (prueba)', 'zz-prueba-cond'||n||'@prueba.local',
       '$2a$10$Ua4IV2eqP.e33xgXamjXNu9vOU22SYY7157Q6aDje6OdYQoiHzYcm','CONDUCTOR',true
from unnest(array['01','02','03','04'],
            array['Mario Huarca','Julio Ccopa','Rene Ancco','Tito Suana']) as t(n,nom)
on conflict (email) do nothing;

insert into "Conductor" (id,"usuarioId",licencia,telefono)
select 'zzp-c'||n,'zzp-u-cond'||n,'ZZP-LIC-'||n,'95000000'||n
from unnest(array['01','02','03','04']) as t(n)
on conflict ("usuarioId") do nothing;

insert into "Vehiculo" (id,placa,marca,modelo,anio,capacidad,estado)
select 'zzp-v'||n,'ZZP-'||n||'0','Toyota','Hiace',2022,16,'ACTIVO'
from unnest(array['01','02','03','04']) as t(n)
on conflict (placa) do nothing;

-- 30 pasajeros: los impares a la ruta de ida, los pares a la de vuelta ──────
insert into "Usuario" (id,nombre,email,password,rol,activo)
select 'zzp-u-pas'||lpad(i::text,2,'0'), nom||' (prueba)',
       'zz-prueba-pas'||lpad(i::text,2,'0')||'@prueba.local',
       '$2a$10$Ua4IV2eqP.e33xgXamjXNu9vOU22SYY7157Q6aDje6OdYQoiHzYcm','PASAJERO',true
from unnest(array['Ana Quispe','Luis Mamani','Rosa Ccama','Marco Apaza','Elena Choque',
 'Jorge Huanca','Nilda Cutipa','Cesar Ticona','Ruth Condori','Pablo Larico',
 'Sonia Calcina','Hugo Machaca','Delia Pari','Raul Ala','Marta Sucari',
 'Percy Colque','Yola Vilca','Edwin Coaquira','Gloria Nina','Fidel Ramos',
 'Rocio Zapana','Wilber Chura','Norma Aguilar','Aldo Cahuana','Lucia Puma',
 'Efrain Salas','Betty Quenta','Nestor Ito','Irma Turpo','Vidal Mendoza'])
 with ordinality as t(nom,i)
on conflict (email) do nothing;

insert into "Pasajero" (id,"usuarioId","rutaId","paraderoId",aprobado,activo,"tiempoAlertaMin")
select 'zzp-p'||lpad(i::text,2,'0'), 'zzp-u-pas'||lpad(i::text,2,'0'), r.id,
       (select id from "Paradero" where "rutaId"=r.id and orden between 2 and 4
        order by orden offset (i % 3) limit 1),
       true, true, 5 + (i % 6)
from generate_series(1,30) as i
cross join lateral (
  select case when i % 2 = 0 then 'zzp-ruta-vuelta'
         else (select id from "Ruta" where id<>'zzp-ruta-vuelta' order by "creadoEn" limit 1) end as id
) r
on conflict ("usuarioId") do nothing;

commit;
