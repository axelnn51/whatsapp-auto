const { sendMessage, sendButtons, sendList, markAsRead, sendTypingIndicator } = require('./whatsapp');
const { generateResponse } = require('./ai/engine');
const {
    delayBeforeSend,
    delayBetweenSplitMessages
} = require('./humanizer');
const {
    getOrCreateContact,
    isAIEnabled,
    getOrCreateConversation,
    saveMessage,
    getConversationHistory,
    isMessageProcessed,
    getSetting,
    updateConversationState,
    setAIEnabled
} = require('./database');

const processingMessages = new Set();
const lastMessageTime = new Map();
const FLOOD_COOLDOWN_MS = 3000;

/**
 * Enviar un mensaje individual (texto, botones o lista)
 */
async function sendSingleMessage(to, msg) {
    if (typeof msg === 'string') {
        return await sendMessage(to, msg);
    }
    if (msg.type === 'buttons') {
        return await sendButtons(to, msg.body, msg.buttons, msg.header, msg.footer);
    }
    if (msg.type === 'list') {
        return await sendList(to, msg.body, msg.buttonLabel, msg.sections, msg.header, msg.footer);
    }
    return await sendMessage(to, msg.body || JSON.stringify(msg));
}

function getMessageText(msg) {
    if (typeof msg === 'string') return msg;
    return msg.body || '[interactive]';
}

/**
 * Pipeline principal
 */
async function handleIncomingMessage(msg, contactInfo) {
    const messageId = msg.id;
    const from = msg.from;
    const text = msg.text?.body;

    if (!text || !from) return;
    if (processingMessages.has(messageId)) return;
    processingMessages.add(messageId);

    try {
        const alreadyProcessed = await isMessageProcessed(messageId);
        if (alreadyProcessed) return;

        const now = Date.now();
        const lastTime = lastMessageTime.get(from) || 0;
        if (now - lastTime < FLOOD_COOLDOWN_MS) return;
        lastMessageTime.set(from, now);

        console.log(`\n📩 Mensaje de ${contactInfo.profile?.name || from}: "${text}"`);

        const contact = await getOrCreateContact(from, contactInfo.profile?.name || null);
        const conversation = await getOrCreateConversation(contact.id);

        await saveMessage(conversation.id, contact.id, messageId, 'incoming', text, { type: msg.type || 'text' });

        const globalAI = await getSetting('ai_enabled_global');
        if (globalAI === 'false') return;

        const contactAI = await isAIEnabled(contact.id);
        if (!contactAI) return;

        // Marcar como leído
        await markAsRead(messageId);

        // Obtener historial
        const history = await getConversationHistory(contact.id, 15);

        // Generar respuesta
        console.log('   🧠 Generando respuesta...');
        const flowResult = await generateResponse(history, text, conversation.id);

        let aiResponse = typeof flowResult === 'string' ? flowResult : flowResult.response;
        const messages = Array.isArray(aiResponse) ? aiResponse : [aiResponse];

        // Actualizar estado
        if (typeof flowResult === 'object' && flowResult.newState) {
            await updateConversationState(conversation.id, flowResult.newState, flowResult.product || null);
            if (flowResult.escalate) {
                await setAIEnabled(contact.id, false);
                console.log(`🔔 Escalado a humano para ${from}`);
            }
            if (flowResult.alertAdmin) {
                console.log(`💰 ALERTA VENTA: ${contactInfo.profile?.name || from}`);
            }
        }

        // Enviar mensajes
        for (let i = 0; i < messages.length; i++) {
            if (i > 0) await delayBetweenSplitMessages();
            await sendSingleMessage(from, messages[i]);
            await saveMessage(conversation.id, contact.id, `out_${Date.now()}_${i}`, 'outgoing', getMessageText(messages[i]), { aiGenerated: true });
        }

        console.log(`✅ ${messages.length} mensaje(s) enviado(s)`);

    } catch (err) {
        console.error(`❌ Error procesando mensaje de ${from}:`, err.message || err);
    } finally {
        setTimeout(() => processingMessages.delete(messageId), 60000);
    }
}

module.exports = { handleIncomingMessage };
