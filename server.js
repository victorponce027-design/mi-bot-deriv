const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let derivWS = null;
let isConnected = false;

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
            res.json({ success: true, message: 'Conectado a Deriv' });
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
    const { symbol = "R_100", amount = 1, duration = 5 } = req.body;
    derivWS.send(JSON.stringify({
        buy: 1,
        parameters: { symbol, amount, contract_type: "CALL", duration, duration_unit: "t" }
    }));
    res.json({ success: true, message: 'Orden enviada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
