const axios = require('axios');
const { getSystemPrompt } = require('./prompts');
const flows = require('./flows'); // Para leer el catálogo dinámicamente

/**
 * Conecta con Google Gemini 1.5 Flash usando Axios (GRATIS y Ligero)
 * Obliga a Gemini a responder en formato JSON para mantener la Máquina de Estados.
 */
async function generateResponse(conversationHistory, newMessage) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'tu_api_key_de_google_aqui') {
        throw new Error('GEMINI_API_KEY no configurada');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Obtener los datos frescos de flows.json para que Gemini sepa los precios exactos
    const flowData = flows.loadFlows();
    const systemInstruction = getSystemPrompt(flowData);

    // Formatear historial para Gemini
    const contents = [];
    for (const msg of conversationHistory) {
        if (msg.content) {
            contents.push({
                role: msg.direction === 'incoming' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }
    }
    // Agregar el mensaje actual
    contents.push({
        role: 'user',
        parts: [{ text: newMessage }]
    });

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: contents,
        generationConfig: {
            temperature: 0.3, // Baja temperatura = respuestas precisas y apegadas a tu flows.json
            responseMimeType: "application/json" // Obliga a devolver un JSON con el estado de la venta
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000 // 10 segundos máximo
        });

        const textResponse = response.data.candidates[0].content.parts[0].text;
        
        // El LLM nos devuelve un JSON (porque se lo exigimos en el config y en el prompt)
        const parsed = JSON.parse(textResponse);
        
        return {
            response: parsed.response,
            newState: parsed.newState || 'catalog',
            product: parsed.product || null,
            escalate: parsed.escalate || false,
            alertAdmin: parsed.alertAdmin || false
        };

    } catch (err) {
        console.error('❌ Error llamando a Gemini:', err.response?.data || err.message);
        
        // Fallback robusto en caso de error de red
        return {
            response: "Dame un momento que verifico eso y te respondo 👍",
            newState: 'catalog',
            product: null,
            escalate: false,
            alertAdmin: false
        };
    }
}

module.exports = { generateResponse };
