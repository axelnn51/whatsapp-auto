const axios = require('axios');
const { getSystemPrompt } = require('./prompts');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';

/**
 * Generar respuesta usando OpenAI (alternativa de pago)
 */
async function generateResponse(conversationHistory, newMessage) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-xxx') {
        console.warn('⚠️ OpenAI API key no configurada');
        return null;
    }

    const messages = [
        { role: 'system', content: getSystemPrompt() }
    ];

    for (const msg of conversationHistory) {
        messages.push({
            role: msg.direction === 'incoming' ? 'user' : 'assistant',
            content: msg.content
        });
    }

    messages.push({ role: 'user', content: newMessage });

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: MODEL,
            messages: messages,
            max_tokens: 300,
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const reply = response.data?.choices?.[0]?.message?.content?.trim();
        return reply || null;

    } catch (err) {
        console.error('❌ Error OpenAI:', err.response?.data || err.message);
        return null;
    }
}

async function isAvailable() {
    return !!(OPENAI_API_KEY && OPENAI_API_KEY !== 'sk-xxx');
}

module.exports = { generateResponse, isAvailable };
