var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const user = { username: "" };
function isUser(username) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`http://localhost/isUser/${username}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            const data = yield response.json();
            console.log("http://localhost/isUser/:username", data);
            return data.exists;
        }
        catch (error) {
            console.error("Error:", error);
        }
        return false;
    });
}
function isPassword(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch("http://localhost/isPassword", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username, password: password })
            });
            const data = yield response.json();
            console.log("http://localhost/isPassword", data);
            return data.valid;
        }
        catch (error) {
            console.error("Error:", error);
        }
        return false;
    });
}
function logout() {
    user.username = "";
    switchRegistrationLevel("logged-off");
    console.log("Logout successful");
}
function login() {
    return __awaiter(this, void 0, void 0, function* () {
        const username = document.getElementById("loginUsername");
        const password = document.getElementById("loginPassword");
        const userExists = yield isUser(username.value);
        if (userExists) {
            const passwordValid = yield isPassword(username.value, password.value);
            if (!passwordValid) {
                console.log("Invalid username or password");
            }
            else {
                user.username = username.value;
                document.getElementById("username").textContent = "Username: " + user.username;
                switchRegistrationLevel("logged-in");
                console.log("Login successful");
            }
        }
        username.value = "";
        password.value = "";
    });
}
function register() {
    return __awaiter(this, void 0, void 0, function* () {
        const username = document.getElementById("registerUsername");
        const password = document.getElementById("registerPassword");
        const userExists = yield isUser(username.value);
        if (userExists) {
            console.log("Username already taken");
            return;
        }
        try {
            const response = yield fetch(`http://localhost/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.value, password: password.value })
            });
            const data = yield response.json();
            console.log("http://localhost/register", data);
            if (data.success)
                console.log(data.message);
        }
        catch (error) {
            console.error("Error:", error);
        }
        username.value = "";
        password.value = "";
    });
}
