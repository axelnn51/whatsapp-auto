const path = require('path');
const {
    getRecentConversations,
    getConversationMessages,
    getStats,
    getAllContacts,
    setAIEnabled,
    getSetting,
    setSetting,
    pool
} = require('../database');
const { checkAIStatus } = require('../ai/engine');
const { getAllFlows, saveFlows } = require('../ai/flows');
const { createBackup } = require('../backup');
const { scheduleBackups } = require('../backup');

module.exports = function (app) {

    // ── Auth middleware simple ──────────────────────
    const AUTH_USER = process.env.ADMIN_USERNAME || 'admin';
    const AUTH_PASS = process.env.ADMIN_PASSWORD || 'cambia_este_password';

    function basicAuth(req, res, next) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Basic ')) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
            return res.status(401).send('Autenticación requerida');
        }
        const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
        const [user, pass] = decoded.split(':');
        if (user === AUTH_USER && pass === AUTH_PASS) {
            return next();
        }
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
        return res.status(401).send('Credenciales inválidas');
    }

    app.use(basicAuth);

    // ── Servir frontend ─────────────────────────────
    app.use('/static', require('express').static(path.join(__dirname, 'public')));

    app.get('/', (_req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // ── API endpoints ───────────────────────────────

    // Dashboard stats
    app.get('/api/stats', async (_req, res) => {
        try {
            const stats = await getStats();
            const aiStatus = await checkAIStatus();
            const globalAI = await getSetting('ai_enabled_global');
            res.json({ ...stats, ai: aiStatus, ai_enabled_global: globalAI !== 'false' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Lista de conversaciones recientes
    app.get('/api/conversations', async (_req, res) => {
        try {
            const convs = await getRecentConversations();
            res.json(convs);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Mensajes de una conversación
    app.get('/api/conversations/:id/messages', async (req, res) => {
        try {
            const messages = await getConversationMessages(parseInt(req.params.id));
            res.json(messages);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Lista de contactos
    app.get('/api/contacts', async (_req, res) => {
        try {
            const contacts = await getAllContacts();
            res.json(contacts);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Toggle IA para un contacto (tomar control / devolver a IA)
    app.post('/api/contacts/:id/toggle-ai', async (req, res) => {
        try {
            const contactId = parseInt(req.params.id);
            const { enabled } = req.body;
            await setAIEnabled(contactId, enabled);
            res.json({ success: true, ai_enabled: enabled });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Toggle IA global
    app.post('/api/settings/toggle-ai', async (req, res) => {
        try {
            const { enabled } = req.body;
            await setSetting('ai_enabled_global', enabled ? 'true' : 'false');
            res.json({ success: true, ai_enabled_global: enabled });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Crear backup manual
    app.post('/api/backup', async (_req, res) => {
        try {
            const filepath = createBackup();
            res.json({ success: true, file: filepath });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Flow Management ─────────────────────────────

    // Obtener todos los flujos
    app.get('/api/flows', (_req, res) => {
        try {
            const flows = getAllFlows();
            res.json(flows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Guardar flujos actualizados
    app.put('/api/flows', (req, res) => {
        try {
            const success = saveFlows(req.body);
            if (success) {
                res.json({ success: true, message: 'Flujos actualizados' });
            } else {
                res.status(500).json({ error: 'Error guardando flujos' });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Servir página de editor de flujos
    app.get('/flows', (_req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'flows.html'));
    });

    // Iniciar backups automáticos
    scheduleBackups();
};
