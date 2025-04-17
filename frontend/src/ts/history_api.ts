/* Global variables */
let argument : string | undefined = undefined;
/* --------- */



/* Event listeners */
window.addEventListener("popstate", async function(event) {
	await verify_token();
	if (event.state && event.state.section) {
		let type = get_url_type(event.state.section);
		let option = get_url_option(event.state.section);

		await verify_token();

		set_section_index(type, option);
		update_sections();

	}
	else {
		set_section_index("home");
		update_sections();
	}
});

document.addEventListener("DOMContentLoaded", async () => {
	window.location.pathname.replace("/", "");
	console.log(window.location.pathname);

	let type = get_url_type(window.location.pathname);
	let option = get_url_option(window.location.pathname);

	await verify_token();

	set_section_index(type, option);

	update_sections();

	let url : string;
	if (sections[section_index].option === undefined)
		url = sections[section_index];
	else
		url = sections[section_index] + '/' + sections[section_index].option;
	history.replaceState({ section : url }, "", url);
});
/* --------- */
