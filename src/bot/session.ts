import { db } from '../database/db.js';

export interface SessionData {
  patientPhone: string;
  currentState: string;
  contextData: {
    patientName?: string;
    patientRut?: string;
    professionalId?: string;
    professionalName?: string;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:MM
    [key: string]: any;
  };
  updatedAt?: number;
}

/**
 * Obtiene o inicializa la sesión de un paciente
 */
export function getSession(patientPhone: string): SessionData {
  const row = db.prepare(`
    SELECT current_state, context_data, updated_at 
    FROM sessions 
    WHERE patient_phone = ?
  `).get(patientPhone) as { current_state: string; context_data: string; updated_at: number } | undefined;

  if (!row) {
    return {
      patientPhone,
      currentState: 'idle',
      contextData: {}
    };
  }

  let context = {};
  try {
    context = row.context_data ? JSON.parse(row.context_data) : {};
  } catch (e) {
    console.error(`Error al parsear context_data para ${patientPhone}:`, e);
  }

  return {
    patientPhone,
    currentState: row.current_state,
    contextData: context,
    updatedAt: row.updated_at
  };
}

/**
 * Guarda los cambios del estado y contexto de la sesión en la base de datos
 */
export function saveSession(session: SessionData): void {
  const now = Math.floor(Date.now() / 1000);
  const contextStr = JSON.stringify(session.contextData);

  db.prepare(`
    INSERT INTO sessions (patient_phone, current_state, context_data, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(patient_phone) DO UPDATE SET
      current_state = excluded.current_state,
      context_data = excluded.context_data,
      updated_at = excluded.updated_at
  `).run(session.patientPhone, session.currentState, contextStr, now);
}

/**
 * Reinicia la sesión de un paciente
 */
export function resetSession(patientPhone: string): void {
  db.prepare(`
    DELETE FROM sessions 
    WHERE patient_phone = ?
  `).run(patientPhone);
}
