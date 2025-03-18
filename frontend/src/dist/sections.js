"use strict";
/* Classes */
class ASection {
    activate_section() {
        doc.querySelectorAll(".section." + this.type).forEach(container => {
            container.classList.add('active');
        });
    }
    deactivate_section() {
        doc.querySelectorAll(".section." + this.type).forEach(container => {
            container.classList.remove('active');
        });
    }
    leave() {
        this.deactivate_section();
        this.switch_logged_off();
    }
    ;
    logged_off_view() {
        var _a, _b;
        this.dependencies.forEach(dep => {
            const index = get_section_index(dep);
            if (index !== undefined)
                sections[get_section_index(dep)].switch_logged_off();
        });
        (_a = this.logged_off) === null || _a === void 0 ? void 0 : _a.forEach((element) => { element.classList.add('active'); });
        (_b = this.logged_in) === null || _b === void 0 ? void 0 : _b.forEach((element) => { element.classList.remove('active'); });
    }
    logged_in_view() {
        var _a, _b;
        this.dependencies.forEach(dep => {
            const index = get_section_index(dep);
            if (index !== undefined)
                sections[get_section_index(dep)].switch_logged_in();
        });
        (_a = this.logged_off) === null || _a === void 0 ? void 0 : _a.forEach((element) => { element.classList.remove('active'); });
        (_b = this.logged_in) === null || _b === void 0 ? void 0 : _b.forEach((element) => { element.classList.add('active'); });
    }
}
class Home extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'home';
        this.protected = false;
        this.parent = doc.getElementById('home-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = [];
        /* Properties */
        this.profile_btn = doc.getElementById('profile-btn');
        this.friends_btn = doc.getElementById('friends-btn');
        this.chat_btn = doc.getElementById('chat-btn');
    }
    /* Methods */
    enter(verified) {
        if (verified === true)
            this.switch_logged_in();
        else
            this.switch_logged_off();
        this.activate_section();
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
class Profile extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'profile';
        this.protected = false;
        this.parent = doc.getElementById('profile-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = ['home'];
        /* Properties */
        this.avatar = doc.getElementById('profile-avatar');
        this.username = doc.getElementById('profile-username');
        this.username_i = doc.getElementById('profile-username-input');
        this.password_i = doc.getElementById('profile-password');
        this.btn1 = doc.getElementById('profile-btn1');
        this.btn2 = doc.getElementById('profile-btn2');
    }
    /* Methods */
    enter(verified) {
        if (verified === true)
            this.switch_logged_in();
        else
            this.switch_logged_off();
        this.activate_section();
    }
    switch_logged_off() {
        this.logged_off_view();
        this.avatar.src = "";
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
        this.avatar.src = user.avatar_path;
        this.username.textContent = user.name;
        this.username_i.value = "";
        this.password_i.value = "";
        this.btn1.textContent = "Settings";
        this.btn2.setAttribute("onclick", "verify_token()");
        this.btn2.textContent = "Logout";
        this.btn2.setAttribute("onclick", "logout()");
        this.logged_in_view();
    }
}
class Friends extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'friends';
        this.protected = true;
        this.parent = doc.getElementById('friends-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = ['home'];
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
        if (verified !== true) {
            console.error("Try to enter Friends section as unauthenticated");
            return;
        }
        this.switch_logged_in();
        this.activate_section();
        return true;
    }
    switch_logged_off() {
        this.logged_off_view();
    }
    switch_logged_in() {
        this.logged_in_view();
    }
}
/* --------- */
/* Utils */
function get_section_index(type) {
    for (let i = 0; i < sections.length; i++) {
        if (sections[i].type === type)
            return i;
    }
    return undefined;
}
function set_new_section_index(type) {
    let index = get_section_index(type);
    section_index = (index !== undefined && is_section_accessible(index)) ? index : HOME_INDEX;
}
function is_section_accessible(index) {
    return !(user === undefined && sections[index].protected === true);
}
function update_sections() {
    for (let i = 0; i < sections.length; i++) {
        if (i !== section_index)
            sections[i].leave();
    }
    sections[section_index].enter(user !== undefined);
}
;
function update_section() {
    if (user === undefined)
        sections[section_index].switch_logged_off();
    else
        sections[section_index].switch_logged_in();
}
function go_section(section) {
    if (section === sections[section_index].type)
        section = 'home';
    set_new_section_index(section);
    update_sections();
    history.pushState({}, "", sections[section_index].type);
}
/* --------- */
