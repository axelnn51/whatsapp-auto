const { sendMessage, markAsRead, sendTypingIndicator } = require('./whatsapp');
const { generateResponse } = require('./ai/engine');
const {
    delayBeforeRead,
    delayBeforeSend,
    delayBetweenSplitMessages,
    maybeSplitMessage,
    isWithinBusinessHours,
    getOutOfHoursMessage
} = require('./humanizer');
const {
    getOrCreateContact,
    isAIEnabled,
    getOrCreateConversation,
    saveMessage,
    getConversationHistory,
    isMessageProcessed,
    getSetting
} = require('./database');

// Conjunto para rastrear mensajes en proceso (anti-flood)
const processingMessages = new Set();
// Timestamps del último mensaje por contacto (anti-flood)
const lastMessageTime = new Map();
const FLOOD_COOLDOWN_MS = 3000; // 3 segundos mínimo entre procesamiento

/**
 * Pipeline principal de procesamiento de mensajes
 * 
 * Flujo:
 * 1. Validar mensaje (no duplicado, no propio, no sistema)
 * 2. Obtener/crear contacto y conversación en DB
 * 3. Guardar mensaje entrante
 * 4. Verificar si IA está habilitada
 * 5. Verificar horario de atención
 * 6. [DELAY] Marcar como leído (1-3 seg)
 * 7. Generar respuesta con IA
 * 8. [DELAY] Simular escritura (7-15 seg)
 * 9. Enviar respuesta (opcionalmente dividida en partes)
 * 10. Guardar respuesta en DB
 */
async function handleIncomingMessage(msg, contactInfo) {
    const messageId = msg.id;
    const from = msg.from;
    const text = msg.text?.body;

    // ── Validaciones ──────────────────────────────
    if (!text || !from) return;

    // Anti-duplicado
    if (processingMessages.has(messageId)) return;
    processingMessages.add(messageId);

    try {
        // Verificar si ya procesamos este mensaje (en DB)
        const alreadyProcessed = await isMessageProcessed(messageId);
        if (alreadyProcessed) {
            console.log(`⏭️ Mensaje ${messageId} ya procesado, ignorando`);
            return;
        }

        // Anti-flood: si el mismo contacto envía mensajes muy rápido
        const lastTime = lastMessageTime.get(from) || 0;
        const now = Date.now();
        if (now - lastTime < FLOOD_COOLDOWN_MS) {
            console.log(`🛑 Anti-flood: ${from} envió mensaje muy rápido, procesando solo el último`);
            // Aún guardamos en DB pero no respondemos inmediatamente
        }
        lastMessageTime.set(from, now);

        console.log(`\n📨 Mensaje de ${contactInfo.profile?.name || from}: "${text}"`);

        // ── Obtener/crear contacto y conversación ─
        const contact = await getOrCreateContact(from, contactInfo.profile?.name);
        const conversation = await getOrCreateConversation(contact.id);

        // ── Guardar mensaje entrante ──────────────
        await saveMessage(conversation.id, contact.id, messageId, 'incoming', text);

        // ── Verificar si IA está habilitada ───────
        const globalAI = await getSetting('ai_enabled_global');
        if (globalAI === 'false') {
            console.log('🔇 IA deshabilitada globalmente — no respondiendo');
            return;
        }

        const contactAI = await isAIEnabled(contact.id);
        if (!contactAI) {
            console.log(`🔇 IA deshabilitada para ${from} — modo humano activo`);
            return;
        }

        // ── Verificar horario de atención ─────────
        // NOTA: Desactivado para pruebas. Descomentar para producción.
        // if (!isWithinBusinessHours()) {
        //     console.log('🌙 Fuera de horario de atención');
        //     const history = await getConversationHistory(contact.id, 5);
        //     const recentOutOfHours = history.some(m => 
        //         m.direction === 'outgoing' && 
        //         m.content.includes('fuera de horario')
        //     );
        //     if (!recentOutOfHours) {
        //         const outMsg = getOutOfHoursMessage();
        //         await delayBeforeRead();
        //         await markAsRead(messageId);
        //         await delayBeforeSend(outMsg);
        //         await sendMessage(from, outMsg);
        //         await saveMessage(conversation.id, contact.id, `out_${Date.now()}`, 'outgoing', outMsg, { aiGenerated: true });
        //     }
        //     return;
        // }

        // ── Detección de escalamiento a humano ────
        const humanPhrases = [
            'hablar con una persona',
            'hablar con alguien',
            'hablar con el dueño',
            'persona real',
            'agente humano',
            'atención personalizada',
            'quiero hablar con',
            'necesito hablar con'
        ];
        const lowerText = text.toLowerCase();
        const wantsHuman = humanPhrases.some(phrase => lowerText.includes(phrase));

        if (wantsHuman) {
            console.log('🙋 Cliente solicita atención humana');
            await delayBeforeRead();
            await markAsRead(messageId);
            const humanMsg = 'Claro, dame un momento que te comunico con alguien del equipo 👍';
            await delayBeforeSend(humanMsg);
            await sendMessage(from, humanMsg);
            await saveMessage(conversation.id, contact.id, `out_${Date.now()}`, 'outgoing', humanMsg, { aiGenerated: true });
            
            // Desactivar IA para este contacto (humano toma control)
            const { setAIEnabled, updateConversationState } = require('./database');
            await setAIEnabled(contact.id, false);
            await updateConversationState(conversation.id, 'human_takeover');
            console.log(`🔔 ALERTA: ${contactInfo.profile?.name || from} quiere hablar con humano — IA desactivada para este contacto`);
            return;
        }

        // ── PASO 1: Delay antes de marcar como leído ──
        await delayBeforeRead();

        // ── PASO 2: Marcar como leído (✓✓ azul) + typing ──
        await markAsRead(messageId);
        await sendTypingIndicator(messageId);

        // ── PASO 3: Obtener historial para contexto ───
        const history = await getConversationHistory(contact.id, 15);

        // ── PASO 4: Generar respuesta con flujos/IA ───
        console.log('   🧠 Generando respuesta...');
        const flowResult = await generateResponse(history, text, conversation.id);
        
        // Extraer respuesta del objeto
        let aiResponse = typeof flowResult === 'string' ? flowResult : flowResult.response;

        // Convertir a array si no lo es
        const messages = Array.isArray(aiResponse) ? aiResponse : [aiResponse];

        // Actualizar estado en DB si el flujo lo indicó
        if (typeof flowResult === 'object' && flowResult.newState) {
            const { updateConversationState } = require('./database');
            await updateConversationState(conversation.id, flowResult.newState, flowResult.product || null);
            
            if (flowResult.escalate) {
                const { setAIEnabled } = require('./database');
                await setAIEnabled(contact.id, false);
                console.log(`🔔 ALERTA: IA detectó necesidad de humano — IA desactivada para este contacto`);
            }
            if (flowResult.alertAdmin) {
                console.log(`💰 ALERTA DE VENTA: ${contactInfo.profile?.name || from} ha enviado un comprobante o necesita ayuda con su compra!`);
            }
        }

        // ── PASO 5: Enviar mensajes (soporta múltiples) ──
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];

            if (i === 0) {
                // Primer mensaje: delay corto de "escribiendo"
                await delayBeforeSend(msg);
            } else {
                // Mensajes siguientes: pausa corta entre envíos
                await delayBetweenSplitMessages();
            }

            await sendMessage(from, msg);
            await saveMessage(
                conversation.id,
                contact.id,
                `out_${Date.now()}_${i}`,
                'outgoing',
                msg,
                { aiGenerated: true }
            );
        }

        console.log(`✅ ${messages.length} mensaje(s) enviado(s) a ${contactInfo.profile?.name || from}`);

    } catch (err) {
        console.error(`❌ Error procesando mensaje de ${from}:`, err);
    } finally {
        // Limpiar del set de procesamiento después de un delay
        setTimeout(() => processingMessages.delete(messageId), 60000);
    }
}

module.exports = { handleIncomingMessage };
