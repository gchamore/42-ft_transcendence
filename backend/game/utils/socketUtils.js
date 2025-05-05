import WebSocket from 'ws';

export function safeSend(socket, message) {
	if (socket.readyState === WebSocket.OPEN) {
		try {
			const jsonMessage = JSON.stringify(message);
			socket.send(jsonMessage);
		} catch (e) {
			console.error('Error sending message:', e);
		}
	} else {
		// console.warn('Cannot send message, socket state:', {
		// 	current: socket.readyState,
		// 	states: {
		// 		CONNECTING: WebSocket.CONNECTING,
		// 		OPEN: WebSocket.OPEN,
		// 		CLOSING: WebSocket.CLOSING,
		// 		CLOSED: WebSocket.CLOSED
		// 	},
		// 	expectedState: `OPEN (${WebSocket.OPEN})`
		// });
	}
}