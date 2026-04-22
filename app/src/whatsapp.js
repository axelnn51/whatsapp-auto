const axios = require('axios');

const API_URL = 'https://graph.facebook.com/v21.0';
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const api = axios.create({
    baseURL: `${API_URL}/${PHONE_ID}`,
    headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 30000
});

/**
 * Enviar mensaje de texto a un número
 */
async function sendMessage(to, text) {
    try {
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: text }
        });
        console.log(`📤 Mensaje enviado a ${to}: "${text.substring(0, 50)}..."`);
        return response.data;
    } catch (err) {
        console.error('❌ Error enviando mensaje:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Marcar mensaje como leído (double blue check)
 */
async function markAsRead(messageId) {
    try {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        });
    } catch (err) {
        // No es crítico si falla
        console.warn('⚠️ No se pudo marcar como leído:', err.message);
    }
}

/**
 * Enviar indicador de "escribiendo..." (typing)
 * Nota: La Cloud API no tiene endpoint nativo de typing indicator,
 * pero marcar como leído + delay crea el efecto esperado.
 * Si Meta habilita typing indicators en el futuro, se actualizará aquí.
 */
async function sendTypingIndicator(to) {
    // Actualmente la Cloud API no soporta typing indicators directamente.
    // El efecto se logra con: mark_as_read → delay → send_message
    // Lo cual ya se maneja en el humanizer.
    // Este método existe como placeholder para futura compatibilidad.
    return true;
}

/**
 * Enviar mensaje de reacción (emoji)
 */
async function sendReaction(to, messageId, emoji) {
    try {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: to,
            type: 'reaction',
            reaction: {
                message_id: messageId,
                emoji: emoji
            }
        });
    } catch (err) {
        console.warn('⚠️ No se pudo enviar reacción:', err.message);
    }
}

module.exports = { sendMessage, markAsRead, sendTypingIndicator, sendReaction };
