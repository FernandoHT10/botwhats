#  BotWhats - Asistente de WhatsApp Open Source para Clínicas

BotWhats es un asistente virtual de código abierto diseñado específicamente para profesionales independientes, clínicas dentales y centros médicos. Permite a los pacientes **agendar citas directamente en tu Google Calendar** sin intervención humana, responder preguntas frecuentes y enviar recordatorios automáticos.

##  Características Principales

- **Agendamiento Inteligente**: Se conecta en tiempo real a Google Calendar para revisar horarios disponibles.
- **Recordatorios Automáticos**: Envía WhatsApp a los pacientes el día anterior a la cita.
- **Toma de Control (Handover)**: Si el paciente tiene un problema, el bot se "pausa" automáticamente y un humano puede tomar el control del chat.
- **Configuración en un solo archivo**: Cero bases de datos complejas. Toda la "personalidad" y configuración de tu bot vive en un archivo `config.ts` fácil de editar.

---

##  Guía de Instalación Rápida

### 1. Requisitos Previos
- Instalar [Node.js](https://nodejs.org/es) (versión 18 o superior).
- Una cuenta de Google (para el calendario).
- Un celular con WhatsApp Business (o WhatsApp normal) que actuará como el bot.

### 2. Clonar e Instalar
```bash
git clone https://github.com/tu-usuario/botwhats.git
cd botwhats
npm install
```

### 3. Configurar tu Clínica (¡Un solo archivo!)
Abre el archivo `src/config.ts`. Este es el **único lugar** que necesitas modificar.

Ahí podrás definir:
1. Nombre de tu clínica.
2. Tu correo de Google Calendar.
3. Tus profesionales o servicios.
4. Las preguntas frecuentes (FAQs).
5. **Todos los textos y mensajes** exactos que enviará el bot (totalmente personalizable).

### 4. Configurar Google Calendar (Opcional pero recomendado)
Para que el bot lea y escriba citas de verdad, necesitas darle permisos:
1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto y habilita la API "Google Calendar API".
3. Crea una "Cuenta de Servicio" (Service Account), descarga el archivo JSON con las credenciales y guárdalo en la raíz de este proyecto con el nombre `google-service-account.json`.
4. En la configuración de tu Google Calendar, ve a "Compartir con personas" y agrega el correo de tu cuenta de servicio con permisos para editar eventos.

*Nota: Si no haces este paso, el bot se ejecutará en "Modo Prueba" y usará citas falsas simuladas.*

### 5. Iniciar el Bot
```bash
npm run dev
```
1. En tu consola aparecerá un **Código QR**.
2. Abre WhatsApp en tu celular (el número que usarás para el negocio).
3. Ve a "Dispositivos Vinculados" -> "Vincular un dispositivo" y escanea el QR.
4. ¡Listo! El bot está funcionando y respondiendo 24/7.

---

## 🛠 Comandos de Control para la Secretaria
La recepcionista puede usar WhatsApp Web o su propio teléfono para tomar el control de la conversación con cualquier paciente, usando "Comandos Silenciosos" que el paciente no verá:
- Escribe `0` y envíalo: Pausa el bot temporalmente para ese paciente.
- Escribe `1` y envíalo: Reactiva el bot para que siga respondiendo automáticamente.

---

## 📜 Licencia
Este proyecto es de código abierto. Puedes usarlo, modificarlo y venderlo a clientes bajo tus propias reglas.
