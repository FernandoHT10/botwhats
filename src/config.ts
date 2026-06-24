export const botConfig = {
  // ---------------------------------------------------------
  // 1. CONFIGURACIÓN GENERAL DEL NEGOCIO
  // ---------------------------------------------------------
  businessName: "Clínica Dental OpenSource",
  phone: "+56912345678", // Opcional, para propósitos de log
  timezone: "America/Santiago",
  
  // ---------------------------------------------------------
  // 2. CONFIGURACIÓN DE GOOGLE CALENDAR
  // ---------------------------------------------------------
  // Para pruebas locales sin credenciales, se usará modo MOCK
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || "clinica.dental.mock@gmail.com",
  
  // ---------------------------------------------------------
  // 3. PROFESIONALES Y SERVICIOS
  // ---------------------------------------------------------
  professionals: [
    { id: 'dr-perez', name: 'Dr. Alejandro Pérez', specialty: 'Odontología General' },
    { id: 'dra-soto', name: 'Dra. Claudia Soto', specialty: 'Ortodoncia y Estética' }
  ],

  // ---------------------------------------------------------
  // 4. PREGUNTAS FRECUENTES (FAQs)
  // ---------------------------------------------------------
  // El bot detectará estas palabras clave (keywords) o mostrará el menú de FAQs
  faqs: [
    {
      keywords: ['ubicacion', 'direccion', 'donde'],
      question: '📍 ¿Dónde están ubicados?',
      answer: 'Estamos ubicados en Av. Principal 123, Oficina 404. Contamos con estacionamiento gratuito para pacientes.'
    },
    {
      keywords: ['precios', 'valores', 'costo'],
      question: '💵 Precios y Aranceles',
      answer: 'El valor de la evaluación inicial es de $20.000. Para tratamientos específicos, el doctor entregará un presupuesto tras la evaluación.'
    },
    {
      keywords: ['horario', 'hora', 'abren'],
      question: '⏰ Horarios de Atención',
      answer: 'Atendemos de Lunes a Viernes de 09:00 a 18:00 hrs. Sábados de 09:00 a 14:00 hrs.'
    }
  ],

  // ---------------------------------------------------------
  // 5. PLANTILLAS DE MENSAJES AUTOMÁTICOS
  // ---------------------------------------------------------
  // Aquí puedes personalizar EXACTAMENTE lo que el bot responde en cada etapa.
  messages: {
    // Saludo inicial y Menú principal
    welcome: (name: string) => `¡Hola! Bienvenido a *${name}*. ¿En qué te podemos ayudar hoy?\n\n` +
      `1. 📅 *Agendar una hora*\n` +
      `2. ❓ *Preguntas Frecuentes*\n` +
      `3. 👤 *Hablar con un ejecutivo*\n` +
      `4. ⚙️ *Gestionar mis citas*`,

    // Flujo de agendamiento
    askProfessional: '👨‍⚕️ ¿Con qué profesional deseas agendar?\nElige un número de la lista:\n',
    askDate: '📅 ¿Para qué día deseas agendar?\nIngresa el número de la opción que prefieras:\n',
    askTime: '⏰ ¿En qué horario te acomoda?\nSelecciona uno de los horarios disponibles:\n',
    askName: '📝 Para registrar tu cita, por favor escribe tu *Nombre y Apellido*:',
    askRut: '🪪 Gracias. Ahora, por favor ingresa tu *RUT o Documento de Identidad*:',
    
    // Confirmación
    confirmAppointment: (date: string, time: string, prof: string) => 
      `✅ ¡Perfecto! Tu cita ha sido agendada con éxito.\n\n` +
      `📅 Fecha: ${date}\n` +
      `⏰ Hora: ${time}\n` +
      `👨‍⚕️ Especialista: ${prof}\n\n` +
      `Si necesitas cambiarla, escribe la palabra "Menú".`,

    // Recordatorios (Ejecutados por el Scheduler)
    reminder: (patient: string, date: string, time: string, prof: string) => 
      `🔔 *Recordatorio de Cita*\n\n` +
      `Hola ${patient}, te recordamos que tienes una cita reservada para mañana *${date}* a las *${time}* con ${prof}.\n\n` +
      `Para cancelar o reagendar, escribe "Menú". ¡Te esperamos!`,

    // Derivación a Humano y Pausa
    handoverRequested: `👤 *Contacto Ejecutivo*\n\nHe notificado a nuestro equipo. Un humano se comunicará contigo a la brevedad.\n\n*(Escribe "Menú" si deseas volver a hablar con el bot).*`,
    botPaused: `⏸️ Bot en pausa. El ejecutivo ha tomado el control.`,
    botResumed: `▶️ Bot reactivado. Modos automáticos listos.`,

    // Errores y validaciones
    invalidOption: '⚠️ Opción no válida. Por favor, ingresa solo el número de la opción que deseas.',
    noSlotsAvailable: 'Lo siento, no quedan horarios disponibles para este día. Por favor elige otro.',
    calendarError: '❌ Hubo un error al conectar con la agenda. Por favor, intenta de nuevo en unos minutos o pide hablar con un ejecutivo.',
    
    // Gestión de citas
    noAppointmentsToManage: 'No tienes citas pendientes para gestionar en este momento.',
    manageAppointmentsList: '📅 *Tus citas vigentes:*\n\nSelecciona el número de la cita que deseas Cancelar/Reagendar, o escribe *menu* para salir:\n',
    appointmentManagedSuccess: '✅ Tu cita ha sido cancelada exitosamente.',
  }
};
