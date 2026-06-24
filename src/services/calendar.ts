import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Cargar credenciales de la cuenta de servicio de Google usando GoogleAuth (más robusto y compatible)
let calendarInstance: any = null;

const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH 
  ? path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
  : path.join(process.cwd(), 'google-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    calendarInstance = google.calendar({ version: 'v3', auth });
    console.log('✅ Integración de Google Calendar: Autenticación GoogleAuth cargada correctamente.');
  } catch (error) {
    console.error('❌ Error al inicializar la autenticación de Google Calendar:', error);
  }
} else {
  console.warn(`⚠️ Google Calendar: No se encontró el archivo de credenciales en '${serviceAccountPath}'.`);
  console.warn('⚠️ Se usará el modo MOCK de Google Calendar para pruebas locales.');
}

// Definición de bloques horarios estándar de la clínica
const CLINIC_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
];

/**
 * Obtiene el offset de la zona horaria de Chile (America/Santiago) para una fecha dada,
 * manejando automáticamente horario de verano (-03:00) e invierno (-04:00).
 */
function getChileOffset(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(d);
  const tzName = parts.find(p => p.type === 'timeZoneName')?.value;
  if (tzName) {
    const offsetNum = tzName.replace('GMT', '');
    if (offsetNum === '') return '+00:00';
    const sign = offsetNum.startsWith('-') ? '-' : '+';
    const num = Math.abs(parseInt(offsetNum, 10));
    return `${sign}${String(num).padStart(2, '0')}:00`;
  }
  return '-04:00';
}

export class CalendarService {
  /**
   * Obtiene los bloques de hora disponibles para una fecha específica (YYYY-MM-DD)
   */
  static async getAvailableSlots(calendarId: string, dateStr: string): Promise<string[]> {
    if (!calendarInstance) {
      console.log(`[Calendar Mock] Consultando slots libres para la fecha: ${dateStr}`);
      // Simular que algunos bloques ya están ocupados (por ejemplo, los de las 10:00 y las 15:30)
      return CLINIC_SLOTS.filter(slot => slot !== '10:00' && slot !== '15:30');
    }

    try {
      // Definir inicio y fin del día manejando el offset de Chile correctamente
      const tzOffset = getChileOffset(dateStr);
      const startOfDay = new Date(`${dateStr}T00:00:00${tzOffset}`);
      const endOfDay = new Date(`${dateStr}T23:59:59${tzOffset}`);

      // Listar eventos programados para ese día
      const response = await calendarInstance.events.list({
        calendarId: calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      console.log(`📅 Google Calendar: Se encontraron ${events.length} eventos en la fecha ${dateStr}.`);

      // Mapear los eventos ocupados (convertidos a HH:MM locales)
      const busySlots = new Set<string>();

      for (const event of events) {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        if (!start || !end) continue;

        const startDateObj = new Date(start);
        const endDateObj = new Date(end);

        // Para cada bloque del día, revisar si se traslapa con el evento
        for (const slot of CLINIC_SLOTS) {
          const tzOffset = getChileOffset(dateStr);
          const slotDateTime = new Date(`${dateStr}T${slot}:00${tzOffset}`);
          const slotEndTime = new Date(slotDateTime.getTime() + 30 * 60 * 1000); // Bloques de 30 mins

          // Hay solapamiento si:
          // El slot empieza antes de que termine el evento AND termina después de que empiece el evento
          if (slotDateTime < endDateObj && slotEndTime > startDateObj) {
            busySlots.add(slot);
          }
        }
      }

      // Filtrar y retornar solo los bloques que no están ocupados
      return CLINIC_SLOTS.filter(slot => !busySlots.has(slot));

    } catch (error) {
      console.error(`❌ Error al consultar Google Calendar para [${calendarId}]:`, error);
      // En caso de fallo de API, devolver mock para no romper el flujo conversacional del bot
      console.warn('⚠️ Retornando slots mock debido a un error de conexión con la API.');
      return CLINIC_SLOTS.filter(slot => slot !== '10:00' && slot !== '15:30');
    }
  }

  /**
   * Crea un evento en el Google Calendar correspondiente
   * Retorna el ID del evento creado
   */
  static async createAppointmentEvent(
    calendarId: string,
    appointment: {
      patientName: string;
      patientPhone: string;
      patientRut: string;
      professionalName: string;
      dateStr: string; // YYYY-MM-DD
      timeStr: string; // HH:MM
    }
  ): Promise<string> {
    const summary = `Cita Médica: ${appointment.patientName} - ${appointment.professionalName}`;
    const description = `🩺 Cita agendada por Bot de WhatsApp\n\n` +
      `👤 Paciente: ${appointment.patientName}\n` +
      `🪪 RUT: ${appointment.patientRut}\n` +
      `📞 Teléfono: ${appointment.patientPhone}\n` +
      `👨‍⚕️ Profesional: ${appointment.professionalName}`;

    const tzOffset = getChileOffset(appointment.dateStr);
    const startDateTime = new Date(`${appointment.dateStr}T${appointment.timeStr}:00${tzOffset}`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000); // 30 minutos de duración

    if (!calendarInstance) {
      console.log(`[Calendar Mock] Creando cita ficticia: "${summary}" el ${appointment.dateStr} a las ${appointment.timeStr}`);
      return `mock-event-id-${Date.now()}`;
    }

    try {
      const response = await calendarInstance.events.insert({
        calendarId: calendarId,
        requestBody: {
          summary,
          description,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'America/Santiago'
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'America/Santiago'
          }
        }
      });

      console.log(`✅ Google Calendar: Evento creado con ID: ${response.data.id}`);
      return response.data.id || `fallback-id-${Date.now()}`;
    } catch (error) {
      console.error(`❌ Error al crear evento en Google Calendar [${calendarId}]:`, error);
      throw error;
    }
  }

  /**
   * Elimina un evento de Google Calendar
   */
  static async deleteAppointmentEvent(calendarId: string, eventId: string): Promise<void> {
    if (!calendarInstance) {
      console.log(`[Calendar Mock] Eliminando cita con Event ID: ${eventId}`);
      return;
    }

    try {
      await calendarInstance.events.delete({
        calendarId,
        eventId
      });
      console.log(`✅ Google Calendar: Evento con ID ${eventId} eliminado correctamente.`);
    } catch (error: any) {
      // Si el evento ya fue borrado en Google Calendar manualmente, responde con 410 o 404.
      if (error.code === 410 || error.code === 404) {
        console.warn(`⚠️ Google Calendar: El evento ${eventId} ya no existe en el calendario.`);
      } else {
        console.error(`❌ Error al eliminar evento en Google Calendar [${calendarId}]:`, error);
        throw error;
      }
    }
  }
}
