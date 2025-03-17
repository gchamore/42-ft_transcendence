"use strict";
var doc = document;
var user;
var home;
/* User */
class User {
    constructor(username) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
    }
}
/* --------- */
/* Sections */
class ASection {
    logged_off_view() {
        var _a, _b;
        (_a = this.logged_in) === null || _a === void 0 ? void 0 : _a.forEach((element) => { element.classList.remove('active'); });
        (_b = this.logged_off) === null || _b === void 0 ? void 0 : _b.forEach((element) => { element.classList.add('active'); });
    }
    logged_in_view() {
        var _a, _b;
        (_a = this.logged_off) === null || _a === void 0 ? void 0 : _a.forEach((element) => { element.classList.remove('active'); });
        (_b = this.logged_in) === null || _b === void 0 ? void 0 : _b.forEach((element) => { element.classList.add('active'); });
    }
}
class Home extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'home';
        this.parent = doc.getElementById('home-parent');
        this.logged_off = this.parent.querySelectorAll('logged-off');
        this.logged_in = this.parent.querySelectorAll('logged-in');
        /* Properties */
        this.profile_btn = doc.getElementById('profile-btn');
        this.friends_btn = doc.getElementById('friends-btn');
        this.chat_btn = doc.getElementById('chat-btn');
    }
    /* Methods */
    enter(verified) {
        if (verified === true)
            this.switch_logged_in();
        return true;
    }
    leave() {
        console.log(`Leaving ${this.type}`);
        this.switch_logged_off();
    }
    switch_logged_off() {
        this.logged_off_view();
        this.chat_btn.removeAttribute('onclick');
        this.friends_btn.removeAttribute('onclick');
    }
    switch_logged_in() {
        this.logged_in_view();
        this.friends_btn.setAttribute('onclick', "go_section('friends')");
        this.chat_btn.setAttribute('onclick', "go_section('chat')");
    }
}
home = new Home();
class Profile extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'profile';
        this.parent = doc.getElementById('profile-parent');
        this.logged_off = this.parent.querySelectorAll('logged-off');
        this.logged_in = this.parent.querySelectorAll('logged-in');
        /* Properties */
        this.avatar = doc.getElementById('profile-avatar');
        this.username = doc.getElementById('profile-username');
        this.username_i = doc.getElementById('profile-username-input');
        this.password_i = doc.getElementById('profile-password');
        this.btn1 = doc.getElementById('profile-btn1');
        this.btn2 = doc.getElementById('profile-btn1');
    }
    /* Methods */
    enter(verified) {
        if (verified === true)
            this.switch_logged_in();
        return true;
    }
    leave() {
        console.log(`Leaving ${this.type}`);
        this.switch_logged_off();
    }
    switch_logged_off() {
        this.logged_off_view();
        this.avatar.removeAttribute('src');
        this.username.textContent = "";
        this.username_i.value = "";
        this.password_i.value = "";
        this.btn1.textContent = "Register";
        this.btn1.onclick = () => register(this.username_i.value, this.password_i.value);
        this.btn2.textContent = "Login";
        this.btn2.onclick = () => login(this.username_i.value, this.password_i.value);
    }
    switch_logged_in() {
        if (user === undefined) {
            console.error("Profile.switch_logged_off: user undefined");
            return;
        }
        this.avatar.setAttribute('src', user.avatar_path);
        this.username.textContent = "";
        this.username_i.value = "";
        this.password_i.value = "";
        this.btn1.textContent = "Settings";
        this.btn1.onclick = () => null;
        this.btn2.textContent = "Logout";
        this.btn2.onclick = () => logout();
        this.logged_in_view();
    }
}
class Friends extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'friends';
        this.parent = doc.getElementById('friends-parent');
        this.logged_off = this.parent.querySelectorAll('logged-off');
        this.logged_in = this.parent.querySelectorAll('logged-in');
        /* Properties */
        this.avatar = doc.getElementById('profile-avatar');
        this.username = doc.getElementById('profile-username');
        this.username_i = doc.getElementById('profile-username-input');
        this.password_i = doc.getElementById('profile-password');
        this.btn1 = doc.getElementById('profile-btn1');
        this.btn2 = doc.getElementById('profile-btn1');
    }
    /* Methods */
    enter(verified) {
        if (verified === true)
            this.switch_logged_in();
        return true;
    }
    leave() {
        console.log(`Leaving ${this.type}`);
        this.switch_logged_off();
    }
    switch_logged_off() {
        this.logged_off_view();
        this.avatar.removeAttribute('src');
        this.username.textContent = "";
        this.username_i.value = "";
        this.password_i.value = "";
        this.btn1.textContent = "Register";
        this.btn1.onclick = () => register(this.username_i.value, this.password_i.value);
        this.btn2.textContent = "Login";
        this.btn2.onclick = () => login(this.username_i.value, this.password_i.value);
    }
    switch_logged_in() {
        if (user === undefined) {
            console.error("Profile.switch_logged_off: user undefined");
            return;
        }
        this.avatar.setAttribute('src', user.avatar_path);
        this.username.textContent = "";
        this.username_i.value = "";
        this.password_i.value = "";
        this.btn1.textContent = "Settings";
        this.btn1.onclick = () => null;
        this.btn2.textContent = "Logout";
        this.btn2.onclick = () => logout();
        this.logged_in_view();
    }
}
/* --------- */
