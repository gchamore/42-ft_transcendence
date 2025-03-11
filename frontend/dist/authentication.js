var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let username = null;
function verify_token() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(`http://localhost:8080/verify_token`, {
                method: "POST",
                credentials: 'include'
            });
            const data = yield response.json();
            if (data.valid) {
                username = data.username;
                console.log(username, "authenticated");
                switch_logged_in();
                return true;
            }
            switch_logged_off();
            console.log("Not authenticated");
            return false;
        }
        catch (error) {
            console.error("Error:", error);
        }
        switch_logged_off();
    });
}
function switch_logged_in() {
    hide_logged_off();
    show_logged_in();
}
function switch_logged_off() {
    hide_logged_in();
    show_logged_off();
}
function show_logged_in() {
    const list = document.querySelectorAll('.logged-in');
    list.forEach((elem) => {
        elem.removeAttribute('hidden');
    });
}
function hide_logged_in() {
    const list = document.querySelectorAll('.logged-in');
    list.forEach((elem) => {
        elem.setAttribute('hidden', 'hidden');
    });
}
function show_logged_off() {
    const list = document.querySelectorAll('.logged-off');
    list.forEach((elem) => {
        elem.removeAttribute('hidden');
    });
}
function hide_logged_off() {
    const list = document.querySelectorAll('.logged-off');
    list.forEach((elem) => {
        elem.setAttribute('hidden', 'hidden');
    });
}
