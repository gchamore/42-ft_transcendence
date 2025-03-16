let current_section: string | undefined = undefined;
const modals = ['profile', 'friends', 'chat'];

function go_section(section: string, is_default: boolean = false) {
	console.log("go_section");
	current_section = section;

	if (is_default) {
		history.replaceState({ section }, "", `${section}`);
	}
	else {
		console.log("go_section pushing:", section);
		history.pushState({ section }, "", `${section}`);
	}
	updateView(section);
}

function updateView(section: string) {
	console.log("updateView");
	document.querySelectorAll('.section').forEach(
        el => el.classList.remove('active'));

    document.querySelectorAll('.section.' + `${section}`).forEach(
        el => el.classList.add('active'));
}

/* Event listeners */
window.addEventListener("popstate", function(event) {
	console.log("popstate");
	if (event.state && event.state.section) {
		updateView(event.state.section);
	} else {
		updateView("home");
	}
});

document.addEventListener("DOMContentLoaded", () => {
	console.log("DOMContentLoaded :", window.location.pathname);
    let path = window.location.pathname.replace("/", "");
	if (!modals.includes(path) || (current_section === path && modals.includes(path)))
		path = 'home';
	console.log("DOMContentLoaded pushing:", path);
	updateView(path);
	history.pushState({ path }, "", `${path}`);
});
/* --------- */
