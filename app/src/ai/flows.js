const fs = require('fs');
const path = require('path');
const { getConversationState, updateConversationState } = require('../database');

const FLOWS_PATH = path.join(__dirname, 'flows.json');

let flowsData = null;
let flowsLastModified = 0;

function loadFlows() {
    try {
        const stat = fs.statSync(FLOWS_PATH);
        if (!flowsData || stat.mtimeMs > flowsLastModified) {
            const raw = fs.readFileSync(FLOWS_PATH, 'utf-8');
            flowsData = JSON.parse(raw);
            flowsLastModified = stat.mtimeMs;
            console.log(`📋 Flujos cargados: ${Object.keys(flowsData.products || {}).length} productos`);
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

function isPaymentProof(text) {
    const payment = ['pagué', 'pague', 'ya pagué', 'ya pague', 'ya transferí',
        'ya transferi', 'listo el pago', 'ya yapee', 'ya te yapee', 'yapee',
        'transferido', 'enviado', 'hecho', 'ahí va', 'ahi va', 'ahí está',
        'comprobante', 'captura', 'voucher', 'deposité', 'deposite'];
    const lower = text.toLowerCase().trim();
    return payment.some(p => lower.includes(p));
}

function isAffirmative(text) {
    const yes = ['si', 'sí', 'dale', 'va', 'ok', 'okay', 'claro', 'por favor',
        'porfa', 'quiero', 'lo quiero', 'me interesa', 'sip', 'de una', 'vamos', 'ya'];
    const lower = text.toLowerCase().trim();
    return yes.some(y => lower === y || lower.startsWith(y + ' ') || lower.startsWith(y + ','));
}

// ── Buscar producto por ID o keywords ─────────────────

function findProduct(text) {
    const data = loadFlows();
    const lower = text.toLowerCase().trim();

    // Primero buscar por ID exacto (desde botones/listas)
    if (data.products[lower]) {
        const p = data.products[lower];
        return { id: lower, ...p };
    }

    // Luego por keywords
    let bestMatch = null;
    let bestScore = 0;
    for (const [id, product] of Object.entries(data.products || {})) {
        for (const kw of product.keywords || []) {
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

// ══════════════════════════════════════════════════════
//  MOTOR PRINCIPAL — Mensajes interactivos
// ══════════════════════════════════════════════════════

async function generateResponse(conversationHistory, newMessage, conversationId) {
    const data = loadFlows();
    const convState = conversationId ? await getConversationState(conversationId) : { state: 'new', product: null };
    const state = convState.state;
    const text = newMessage;
    const lower = text.toLowerCase().trim();

    console.log(`   📍 Estado: ${state} | Input: "${text.substring(0, 40)}"`);

    // ── Botón: ver_catalogo ──
    if (lower === 'ver_catalogo') {
        return {
            response: { type: 'list', body: '📋 *Nuestros productos* 🧑🏻💻\n\nElige una categoría para ver las opciones disponibles:', buttonLabel: 'Ver categorías', sections: [
                { title: '🖥️ Software', rows: [
                    { id: 'cat_office', title: 'Microsoft Office', description: 'Desde S/20 — Permanentes y 365' },
                    { id: 'cat_windows', title: 'Windows', description: 'S/30 — Win 10/11 Pro' },
                    { id: 'cat_antivirus', title: 'Antivirus', description: 'S/45 — ESET NOD32 23 meses' },
                    { id: 'cat_canva', title: 'Canva Pro', description: 'S/15 — 12 meses' }
                ]}
            ]},
            newState: 'catalog'
        };
    }

    // ── Botón: categoría Office ──
    if (lower === 'cat_office' || lower.includes('office') || lower.includes('word') || lower.includes('excel')) {
        return {
            response: { type: 'list', body: '✅ *Si tenemos Office disponible* 🧑🏻💻🙌🏻\n\nElige la versión que te interesa:', buttonLabel: 'Ver versiones', sections: [
                { title: '🔑 Licencias Permanentes', rows: [
                    { id: 'office_2016', title: 'Office 2016 Pro Plus', description: 'S/20 — Permanente 1 PC' },
                    { id: 'office_2019', title: 'Office 2019 Pro Plus', description: 'S/25 — Permanente 1 PC' },
                    { id: 'office_2021', title: 'Office 2021 Pro Plus', description: 'S/30 — Permanente 1 PC' },
                    { id: 'office_2024', title: 'Office 2024 LTSC', description: 'S/35 — Permanente 1 PC' }
                ]},
                { title: '☁️ Office 365', rows: [
                    { id: 'office_365_cuenta', title: 'Cuenta 365 Pro Plus', description: 'S/40 — 5 dispositivos' },
                    { id: 'office_365_personal_invitacion', title: '365 Personal Invitación', description: 'S/70 — 12 meses' },
                    { id: 'office_365_personal_licencia', title: '365 Personal Licencia', description: 'S/180 — 12 meses' }
                ]}
            ]},
            newState: 'catalog'
        };
    }

    // ── Botón: categoría Windows ──
    if (lower === 'cat_windows' || lower.includes('windows') || lower.includes('win')) {
        return {
            response: { type: 'list', body: '✅ *Si tenemos Windows disponible* 🧑🏻💻🙌🏻\n\nElige la versión:', buttonLabel: 'Ver versiones', sections: [
                { title: '🖥️ Windows', rows: [
                    { id: 'windows_10', title: 'Windows 10 Pro', description: 'S/30 — Permanente 1 PC' },
                    { id: 'windows_11', title: 'Windows 11 Pro', description: 'S/30 — Permanente 1 PC' }
                ]}
            ]},
            newState: 'catalog'
        };
    }

    // ── Botón: categoría Antivirus ──
    if (lower === 'cat_antivirus' || lower.includes('antivirus') || lower.includes('eset') || lower.includes('virus')) {
        const prod = data.products.eset;
        return {
            response: ['Si tenemos disponible 🧑🏻💻', { type: 'buttons', body: prod.info_message, buttons: [
                { id: 'comprar_eset', title: '🛒 Comprar' },
                { id: 'ver_catalogo', title: '📋 Ver más' }
            ]}],
            newState: 'product_info', product: 'eset'
        };
    }

    // ── Botón: categoría Canva ──
    if (lower === 'cat_canva' || lower.includes('canva')) {
        const prod = data.products.canva_pro;
        return {
            response: ['Si tenemos disponible 🧑🏻💻', { type: 'buttons', body: prod.info_message, buttons: [
                { id: 'comprar_canva_pro', title: '🛒 Comprar' },
                { id: 'ver_catalogo', title: '📋 Ver más' }
            ]}],
            newState: 'product_info', product: 'canva_pro'
        };
    }

    // ── Selección de producto específico (desde lista) ──
    const product = findProduct(text);
    if (product) {
        return {
            response: ['Si tenemos disponible 🧑🏻💻', { type: 'buttons', body: product.info_message, buttons: [
                { id: `comprar_${product.id}`, title: '🛒 Comprar' },
                { id: 'ver_catalogo', title: '📋 Ver más' }
            ]}],
            newState: 'product_info', product: product.id
        };
    }

    // ── Botón: comprar (comprar_xxx) ──
    if (lower.startsWith('comprar_')) {
        const productId = lower.replace('comprar_', '');
        const payMsg = data.payment_info;
        const bonus = data.bonus_message || '';
        return {
            response: [
                pick(data.confirm_purchase_responses),
                payMsg,
                bonus
            ].filter(m => m),
            newState: 'waiting_payment', product: productId
        };
    }

    // ── Pago / comprobante ──
    if (isPaymentProof(text)) {
        return {
            response: pick(data.payment_confirmed_responses),
            newState: 'delivered', alertAdmin: true
        };
    }

    // ── Hablar con humano ──
    const humanPhrases = ['hablar con una persona', 'hablar con alguien', 'persona real', 'agente'];
    if (humanPhrases.some(p => lower.includes(p))) {
        return { response: 'Claro, dame un momento que te comunico con alguien 🤗🧑🏻💻', newState: state, escalate: true };
    }

    // ── Saludo → Botones principales ──
    if (isGreeting(text) || state === 'new' || conversationHistory.length === 0) {
        return {
            response: { type: 'buttons', body: 'Hola buenas! 🤗\ncomo te podemos ayudar? 🙌🏻', buttons: [
                { id: 'ver_catalogo', title: '📋 Ver productos' },
                { id: 'cat_office', title: '📎 Office' },
                { id: 'cat_windows', title: '🖥️ Windows' }
            ]},
            newState: 'catalog'
        };
    }

    // ── Afirmativo sin contexto ──
    if (isAffirmative(text)) {
        if (convState.product && data.products[convState.product]) {
            const payMsg = data.payment_info;
            return {
                response: [pick(data.confirm_purchase_responses), payMsg],
                newState: 'waiting_payment', product: convState.product
            };
        }
        return {
            response: { type: 'buttons', body: 'Que producto te interesa? 🤗', buttons: [
                { id: 'ver_catalogo', title: '📋 Ver productos' },
                { id: 'cat_office', title: '📎 Office' },
                { id: 'cat_windows', title: '🖥️ Windows' }
            ]},
            newState: 'catalog'
        };
    }

    // ── Fallback: no entendió → botones ──
    return {
        response: { type: 'buttons', body: 'Mmm no estoy seguro a cuál te refieres 🤔\nque producto estas buscando? 🧑🏻💻', buttons: [
            { id: 'ver_catalogo', title: '📋 Ver productos' },
            { id: 'cat_office', title: '📎 Office' },
            { id: 'cat_windows', title: '🖥️ Windows' }
        ]},
        newState: 'catalog'
    };
}

// ── Exports ──────────────────────────────────────────

function getAllFlows() { return loadFlows(); }

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
