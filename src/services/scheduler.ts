import { db } from '../database/db.js';
import { WhatsAppProvider } from '../providers/whatsapp.js';
import { botConfig } from '../config.js';

export function startScheduler(provider: WhatsAppProvider) {
  console.log('⏰ Iniciando servicio de recordatorios automáticos (ejecución cada hora)...');

  const runReminders = async () => {
    try {
      console.log('⏰ Ejecutando revisión de recordatorios automáticos...');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const appointments = db.prepare(`
        SELECT id, patient_phone, patient_name, appointment_date, appointment_time, professional_id
        FROM appointments
        WHERE appointment_date = ? AND reminder_sent = 0
      `).all(dateStr) as any[];

      if (appointments.length === 0) {
        return;
      }

      console.log(`⏰ Se encontraron ${appointments.length} recordatorios pendientes para enviar.`);

      for (const app of appointments) {
        // Buscar nombre del profesional en el config
        const prof = botConfig.professionals.find(p => p.id === app.professional_id);
        const profName = prof ? prof.name : 'nuestro especialista';

        const text = botConfig.messages.reminder(app.patient_name, app.appointment_date, app.appointment_time, profName);

        await provider.sendMessage(app.patient_phone, text);

        db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?').run(app.id);
        console.log(`✅ Recordatorio enviado a ${app.patient_phone} (Cita ID: ${app.id})`);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error('❌ Error en el servicio de recordatorios:', error);
    }
  };

  setTimeout(runReminders, 15000);
  setInterval(runReminders, 60 * 60 * 1000);
}
