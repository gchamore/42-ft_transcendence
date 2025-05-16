import { user, User, update_user, OtherUser } from './users.js';
import { ASection, go_section, sections, get_type_index, get_url_type, showTwofaVerificationModal, update_sections } from './sections.js';
import { showSuccess, showError, showInfo } from './notifications.js';


export async function verify_token(): Promise<void> {
	try {
		const response = await fetch(`/api/verify_token`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok || !data.success) {
			update_user(undefined);
			return;
		}

		if (user !== undefined && user.name === data.username) {
			return;
		}

		if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN) {
			user.web_socket.close(1000);
		}

		update_user(new User(data.username, data.id, data.email, data.avatar));

	} catch (error) {
		// console.error("/api/verify_token error:", error);
		showError("Session expired");
		update_user(undefined);
	}
}

export async function register(username: string, password: string) {
	try {
		if (username.length > 50 || password.length > 50) {
			showError("Username or Password too long");
			return;
		}
		const response = await fetch(`/api/register`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ username: username, password: password })
		});
		const data = await response.json();

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Registering failed";
			showError(errorMessage);
		}
		else if (data.success) {
			update_user(new User(data.username, data.id));
			showSuccess(`Welcome, ${data.username} !`);
		}

	} catch (error) {
		// console.error("/api/register error:", error);
		showError("Sorry, Registering failed");
	}
}

export async function login(username: string, password: string) {
	try {
		if (username.length > 50 || password.length > 50) {
			showError("Username or Password too long");
			return;
		}
		const response = await fetch(`/api/login`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ username, password })
		});
		const data = await response.json();

		if (data.step === "2fa_required") {
			showTwofaVerificationModal(data.temp_token, username);
			return;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Login failed";
			showError(errorMessage);
			return;
		}

		update_user(new User(data.username, data.id, data.email, data.avatar));
		showSuccess(`Welcome back, ${data.username} !`);

	} catch (error) {
		// console.error("/api/login error:", error);
		showError("Sorry, login failed");
	}
}

export async function logout(): Promise<void> {
	try {
		const response = await fetch(`/api/logout`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401 || !response.ok || !data.success) {
			if (user?.web_socket?.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Logout failed";
			showError(errorMessage);
			check_redirect();
			return;
		}

		if (user?.web_socket?.readyState === WebSocket.OPEN)
			user.web_socket.close(1000);
		update_user(undefined);
		showSuccess(`Successfully\nlogged out!`);

	} catch (error) {
		// console.error("/api/logout error:", error);
		showError("Sorry, logout failed");
	}
}

export async function search(friend_username: string): Promise<OtherUser | Error | undefined> {
	try {
		if (friend_username.length > 50) {
			showError("Username too long");
			return undefined;
		}
		const response = await fetch(`/api/search/${friend_username}`, {
			method: "GET",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return undefined;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Search failed";
			showError(errorMessage);
			return undefined;
		}
		else if (data.success) {
			if (data.isFriend)
				return new OtherUser(data.user.username, data.isFriend, data.user.isConnected,
					data.user.friendSince, data.user.winRate, data.user.gamesTogether);
			return new OtherUser(data.user.username, data.isFriend, data.user.isConnected,
				data.user.createdAt, data.user.winRate, data.user.gamesPlayed);
		}

	} catch (error) {
		// console.error(`/api/search/${friend_username} error:`, error);
		showError("Sorry, search failed");
	}
	return undefined;
}

export async function add(friend_username: string): Promise<boolean | Error> {
	try {
		if (friend_username.length > 50) {
			showError("Username too long");
			return false;
		}
		const response = await fetch(`/api/add/${friend_username}`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Adding friend failed";
			showError(errorMessage);
			return false;
		}
		showInfo(`User ${friend_username}\nAdded !`);
		return data.success;

	} catch (error) {
		// console.error(`/api/add/${friend_username} error:`, error);
		showError("Sorry, adding friend failed");
		return false;
	}
}

export async function remove(friend_username: string): Promise<boolean | Error> {
	try {
		if (friend_username.length > 50) {
			showError("Username too long");
			return false;
		}
		const response = await fetch(`/api/remove/${friend_username}`, {
			method: "DELETE",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "remove friend failed";
			showError(errorMessage);
			return false;
		}
		showInfo(`User ${friend_username}\nremoved from friends !`);
		return data.success;

	} catch (error) {
		// console.error(`/api/remove/${friend_username} error:`, error);
		showError("Sorry, removing friend failed");
		return false;
	}
}

export async function send(message: string, type: string, to: string = ''): Promise<boolean> {
	let url;
	let body;

	try {
		if (type === 'livechat') {
			url = '/api/live_chat_message';
			body = { message: message };
		}
		else /*(type === 'direct_message') */ {
			url = '/api/direct_chat_message';
			body = { to: to, message: message };
		}
		const response = await fetch(url, {
			method: "POST",
			credentials: 'include',
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Sending message failed";
			alert(errorMessage);
			return false;
		}
		return data.success;

	} catch (error) {
		// console.error(`/api/${type} error:`, error);
		showError("Sorry, sending message failed");
		return false;
	}
}

export interface t_DirectMessage {
	id: number;
	content: string;
	sent_at: string;
	sender: string;
}

export interface ChatResponse {
	messages: t_DirectMessage[];
}

export async function get_direct_messages(username: string): Promise<ChatResponse | undefined> {
	try {
		const response = await fetch(`/api/chats/${username}`, {
			method: "GET",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return undefined;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Getting messages history failed";
			showError(errorMessage);
			return undefined;
		}
		return data;
	} catch (error) {
		// console.error(`/api/chats/${username} error:`, error);
		showError("Sorry, fetching messages failed");
		return undefined;
	}
}

export async function get_blocked_users(): Promise<Array<string> | undefined> {
	try {
		const response = await fetch(`/api/blocked`, {
			method: "GET",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return undefined;
		}

		if (!response.ok || !data.success) {
			return undefined;
		}

		return data.blockedUsers;
	} catch (error) {
		// console.error(`/api/blocked error:`, error);
		showError("Sorry, getting blocked users failed");
		return undefined;
	}
}

export async function block(username: string): Promise<boolean> {
	try {
		if (username.length > 50) {
			showError("Username too long");
			return false;
		}
		const response = await fetch(`/api/block/${username}`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Blocking user failed";
			showError(errorMessage);
			return false;
		}
		showInfo(`User ${username}\nBlocked !`);
		return data.success;

	} catch (error) {
		// console.error(`/api/block/${username} error:`, error);
		showError("Sorry, blocking user failed");
		return false;
	}
}

export async function unblock(username: string): Promise<boolean> {
	try {
		if (username.length > 50) {
			showError("Username too long");
			return false;
		}
		const response = await fetch(`/api/unblock/${username}`, {
			method: "DELETE",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Unblocking user failed";
			showError(errorMessage);
			return false;
		}
		showInfo(`User ${username}\nUnblocked !`);
		return data.success;

	} catch (error) {
		// console.error(`/api/unblock/${username} error:`, error);
		showError("Sorry, unblocking user failed");
		return false;
	}
}

export async function setup2fa(): Promise<{ otpauth_url: string, qrCode: string } | undefined> {
	try {
		const response = await fetch('/api/2fa/setup', {
			method: 'POST',
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return undefined;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "2FA setup failed";
			showError(errorMessage);
			return undefined;
		}

		return {
			otpauth_url: data.otpauth_url,
			qrCode: data.qrCode
		};
	} catch (error) {
		// console.error('/api/2fa/setup error:', error);
		showError("Sorry, 2FA setup failed");
		return undefined;
	}
}

export async function activate2fa(token: string): Promise<boolean> {
	try {
		const response = await fetch('/api/2fa/activate', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ token })
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "2FA activation failed";
			showError(errorMessage);
			return false;
		}
		showInfo(`2FA activated !`);
		return data.success;
	} catch (error) {
		// console.error('/api/2fa/activate error:', error);
		showError("Sorry, 2FA activation failed");
		return false;
	}
}

export async function update(
	username: string, email: string,
	old_password: string, new_password: string): Promise<boolean> {
	// console.log(old_password);
	try {
		let body = { username: username, email: email, old_password: old_password, new_password: new_password };
		const response = await fetch('/api/update', {
			method: 'PUT',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}
		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Updating account failed";
			showError(errorMessage);
			return false;
		}
		showSuccess(`Account updated !`);
		return true;
	} catch (error) {
		// console.error('/api/update error:', error);
		showError("Sorry, updating account failed");
	}
	return false;
}

export async function verify2fa(token: string, temp_token: string): Promise<boolean> {
	try {
		const response = await fetch('/api/2fa/verify', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ token, temp_token })
		});
		const data = await response.json();

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "2FA verification failed";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (data.success) {
			update_user(new User(data.username, data.id));
			showSuccess(`Welcome back, ${data.username} !`);
		}

		return data.success;
	} catch (error) {
		// console.error('/api/2fa/verify error:', error);
		showError("Sorry, 2FA verification failed");
		return false;
	}
}

export async function disable2fa(password?: string): Promise<boolean> {
	try {
		if (password && password.length > 50) {
			showError("Password too long");
			return false;
		}
		const response = await fetch('/api/2fa/disable', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ password })
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok || !data.success) {
			const errorMessage = data?.error || "Disabling 2FA failed";
			showError(errorMessage);
			return false;
		}

		return data.success;
	} catch (error) {
		// console.error('/api/2fa/disable error:', error);
		showError("Sorry, disabling 2FA failed");
		return false;
	}
}

export async function get2faStatus(): Promise<boolean | undefined> {
	try {
		const response = await fetch('/api/2fa/status', {
			method: 'GET',
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return undefined;
		}

		if (!response.ok || !data.success) {
			return undefined;
		}

		return data.enabled;
	} catch (error) {
		// console.error('/api/2fa/status error:', error);
		showError("Sorry, getting 2FA status failed");
		return undefined;
	}
}

export async function getUserAccountType(): Promise<{ is_google_account: boolean, has_password: boolean } | undefined> {
	try {
		const response = await fetch('/api/auth/account_type', {
			method: 'GET',
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return undefined;
		}

		if (!response.ok || !data.success) {
			return undefined;
		}

		return data.data;
	} catch (error) {
		// console.error('/api/auth/account_type error:', error);
		showError("Sorry, impossible to get your account");
		return undefined;
	}
}

export async function initiateGoogleLogin() {
	try {
		const clientId = '719179054785-2jaf8669fv3kj0qk6ib8cmtumlb23e8a.apps.googleusercontent.com';
		const redirectUri = `https://swan-genuine-cattle.ngrok-free.app/oauth-callback`;
		const scope = 'email profile';
		const responseType = 'code';
		const accessType = 'offline';
		const prompt = 'consent';

		const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
			`client_id=${encodeURIComponent(clientId)}` +
			`&redirect_uri=${encodeURIComponent(redirectUri)}` +
			`&response_type=${encodeURIComponent(responseType)}` +
			`&scope=${encodeURIComponent(scope)}` +
			`&access_type=${encodeURIComponent(accessType)}` +
			`&prompt=${encodeURIComponent(prompt)}`;

		window.location.href = googleAuthUrl;

	} catch (error) {
		console.error('Failed to initiate Google login:', error);
	}
}

export async function processGoogleOAuth(code: string): Promise<void> {
	try {
		const response = await fetch('/api/auth/google', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({ code })
		});

		const data = await response.json();

		if (response.status === 202 && data.step === "choose_username") {
			const username = prompt("Please choose a username:");
			if (username) {
				if (username.length > 50) {
					showError("Username too long");
					return;
				}
				await completeGoogleRegistration(username, data.temp_token);
			}
			return;
		} else if (response.status === 202 && data.step === "2fa_required") {
			showTwofaVerificationModal(data.temp_token, "your Google account");
			return;
		} else if (response.ok && data.success) {
			update_user(new User(data.username));
			showSuccess(`Welcome back, ${data.username} !`);
		} else {
			showError("Failed to process Google OAuth");
		}

	} catch (error) {
		// console.error("api/auth/google error:", error);
		showError("Failed to process Google OAuth");
	}
}

async function completeGoogleRegistration(username: string, tempToken: string): Promise<void> {
	try {
		const response = await fetch('/api/auth/google/username', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify({
				username,
				temp_token: tempToken
			})
		});

		const data = await response.json();

		if (response.status === 202 && data.step === "2fa_required") {
			showTwofaVerificationModal(data.temp_token, username);
			return;
		} else if (response.ok && data.success) {
			update_user(new User(data.username, data.id, data.email, data.avatar));
			showSuccess(`Welcome, ${data.username} !`);
		} else {
			showError("Failed to complete Google registration");
		}

	} catch (error) {
		// console.error("api/auth/google/username error:", error);
		showError("Failed to complete Google registration");
	}
}

export async function updateAvatar(file: File): Promise<boolean> {
	try {
		const maxSize = 2 * 1024 * 1024;
		if (file.size > maxSize) {
			showError("File size exceeds 2MB");
			return false;
		}

		const formData = new FormData();
		formData.append('avatar', file);

		const response = await fetch('/api/update_avatar', {
			method: 'PUT',
			body: formData,
			credentials: 'include'
		});

		const text = await response.text();
		let data;
		try {
			data = JSON.parse(text);
		} catch (e) {
			showError("Updating avatar failed");
			return false;
		}

		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			return false;
		}

		if (!response.ok) {
			const errorMessage = data?.error || "Updating avatar failed";
			showError(errorMessage);
			return false;
		}

		if (data.success && user) {
			const avatarElements = document.querySelectorAll('.avatar.logged-in') as NodeListOf<HTMLImageElement>;
			avatarElements.forEach(avatar => {
				avatar.src = `${data.user.avatar}?${Date.now()}`;
			});
			showInfo("Avatar updated successfully!");
			return true;
		}
		return false;
	} catch (error) {
		// console.error('/api/update_avatar error:', error);
		showError("Updating avatar failed");
		return false;
	}
}

export async function getGameHistory(userId: string) {
	try {
		const response = await fetch(`/api/game/history/${userId}`, {
			method: 'GET',
			credentials: 'include',
			headers: { "Content-Type": "application/json" }
		});
		const data = await response.json();
		if (response.status === 401) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			const errorMessage = data?.error || "Session expired";
			showError(errorMessage);
			check_redirect();
			throw new Error('Failed to fetch game history');
		}
		if (!response.ok || !data.success) {
			throw new Error('Failed to fetch game history');
		}
		return data.games;
	} catch (error) {
		// console.error('/api/game/history error:', error);
		showError("Fetching game history failed");
		return;
	}
}

export async function unregister(password?: string): Promise<boolean> {
	try {
		const response = await fetch("/api/unregister", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ password }),
			credentials: "include",
		});

		const data = await response.json();

		if (response.status === 401 || !data.success || !response.ok) {
			if (user?.web_socket?.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);

			if (response.status === 401) {
				const errorMessage = data?.error || "Session expired";
				showError(errorMessage);
				check_redirect();
				return false;
			}

			const errorMessage = data?.error || "Unregistering failed";
			showError(errorMessage);
			return false;
		}

		if (user?.web_socket?.readyState === WebSocket.OPEN)
			user.web_socket.close(1000);
		update_user(undefined);
		showSuccess("Account unregistered successfully!");
		return true;

	} catch (error) {
		// console.error('/api/unregister error:', error);
		showError("Sorry, unregistering failed");
		return false;
	}
}

async function check_redirect() {
	let type = get_url_type(window.location.pathname);
	let type_index = get_type_index(type);
	
	if (type_index === undefined || (sections[type_index] as ASection).protected === true)
		await go_section('home', '');
	else
		update_sections();
}
