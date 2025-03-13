function go_section(section) {
    // Change URL without reloading
    history.pushState({ section }, "", `/${section}`);
    // Update the view
    updateView(section);
}
function updateView(section) {
    console.log(section);
    // Hide all sections
    console.log(document.querySelectorAll('.section'));
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden', 'hidden'));
    // Show the selected section
    console.log('.section.' + `${section}`);
    document.querySelectorAll('.section.' + `${section}`).forEach(el => el.classList.remove('hidden'));
}
// Handle back/forward buttons
window.addEventListener("popstate", function (event) {
    if (event.state && event.state.section) {
        updateView(event.state.section);
    }
    else {
        updateView("home");
    }
});
// On page load, check the URL and show the correct section
document.addEventListener("DOMContentLoaded", () => {
    let path;
    console.log(window.location.pathname);
    if (window.location.pathname === "/frontend/src/")
        path = "home";
    else
        path = window.location.pathname.replace("/", "") || "home";
    updateView(path);
});
