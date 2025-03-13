let current_section = null;
const modals = ['profile', 'friends', 'chat'];
function go_section(section, is_default = false) {
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
function updateView(section) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden', 'hidden'));
    document.querySelectorAll('.section.' + `${section}`).forEach(el => el.classList.remove('hidden'));
}
window.addEventListener("popstate", function (event) {
    if (event.state && event.state.section) {
        updateView(event.state.section);
    }
    else {
        updateView("home");
    }
});
document.addEventListener("DOMContentLoaded", () => {
    let path;
    if (window.location.pathname === "/frontend/src/")
        path = "home";
    else
        path = window.location.pathname.replace("/", "") || "home";
    updateView(path);
});
