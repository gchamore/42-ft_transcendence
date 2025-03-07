var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let username;
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
                show_logged_in_sidebar_btn();
                return true;
            }
            console.log("Not authenticated");
            return false;
        }
        catch (error) {
            console.error("Error:", error);
        }
        console.log("Authentication failed");
        return false;
    });
}
