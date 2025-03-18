"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
        this.founds = this.parent.querySelectorAll('.found');
        this.not_founds = this.parent.querySelectorAll('.not-found');
        this.username_i = doc.getElementById('friends-username');
        this.avatar = doc.getElementById('friend-avatar');
        this.status = doc.getElementById('status');
        this.stat1 = doc.getElementById('friend-stat1');
        this.stat2 = doc.getElementById('friend-stat2');
        this.stat3 = doc.getElementById('friend-stat3');
        this.btn1 = doc.getElementById('friends-btn1');
        this.btn2 = doc.getElementById('friends-btn2');
        this.btn3 = doc.getElementById('friends-btn3');
    }
    /* Methods */
    enter(verified) {
        if (verified !== true) {
            console.error("Try to enter Friends section as unauthenticated");
            return;
        }
        this.reset();
        this.logged_in_view();
        this.activate_section();
    }
    leave() {
        this.reset();
        this.deactivate_section();
        this.btn1.removeAttribute('onclick');
        this.btn2.removeAttribute('onclick');
        this.btn3.removeAttribute('onclick');
    }
    switch_logged_off() { }
    switch_logged_in() { }
    reset() {
        deactivate(this.founds);
        deactivate(this.not_founds);
        this.btn1.onclick = () => this.search();
        this.btn1.textContent = 'Search';
        this.btn2.removeAttribute('onclick');
        this.btn2.textContent = '';
        this.btn3.removeAttribute('onclick');
        this.btn3.textContent = '';
        this.stat1.textContent = '';
        this.stat2.textContent = '';
        this.stat3.textContent = '';
        this.username_i.value = '';
        this.avatar.src = '';
        this.status.textContent = '';
    }
    search() {
        return __awaiter(this, void 0, void 0, function* () {
            const username = this.username_i.value;
            this.reset();
            if ((yield search(username)) === true) {
                console.log(username, "found");
            }
            // To be continued...
        });
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
    history.pushState({ section: sections[section_index].type }, "", sections[section_index].type);
}
function activate(list) {
    list.forEach(element => {
        element.classList.add('activate');
    });
}
function deactivate(list) {
    list.forEach(element => {
        element.classList.remove('activate');
    });
}
function clear_friends(section) {
}
/* --------- */
