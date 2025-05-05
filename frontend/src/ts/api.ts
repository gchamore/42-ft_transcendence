import { user, User, update_user, OtherUser } from './users.js';

export async function verify_token(): Promise<void> {
	console.log('verify_token()');
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
			update_user(new User(data.username));
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
			update_user(new User(data.username, data.id));

			console.log(username, "logged-in");
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
			if (data.isFriend)
				return new OtherUser(friend_username, data.isFriend, data.user.isConnected,
					data.user.friendSince, data.user.winRate, data.user.gamesTogether);
			return new OtherUser(friend_username, data.isFriend, data.user.isConnected,
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

export async function get_blocked_users(): Promise<Array<string> | Error> {
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

async function block(username : string): Promise<boolean> {
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

async function unblock(username : string): Promise<boolean> {
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
