const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = '/app/backups';
const MAX_BACKUPS = 30;

/**
 * Realizar backup de la base de datos PostgreSQL
 */
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `whatsapp_auto_${timestamp}.sql.gz`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Crear directorio si no existe
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    try {
        const host = process.env.POSTGRES_HOST || 'postgres';
        const db = process.env.POSTGRES_DB || 'whatsapp_auto';
        const user = process.env.POSTGRES_USER || 'whatsapp';

        execSync(
            `PGPASSWORD="${process.env.POSTGRES_PASSWORD}" pg_dump -h ${host} -U ${user} ${db} | gzip > ${filepath}`,
            { timeout: 60000 }
        );

        console.log(`💾 Backup creado: ${filename}`);

        // Limpiar backups antiguos
        cleanOldBackups();

        return filepath;
    } catch (err) {
        console.error('❌ Error creando backup:', err.message);
        return null;
    }
}

/**
 * Eliminar backups más antiguos que MAX_BACKUPS
 */
function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.sql.gz'))
            .sort()
            .reverse();

        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            for (const file of toDelete) {
                fs.unlinkSync(path.join(BACKUP_DIR, file));
                console.log(`🗑️ Backup antiguo eliminado: ${file}`);
            }
        }
    } catch (err) {
        console.warn('⚠️ Error limpiando backups:', err.message);
    }
}

/**
 * Programar backup diario (cada 24h)
 */
function scheduleBackups() {
    // Backup inicial al arrancar (después de 5 min para que la DB esté lista)
    setTimeout(() => {
        createBackup();
    }, 5 * 60 * 1000);

    // Backup cada 24 horas
    setInterval(() => {
        createBackup();
    }, 24 * 60 * 60 * 1000);

    console.log('📅 Backups automáticos programados (cada 24h)');
}

module.exports = { createBackup, scheduleBackups };
