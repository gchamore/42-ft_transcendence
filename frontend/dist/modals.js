function select_modal(name) {
    const modals = document.querySelectorAll(".modal-item");
    modals.forEach((modal) => {
        if (modal.classList.contains(name) && !(modal.classList.contains("active")))
            modal.classList.add("active");
        else
            modal.classList.remove("active");
    });
}
