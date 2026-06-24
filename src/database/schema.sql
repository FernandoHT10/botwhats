-- Esquema SQLite para Bot de WhatsApp Open Source (Single Tenant)

CREATE TABLE IF NOT EXISTS sessions (
  patient_phone TEXT PRIMARY KEY,          -- Número del paciente (remitente en WhatsApp)
  current_state TEXT NOT NULL DEFAULT 'idle', -- Estado actual en la máquina de estados
  context_data TEXT,                       -- Datos temporales del flujo en JSON
  updated_at INTEGER NOT NULL              -- Timestamp Unix de última actividad
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_phone TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  professional_id TEXT,                    -- Relacionado al config.ts
  appointment_date TEXT NOT NULL,          -- YYYY-MM-DD
  appointment_time TEXT NOT NULL,          -- HH:MM
  google_event_id TEXT,                    -- ID del evento creado en Google Calendar
  reminder_sent INTEGER DEFAULT 0,         -- 0 = no enviado, 1 = enviado
  created_at INTEGER NOT NULL
);
