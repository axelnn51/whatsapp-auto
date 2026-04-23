const axios = require('axios');

const API_URL = 'https://graph.facebook.com/v25.0';
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
 * Usa el endpoint oficial de Meta para mostrar el bubble de escritura.
 * Requiere el message_id del mensaje recibido del usuario.
 */
async function sendTypingIndicator(messageId) {
    try {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
            typing_indicator: {
                type: 'text'
            }
        });
        console.log('✍️ Indicador de escritura enviado');
    } catch (err) {
        // No es crítico si falla — continuar sin typing
        console.warn('⚠️ No se pudo enviar typing indicator:', err.response?.data?.error?.message || err.message);
    }
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
