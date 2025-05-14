export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationOptions {
	message: string;
	type: NotificationType;
	duration?: number;
}

export function showNotification(options: NotificationOptions): void {
	// Get or create notification container
	let container = document.getElementById('notification-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'notification-container';
		document.body.appendChild(container);
	}

	// Create notification element
	const notification = document.createElement('div');
	notification.className = `notification ${options.type}`;

	// Create content
	const content = document.createElement('div');
	content.className = 'notification-content';

	// Add message
	const message = document.createElement('div');
	message.className = 'notification-message';
	message.innerHTML = options.message.replace(/\n/g, '<br>');
	content.appendChild(message);

	// Add close button
	const closeBtn = document.createElement('button');
	closeBtn.className = 'notification-close';
	closeBtn.innerHTML = '&times;';
	closeBtn.onclick = () => removeNotification(notification);
	content.appendChild(closeBtn);

	// Add content to notification
	notification.appendChild(content);

	// Add to container
	container.appendChild(notification);

	// Make visible after a small delay (for animation)
	setTimeout(() => {
		notification.classList.add('visible');
	}, 10);

	// Auto remove after duration
	const duration = options.duration || 5000; // Default 5 seconds
	setTimeout(() => {
		removeNotification(notification);
	}, duration);
}

function removeNotification(notification: HTMLElement): void {
	notification.classList.remove('visible');

	setTimeout(() => {
		if (notification.parentNode) {
			notification.parentNode.removeChild(notification);
		}
	}, 300);
}

export function showSuccess(message: string, duration?: number): void {
	showNotification({ message, type: 'success', duration });
}

export function showError(message: string, duration?: number): void {
	showNotification({ message, type: 'error', duration });
}

export function showInfo(message: string, duration?: number): void {
	showNotification({ message, type: 'info', duration });
}