import { user, User, update_user, OtherUser } from './users.js';
import { showTwofaVerificationModal } from './sections.js';

export async function verify_token(): Promise<void> {
	try {
		const response = await fetch(`/api/verify_token`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");

		}

		if (!response.ok)
			console.error("/api/verify_token failed:", data.error);
		else if (data.valid) {
			if (user !== undefined && user.name === data.username)
				return;

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(new User(data.username, data.id, data.email, data.avatar));
			return;
		}

	} catch (error) {
		console.error("/api/verify_token error:", error);
	}

	update_user(undefined);
}

export async function register(username: string, password: string) {
	try {
		const response = await fetch(`/api/register`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ username: username, password: password })
		});
		const data = await response.json();

		if (!response.ok)
			console.error("/api/register failed:", data.error);
		else if (data.success) {
			update_user(new User(data.username, data.id));

			console.log(username, "registered");
		}

	} catch (error) {
		console.error("/api/register error:", error);
	}
}

export async function login(username: string, password: string) {
	try {
		const response = await fetch(`/api/login`, {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ username: username, password: password })
		});
		const data = await response.json();

		if (!response.ok)
			console.error("/api/login failed:", data.error);
		else if (data.success) {
			update_user(new User(data.username, data.id, data.email, data.avatar));
			console.log(username, "logged-in");
		}
		else if (data.step === "2fa_required") {
			showTwofaVerificationModal(data.temp_token, username);
			return;
		}

	} catch (error) {
		console.error("/api/login error:", error);
	}
}

export async function logout() {
	try {
		const response = await fetch(`/api/logout`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok)
			console.error("/api/logout failed:", data.error);
		else if (data.success) {
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
		}

	} catch (error) {
		console.error("/api/logout error:", error);
	}
}

export async function search(friend_username: string): Promise<OtherUser | Error | undefined> {
	try {
		const response = await fetch(`/api/search/${friend_username}`, {
			method: "GET",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return new Error();
		}

		if (!response.ok)
			console.error(`/api/search/${friend_username} failed:`, data.error);
		else if (data.success) {
			console.log(data.user.isConnected);
			if (data.isFriend)
				return new OtherUser(data.user.username, data.isFriend, data.user.isConnected,
					data.user.friendSince, data.user.winRate, data.user.gamesTogether);
			return new OtherUser(data.user.username, data.isFriend, data.user.isConnected,
				data.user.createdAt, data.user.winRate, data.user.gamesPlayed);
		}

	} catch (error) {
		console.error(`/api/search/${friend_username} error:`, error);
	}

	return undefined;
}

export async function add(friend_username: string): Promise<boolean | Error> {
	try {
		const response = await fetch(`/api/add/${friend_username}`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return new Error();
		}

		if (!response.ok)
			console.error(`/api/add/${friend_username} failed:`, data.error);
		return data.success;

	} catch (error) {
		console.error(`/api/add/${friend_username} error:`, error);
	}

	return false;
}

export async function remove(friend_username: string): Promise<boolean | Error> {
	try {
		const response = await fetch(`/api/remove/${friend_username}`, {
			method: "DELETE",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return new Error();
		}

		if (!response.ok)
			console.error(`/api/remove/${friend_username} failed:`, data.error);
		return data.success;

	} catch (error) {
		console.error(`/api/remove/${friend_username} error:`, error);
	}

	return false;
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
			console.error("Unauthorized!");

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return false;
		}

		if (!response.ok) {
			console.error(url + ' error: ', data.error);
			return true;
		}
		return data.success;

	} catch (error) {
		console.error(url + ' error: ', error);
	}

	return true;
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

export async function get_direct_messages(username : string): Promise<ChatResponse | undefined> {
	try {
		const response = await fetch(`/api/chats/${username}`, {
			method: "GET",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok) {
			return undefined;
		}
		return data;
	} catch (error) {
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
			console.error("Unauthorized!");

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return undefined;
		}

		if (!response.ok) {
			console.error(`/api/blocked failed:`, data.error);
			return undefined;
		}

		return data.blockedUsers;
	} catch (error) {
		console.error(`/api/blocked error:`, error);
	}

	return undefined;
}

export async function block(username: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/block/${username}`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return false;
		}

		if (!response.ok) {
			console.error(`/api/block/${username} failed:`, data.error);
			return false;
		}
		return data.success;

	} catch (error) {
		console.error(`/api/block/${username} error:`, error);
	}

	return false;
}

export async function unblock(username: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/unblock/${username}`, {
			method: "DELETE",
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");

			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return false;
		}

		if (!response.ok) {
			console.error(`/api/unblock/${username} failed:`, data.error);
			return false;
		}
		return data.success;

	} catch (error) {
		console.error(`/api/unblock/${username} error:`, error);
	}

	return false;
}

export async function setup2fa(): Promise<{ otpauth_url: string, qrCode: string } | undefined> {
	try {
		const response = await fetch('/api/2fa/setup', {
			method: 'POST',
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return undefined;
		}

		if (!response.ok) {
			console.error('/api/2fa/setup failed:', data.error);
			return undefined;
		}

		return {
			otpauth_url: data.otpauth_url,
			qrCode: data.qrCode
		};
	} catch (error) {
		console.error('/api/2fa/setup error:', error);
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
			console.error("Unauthorized!");
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return false;
		}

		if (!response.ok) {
			console.error('/api/2fa/activate failed:', data.error);
			return false;
		}

		return data.success;
	} catch (error) {
		console.error('/api/2fa/activate error:', error);
		return false;
	}
}

export async function update(
    username : string, email : string,
    old_password : string, new_password : string): Promise<boolean> {
    console.log(old_password);
    try {
        let body = {username : username, email : email, old_password : old_password, new_password : new_password};
        const response = await fetch('/api/update', {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();

        if (!response.ok) {
            console.error('/api/update failed:', data.error);
            return false;
        }

        if (data.success) {
            console.log('accepted');
            return true;
        }
    } catch (error) {
        console.error('/api/2fa/verify error:', error);
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

		if (!response.ok) {
			console.error('/api/2fa/verify failed:', data.error);
			return false;
		}

		if (data.success) {
			update_user(new User(data.username, data.id));
			console.log(data.username, "verified with 2FA");
		}

		return data.success;
	} catch (error) {
		console.error('/api/2fa/verify error:', error);
		return false;
	}
}

export async function disable2fa(password?: string): Promise<boolean> {
	try {
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
			console.error("Unauthorized!");
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return false;
		}

		if (!response.ok) {
			console.error('/api/2fa/disable failed:', data.error);
			return false;
		}

		return data.success;
	} catch (error) {
		console.error('/api/2fa/disable error:', error);
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
			console.error("Unauthorized!");
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return undefined;
		}

		if (!response.ok) {
			console.error('/api/2fa/status failed:', data.error);
			return undefined;
		}

		return data.enabled;
	} catch (error) {
		console.error('/api/2fa/status error:', error);
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
			console.error("Unauthorized!");
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return undefined;
		}

		if (!response.ok) {
			console.error('/api/auth/account_type failed:', data.error);
			return undefined;
		}

		return data.data;
	} catch (error) {
		console.error('/api/auth/account_type error:', error);
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
				await completeGoogleRegistration(username, data.temp_token);
			}
			return;
		} else if (response.status === 202 && data.step === "2fa_required") {
			showTwofaVerificationModal(data.temp_token, "your Google account");
			return;
		} else if (response.ok && data.success) {
			update_user(new User(data.username));
			console.log(`Google login successful as ${data.username}`);
		} else {
			console.error("Google OAuth error:", data.error || "Unknown error");
		}

	} catch (error) {
		console.error("Error processing Google OAuth:", error);
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
			console.log(`Google registration complete as ${data.username}`);
		} else {
			alert(data.error || "Failed to complete registration");
			console.error("Google registration error:", data.error || "Unknown error");
		}

	} catch (error) {
		console.error("Error completing Google registration:", error);
	}
}

export async function updateAvatar(file: File): Promise<boolean> {
	try {
		const formData = new FormData();
		formData.append('avatar', file);

		const response = await fetch('/api/update_avatar', {
			method: 'PUT',
			body: formData,
			credentials: 'include'
		});
		const data = await response.json();

		if (response.status === 401) {
			console.error("Unauthorized!");
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return false;
		}

		if (!response.ok) {
			console.error('/api/update_avatar failed:', data.error);
			return false;
		}

		if (data.success && user) {
			const avatarElements = document.querySelectorAll('.avatar.logged-in') as NodeListOf<HTMLImageElement>;
			avatarElements.forEach(avatar => {
				avatar.src = `${data.user.avatar}?${Date.now()}`;
			});
			return true;
		}
		return false;
	} catch (error) {
		console.error('/api/update_avatar error:', error);
		return false;
	}
}


export async function getGameHistory(userId: string) {
    const resp = await fetch(`/api/game/history/${userId}`, {
        method: 'GET',
        credentials: 'include',
        headers: { "Content-Type": "application/json" }
    });
    if (!resp.ok) throw new Error('Failed to fetch game history');
    return (await resp.json()).games;
}


export async function unregister(password?: string): Promise<boolean> {
	try {
		const response = await fetch("/api/unregister", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ password }),
		});

		const data = await response.json();
		if (response.status === 401) {
			console.error("Unauthorized!");
			if (user?.web_socket && user?.web_socket.readyState === WebSocket.OPEN)
				user.web_socket.close(1000);
			update_user(undefined);
			return false;
		}
		if (!response.ok) {
			console.error('Fail to unregister:', data.error);
			return false;
		}

		return data.success;
	} catch (error) {
		console.error('Fail to unregister:', error);
		return false;
	}
}