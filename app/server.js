require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { initDatabase } = require('./src/database');
const { handleIncomingMessage } = require('./src/messageHandler');
const adminRoutes = require('./src/admin/routes');

const app = express();

// ── Raw body para verificación de firma ─────────────────
app.use('/webhook', express.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString();
    }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Verificación del Webhook (Meta envía GET) ───────────
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('✅ Webhook verificado correctamente');
        return res.status(200).send(challenge);
    }

    console.warn('⚠️ Verificación fallida — token incorrecto');
    return res.sendStatus(403);
});

// ── Recepción de mensajes (Meta envía POST) ─────────────
app.post('/webhook', (req, res) => {
    // Responder 200 INMEDIATAMENTE (Meta requiere respuesta rápida)
    res.sendStatus(200);

    // Verificar firma de seguridad
    // const signature = req.headers['x-hub-signature-256'];
    // if (signature && process.env.WHATSAPP_ACCESS_TOKEN) {
    //     const expectedSig = 'sha256=' + crypto
    //         .createHmac('sha256', process.env.WHATSAPP_APP_SECRET || process.env.WHATSAPP_ACCESS_TOKEN)
    //         .update(req.rawBody || '')
    //         .digest('hex');
    //
    //     if (signature !== expectedSig) {
    //         console.warn('⚠️ Firma inválida — ignorando mensaje');
    //         return;
    //     }
    // }

    // Procesar el mensaje de forma asíncrona
    const body = req.body;

    if (body?.object === 'whatsapp_business_account') {
        const entries = body.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field === 'messages') {
                    const value = change.value;
                    const messages = value?.messages || [];
                    const contacts = value?.contacts || [];

                    for (let i = 0; i < messages.length; i++) {
                        const msg = messages[i];
                        const contact = contacts[i] || {};

                        // Ignorar mensajes de estado
                        if (msg.type === 'system') continue;

                        // Extraer texto según tipo de mensaje
                        let textContent = null;
                        if (msg.type === 'text') {
                            textContent = msg.text?.body;
                        } else if (msg.type === 'interactive') {
                            // Click en botón o selección de lista
                            const interactive = msg.interactive;
                            if (interactive?.type === 'button_reply') {
                                textContent = interactive.button_reply.id;
                                console.log(`🔘 Botón: "${interactive.button_reply.title}" (${interactive.button_reply.id})`);
                            } else if (interactive?.type === 'list_reply') {
                                textContent = interactive.list_reply.id;
                                console.log(`📋 Lista: "${interactive.list_reply.title}" (${interactive.list_reply.id})`);
                            }
                        } else if (msg.type === 'image' || msg.type === 'document') {
                            // Posible comprobante de pago
                            textContent = msg.image?.caption || msg.document?.caption || 'comprobante';
                        }

                        if (!textContent) continue;

                        // Inyectar el texto extraído en msg.text para compatibilidad
                        msg.text = msg.text || {};
                        msg.text.body = textContent;

                        handleIncomingMessage(msg, contact).catch(err => {
                            console.error('❌ Error procesando mensaje:', err.message);
                        });
                    }
                }
            }
        }
    }
});

// ── Health check ────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ── Admin Panel (puerto separado) ───────────────────────
const adminApp = express();
adminApp.use(express.json());
adminApp.use(express.urlencoded({ extended: true }));
adminRoutes(adminApp);

// ── Iniciar servidores ──────────────────────────────────
async function start() {
    try {
        await initDatabase();
        console.log('✅ Base de datos inicializada');

        app.listen(3000, () => {
            console.log('🔌 Webhook server escuchando en puerto 3000');
        });

        adminApp.listen(8080, () => {
            console.log('📊 Admin panel escuchando en puerto 8080');
        });

        console.log('');
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║  🤖 WhatsApp Auto-Responder — CDKeysPeru    ║');
        console.log('║  ✅ Webhook: http://localhost:3000/webhook   ║');
        console.log('║  📊 Admin:   http://localhost:8080           ║');
        console.log('╚══════════════════════════════════════════════╝');
        console.log('');

    } catch (err) {
        console.error('❌ Error al iniciar:', err);
        process.exit(1);
    }
}

start();
