/**
 * Humanizer — Simula comportamiento humano real
 * 
 * Hace que las respuestas del bot se sientan como si una persona real
 * estuviera leyendo y escribiendo en su celular.
 */

const READ_DELAY_MIN = parseInt(process.env.READ_DELAY_MIN || '1');
const READ_DELAY_MAX = parseInt(process.env.READ_DELAY_MAX || '3');
const TYPING_DELAY_MIN = parseInt(process.env.TYPING_DELAY_MIN || '7');
const TYPING_DELAY_MAX = parseInt(process.env.TYPING_DELAY_MAX || '15');
const SPLIT_DELAY_MIN = parseInt(process.env.SPLIT_DELAY_MIN || '2');
const SPLIT_DELAY_MAX = parseInt(process.env.SPLIT_DELAY_MAX || '5');
const SPLIT_PROBABILITY = parseFloat(process.env.SPLIT_PROBABILITY || '0.3');

const HOURS_START = parseInt(process.env.BUSINESS_HOURS_START || '8');
const HOURS_END = parseInt(process.env.BUSINESS_HOURS_END || '22');
const TIMEZONE = process.env.BUSINESS_TIMEZONE || 'America/Lima';

/**
 * Esperar un tiempo aleatorio entre min y max segundos
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generar un delay aleatorio entre min y max (en segundos)
 * Usa distribución ligeramente gaussiana para ser más natural
 */
function randomDelay(minSec, maxSec) {
    // Promedio de 2 randoms da distribución más "natural" (tendencia al centro)
    const r1 = Math.random();
    const r2 = Math.random();
    const avg = (r1 + r2) / 2;
    const delayMs = (minSec + avg * (maxSec - minSec)) * 1000;
    return Math.round(delayMs);
}

/**
 * Delay antes de marcar como leído
 * Simula que la persona abre el chat después de ver la notificación
 */
async function delayBeforeRead() {
    const ms = randomDelay(READ_DELAY_MIN, READ_DELAY_MAX);
    console.log(`   👀 Esperando ${(ms/1000).toFixed(1)}s antes de marcar como leído...`);
    await sleep(ms);
}

/**
 * Delay de "escribiendo" antes de enviar respuesta
 * Simula el tiempo que toma leer el mensaje y escribir la respuesta
 * Ajusta según el largo de la respuesta
 */
async function delayBeforeSend(responseText) {
    // Mensajes más largos = más tiempo "escribiendo"
    const textLength = responseText.length;
    let minSec = TYPING_DELAY_MIN;
    let maxSec = TYPING_DELAY_MAX;

    // Mensajes muy cortos (< 30 chars) = respuesta un poco más rápida
    if (textLength < 30) {
        minSec = Math.max(5, TYPING_DELAY_MIN - 2);
        maxSec = Math.max(8, TYPING_DELAY_MAX - 4);
    }
    // Mensajes largos (> 200 chars) = un poco más de tiempo
    else if (textLength > 200) {
        minSec = TYPING_DELAY_MIN + 2;
        maxSec = TYPING_DELAY_MAX + 5;
    }

    const ms = randomDelay(minSec, maxSec);
    console.log(`   ⌨️ Simulando escritura por ${(ms/1000).toFixed(1)}s para "${responseText.substring(0, 40)}..."`);
    await sleep(ms);
}

/**
 * Delay entre mensajes cuando se divide una respuesta larga
 */
async function delayBetweenSplitMessages() {
    const ms = randomDelay(SPLIT_DELAY_MIN, SPLIT_DELAY_MAX);
    console.log(`   ⏳ Pausa entre mensajes: ${(ms/1000).toFixed(1)}s`);
    await sleep(ms);
}

/**
 * Decidir si dividir un mensaje largo en partes
 * Retorna array de strings (1 elemento = no dividir)
 */
function maybeSplitMessage(text) {
    // Solo dividir si el mensaje es largo (> 150 chars)
    if (text.length < 150) return [text];

    // Probabilidad aleatoria de dividir
    if (Math.random() > SPLIT_PROBABILITY) return [text];

    // Dividir en oraciones naturales
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length < 2) return [text];

    // Agrupar en 2-3 partes de forma natural
    if (sentences.length <= 3) {
        // 2 mensajes
        const mid = Math.ceil(sentences.length / 2);
        return [
            sentences.slice(0, mid).join('').trim(),
            sentences.slice(mid).join('').trim()
        ].filter(s => s.length > 0);
    }

    // 3 mensajes para textos largos
    const third = Math.ceil(sentences.length / 3);
    return [
        sentences.slice(0, third).join('').trim(),
        sentences.slice(third, third * 2).join('').trim(),
        sentences.slice(third * 2).join('').trim()
    ].filter(s => s.length > 0);
}

/**
 * Verificar si estamos en horario de atención
 */
function isWithinBusinessHours() {
    const now = new Date();
    // Obtener hora en timezone del negocio
    const timeStr = now.toLocaleString('en-US', { timeZone: TIMEZONE, hour12: false });
    const hour = parseInt(timeStr.split(',')[1].trim().split(':')[0]);
    return hour >= HOURS_START && hour < HOURS_END;
}

/**
 * Obtener mensaje de fuera de horario
 */
function getOutOfHoursMessage() {
    const messages = [
        `¡Hola! 👋 Por el momento estamos fuera de horario. Te responderemos mañana a primera hora. Nuestro horario es de ${HOURS_START}am a ${HOURS_END > 12 ? HOURS_END - 12 : HOURS_END}pm 🕐`,
        `Hola! Gracias por escribirnos. Estamos fuera de horario pero te atenderemos mañana temprano ✨ Horario: ${HOURS_START}am - ${HOURS_END > 12 ? HOURS_END - 12 : HOURS_END}pm`,
        `Hey! 👋 Ya cerramos por hoy, pero tu mensaje es importante para nosotros. Te respondo mañana sin falta 💪`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Agregar variación sutil a saludos repetitivos
 */
function addVariation(text) {
    // Si la IA ya genera variación, no necesitamos mucha más
    // Solo asegurar que no sea exactamente igual cada vez
    return text;
}

module.exports = {
    sleep,
    delayBeforeRead,
    delayBeforeSend,
    delayBetweenSplitMessages,
    maybeSplitMessage,
    isWithinBusinessHours,
    getOutOfHoursMessage,
    addVariation
};
