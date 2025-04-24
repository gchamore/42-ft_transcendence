import {set_new_section_index, update_sections, sections, section_index} from "./sections.js";
import {verify_token} from "./api.js";

/* Event listeners */
window.addEventListener("popstate", async function(event) {
	await verify_token();
	if (event.state && event.state.section)
		set_new_section_index(event.state.section);
	else
		set_new_section_index("home");

	update_sections();
});

document.addEventListener("DOMContentLoaded", async () => {
	await verify_token();
	set_new_section_index(window.location.pathname.replace("/", ""));
	update_sections();
	history.replaceState({ section : sections[section_index].type }, "",
		sections[section_index].type);
});
/* --------- */
