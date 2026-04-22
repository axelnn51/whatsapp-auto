const flows = require('./flows');
const gemini = require('./gemini');

/**
 * Motor principal — usa Google Gemini 1.5 Flash (IA) por defecto.
 * Si no hay API Key, usa el sistema de Flujos rígidos como respaldo.
 */
async function generateResponse(conversationHistory, newMessage, conversationId) {
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if (geminiKey && geminiKey.length > 10 && geminiKey !== 'tu_api_key_de_google_aqui') {
        console.log('   🤖 Enrutando a Google Gemini...');
        return await gemini.generateResponse(conversationHistory, newMessage);
    } else {
        console.log('   🚦 Enrutando a Flows (Motor Estricto)...');
        return await flows.generateResponse(conversationHistory, newMessage, conversationId);
    }
}

/**
 * Verificar estado del motor
 */
async function checkAIStatus() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const hasGemini = !!(geminiKey && geminiKey.length > 10 && geminiKey !== 'tu_api_key_de_google_aqui');
    const flowData = flows.loadFlows();

    return {
        primary: hasGemini ? 'gemini' : 'flows',
        products_count: Object.keys(flowData.products || {}).length,
        status: 'ok'
    };
}

module.exports = { generateResponse, checkAIStatus };
