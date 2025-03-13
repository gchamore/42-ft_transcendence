function select_modal(name) {
    const modals = document.querySelectorAll(".modal-item");
    modals.forEach((modal) => {
        if (modal.classList.contains(name) && !(modal.classList.contains("active")))
            modal.classList.add("active");
        else
            modal.classList.remove("active");
    });
}
function set_modals(mode) {
    // profile modal
    const avatar = document.getElementById("profile-avatar");
    const username = document.getElementById("profile-username-input");
    const password = document.getElementById("profile-password");
    const btn1 = document.getElementById("profile-btn1");
    const btn2 = document.getElementById("profile-btn2");
    if (mode === "logged-in") {
        btn1.textContent = "Settings";
        btn1.onclick = null;
        btn2.textContent = "Logout";
        btn2.onclick = () => logout();
    }
    if (mode === "logged-off") {
        btn1.textContent = "Register";
        btn1.onclick = () => register(username.value, password.value);
        btn2.textContent = "Login";
        btn2.onclick = () => login(username.value, password.value);
    }
}
