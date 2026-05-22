const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let derivWS = null;
let isConnected = false;
let currentTicks = {};
let activeSymbol = 'R_100';

// Suscripción a ticks del símbolo activo
function subscribeToTicks(symbol) {
    if (!derivWS || !isConnected) return;
    // Desuscribir del anterior
    if (activeSymbol) {
        derivWS.send(JSON.stringify({ forget: activeSymbol }));
    }
    activeSymbol = symbol;
    // Suscribirse al nuevo
    derivWS.send(JSON.stringify({
        ticks: symbol,
        subscribe: 1
    }));
}

app.post('/api/connect', (req, res) => {
    const { token, app_id } = req.body;
    if (!token) return res.json({ error: 'Token requerido' });
    
    derivWS = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id || '1089'}`);
    
    derivWS.on('open', () => {
        derivWS.send(JSON.stringify({ authorize: token }));
    });
    
    derivWS.on('message', (data) => {
        const msg = JSON.parse(data);
        
        if (msg.msg_type === 'authorize') {
            isConnected = true;
            // Suscribirse a ticks por defecto
            subscribeToTicks('R_100');
            // Obtener saldo
            derivWS.send(JSON.stringify({ balance: 1 }));
            res.json({ success: true, message: 'Conectado a Deriv', loginid: msg.authorize.loginid });
        }
        
        if (msg.msg_type === 'tick') {
            const symbol = msg.tick.symbol;
            if (!currentTicks[symbol]) currentTicks[symbol] = [];
            currentTicks[symbol].push({
                price: msg.tick.quote,
                time: Date.now()
            });
            // Mantener solo últimos 50 ticks
            if (currentTicks[symbol].length > 50) currentTicks[symbol].shift();
        }
        
        if (msg.msg_type === 'balance') {
            currentBalance = msg.balance.balance;
        }
    });
    
    setTimeout(() => {
        if (!isConnected) res.json({ error: 'Timeout de conexión' });
    }, 10000);
});

app.post('/api/buy', (req, res) => {
    if (!derivWS || !isConnected) {
        return res.json({ error: 'No conectado a Deriv' });
    }
    const { symbol = "R_100", amount = 1, duration = 5, contract_type = "CALL" } = req.body;
    derivWS.send(JSON.stringify({
        buy: 1,
        parameters: { symbol, amount, contract_type, duration, duration_unit: "t" }
    }));
    res.json({ success: true, message: 'Orden enviada', type: contract_type });
});

app.get('/api/ticks/:symbol', (req, res) => {
    const symbol = req.params.symbol;
    res.json({ ticks: currentTicks[symbol] || [] });
});

app.post('/api/subscribe', (req, res) => {
    const { symbol } = req.body;
    if (derivWS && isConnected) {
        subscribeToTicks(symbol);
        res.json({ success: true, symbol });
    } else {
        res.json({ error: 'No conectado' });
    }
});

app.get('/api/balance', (req, res) => {
    if (derivWS && isConnected) {
        derivWS.send(JSON.stringify({ balance: 1 }));
        setTimeout(() => {
            res.json({ balance: currentBalance || 0 });
        }, 500);
    } else {
        res.json({ error: 'No conectado' });
    }
});

let currentBalance = 0;
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
