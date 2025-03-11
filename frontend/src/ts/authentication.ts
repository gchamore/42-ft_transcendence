let username : string = null;

async function verify_token(): Promise<boolean> {
	try {
		const response = await fetch(`http://localhost:8080/verify_token`, {
			method: "POST",
			credentials: 'include'
		});
		const data = await response.json();
		if (!response.ok) {
			console.error("Verify token failed:", data.error);
			return ;
		}

		if (data.valid) {
			username = data.username;
			console.log(username, "authenticated");

			switch_logged_in();
			return true;
		}
		
		switch_logged_off();
		console.log("Not authenticated");
		return false;
    } catch (error) {
		console.error("Error:", error);
    }
	switch_logged_off();
}

async function register(username: string, password: string) {
	try {
		const response = await fetch(`http://localhost:8080/register`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json"
			},
			body: JSON.stringify({username: username, password: password})
		});
		const data = await response.json();
		if (!response.ok) {
			console.error("Registration failed:", data.error);
			return ;
		}
        
		if (data.success) {
			username = username;
			console.log(username, "register");

			switch_logged_in();
		}
		else
			console.log("Not register");
    } catch (error) {
		console.error("Error:", error);
    }
}

async function login(username: string, password: string) {
	try {
        const response = await fetch(`http://localhost:8080/login`, {
            method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json"
			},
			body: JSON.stringify({username: username, password: password})
		});
		const data = await response.json();
		if (!response.ok) {
            console.error("Login failed:", data.error);
			return ;
		}

		if (data.success) {
			username = data.username;
			console.log(username, "login");

			switch_logged_in();
		}
		else
			console.log("Not login");
    } catch (error) {
		console.error("Error:", error);
    }
}

async function logout() {
	try {
        const response = await fetch(`http://localhost:8080/logout`, {
            method: "POST",
			credentials: 'include'
		});
		const data = await response.json();
		if (!response.ok) {
            console.error("Logout failed:", data.error);
			return ;
		}

		if (data.success) {
			username = data.username;
			console.log(username, "logout");

			switch_logged_off();
		}
		else
			console.log("Not logout");
    } catch (error) {
		console.error("Error:", error);
    }
}
