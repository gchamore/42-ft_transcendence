async function verify_token(): Promise<void> {
	console.log('verify_token()');
	try {
		const response = await fetch(`/api/verify_token`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok)
			console.error("/api/verify_token failed:", data.error);
		else if (data.valid) {
			console.log(data.username, "authenticated");
			
			update_user(new User(data.username));
			return;
		}

    } catch (error) {
		console.error("/api/verify_token error:", error);
    }

	update_user(undefined);
}

async function register(username: string, password: string) {
	try {
		const response = await fetch(`/api/register`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json"
			},
			body: JSON.stringify({username: username, password: password})
		});
		const data = await response.json();
		
		if (!response.ok)
			console.error("/api/register failed:", data.error);
        else if (data.success) {
			update_user(new User(data.username));
			console.log(username, "registered");
		}

    } catch (error) {
		console.error("/api/register error:", error);
    }
}

async function login(username: string, password: string) {
	try {
        const response = await fetch(`/api/login`, {
            method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json"
			},
			body: JSON.stringify({username: username, password: password})
		});
		const data = await response.json();

		if (!response.ok)
			console.error("/api/login failed:", data.error);
        else if (data.success) {
			update_user(new User(data.username));
			console.log(username, "logged-in");
		}

    } catch (error) {
		console.error("/api/login error:", error);
    }
}

async function logout() {
	try {
        const response = await fetch(`/api/logout`, {
            method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok)
			console.error("/api/logout failed:", data.error);
        else if (data.success) {
			console.log(user?.name, "logged-out");
			update_user(undefined);
		}

    } catch (error) {
		console.error("/api/logout error:", error);
    }
}

async function search(friend_username : string): Promise<OtherUser | undefined> {
	try {
        const response = await fetch(`/api/search/${friend_username}`, {
            method: "GET",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok)
			console.error(`/api/search/${friend_username} failed:`, data.error);
        else if (data.success) {
			if (data.isFriend)
				return new OtherUser(friend_username, data.isFriend, data.user.is_connected,
									data.user.friendSince, data.user.winRate, data.user.gamesTogether);
			return new OtherUser(friend_username, data.isFriend, false,
								data.user.createdAt, data.user.winRate, data.user.gamesPlayed);
		}

    } catch (error) {
		console.error(`/api/search/${friend_username} error:`, error);
    }

	return undefined;
}

async function add(friend_username : string): Promise<boolean> {
	try {
        const response = await fetch(`/api/add/${friend_username}`, {
            method: "POST",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok)
			console.error(`/api/add/${friend_username} failed:`, data.error);
        return data.success;

    } catch (error) {
		console.error(`/api/add/${friend_username} error:`, error);
    }

	return false;
}

async function remove(friend_username : string): Promise<boolean> {
	try {
        const response = await fetch(`/api/remove/${friend_username}`, {
            method: "DELETE",
			credentials: 'include'
		});
		const data = await response.json();

		if (!response.ok)
			console.error(`/api/remove/${friend_username} failed:`, data.error);
		return data.success;

    } catch (error) {
		console.error(`/api/remove/${friend_username} error:`, error);
    }

	return false;
}
