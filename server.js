const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const ping = require('ping');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Verificar pasta db existe
if (!fs.existsSync('./db')) {
    fs.mkdirSync('./db');
}

// Banco de dados
const db = new sqlite3.Database('./db/database.sqlite', (err) => {
    if (err) console.error('Erro ao conectar:', err.message);
    else console.log('✅ Banco SQLite conectado');
});

// Criar tabelas
db.serialize(() => {
    // Tabela de categorias
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de equipamentos
    db.run(`CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        category_id INTEGER,
        status TEXT DEFAULT 'unknown',
        last_ping DATETIME,
        packet_loss INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    // NOVO: Tabela de logs/histórico de pings
    db.run(`CREATE TABLE IF NOT EXISTS ping_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER,
        device_name TEXT,
        ip_address TEXT,
        status TEXT,
        ping_time INTEGER,
        packet_loss INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id)
    )`);
});

// ==================== ROTAS DE CATEGORIAS ====================

app.get('/api/categories', (req, res) => {
    db.all('SELECT * FROM categories ORDER BY name', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/categories', (req, res) => {
    const { name, description } = req.body;
    db.run('INSERT INTO categories (name, description) VALUES (?, ?)', 
        [name, description], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, description });
        }
    );
});

app.delete('/api/categories/:id', (req, res) => {
    db.run('DELETE FROM categories WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Categoria deletada' });
    });
});

// ==================== ROTAS DE EQUIPAMENTOS ====================

app.get('/api/devices', (req, res) => {
    const query = `
        SELECT d.*, c.name as category_name 
        FROM devices d
        LEFT JOIN categories c ON d.category_id = c.id 
        ORDER BY d.name
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/devices', (req, res) => {
    const { name, ip_address, category_id } = req.body;
    db.run('INSERT INTO devices (name, ip_address, category_id) VALUES (?, ?, ?)', 
        [name, ip_address, category_id], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ 
                id: this.lastID, 
                name, 
                ip_address, 
                category_id, 
                status: 'unknown',
                packet_loss: 0 
            });
        }
    );
});

app.delete('/api/devices/:id', (req, res) => {
    db.run('DELETE FROM devices WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // Limpar logs também
        db.run('DELETE FROM ping_logs WHERE device_id = ?', req.params.id);
        res.json({ message: 'Equipamento deletado' });
    });
});

// ==================== MONITORAMENTO E LOGS ====================

// Executar ping e salvar no histórico
async function executePing(deviceId, ip, name) {
    try {
        const result = await ping.promise.probe(ip, {
            timeout: 3,
            extra: process.platform === 'linux' ? ['-c', '3'] : ['-n', '3']
        });

        const status = result.alive ? 'online' : 'offline';
        const pingTime = result.time || 0;
        const packetLoss = result.packetLoss || 0;
        const now = new Date().toISOString();

        // Atualizar device
        db.run(
            'UPDATE devices SET status = ?, last_ping = ?, packet_loss = ? WHERE id = ?',
            [status, now, packetLoss, deviceId]
        );

        // NOVO: Salvar no histórico
        db.run(
            'INSERT INTO ping_logs (device_id, device_name, ip_address, status, ping_time, packet_loss) VALUES (?, ?, ?, ?, ?, ?)',
            [deviceId, name, ip, status, pingTime, packetLoss]
        );

        return {
            device_id: deviceId,
            name,
            ip,
            status,
            ping_time: pingTime,
            packet_loss: packetLoss,
            timestamp: now
        };
    } catch (error) {
        const now = new Date().toISOString();
        
        // Salvar erro no histórico
        db.run(
            'INSERT INTO ping_logs (device_id, device_name, ip_address, status, ping_time, packet_loss) VALUES (?, ?, ?, ?, ?, ?)',
            [deviceId, name, ip, 'error', 0, 100]
        );

        db.run(
            'UPDATE devices SET status = ?, last_ping = ?, packet_loss = ? WHERE id = ?',
            ['offline', now, 100, deviceId]
        );

        return {
            device_id: deviceId,
            name,
            ip,
            status: 'error',
            ping_time: 0,
            packet_loss: 100,
            timestamp: now,
            error: error.message
        };
    }
}

// Ping em todos (usado pelo frontend a cada 10s)
app.get('/api/ping-all', async (req, res) => {
    db.all('SELECT * FROM devices', [], async (err, devices) => {
        if (err) return res.status(500).json({ error: err.message });

        // Pings em paralelo — muito mais rápido do que sequencial
        const results = await Promise.all(
            devices.map(device => executePing(device.id, device.ip_address, device.name))
        );

        res.json(results);
    });
});

// Ping em um específico
app.get('/api/ping/:id', async (req, res) => {
    db.get('SELECT * FROM devices WHERE id = ?', req.params.id, async (err, device) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!device) return res.status(404).json({ error: 'Não encontrado' });

        const result = await executePing(device.id, device.ip_address, device.name);
        res.json(result);
    });
});

// NOVO: Relatório/Histórico de pings
app.get('/api/logs', (req, res) => {
    const { device_id, limit = 100, date_from, date_to } = req.query;
    let query = `
        SELECT l.*, d.name as device_name 
        FROM ping_logs l
        LEFT JOIN devices d ON l.device_id = d.id
        WHERE 1=1
    `;
    const params = [];

    if (device_id) {
        query += ' AND l.device_id = ?';
        params.push(device_id);
    }
    if (date_from) {
        query += ' AND l.timestamp >= ?';
        params.push(date_from);
    }
    if (date_to) {
        query += ' AND l.timestamp <= ?';
        params.push(date_to);
    }

    query += ' ORDER BY l.timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Limpar logs (todos ou por equipamento)
app.delete('/api/logs', (req, res) => {
    const { device_id } = req.query;
    if (device_id) {
        db.run('DELETE FROM ping_logs WHERE device_id = ?', [device_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: `${this.changes} registros removidos.` });
        });
    } else {
        db.run('DELETE FROM ping_logs', [], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: `${this.changes} registros removidos.` });
        });
    }
});

// NOVO: Estatísticas para dashboard
app.get('/api/stats', (req, res) => {
    db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
            SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
            SUM(CASE WHEN packet_loss > 0 AND packet_loss < 100 THEN 1 ELSE 0 END) as warning
        FROM devices
    `, [], (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(stats);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Função para pegar IP local
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// ==================== ROTAS DE EDIÇÃO ====================

// Editar categoria
app.put('/api/categories/:id', (req, res) => {
    const { name, description } = req.body;
    db.run(
        'UPDATE categories SET name = ?, description = ? WHERE id = ?',
        [name, description, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
            res.json({ message: 'Categoria atualizada', id: req.params.id });
        }
    );
});

// Editar equipamento
app.put('/api/devices/:id', (req, res) => {
    const { name, ip_address, category_id } = req.body;
    db.run(
        'UPDATE devices SET name = ?, ip_address = ?, category_id = ? WHERE id = ?',
        [name, ip_address, category_id, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Equipamento não encontrado' });
            res.json({ message: 'Equipamento atualizado', id: req.params.id });
        }
    );
});