function isUser(username) {
    return true; // here, ask to back-end if username exists
}
function isPassword(username, password) {
    return true; // here, ask to back-end if password is right
}
function login() {
    const username = document.getElementById("loginUsername");
    const password = document.getElementById("loginPassword");
    console.log("Inputs:", username.value, password.value);
    if (!isUser(username.value)
        || !isPassword(username.value, password.value)) {
        console.log("Invalid username or password");
    }
    username.value = "";
    password.value = "";
}
function register() {
    const username = document.getElementById("registerUsername");
    const password = document.getElementById("registerPassword");
    console.log("Inputs:", username.value, password.value);
    if (isUser(username.value)) {
        console.log("Username already taken");
    }
    username.value = "";
    password.value = "";
}
