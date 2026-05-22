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
    console.log('Intentando conectar con token:', token ? 'Token recibido' : 'No token');
    
    if (!token) {
        return res.json({ error: 'Token requerido' });
    }
    
    try {
        derivWS = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id || '1089'}`);
        
        derivWS.on('open', () => {
            console.log('WebSocket abierto, autorizando...');
            derivWS.send(JSON.stringify({ authorize: token }));
        });
        
        derivWS.on('message', (data) => {
            const msg = JSON.parse(data);
            console.log('Mensaje recibido:', msg.msg_type);
            
            if (msg.msg_type === 'authorize') {
                isConnected = true;
                console.log('Autorizado correctamente');
                res.json({ success: true, message: 'Conectado a Deriv', loginid: msg.authorize.loginid });
            }
            
            if (msg.msg_type === 'error') {
                console.log('Error de Deriv:', msg.error);
                res.json({ error: msg.error.message });
            }
        });
        
        derivWS.on('error', (error) => {
            console.log('Error WebSocket:', error);
            res.json({ error: 'Error de conexión WebSocket' });
        });
        
        setTimeout(() => {
            if (!isConnected) {
                console.log('Timeout de conexión');
                res.json({ error: 'Timeout de conexión - Revisa tu token' });
            }
        }, 10000);
        
    } catch (error) {
        console.log('Error general:', error);
        res.json({ error: 'Error interno: ' + error.message });
    }
});

app.post('/api/buy', (req, res) => {
    if (!derivWS || !isConnected) {
        return res.json({ error: 'No conectado a Deriv - Primero conecta con tu token' });
    }
    
    const { symbol = "R_100", amount = 1, duration = 5, contract_type = "CALL" } = req.body;
    console.log('Comprando:', { symbol, amount, duration, contract_type });
    
    derivWS.send(JSON.stringify({
        buy: 1,
        parameters: { symbol, amount, contract_type, duration, duration_unit: "t" }
    }));
    
    res.json({ success: true, message: 'Orden enviada', type: contract_type });
});

app.get('/api/status', (req, res) => {
    res.json({ connected: isConnected });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
