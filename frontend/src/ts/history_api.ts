/* Event listeners */
window.addEventListener("popstate", function(event) {
	console.log("popstate");
});

document.addEventListener("DOMContentLoaded", async () => {
	sections.forEach(element => { element.switch_logged_off(); });

	user = await verify_token();
	section_index = get_section_index(window.location.pathname.replace("/", ""));

	if (section_index !== HOME_INDEX)
		select_section(section_index);
	history.pushState({}, "", sections[section_index].type);
});
/* --------- */
