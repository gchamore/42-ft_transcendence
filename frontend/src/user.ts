async function isUser(username: string): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost/isUser/${username}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const data = await response.json();
        console.log("http://localhost/isUser/:username", data);

        return data.exists;
    } catch (error) {
        console.error("Error:", error);
    }
}

async function isPassword(username: string, password: string): Promise<boolean> {
    try {
        const response = await fetch("http://localhost/isPassword", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username, password: password })
        });
        const data = await response.json();
        console.log("http://localhost/isPassword", data);

        return data.valid;
    } catch (error) {
        console.error("Error:", error);
    }
}

async function login() {
    const username = document.getElementById("loginUsername") as HTMLInputElement;
    const password = document.getElementById("loginPassword") as HTMLInputElement;

    const userExists = await isUser(username.value);
    if (userExists) {
        const passwordValid = await isPassword(username.value, password.value);
        if (!passwordValid) {
            console.log("Invalid username or password");
        } else {
            console.log("Login successful");
        }
    }

    username.value = "";
    password.value = "";
}

async function register() {
    const username = document.getElementById("registerUsername") as HTMLInputElement;
    const password = document.getElementById("registerPassword") as HTMLInputElement;

    const userExists = await isUser(username.value);

    if (userExists) {
        console.log("Username already taken");
        return;
    }

    try {
        const response = await fetch(`http://localhost/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username.value, password: password.value })
        });
        const data = await response.json();

        if (data.success)
            console.log(data.message);
    } catch (error) {
        console.error("Error:", error);
    }

    username.value = "";
    password.value = "";
}
