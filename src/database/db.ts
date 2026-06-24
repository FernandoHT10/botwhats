import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Asegurarse de que el directorio 'data' exista
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bot_database.db');
const db = new Database(dbPath);

// Inicializar base de datos ejecutando schema.sql si es necesario
function initializeDatabase() {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schemaSql);
      console.log('✅ Base de datos SQLite inicializada correctamente.');
    } else {
      console.warn('⚠️ No se encontró el archivo schema.sql en src/database/. Se asume que la base de datos ya existe.');
    }
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
  }
}

// Inicializar la base de datos de inmediato
initializeDatabase();

export default db;
export { db };
