function show_logged_in_li() {
    const lis = document.querySelectorAll('li.logged-in');
    lis.forEach((li) => {
        li.removeAttribute('hidden');
    });
    console.log(lis);
}
function hide_logged_in_li() {
    const lis = document.querySelectorAll('li.logged-in');
    lis.forEach((li) => {
        li.setAttribute("hidden", "hidden");
    });
    console.log(lis);
}
let opened_modal = null;
function profile_clicked() {
    console.log("profile_clicked");
    const modal = document.querySelector(".modal-item.profile");
    console.log(modal);
    opened_modal = modal;
    modal.classList.add("active");
}
function friends_clicked() {
    console.log("friends_clicked");
}
function chat_clicked() {
    console.log("chat_clicked");
}
