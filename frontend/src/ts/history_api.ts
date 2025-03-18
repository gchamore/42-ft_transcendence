/* Event listeners */
window.addEventListener("popstate", function(event) {
	console.log("popstate");
});

document.addEventListener("DOMContentLoaded", async () => {
	await verify_token();
	set_new_section_index(window.location.pathname.replace("/", ""));
	update_section();
	history.replaceState({}, "", sections[section_index].type);
});
/* --------- */
