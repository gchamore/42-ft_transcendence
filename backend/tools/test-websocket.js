wss.on('connection', (ws) => {
    console.log("✅ Nouvelle connexion WebSocket !");
    
    ws.on('message', (message) => {
        console.log("📩 Message reçu :", message.toString());
    });

    ws.on('close', () => {
        console.log("🔴 Connexion WebSocket fermée.");
    });
});



// npm install ws
// npm list ws
// node ./backend/tools/test-websocket.js
