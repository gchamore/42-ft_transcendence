let username : string;

async function verify_token(): Promise<boolean> {
	try {
        const response = await fetch(`http://localhost:8080/verify_token`, {
            method: "POST",
			credentials: 'include'
        });
        const data = await response.json();

		if (data.valid) {
			username = data.username;
			console.log(username, "authenticated");

			show_logged_in_li();
			return true;
		}

		console.log("Not authenticated");
		return false;
    } catch (error) {
        console.error("Error:", error);
    }
	
	console.log("Authentication failed");
	return false;
}
