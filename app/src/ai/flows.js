const fs = require('fs');
const path = require('path');
const { getConversationState, updateConversationState } = require('../database');

const FLOWS_PATH = path.join(__dirname, 'flows.json');

let flowsData = null;
let flowsLastModified = 0;

// ── Cargar flujos ─────────────────────────────────────

function loadFlows() {
    try {
        const stat = fs.statSync(FLOWS_PATH);
        if (!flowsData || stat.mtimeMs > flowsLastModified) {
            const raw = fs.readFileSync(FLOWS_PATH, 'utf-8');
            flowsData = JSON.parse(raw);
            flowsLastModified = stat.mtimeMs;
            const productCount = Object.keys(flowsData.products || {}).length;
            console.log(`📋 Flujos cargados: ${productCount} productos`);
        }
        return flowsData;
    } catch (err) {
        console.error('❌ Error cargando flows.json:', err.message);
        return {};
    }
}

function pick(arr) {
    if (!arr || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Detectores ────────────────────────────────────────

function isGreeting(text) {
    const greetings = ['hola', 'buenas', 'buenos días', 'buenos dias', 'buenas tardes',
        'buenas noches', 'hey', 'hi', 'hello', 'qué tal', 'que tal', 'buen día',
        'buen dia', 'saludos', 'buenass', 'holaa', 'holaaaa', 'ola'];
    const lower = text.toLowerCase().trim();
    return greetings.some(g => lower === g || lower.startsWith(g + ' ') ||
        lower.startsWith(g + ',') || lower.startsWith(g + '!') || lower.startsWith(g + '.'));
}

function isFarewell(text) {
    const farewells = ['gracias', 'chau', 'bye', 'adiós', 'adios', 'hasta luego',
        'nos vemos', 'ok gracias', 'listo gracias', 'dale gracias',
        'muchas gracias', 'thanks', 'excelente gracias', 'genial gracias',
        'perfecto gracias', 'buenisimo', 'grax', 'mil gracias'];
    const lower = text.toLowerCase().trim();
    return farewells.some(f => lower === f || lower.startsWith(f + ' ') ||
        lower.startsWith(f + ',') || lower.startsWith(f + '!'));
}

function isAffirmative(text) {
    const yes = ['si', 'sí', 'dale', 'va', 'ok', 'okay', 'claro', 'por favor',
        'porfa', 'quiero', 'lo quiero', 'me interesa', 'va va', 'sip',
        'de una', 'manda', 'vamos', 'perfecto', 'listo', 'ya', 'pues'];
    const lower = text.toLowerCase().trim();
    return yes.some(y => lower === y || lower.startsWith(y + ' ') || lower.startsWith(y + ','));
}

function isPaymentProof(text) {
    const payment = ['pagué', 'pague', 'ya pagué', 'ya pague', 'ya transferí',
        'ya transferi', 'listo el pago', 'ya yapee', 'ya te yapee', 'yapee',
        'transferido', 'enviado', 'hecho', 'ahí va', 'ahi va', 'ahí está',
        'comprobante', 'captura', 'voucher', 'deposité', 'deposite'];
    const lower = text.toLowerCase().trim();
    return payment.some(p => lower.includes(p));
}

function isCatalogRequest(text) {
    const catalog = ['productos', 'catálogo', 'catalogo', 'qué tienen', 'que tienen',
        'qué venden', 'que venden', 'lista', 'todo', 'precios'];
    const lower = text.toLowerCase().trim();
    return catalog.some(c => lower.includes(c));
}

function isPaymentQuestion(text) {
    const pay = ['cómo pago', 'como pago', 'métodos de pago', 'metodos de pago',
        'formas de pago', 'yape', 'plin', 'paypal', 'transferencia', 'cómo compro',
        'como compro', 'datos de pago'];
    const lower = text.toLowerCase().trim();
    return pay.some(p => lower.includes(p));
}

// ── Buscar producto por keywords ──────────────────────

function findProduct(text) {
    const data = loadFlows();
    const lower = text.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [id, product] of Object.entries(data.products || {})) {
        for (const kw of product.keywords) {
            if (lower.includes(kw.toLowerCase())) {
                const score = kw.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { id, ...product };
                }
            }
        }
    }
    return bestMatch;
}

// ── Buscar categoría por keywords ─────────────────────

function findCategory(text) {
    const data = loadFlows();
    const lower = text.toLowerCase();

    for (const [id, cat] of Object.entries(data.category_responses || {})) {
        for (const kw of cat.keywords) {
            if (lower.includes(kw.toLowerCase())) {
                return { id, ...cat };
            }
        }
    }
    return null;
}

// ══════════════════════════════════════════════════════
//  MOTOR PRINCIPAL — Máquina de estados del embudo
// ══════════════════════════════════════════════════════

/**
 * Genera respuesta basada en el estado de la conversación
 * 
 * Estados del embudo:
 *   new → catalog → product_info → payment → waiting_payment → delivered → review → done
 * 
 * El cliente puede saltar estados (ej: llegar directo pidiendo un producto)
 */
async function generateResponse(conversationHistory, newMessage, conversationId) {
    const data = loadFlows();
    const convState = conversationId ? await getConversationState(conversationId) : { state: 'new', product: null };
    const state = convState.state;
    const text = newMessage;

    console.log(`   📍 Estado: ${state} | Producto: ${convState.product || 'ninguno'}`);

    // ── SIEMPRE: Detectar si pide hablar con humano ───
    const humanPhrases = ['hablar con una persona', 'hablar con alguien', 'persona real', 'agente'];
    if (humanPhrases.some(p => text.toLowerCase().includes(p))) {
        return { response: 'Claro, dame un momento que te comunico 👍', newState: state, escalate: true };
    }

    // ── SIEMPRE: Si pregunta por métodos de pago ──────
    if (isPaymentQuestion(text)) {
        const payMsg = data.payment_info.replace('{trustpilot_url}', data.trustpilot_url);
        return { response: payMsg, newState: 'payment' };
    }

    // ── SIEMPRE: Si manda catálogo/precios ────────────
    if (isCatalogRequest(text)) {
        return { response: data.catalog_message, newState: 'catalog' };
    }

    // ── SIEMPRE: Si menciona un producto específico ───
    const product = findProduct(text);
    if (product) {
        return { response: product.info_message, newState: 'product_info', product: product.id };
    }

    // ── SIEMPRE: Si menciona una categoría ────────────
    const category = findCategory(text);
    if (category) {
        return { response: category.message, newState: 'catalog' };
    }

    // ── Lógica por estado ─────────────────────────────

    switch (state) {
        case 'new':
            // Primera vez → saludar
            if (isGreeting(text) || conversationHistory.length === 0) {
                const greeting = pick(data.greeting_responses);
                return { response: greeting, newState: 'catalog' };
            }
            // Si no es saludo, mostrar catálogo
            return { response: data.catalog_message, newState: 'catalog' };

        case 'catalog':
            // Estamos esperando que elija producto
            if (isGreeting(text)) {
                return { response: 'Dime, qué producto necesitas? 😊 O si quieres te muestro el catálogo completo', newState: 'catalog' };
            }
            if (isAffirmative(text)) {
                return { response: data.catalog_message, newState: 'catalog' };
            }
            // No matcheó producto/categoría → mostrar catálogo
            return { response: 'No estoy seguro cuál producto te refieres 🤔\n\n' + data.catalog_message, newState: 'catalog' };

        case 'product_info':
            // Le mostramos info del producto, esperamos confirmación
            if (isAffirmative(text)) {
                const confirmMsg = pick(data.confirm_purchase_responses);
                const payMsg = data.payment_info;
                const fullMsg = confirmMsg + '\n\n' + payMsg;
                return { response: fullMsg, newState: 'waiting_payment' };
            }
            if (isFarewell(text)) {
                const farewell = pick(data.farewell_responses).replace('{trustpilot_url}', data.trustpilot_url);
                return { response: farewell, newState: 'done' };
            }
            // Tal vez quiere otro producto → ya se maneja arriba con findProduct
            return { response: 'Te interesa comprarlo? Te paso los datos de pago 👍\n\nO si buscas otro producto, dime cuál', newState: 'product_info' };

        case 'payment':
            // Ya le dimos datos de pago
            if (isPaymentProof(text)) {
                const confirmed = pick(data.payment_confirmed_responses);
                return { response: confirmed, newState: 'delivered', alertAdmin: true };
            }
            if (isAffirmative(text)) {
                const waitMsg = pick(data.waiting_payment_responses);
                return { response: waitMsg, newState: 'waiting_payment' };
            }
            return { response: pick(data.waiting_payment_responses), newState: 'waiting_payment' };

        case 'waiting_payment':
            // Esperando comprobante de pago
            if (isPaymentProof(text)) {
                const confirmed = pick(data.payment_confirmed_responses);
                return { response: confirmed, newState: 'delivered', alertAdmin: true };
            }
            if (isGreeting(text)) {
                return { response: 'Hola! Seguimos con tu compra 😊 Ya pudiste hacer el pago?', newState: 'waiting_payment' };
            }
            return { response: 'Quedo atento a tu comprobante de pago 👀 Cuando lo tengas, envíamelo por aquí', newState: 'waiting_payment' };

        case 'delivered':
            // Ya se envió la licencia (manualmente por el admin)
            if (isFarewell(text)) {
                const farewell = pick(data.farewell_responses).replace('{trustpilot_url}', data.trustpilot_url);
                return { response: farewell, newState: 'done' };
            }
            // Si tiene problemas con instalación
            if (text.toLowerCase().includes('ayuda') || text.toLowerCase().includes('error') || text.toLowerCase().includes('no puedo') || text.toLowerCase().includes('problema')) {
                return { response: 'Sin problema! Cuéntame qué error te sale y te ayudo paso a paso 🛠️', newState: 'delivered', alertAdmin: true };
            }
            return { response: 'Todo bien con tu licencia? Si necesitas ayuda con la instalación me dices 😊', newState: 'delivered' };

        case 'done':
        case 'review':
            // Conversación terminada, si vuelve a escribir → nueva interacción
            if (isGreeting(text)) {
                const greeting = pick(data.greeting_responses);
                return { response: greeting, newState: 'catalog' };
            }
            return { response: 'Hola de nuevo! 👋 En qué te puedo ayudar?', newState: 'catalog' };

        default:
            // Intentar fallback con OpenAI si está configurado
            const openaiKey = process.env.OPENAI_API_KEY;
            if (openaiKey && openaiKey !== 'sk-xxx' && openaiKey.length > 10) {
                try {
                    const openai = require('./openai');
                    const aiResponse = await openai.generateResponse(conversationHistory, text);
                    if (aiResponse) return { response: aiResponse, newState: state };
                } catch (err) {
                    console.warn('   ⚠️ OpenAI fallback falló:', err.message);
                }
            }
            
            // Si no hay OpenAI o falló, usar respuestas genéricas de fallback
            const fallback = pick(data.fallback_responses) || 'Dame un momento que reviso eso 👍';
            return { response: fallback, newState: state };
    }
}

// ── Exports para admin panel ──────────────────────────

function getAllFlows() {
    return loadFlows();
}

function saveFlows(newData) {
    try {
        fs.writeFileSync(FLOWS_PATH, JSON.stringify(newData, null, 2), 'utf-8');
        flowsData = null;
        flowsLastModified = 0;
        console.log('✅ Flujos actualizados');
        return true;
    } catch (err) {
        console.error('❌ Error guardando flows.json:', err.message);
        return false;
    }
}

module.exports = { generateResponse, getAllFlows, saveFlows, loadFlows };
