function switchPanel(name) {
    // Hide panels
    document.querySelectorAll(".panel").forEach(panel => {
        panel.classList.remove("active");
    });
    // Shadow buttons
    document.querySelectorAll(".btn").forEach(btn => {
        btn.classList.remove("selected");
    });
    // Show selected panel and btn
    document.getElementById(`${name}Panel`).classList.add("active");
    document.getElementById(`${name}Btn`).classList.add("selected");
}
function switchRegistrationLevel(newLevel) {
    document.querySelectorAll(".btn").forEach(btn => {
        btn.classList.remove("active");
        btn.classList.remove("selected");
        if (btn.classList.contains(newLevel))
            btn.classList.add("active");
    });
    if (newLevel == "logged-off")
        switchPanel("login");
    else if (newLevel == "logged-in")
        switchPanel("profile");
}
