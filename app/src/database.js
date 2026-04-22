const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'whatsapp_auto',
    user: process.env.POSTGRES_USER || 'whatsapp',
    password: process.env.POSTGRES_PASSWORD || 'cambia_esta_password_segura',
    max: 10
});

/**
 * Verificar conexión a la base de datos
 */
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        console.log('✅ Conexión a PostgreSQL establecida');
    } finally {
        client.release();
    }
}

// ── Contactos ──────────────────────────────────────────

/**
 * Obtener o crear un contacto por número de teléfono
 */
async function getOrCreateContact(phone, name = null) {
    // Intentar encontrar existente
    let result = await pool.query(
        'SELECT * FROM contacts WHERE phone = $1',
        [phone]
    );

    if (result.rows.length > 0) {
        // Actualizar last_seen y nombre si cambió
        await pool.query(
            `UPDATE contacts SET 
                last_seen = NOW(), 
                total_messages = total_messages + 1,
                name = COALESCE($2, name)
             WHERE phone = $1`,
            [phone, name]
        );
        return result.rows[0];
    }

    // Crear nuevo contacto
    result = await pool.query(
        `INSERT INTO contacts (phone, name) 
         VALUES ($1, $2) 
         RETURNING *`,
        [phone, name]
    );
    console.log(`👤 Nuevo contacto: ${name || phone}`);
    return result.rows[0];
}

/**
 * Verificar si la IA está habilitada para un contacto
 */
async function isAIEnabled(contactId) {
    const result = await pool.query(
        'SELECT ai_enabled FROM contacts WHERE id = $1',
        [contactId]
    );
    if (result.rows.length === 0) return true;
    return result.rows[0].ai_enabled;
}

/**
 * Activar/desactivar IA para un contacto
 */
async function setAIEnabled(contactId, enabled) {
    await pool.query(
        'UPDATE contacts SET ai_enabled = $2 WHERE id = $1',
        [contactId, enabled]
    );
}

// ── Conversaciones ─────────────────────────────────────

/**
 * Obtener o crear una conversación activa para un contacto
 * (Una conversación se considera activa si el último mensaje fue hace menos de 24h)
 */
async function getOrCreateConversation(contactId) {
    const result = await pool.query(
        `SELECT * FROM conversations 
         WHERE contact_id = $1 
           AND status = 'active'
           AND last_message_at > NOW() - INTERVAL '24 hours'
         ORDER BY last_message_at DESC
         LIMIT 1`,
        [contactId]
    );

    if (result.rows.length > 0) {
        await pool.query(
            'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
            [result.rows[0].id]
        );
        return result.rows[0];
    }

    // Crear nueva conversación
    const newConv = await pool.query(
        'INSERT INTO conversations (contact_id) VALUES ($1) RETURNING *',
        [contactId]
    );
    return newConv.rows[0];
}

// ── Mensajes ───────────────────────────────────────────

/**
 * Guardar un mensaje (entrante o saliente)
 */
async function saveMessage(conversationId, contactId, waMessageId, direction, content, options = {}) {
    try {
        const result = await pool.query(
            `INSERT INTO messages (conversation_id, contact_id, wa_message_id, direction, content, message_type, ai_generated)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (wa_message_id) DO NOTHING
             RETURNING *`,
            [
                conversationId,
                contactId,
                waMessageId,
                direction,
                content,
                options.type || 'text',
                options.aiGenerated || false
            ]
        );
        return result.rows[0];
    } catch (err) {
        // Ignorar duplicados silenciosamente
        if (err.code === '23505') return null;
        throw err;
    }
}

/**
 * Obtener historial reciente de una conversación (para contexto de IA)
 */
async function getConversationHistory(contactId, limit = 20) {
    const result = await pool.query(
        `SELECT direction, content, created_at 
         FROM messages 
         WHERE contact_id = $1
         ORDER BY created_at DESC 
         LIMIT $2`,
        [contactId, limit]
    );
    // Invertir para orden cronológico
    return result.rows.reverse();
}

/**
 * Verificar si un mensaje ya fue procesado (anti-duplicados)
 */
async function isMessageProcessed(waMessageId) {
    const result = await pool.query(
        'SELECT id FROM messages WHERE wa_message_id = $1',
        [waMessageId]
    );
    return result.rows.length > 0;
}

// ── Settings ───────────────────────────────────────────

/**
 * Obtener una configuración
 */
async function getSetting(key) {
    const result = await pool.query(
        'SELECT value FROM settings WHERE key = $1',
        [key]
    );
    return result.rows.length > 0 ? result.rows[0].value : null;
}

/**
 * Establecer una configuración
 */
async function setSetting(key, value) {
    await pool.query(
        `INSERT INTO settings (key, value, updated_at) 
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
    );
}

// ── Admin Queries ──────────────────────────────────────

/**
 * Obtener todas las conversaciones recientes con info del contacto
 */
async function getRecentConversations(limit = 50) {
    const result = await pool.query(
        `SELECT c.*, 
                ct.phone, ct.name, ct.ai_enabled,
                m.content as last_message,
                m.direction as last_direction
         FROM conversations c
         JOIN contacts ct ON c.contact_id = ct.id
         LEFT JOIN LATERAL (
             SELECT content, direction FROM messages 
             WHERE conversation_id = c.id 
             ORDER BY created_at DESC LIMIT 1
         ) m ON true
         ORDER BY c.last_message_at DESC
         LIMIT $1`,
        [limit]
    );
    return result.rows;
}

/**
 * Obtener mensajes de una conversación
 */
async function getConversationMessages(conversationId) {
    const result = await pool.query(
        `SELECT * FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`,
        [conversationId]
    );
    return result.rows;
}

/**
 * Obtener estadísticas generales
 */
async function getStats() {
    const result = await pool.query(`
        SELECT 
            (SELECT COUNT(*) FROM contacts) as total_contacts,
            (SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours') as messages_today,
            (SELECT COUNT(*) FROM messages WHERE direction = 'incoming' AND created_at > NOW() - INTERVAL '24 hours') as incoming_today,
            (SELECT COUNT(*) FROM messages WHERE direction = 'outgoing' AND created_at > NOW() - INTERVAL '24 hours') as outgoing_today,
            (SELECT COUNT(*) FROM messages WHERE ai_generated = true AND created_at > NOW() - INTERVAL '24 hours') as ai_responses_today,
            (SELECT COUNT(*) FROM conversations WHERE status = 'active') as active_conversations
    `);
    return result.rows[0];
}

/**
 * Obtener todos los contactos
 */
async function getAllContacts() {
    const result = await pool.query(
        'SELECT * FROM contacts ORDER BY last_seen DESC'
    );
    return result.rows;
}

// ── Conversation State (Sales Funnel) ──────────────────

/**
 * Obtener estado actual de la conversación
 */
async function getConversationState(conversationId) {
    const result = await pool.query(
        'SELECT conversation_state, selected_product FROM conversations WHERE id = $1',
        [conversationId]
    );
    if (result.rows.length === 0) return { state: 'new', product: null };
    return {
        state: result.rows[0].conversation_state || 'new',
        product: result.rows[0].selected_product
    };
}

/**
 * Actualizar estado de la conversación
 */
async function updateConversationState(conversationId, state, product = null) {
    if (product !== null) {
        await pool.query(
            'UPDATE conversations SET conversation_state = $2, selected_product = $3 WHERE id = $1',
            [conversationId, state, product]
        );
    } else {
        await pool.query(
            'UPDATE conversations SET conversation_state = $2 WHERE id = $1',
            [conversationId, state]
        );
    }
}

module.exports = {
    pool,
    initDatabase,
    getOrCreateContact,
    isAIEnabled,
    setAIEnabled,
    getOrCreateConversation,
    saveMessage,
    getConversationHistory,
    isMessageProcessed,
    getSetting,
    setSetting,
    getRecentConversations,
    getConversationMessages,
    getStats,
    getAllContacts,
    getConversationState,
    updateConversationState
};
