const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let derivWS = null;
let isConnected = false;
let currentToken = null;
let balance = 0;
let orders = [];

app.post('/api/connect', (req, res) => {
    const { token, app_id } = req.body;
    if (!token) return res.json({ error: 'Token requerido' });
    
    currentToken = token;
    derivWS = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id || '1089'}`);
    
    derivWS.on('open', () => {
        derivWS.send(JSON.stringify({ authorize: token }));
    });
    
    derivWS.on('message', (data) => {
        const msg = JSON.parse(data);
        
        if (msg.msg_type === 'authorize') {
            isConnected = true;
            // Obtener saldo después de conectar
            derivWS.send(JSON.stringify({ balance: 1 }));
            res.json({ success: true, message: 'Conectado a Deriv', loginid: msg.authorize.loginid });
        }
        
        if (msg.msg_type === 'balance') {
            balance = msg.balance.balance;
        }
        
        if (msg.msg_type === 'buy') {
            const order = {
                id: msg.buy.contract_id,
                price: msg.buy.longcode,
                time: new Date().toLocaleTimeString(),
                status: 'Abierta'
            };
            orders.unshift(order);
            if (orders.length > 10) orders.pop();
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

app.get('/api/balance', (req, res) => {
    if (!derivWS || !isConnected) {
        return res.json({ error: 'No conectado' });
    }
    derivWS.send(JSON.stringify({ balance: 1 }));
    setTimeout(() => {
        res.json({ balance: balance });
    }, 500);
});

app.get('/api/orders', (req, res) => {
    res.json({ orders: orders });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
