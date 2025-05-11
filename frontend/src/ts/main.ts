import { go_section } from "./sections.js";
import { processGoogleOAuth } from "./api.js";


document.addEventListener("DOMContentLoaded", () => {
	const profileBtn = document.getElementById("profile-btn");
	if (profileBtn) {
		profileBtn.addEventListener("click", () => go_section("profile"));
	}

	const urlParams = new URLSearchParams(window.location.search);
	const oauthCode = urlParams.get('code');

	if (oauthCode && window.location.pathname.includes('/oauth-callback')) {
		processGoogleOAuth(oauthCode).then(() => {
			window.history.replaceState({}, document.title, '/');
			go_section('profile');
		});
	}
});