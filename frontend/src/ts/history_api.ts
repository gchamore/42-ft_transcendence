import {set_section_index, update_sections, get_url_type, get_url_option,
	get_type_index, is_section_accessible, build_url} from "./sections.js";
import { verify_token } from "./api.js";
import { go_section } from "./sections.js";
import { processGoogleOAuth } from "./api.js";

	
/* Event listeners */
window.addEventListener("popstate", async function(event) {
	let type : string = 'home';
	let option : string = '';
	
	if (event.state && event.state.section) {
		await verify_token();
		type = get_url_type(event.state.section);
		option = get_url_option(event.state.section);
	}
	
	if (!(await is_section_accessible(type, option))) {
		type = 'home';
		option = '';
	}
	
	let url : string = build_url(type, option);
	history.replaceState({ section : url }, "", url);
	set_section_index(get_type_index(type));
	update_sections();
});

document.addEventListener("DOMContentLoaded", async () => {
	const profileBtn = document.getElementById("profile-btn");
	if (profileBtn) {
		profileBtn.addEventListener("click", () => go_section("profile", ''));
	}

	const urlParams = new URLSearchParams(window.location.search);
	const oauthCode = urlParams.get('code');
	
	if (oauthCode && window.location.pathname.includes('/oauth-callback')) {
		processGoogleOAuth(oauthCode).then(() => {
			window.history.replaceState({}, document.title, '/');
			go_section("profile", '');
		});
	}

	let type = get_url_type(window.location.pathname);
	let option = get_url_option(window.location.pathname);

	await verify_token();
	if (get_type_index(type) === undefined || !(await is_section_accessible(type, option))) {
		type = 'home';
		option = '';
	}

	let url : string = build_url(type, option);
	history.replaceState({ section : url }, "", url);
	set_section_index(get_type_index(type));
	update_sections();
});
/* --------- */
