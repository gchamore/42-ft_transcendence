"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let username = undefined;
function assign_username(new_username) {
    username = new_username;
    if (username)
        document.getElementById("profile-username")
            .textContent = username;
    else
        document.getElementById("profile-username")
            .textContent = "";
}
function verify_token() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('verify_token()');
        try {
            const response = yield fetch(`/api/verify_token`, {
                method: "POST",
                credentials: 'include'
            });
            const data = yield response.json();
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
        }
        catch (error) {
            console.error("Error:", error);
        }
        return undefined;
    });
}
function register(_username, _password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/api/register`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: _username, password: _password })
            });
            const data = yield response.json();
            if (!response.ok) {
                console.error("Registration failed:", data.error);
                return;
            }
            if (data.success) {
                assign_username(_username);
                console.log(username, "register");
            }
            else
                console.log("Not register");
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
function login(_username, _password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/api/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: _username, password: _password })
            });
            const data = yield response.json();
            if (!response.ok) {
                console.error("Login failed:", data.error);
                return;
            }
            if (data.success) {
                assign_username(_username);
                console.log(_username, "login");
            }
            else
                console.log("Not login");
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
function logout() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/api/logout`, {
                method: "POST",
                credentials: 'include'
            });
            const data = yield response.json();
            if (!response.ok) {
                console.error("Logout failed:", data.error);
                return;
            }
            if (data.success) {
                assign_username(undefined);
                console.log(username, "logout");
            }
            else
                console.log("Not logout");
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
