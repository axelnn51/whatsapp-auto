const axios = require('axios');
const { getSystemPrompt } = require('./prompts');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

/**
 * Generar respuesta usando Ollama (IA local)
 */
async function generateResponse(conversationHistory, newMessage) {
    // Construir mensajes en formato chat
    const messages = [
        { role: 'system', content: getSystemPrompt() }
    ];

    // Agregar historial de conversación como contexto
    for (const msg of conversationHistory) {
        messages.push({
            role: msg.direction === 'incoming' ? 'user' : 'assistant',
            content: msg.content
        });
    }

    // Agregar el mensaje nuevo
    messages.push({ role: 'user', content: newMessage });

    try {
        const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
            model: MODEL,
            messages: messages,
            stream: false,
            options: {
                temperature: 0.7,       // Creatividad moderada
                top_p: 0.9,
                num_predict: 300,        // Máximo ~300 tokens (respuestas cortas)
                repeat_penalty: 1.2      // Evitar repeticiones
            }
        }, {
            timeout: 60000  // 60s timeout (modelos locales pueden ser lentos)
        });

        const reply = response.data?.message?.content?.trim();

        if (!reply) {
            console.warn('⚠️ Ollama retornó respuesta vacía');
            return null;
        }

        // Limpiar respuesta de formatos no deseados
        return cleanResponse(reply);

    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.error('❌ Ollama no está disponible. ¿Está corriendo el contenedor?');
        } else if (err.code === 'ECONNABORTED') {
            console.error('❌ Ollama timeout — el modelo está tardando demasiado');
        } else {
            console.error('❌ Error Ollama:', err.response?.data || err.message);
        }
        return null;
    }
}

/**
 * Limpiar respuesta de la IA para que parezca mensaje de WhatsApp real
 */
function cleanResponse(text) {
    let clean = text;

    // Remover asteriscos de negritas markdown
    clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');
    clean = clean.replace(/\*(.*?)\*/g, '$1');

    // Remover bullets/listas
    clean = clean.replace(/^[-•]\s+/gm, '');
    clean = clean.replace(/^\d+\.\s+/gm, '');

    // Remover backticks
    clean = clean.replace(/`/g, '');

    // Remover saltos de línea excesivos
    clean = clean.replace(/\n{3,}/g, '\n\n');

    // Limitar largo (máximo ~500 chars)
    if (clean.length > 500) {
        // Cortar en la última oración completa antes de 500
        const truncated = clean.substring(0, 500);
        const lastPeriod = Math.max(
            truncated.lastIndexOf('.'),
            truncated.lastIndexOf('!'),
            truncated.lastIndexOf('?')
        );
        if (lastPeriod > 200) {
            clean = truncated.substring(0, lastPeriod + 1);
        } else {
            clean = truncated + '...';
        }
    }

    return clean.trim();
}

/**
 * Verificar si Ollama está disponible
 */
async function isAvailable() {
    try {
        await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

module.exports = { generateResponse, isAvailable };
