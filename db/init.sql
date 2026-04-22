-- ============================================
-- WhatsApp Auto-Responder — Database Schema
-- CDKeysPeru
-- ============================================

-- Contactos (clientes)
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    total_messages INTEGER DEFAULT 0,
    ai_enabled BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- Conversaciones
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active', -- active, closed, human_takeover
    conversation_state VARCHAR(30) DEFAULT 'new', -- new, catalog, product_info, payment, waiting_payment, delivered, review, done
    selected_product VARCHAR(100),
    summary TEXT
);

-- Mensajes individuales
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    wa_message_id VARCHAR(255) UNIQUE,
    direction VARCHAR(10) NOT NULL, -- 'incoming' o 'outgoing'
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, audio, document
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración del bot (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- Configuración inicial
INSERT INTO settings (key, value) VALUES
    ('ai_enabled_global', 'true'),
    ('business_name', 'CDKeysPeru'),
    ('max_response_length', '500')
ON CONFLICT (key) DO NOTHING;
