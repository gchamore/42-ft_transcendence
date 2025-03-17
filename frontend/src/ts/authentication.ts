let username : string | undefined = undefined;

function assign_username(new_username: string | undefined) {
	username = new_username;
	if (username)
		(document.getElementById("profile-username") as HTMLLabelElement)
			.textContent = username;
	else
		(document.getElementById("profile-username") as HTMLLabelElement)
			.textContent = "";
}

async function verify_token(): Promise<User| undefined> {
	console.log('verify_token()');
	try {
		const response = await fetch(`/api/verify_token`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();
		if (!response.ok) {
			console.error("Verify token failed:", data.error);
			return undefined;
		}

		if (data.valid) {
			console.log(data.username, "authenticated");
			return new User(data.username);
		}

		console.log("Not authenticated");
		return undefined;
    } catch (error) {
		console.error("Error:", error);
    }
	return undefined;
}

async function register(_username: string, _password: string) {
	try {
		const response = await fetch(`/api/register`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json"
			},
			body: JSON.stringify({username: _username, password: _password})
		});
		const data = await response.json();
		if (!response.ok) {
			console.error("Registration failed:", data.error);
			return ;
		}
        
		if (data.success) {
			assign_username(_username);
			console.log(username, "register");
		}
		else
			console.log("Not register");
    } catch (error) {
		console.error("Error:", error);
    }
}

async function login(_username: string, _password: string) {
	try {
        const response = await fetch(`/api/login`, {
            method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json"
			},
			body: JSON.stringify({username: _username, password: _password})
		});
		const data = await response.json();
		if (!response.ok) {
            console.error("Login failed:", data.error);
			return ;
		}

		if (data.success) {
			assign_username(_username);
			console.log(_username, "login");
		}
		else
			console.log("Not login");
    } catch (error) {
		console.error("Error:", error);
    }
}

async function logout() {
	try {
        const response = await fetch(`/api/logout`, {
            method: "POST",
			credentials: 'include'
		});
		const data = await response.json();
		if (!response.ok) {
            console.error("Logout failed:", data.error);
			return ;
		}

		if (data.success) {
			assign_username(undefined);
			console.log(username, "logout");
		}
		else
			console.log("Not logout");
    } catch (error) {
		console.error("Error:", error);
    }
}
