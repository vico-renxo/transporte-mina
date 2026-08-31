#!/usr/bin/env node
// Genera el hash bcrypt de una contraseña que TÚ escribís, para pegarlo en
// un UPDATE de Supabase. La contraseña nunca sale de tu máquina, no queda en
// el historial de la terminal y no se le muestra a nadie.
//
//   node scripts/hashear-password.js
//
// Después pegás el UPDATE que imprime en el editor SQL de Supabase.
//
// POR QUE ASI Y NO CON UNA PANTALLA DE LA APP: no existe pantalla para
// cambiar contraseña (el endpoint POST /auth/cambiar-password sí existe,
// pero exige estar logueado, y el punto es justamente que la contraseña
// actual está publicada).

const bcrypt = require('bcryptjs');
const readline = require('readline');

function preguntarOculto(texto) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdout = process.stdout;
    rl.question(texto, valor => { rl.close(); stdout.write('\n'); resolve(valor); });
    // Tapar lo que se escribe.
    rl._writeToOutput = function (s) {
      if (s.includes(texto)) stdout.write(texto);
      else stdout.write('*');
    };
  });
}

(async () => {
  const email = process.argv[2] || 'admin@empresa.com';

  const p1 = await preguntarOculto(`Contraseña nueva para ${email}: `);
  if (p1.length < 12) {
    console.error('\n✗ Muy corta. Mínimo 12 caracteres: esta cuenta está expuesta a internet.');
    process.exit(1);
  }
  const p2 = await preguntarOculto('Repetila: ');
  if (p1 !== p2) { console.error('\n✗ No coinciden.'); process.exit(1); }

  const hash = await bcrypt.hash(p1, 10);

  console.log('\nPegá esto en el editor SQL de Supabase y ejecutalo:\n');
  console.log(`update "Usuario" set password = '${hash}' where email = '${email}';`);
  console.log('\nDespués comprobá que entrás con la nueva, y guardala en tu gestor.');
  console.log('El token viejo muere solo: el login firma una huella del hash (pv),');
  console.log('y al cambiar el hash esa huella deja de coincidir.\n');
})();
