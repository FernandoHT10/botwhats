import dotenv from 'dotenv';
import { WhatsAppProvider } from './providers/whatsapp.js';
import { handleIncomingMessage, getMessageText } from './bot/flow.js';
import { WASocket } from '@whiskeysockets/baileys';
import { startScheduler } from './services/scheduler.js';

dotenv.config();

console.log('🤖 Inicializando Servidor de Bot de WhatsApp Open Source...');

// Handler para procesar los mensajes recibidos
async function messageHandler(socket: WASocket, msg: any) {
  const messageContent = msg.message;
  if (!messageContent) return;

  const senderJid = msg.key.remoteJid;
  const patientPhone = senderJid ? senderJid.split('@')[0] : 'Desconocido';
  
  const text = getMessageText(msg);
  console.log(`✉️ Mensaje recibido de +${patientPhone}: "${text}"`);

  // Ejecutar el flujo conversacional del bot
  await handleIncomingMessage(socket, msg);
}

// Inicializar el Proveedor de WhatsApp
const provider = new WhatsAppProvider(messageHandler);

async function main() {
  try {
    await provider.startSession();
    console.log('🚀 Sistema cargado. Esperando mensajes...');
    
    // Iniciar recordatorios automáticos
    startScheduler(provider);
  } catch (error) {
    console.error('❌ Error fatal al arrancar el bot:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Apagando el bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Apagando el bot...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Excepción no controlada:', err);
});

main();
