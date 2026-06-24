import { WASocket } from '@whiskeysockets/baileys';
import { db } from '../database/db.js';
import { getSession, saveSession, resetSession, SessionData } from './session.js';
import { CalendarService } from '../services/calendar.js';
import { botConfig } from '../config.js';

function getNextWorkingDays(count: number): Array<{ dateStr: string; friendlyStr: string }> {
  const days: Array<{ dateStr: string; friendlyStr: string }> = [];
  let current = new Date();
  
  const formatter = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: botConfig.timezone
  });

  while (days.length < count) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0) continue;

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    let friendlyStr = formatter.format(current);
    friendlyStr = friendlyStr.charAt(0).toUpperCase() + friendlyStr.slice(1);
    days.push({ dateStr, friendlyStr });
  }
  return days;
}

function formatDateFriendly(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: botConfig.timezone
  });
  let friendlyStr = formatter.format(dateObj);
  return friendlyStr.charAt(0).toUpperCase() + friendlyStr.slice(1);
}

export function getMessageText(msg: any): string {
  if (!msg.message) return '';
  let message = msg.message;
  if (message.ephemeralMessage) message = message.ephemeralMessage.message;
  if (message.viewOnceMessage) message = message.viewOnceMessage.message;
  if (message.viewOnceMessageV2) message = message.viewOnceMessageV2.message;
  
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ''
  ).trim();
}

export async function handleIncomingMessage(socket: WASocket, msg: any) {
  const senderJid = msg.key.remoteJid;
  if (!senderJid) return;
  const phone = senderJid.split('@')[0];
  const text = getMessageText(msg);

  const textClean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let session = getSession(phone);

  if (msg.key.fromMe) {
    const fromMeText = text.trim();
    if (fromMeText === '0') {
      session.currentState = 'paused';
      saveSession(session);
      await socket.sendMessage(senderJid, { text: botConfig.messages.botPaused });
      return;
    } else if (fromMeText === '1') {
      session.currentState = 'idle';
      saveSession(session);
      await socket.sendMessage(senderJid, { text: botConfig.messages.botResumed });
      return;
    }
    return;
  }

  if (session.currentState !== 'idle' && session.updatedAt) {
    const now = Math.floor(Date.now() / 1000);
    if (now - session.updatedAt > 3600) {
      resetSession(phone);
      session = getSession(phone);
    }
  }

  if (session.currentState === 'paused') return;

  const sendReply = async (responseText: string) => {
    await socket.sendMessage(senderJid, { text: responseText });
  };

  if (textClean === 'menu' || textClean === 'reiniciar' || textClean === 'inicio' || (textClean === 'cancelar' && session.currentState !== 'idle')) {
    resetSession(phone);
    await sendReply(`🔄 Conversación reiniciada.\n\n` + botConfig.messages.welcome(botConfig.businessName));
    return;
  }

  switch (session.currentState) {
    case 'idle': {
      if (text === '1') {
        const professionals = botConfig.professionals;
        if (professionals.length === 0) {
          await sendReply('⚠️ Por el momento no hay profesionales registrados. Por favor, escribe *menu* para volver.');
          return;
        }

        session.currentState = 'booking_professional';
        session.contextData.professionalsList = professionals.map(p => ({ id: p.id, name: p.name }));

        let professionalMenu = botConfig.messages.askProfessional;
        professionals.forEach((p, idx) => {
          professionalMenu += `${idx + 1}. *${p.name}* (${p.specialty})\n`;
        });
        professionalMenu += `\nEscribe el número correspondiente o escribe *cancelar*.`;

        saveSession(session);
        await sendReply(professionalMenu);
      } 
      else if (text === '2') {
        const faqs = botConfig.faqs;
        if (faqs.length === 0) {
          await sendReply('⚠️ No hay preguntas frecuentes configuradas. Escribe *menu* para volver.');
          return;
        }

        session.currentState = 'faqs_menu';
        let faqMenu = '❓ *Preguntas Frecuentes*\nSelecciona el número del tema de tu interés:\n\n';
        faqs.forEach((f, idx) => {
          faqMenu += `${idx + 1}. *${f.question}*\n`;
        });
        faqMenu += `\nEscribe el número correspondiente o escribe *menu* para volver al menú principal.`;

        saveSession(session);
        await sendReply(faqMenu);
      } 
      else if (text === '3') {
        session.currentState = 'paused';
        saveSession(session);
        await sendReply(botConfig.messages.handoverRequested);
      }  
      else if (text === '4' || textClean === 'cancelar' || textClean === 'cancelar cita' || textClean === 'anular cita') {
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: botConfig.timezone });
        
        const appointments = db.prepare(`
          SELECT a.id, a.appointment_date, a.appointment_time, a.google_event_id, a.patient_name, a.patient_phone, a.professional_id
          FROM appointments a
          WHERE a.patient_phone = ? AND a.appointment_date >= ?
          ORDER BY a.appointment_date ASC, a.appointment_time ASC
        `).all(phone, todayStr) as any[];

        if (appointments.length === 0) {
          await sendReply(botConfig.messages.noAppointmentsToManage + `\n\nEscribe *menu* para volver al menú principal.`);
          return;
        }

        session.currentState = 'manage_select';
        session.contextData.appointmentsList = appointments.map(a => {
          const prof = botConfig.professionals.find(p => p.id === a.professional_id);
          return {
            id: a.id,
            date: a.appointment_date,
            time: a.appointment_time,
            googleEventId: a.google_event_id,
            patientName: a.patient_name,
            professionalName: prof ? prof.name : 'Profesional',
            professionalId: a.professional_id
          };
        });

        let appointmentsMenu = botConfig.messages.manageAppointmentsList;
        session.contextData.appointmentsList.forEach((a: any, idx: number) => {
          const friendlyDate = formatDateFriendly(a.date);
          appointmentsMenu += `${idx + 1}. *${a.professionalName}* - ${friendlyDate} a las *${a.time} hrs*\n`;
        });

        saveSession(session);
        await sendReply(appointmentsMenu);
      }
      else {
        await sendReply(botConfig.messages.welcome(botConfig.businessName));
      }
      break;
    }

    case 'faqs_menu': {
      const index = parseInt(text) - 1;
      if (!isNaN(index) && index >= 0 && index < botConfig.faqs.length) {
        const faq = botConfig.faqs[index];
        await sendReply(`*${faq.question}*\n\n${faq.answer}\n\n¿Tienes otra consulta? Selecciona otro número o escribe *menu* para volver al menú principal.`);
      } else {
        const matchingFaq = botConfig.faqs.find(f => 
          f.keywords.some(k => textClean.includes(k.toLowerCase())) || 
          f.answer.toLowerCase().includes(textClean)
        );

        if (matchingFaq) {
          await sendReply(`*${matchingFaq.question}*\n\n${matchingFaq.answer}\n\nEscribe *menu* para regresar al menú principal.`);
        } else {
          await sendReply(botConfig.messages.invalidOption);
        }
      }
      break;
    }

    case 'booking_professional': {
      const pList = session.contextData.professionalsList;
      const index = parseInt(text) - 1;

      if (pList && !isNaN(index) && index >= 0 && index < pList.length) {
        const selected = pList[index];
        session.contextData.professionalId = selected.id;
        session.contextData.professionalName = selected.name;

        const nextDays = getNextWorkingDays(5);
        session.contextData.datesList = nextDays;
        session.currentState = 'booking_date';

        let dateMenu = `📅 *Has seleccionado a ${selected.name}*\n\n` + botConfig.messages.askDate;
        nextDays.forEach((d, idx) => {
          dateMenu += `${idx + 1}. *${d.friendlyStr}*\n`;
        });

        saveSession(session);
        await sendReply(dateMenu);
      } else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'booking_date': {
      const dList = session.contextData.datesList;
      const index = parseInt(text) - 1;

      if (dList && !isNaN(index) && index >= 0 && index < dList.length) {
        const selectedDate = dList[index];
        session.contextData.date = selectedDate.dateStr;
        session.contextData.dateFriendly = selectedDate.friendlyStr;

        await sendReply('🔍 Buscando horas disponibles para esa fecha en tiempo real, espera un momento...');

        try {
          const slots = await CalendarService.getAvailableSlots(botConfig.googleCalendarId, selectedDate.dateStr);

          if (slots.length === 0) {
            await sendReply(botConfig.messages.noSlotsAvailable);
            return;
          }

          session.contextData.availableSlots = slots;
          session.currentState = 'booking_time';

          let timeMenu = botConfig.messages.askTime;
          slots.forEach((s, idx) => {
            timeMenu += `${idx + 1}. *${s} hrs*\n`;
          });

          saveSession(session);
          await sendReply(timeMenu);

        } catch (error) {
          await sendReply(botConfig.messages.calendarError);
        }
      } else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'booking_time': {
      const slots = session.contextData.availableSlots;
      const index = parseInt(text) - 1;

      if (slots && !isNaN(index) && index >= 0 && index < slots.length) {
        session.contextData.time = slots[index];
        session.currentState = 'booking_name';
        saveSession(session);
        await sendReply(`📝 Excelente. Has elegido las *${slots[index]} hrs*.\n\n` + botConfig.messages.askName);
      } else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'booking_name': {
      if (text.length < 3) {
        await sendReply('⚠️ ' + botConfig.messages.askName);
        return;
      }
      session.contextData.patientName = text;
      session.currentState = 'booking_rut';
      saveSession(session);
      await sendReply(botConfig.messages.askRut);
      break;
    }

    case 'booking_rut': {
      if (text.length < 7) {
        await sendReply('⚠️ ' + botConfig.messages.askRut);
        return;
      }
      session.contextData.patientRut = text;
      session.currentState = 'booking_confirm';

      const summary = `✍️ *Confirmación de Cita:*\n\n` +
        `👨‍⚕️ *Profesional:* ${session.contextData.professionalName}\n` +
        `📅 *Fecha:* ${session.contextData.dateFriendly}\n` +
        `⏰ *Hora:* ${session.contextData.time} hrs\n` +
        `👤 *Paciente:* ${session.contextData.patientName}\n` +
        `🪪 *RUT:* ${session.contextData.patientRut}\n\n` +
        `¿Deseas confirmar la reserva?\n1. *Sí, confirmar cita*\n2. *No, cancelar*`;

      saveSession(session);
      await sendReply(summary);
      break;
    }

    case 'booking_confirm': {
      if (text === '1') {
        await sendReply('⏳ Registrando tu hora médica en nuestro sistema... Por favor, no cierres este chat.');
        try {
          const eventId = await CalendarService.createAppointmentEvent(
            botConfig.googleCalendarId,
            {
              patientName: session.contextData.patientName!,
              patientPhone: phone,
              patientRut: session.contextData.patientRut!,
              professionalName: session.contextData.professionalName!,
              dateStr: session.contextData.date!,
              timeStr: session.contextData.time!
            }
          );

          db.prepare(`
            INSERT INTO appointments (patient_phone, patient_name, professional_id, appointment_date, appointment_time, google_event_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            phone,
            session.contextData.patientName,
            session.contextData.professionalId,
            session.contextData.date,
            session.contextData.time,
            eventId,
            Math.floor(Date.now() / 1000)
          );

          resetSession(phone);
          await sendReply(botConfig.messages.confirmAppointment(session.contextData.dateFriendly!, `${session.contextData.time} hrs`, session.contextData.professionalName!));
        } catch (error) {
          await sendReply(botConfig.messages.calendarError);
          resetSession(phone);
        }
      } 
      else if (text === '2') {
        resetSession(phone);
        await sendReply('❌ Reserva cancelada.\n\n' + botConfig.messages.welcome(botConfig.businessName));
      } 
      else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'manage_select': {
      const appList = session.contextData.appointmentsList;
      const index = parseInt(text) - 1;

      if (appList && !isNaN(index) && index >= 0 && index < appList.length) {
        const selected = appList[index];
        session.contextData.selectedAppointment = selected;
        session.currentState = 'manage_action';

        saveSession(session);
        await sendReply(
          `Has seleccionado tu cita:\n\n` +
          `👨‍⚕️ *Profesional:* ${selected.professionalName}\n` +
          `📅 *Fecha:* ${formatDateFriendly(selected.date)}\n` +
          `⏰ *Hora:* ${selected.time} hrs\n\n` +
          `¿Qué deseas hacer con esta cita?\n1. ❌ *Cancelar la cita*\n2. 🔄 *Reagendar la cita*\n3. 🔙 *Volver al menú*`
        );
      } else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'manage_action': {
      const selected = session.contextData.selectedAppointment;
      if (!selected) { resetSession(phone); return; }

      if (text === '1') {
        session.currentState = 'manage_cancel_confirm';
        saveSession(session);
        await sendReply(`⚠️ ¿Estás seguro que deseas cancelar tu cita? Esta acción no se puede deshacer.\n\n1. *Sí, cancelar cita*\n2. *No, mantener cita*`);
      }
      else if (text === '2') {
        const nextDays = getNextWorkingDays(5);
        session.contextData.datesList = nextDays;
        session.currentState = 'reschedule_date';

        let dateMenu = `📅 *Reagendamiento de cita con ${selected.professionalName}*\n\n` + botConfig.messages.askDate;
        nextDays.forEach((d, idx) => {
          dateMenu += `${idx + 1}. *${d.friendlyStr}*\n`;
        });
        saveSession(session);
        await sendReply(dateMenu);
      }
      else if (text === '3') {
        resetSession(phone);
        await sendReply(botConfig.messages.welcome(botConfig.businessName));
      }
      else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'manage_cancel_confirm': {
      const selected = session.contextData.selectedAppointment;
      if (!selected) { resetSession(phone); return; }

      if (text === '1') {
        await sendReply('⏳ Procesando cancelación... Por favor, no cierres este chat.');
        try {
          if (selected.googleEventId) {
            await CalendarService.deleteAppointmentEvent(botConfig.googleCalendarId, selected.googleEventId);
          }
          db.prepare('DELETE FROM appointments WHERE id = ?').run(selected.id);

          resetSession(phone);
          await sendReply(botConfig.messages.appointmentManagedSuccess);
        } catch (error) {
          await sendReply(botConfig.messages.calendarError);
          resetSession(phone);
        }
      }
      else if (text === '2') {
        resetSession(phone);
        await sendReply('Cita mantenida.\n\n' + botConfig.messages.welcome(botConfig.businessName));
      }
      break;
    }

    case 'reschedule_date': {
      const selected = session.contextData.selectedAppointment;
      const dList = session.contextData.datesList;
      const index = parseInt(text) - 1;

      if (!selected) { resetSession(phone); return; }

      if (dList && !isNaN(index) && index >= 0 && index < dList.length) {
        const selectedDate = dList[index];
        session.contextData.newDate = selectedDate.dateStr;
        session.contextData.newDateFriendly = selectedDate.friendlyStr;

        await sendReply('🔍 Buscando horas disponibles para esa nueva fecha...');
        try {
          const slots = await CalendarService.getAvailableSlots(botConfig.googleCalendarId, selectedDate.dateStr);
          if (slots.length === 0) {
            await sendReply(botConfig.messages.noSlotsAvailable);
            return;
          }

          session.contextData.availableSlots = slots;
          session.currentState = 'reschedule_time';

          let timeMenu = botConfig.messages.askTime;
          slots.forEach((s, idx) => {
            timeMenu += `${idx + 1}. *${s} hrs*\n`;
          });
          saveSession(session);
          await sendReply(timeMenu);
        } catch (error) {
          await sendReply(botConfig.messages.calendarError);
        }
      } else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'reschedule_time': {
      const selected = session.contextData.selectedAppointment;
      const slots = session.contextData.availableSlots;
      const index = parseInt(text) - 1;

      if (!selected) { resetSession(phone); return; }

      if (slots && !isNaN(index) && index >= 0 && index < slots.length) {
        session.contextData.newTime = slots[index];
        session.currentState = 'reschedule_confirm';
        saveSession(session);
        await sendReply(
          `🔄 *Confirmación de Reagendamiento:*\n\n` +
          `📅 *Nueva Fecha:* ${session.contextData.newDateFriendly}\n` +
          `⏰ *Nueva Hora:* ${slots[index]} hrs\n\n` +
          `¿Confirmas el cambio de tu cita? (Se cancelará la anterior)\n1. *Sí*\n2. *No*`
        );
      } else {
        await sendReply(botConfig.messages.invalidOption);
      }
      break;
    }

    case 'reschedule_confirm': {
      const selected = session.contextData.selectedAppointment;
      if (!selected) { resetSession(phone); return; }

      if (text === '1') {
        await sendReply('⏳ Registrando el cambio en nuestro sistema...');
        try {
          if (selected.googleEventId) {
            await CalendarService.deleteAppointmentEvent(botConfig.googleCalendarId, selected.googleEventId);
          }
          let patientRut = selected.patientRut;
          if (!patientRut) {
            const dbApp = db.prepare('SELECT patient_phone FROM appointments WHERE id = ?').get(selected.id) as any;
            patientRut = dbApp ? dbApp.patient_phone : '';
          }

          const newEventId = await CalendarService.createAppointmentEvent(
            botConfig.googleCalendarId,
            {
              patientName: selected.patientName,
              patientPhone: phone,
              patientRut: patientRut || '',
              professionalName: selected.professionalName,
              dateStr: session.contextData.newDate!,
              timeStr: session.contextData.newTime!
            }
          );

          db.prepare(`
            UPDATE appointments
            SET appointment_date = ?, appointment_time = ?, google_event_id = ?, created_at = ?
            WHERE id = ?
          `).run(session.contextData.newDate, session.contextData.newTime, newEventId, Math.floor(Date.now() / 1000), selected.id);

          resetSession(phone);
          await sendReply(`✅ *¡Cita Reagendada Exitosamente!*\nNueva hora: ${session.contextData.newDateFriendly} a las ${session.contextData.newTime} hrs.`);
        } catch (error) {
          await sendReply(botConfig.messages.calendarError);
          resetSession(phone);
        }
      }
      else if (text === '2') {
        resetSession(phone);
        await sendReply('Reagendamiento cancelado.\n\n' + botConfig.messages.welcome(botConfig.businessName));
      }
      break;
    }

    default: {
      resetSession(phone);
      break;
    }
  }
}
