let twilioClient = null;

function getClient() {
  if (twilioClient) return twilioClient;
  if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    if (process.env.TWILIO_ACCOUNT_SID === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') return null;
  }
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return twilioClient;
}

async function enviarSMS(telefono, mensaje) {
  if (!telefono) return null;
  const client = getClient();
  if (!client) {
    console.log(`[SMS DEMO] → ${telefono}: ${mensaje}`);
    return { sid: 'demo' };
  }
  return client.messages.create({
    body: mensaje.substring(0, 160), // max SMS length
    from: process.env.TWILIO_PHONE_NUMBER,
    to: telefono
  });
}

module.exports = { enviarSMS };
