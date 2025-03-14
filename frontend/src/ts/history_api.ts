let current_section: string | undefined = undefined;
const modals = ['profile', 'friends', 'chat'];

function go_section(section: string, is_default: boolean = false) {
	if (current_section === section && modals.includes(section))
		section = 'home';
	current_section = section;

	if (is_default) {
		history.replaceState({ section }, "", `/${section}`);
	}
	else
		history.pushState({ section }, "", `/${section}`);
	updateView(section);
}

function updateView(section: string) {
	document.querySelectorAll('.section').forEach(
        el => el.classList.remove('active'));

    document.querySelectorAll('.section.' + `${section}`).forEach(
        el => el.classList.add('active'));
}

window.addEventListener("popstate", function(event) {
	if (event.state && event.state.section) {
		updateView(event.state.section);
	} else {
		updateView("home");
	}
});

document.addEventListener("DOMContentLoaded", () => {
    let path = window.location.pathname.replace("/", "") || "home";
	updateView(path);
});
