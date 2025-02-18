function isUser(username: string): boolean {
    return true; // here, ask to back-end if username exists
}

function isPassword(username: string, password: string): boolean {
    return true; // here, ask to back-end if password is right
}

function login() {
    const username = document.getElementById("loginUsername") as HTMLInputElement;
    const password = document.getElementById("loginPassword") as HTMLInputElement;

    console.log("Inputs:", username.value, password.value);
    if (!isUser(username.value)
        || !isPassword(username.value, password.value)) {
        console.log("Invalid username or password");
    }

    username.value = "";
    password.value = "";
}

function register() {
    const username = document.getElementById("registerUsername") as HTMLInputElement;
    const password = document.getElementById("registerPassword") as HTMLInputElement;

    console.log("Inputs:", username.value, password.value);
    if (isUser(username.value)) {
        console.log("Username already taken");
    }
    
    username.value = "";
    password.value = "";
}
