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
 * Enviar mensaje de texto simple
 */
async function sendMessage(to, text) {
    try {
        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: { body: text }
        });
        console.log(`📤 Texto enviado a ${to}`);
        return response.data;
    } catch (err) {
        console.error('❌ Error enviando mensaje:', err.response?.data?.error?.message || err.message);
        throw err;
    }
}

/**
 * Enviar mensaje con botones interactivos (máximo 3 botones)
 */
async function sendButtons(to, bodyText, buttons, headerText, footerText) {
    try {
        const interactive = {
            type: 'button',
            body: { text: bodyText },
            action: {
                buttons: buttons.map(btn => ({
                    type: 'reply',
                    reply: {
                        id: btn.id,
                        title: btn.title.substring(0, 20) // max 20 chars
                    }
                }))
            }
        };
        if (headerText) interactive.header = { type: 'text', text: headerText };
        if (footerText) interactive.footer = { text: footerText };

        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: to,
            type: 'interactive',
            interactive: interactive
        });
        console.log(`📤 Botones enviados a ${to}`);
        return response.data;
    } catch (err) {
        console.error('❌ Error enviando botones:', err.response?.data?.error?.message || err.message);
        throw err;
    }
}

/**
 * Enviar lista interactiva (hasta 10 opciones por sección)
 */
async function sendList(to, bodyText, buttonLabel, sections, headerText, footerText) {
    try {
        const interactive = {
            type: 'list',
            body: { text: bodyText },
            action: {
                button: buttonLabel.substring(0, 20),
                sections: sections.map(section => ({
                    title: section.title.substring(0, 24),
                    rows: section.rows.map(row => ({
                        id: row.id,
                        title: row.title.substring(0, 24),
                        description: (row.description || '').substring(0, 72)
                    }))
                }))
            }
        };
        if (headerText) interactive.header = { type: 'text', text: headerText };
        if (footerText) interactive.footer = { text: footerText };

        const response = await api.post('/messages', {
            messaging_product: 'whatsapp',
            to: to,
            type: 'interactive',
            interactive: interactive
        });
        console.log(`📤 Lista enviada a ${to}`);
        return response.data;
    } catch (err) {
        console.error('❌ Error enviando lista:', err.response?.data?.error?.message || err.message);
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
        console.warn('⚠️ No se pudo marcar como leído:', err.message);
    }
}

/**
 * Enviar indicador de "escribiendo..."
 */
async function sendTypingIndicator(messageId) {
    try {
        await api.post('/messages', {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
            typing_indicator: { type: 'text' }
        });
    } catch (err) {
        // No crítico — silenciar
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

module.exports = { sendMessage, sendButtons, sendList, markAsRead, sendTypingIndicator, sendReaction };
