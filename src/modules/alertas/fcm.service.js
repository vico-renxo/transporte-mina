let admin = null;

function getAdmin() {
  if (admin) return admin;
  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'tu_proyecto') {
    return null; // modo demo
  }
  const firebase = require('firebase-admin');
  if (!firebase.apps.length) {
    firebase.initializeApp({
      credential: firebase.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
  }
  admin = firebase;
  return admin;
}

async function enviarPush(token, titulo, cuerpo, datos = {}) {
  if (!token) return null;
  const fb = getAdmin();
  if (!fb) {
    console.log(`[FCM DEMO] → ${titulo}: ${cuerpo}`);
    return { messageId: 'demo' };
  }
  return fb.messaging().send({
    token,
    notification: { title: titulo, body: cuerpo },
    data: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v)])),
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } }
  });
}

async function enviarPushMultiple(tokens, titulo, cuerpo, datos = {}) {
  const tokensValidos = tokens.filter(Boolean);
  if (!tokensValidos.length) return null;
  const fb = getAdmin();
  if (!fb) {
    console.log(`[FCM DEMO] Multicast(${tokensValidos.length}) → ${titulo}: ${cuerpo}`);
    return { successCount: tokensValidos.length, failureCount: 0 };
  }
  return fb.messaging().sendEachForMulticast({
    tokens: tokensValidos,
    notification: { title: titulo, body: cuerpo },
    data: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v)])),
    android: { priority: 'high' }
  });
}

module.exports = { enviarPush, enviarPushMultiple };
