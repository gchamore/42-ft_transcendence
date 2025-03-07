let username : string;

async function verify_token(): Promise<boolean> {
	try {
        const response = await fetch(`http://localhost:8080/verify_token`, {
            method: "POST",
			credentials: 'include',
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({})
        });
        const data = await response.json();

		if (data.valid) {
			username = data.username;
			console.log(username, "authenticated");
			return true;
		}

		console.log("Not authenticated");
		hide_logged_in_sidebar_btn();
		return false;
    } catch (error) {
        console.error("Error:", error);
    }
	
	console.log("Authentication failed");
	return false;
}
