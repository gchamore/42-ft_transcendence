import WebSocket from 'ws';

export function safeSend(socket, message) {
	if (socket.readyState === WebSocket.OPEN) {
		try {
			const jsonMessage = JSON.stringify(message);
			socket.send(jsonMessage);
		} catch (e) {
			console.error('Error sending message:', e);
		}
	}
}
