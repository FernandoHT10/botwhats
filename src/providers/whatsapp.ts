import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
// @ts-ignore
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

export class WhatsAppProvider {
  private sock: WASocket | null = null;
  private messageHandler: (socket: WASocket, msg: any) => Promise<void>;

  constructor(messageHandler: (socket: WASocket, msg: any) => Promise<void>) {
    this.messageHandler = messageHandler;
  }

  /**
   * Inicializa la sesión principal de WhatsApp
   */
  async startSession() {
    console.log(`🚀 Iniciando sesión de WhatsApp Open Source...`);

    const authDir = path.join(process.cwd(), 'auth', `session_main`);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const logger = pino({ level: 'warn' });
    const makeWASocketFn = (makeWASocket as any).default || makeWASocket;
    
    this.sock = makeWASocketFn({
      auth: state,
      printQRInTerminal: false, 
      logger,
      browser: Browsers.windows('Chrome')
    });

    this.sock!.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`\n======================================================`);
        console.log(`📲 CÓDIGO QR PARA INICIAR EL BOT`);
        console.log(`Escanea este código desde WhatsApp (Dispositivos Vinculados).`);
        console.log(`------------------------------------------------------`);
        qrcode.generate(qr, { small: true });
        console.log(`======================================================\n`);
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`🔌 Conexión cerrada. Reconectando: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(() => this.startSession(), 5000);
        } else {
          console.log(`🚫 Sesión cerrada permanentemente. Borrando credenciales...`);
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch (e) {
            console.error(`Error al eliminar sesión:`, e);
          }
        }
      } else if (connection === 'open') {
        console.log(`✅ ¡Bot de WhatsApp CONECTADO y listo!`);
      }
    });

    this.sock!.ev.on('creds.update', saveCreds);

    this.sock!.ev.on('messages.upsert', async (m: any) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) {
          const textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
          const t = textContent.trim();
          if (t === '0' || t === '1') {
            // Dejar pasar comandos 0 y 1 del dueño
          } else {
            continue;
          }
        }
        
        if (!msg.key.remoteJid || msg.key.remoteJid.endsWith('@g.us')) continue;

        try {
          await this.messageHandler(this.sock!, msg);
        } catch (error) {
          console.error(`❌ Error procesando mensaje:`, error);
        }
      }
    });
  }

  async sendMessage(toPhone: string, text: string) {
    if (!this.sock) {
      console.error(`❌ El socket no está inicializado.`);
      return;
    }
    const formattedJid = toPhone.includes('@s.whatsapp.net') ? toPhone : `${toPhone}@s.whatsapp.net`;
    await this.sock.sendMessage(formattedJid, { text });
  }
}
