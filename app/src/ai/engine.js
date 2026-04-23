const flows = require('./flows');

/**
 * Motor principal — usa el motor de flujos interactivos directamente.
 * Rápido, sin llamadas API externas.
 */
async function generateResponse(conversationHistory, newMessage, conversationId) {
    return await flows.generateResponse(conversationHistory, newMessage, conversationId);
}

async function checkAIStatus() {
    const flowData = flows.loadFlows();
    return {
        primary: 'flows',
        products_count: Object.keys(flowData.products || {}).length,
        status: 'ok'
    };
}

module.exports = { generateResponse, checkAIStatus };
