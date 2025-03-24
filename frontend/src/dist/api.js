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
function verify_token() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('verify_token()');
        try {
            const response = yield fetch(`/api/verify_token`, {
                method: "POST",
                credentials: 'include'
            });
            const data = yield response.json();
            if (!response.ok)
                console.error("/api/verify_token failed:", data.error);
            else if (data.valid) {
                console.log(data.username, "authenticated");
                update_user(new User(data.username));
                return;
            }
        }
        catch (error) {
            console.error("/api/verify_token error:", error);
        }
        update_user(undefined);
    });
}
function register(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/api/register`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: username, password: password })
            });
            const data = yield response.json();
            if (!response.ok)
                console.error("/api/register failed:", data.error);
            else if (data.success) {
                update_user(new User(data.username));
                console.log(username, "registered");
            }
        }
        catch (error) {
            console.error("/api/register error:", error);
        }
    });
}
function login(username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`/api/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: username, password: password })
            });
            const data = yield response.json();
            if (!response.ok)
                console.error("/api/login failed:", data.error);
            else if (data.success) {
                update_user(new User(data.username));
                console.log(username, "logged-in");
            }
        }
        catch (error) {
            console.error("/api/login error:", error);
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
            if (!response.ok)
                console.error("/api/logout failed:", data.error);
            else if (data.success) {
                console.log(user === null || user === void 0 ? void 0 : user.name, "logged-out");
                update_user(undefined);
            }
        }
        catch (error) {
            console.error("/api/logout error:", error);
        }
    });
}
function search(friend_username) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Ajout de console.log pour debug
            console.log('Searching for:', friend_username);
            
            const response = yield fetch(`/api/search/${encodeURIComponent(friend_username)}`, {
                method: "GET",
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            // Ajout de console.log pour debug
            console.log('Search response:', response.status);
            
            const data = yield response.json();
            console.log('Search data:', data);

            if (!response.ok) {
                console.error(`/api/search/${friend_username} failed:`, data.error);
                return undefined;
            }
            
            return new OtherUser(
                data.isFriend,
                new Date(data.user.friendSince || data.user.createdAt),
                data.user.winRate,
                data.user.gamesPlayed
            );
        }
        catch (error) {
            console.error(`/api/search/${friend_username} error:`, error);
        }
        return undefined;
    });
}
