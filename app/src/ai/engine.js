const flows = require('./flows');
const gemini = require('./gemini');

/**
 * Motor principal — PRIMERO usa el motor de flujos (instantáneo),
 * y SOLO llama a Gemini si el motor no sabe qué responder (fallback).
 */
async function generateResponse(conversationHistory, newMessage, conversationId) {
    // PASO 1: Intentar con el motor de flujos (instantáneo, sin API)
    console.log('   🚦 Intentando motor de Flujos...');
    const flowResult = await flows.generateResponse(conversationHistory, newMessage, conversationId);
    
    // Si el motor de flujos dio una respuesta real (no fallback), usarla
    const fallbackTexts = (flows.loadFlows().fallback_responses || []);
    const isFallback = fallbackTexts.some(f => flowResult.response.includes(f.substring(0, 20)));
    
    if (!isFallback) {
        console.log('   ✅ Respuesta del motor de Flujos (instantánea)');
        return flowResult;
    }

    // PASO 2: Solo si el motor no supo responder, usar Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.length > 10 && geminiKey !== 'tu_api_key_de_google_aqui') {
        console.log('   🤖 Flujos no supo responder, consultando Gemini...');
        try {
            const geminiResult = await gemini.generateResponse(conversationHistory, newMessage);
            console.log('   ✅ Respuesta de Gemini');
            return geminiResult;
        } catch (err) {
            console.error('   ❌ Gemini falló, usando respuesta de flujos:', err.message);
        }
    }

    // PASO 3: Si todo falla, devolver la respuesta del motor de flujos
    return flowResult;
}

/**
 * Verificar estado del motor
 */
async function checkAIStatus() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const hasGemini = !!(geminiKey && geminiKey.length > 10 && geminiKey !== 'tu_api_key_de_google_aqui');
    const flowData = flows.loadFlows();

    return {
        primary: 'flows',
        fallback: hasGemini ? 'gemini' : 'none',
        products_count: Object.keys(flowData.products || {}).length,
        status: 'ok'
    };
}

module.exports = { generateResponse, checkAIStatus };
