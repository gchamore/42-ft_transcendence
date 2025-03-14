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

async function verify_token(): Promise<boolean> {
	try {
		const response = await fetch(`/api/verify_token`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();
		if (!response.ok) {
			console.error("Verify token failed:", data.error);
			switch_logged_off();
			assign_username(undefined);
			return false;
		}

		if (data.valid) {
			switch_logged_in();
			assign_username(data.username);
			console.log(username, "authenticated");
			return true;
		}

		assign_username(undefined);
		switch_logged_off();
		console.log("Not authenticated");
		return false;
    } catch (error) {
		console.error("Error:", error);
    }
	assign_username(undefined);
	switch_logged_off();
	return false;
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
			switch_logged_in();
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
			switch_logged_in();
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
			switch_logged_off();
			console.log(username, "logout");
		}
		else
			console.log("Not logout");
    } catch (error) {
		console.error("Error:", error);
    }
}
