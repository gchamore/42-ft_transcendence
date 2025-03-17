/* Event listeners */
window.addEventListener("popstate", function(event) {
	console.log("popstate");
});

document.addEventListener("DOMContentLoaded", async () => {
	user = await verify_token();
	section_index = get_section_index(window.location.pathname.replace("/", ""));

	select_section(section_index);
	history.pushState({}, "", sections[section_index].type);
});
/* --------- */
