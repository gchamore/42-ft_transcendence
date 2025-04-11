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
/* Global variables */
var sections = [];
var HOME_INDEX = 0;
var section_index = HOME_INDEX;
/* --------- */
/* Classes */
class ASection {
    activate_section() {
        this.dependencies.forEach(dep => {
            sections[get_section_index(dep)].enter(user !== undefined);
        });
        document.querySelectorAll(".section." + this.type).forEach(container => {
            container.classList.add('active');
        });
    }
    deactivate_section() {
        document.querySelectorAll(".section." + this.type).forEach(container => {
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
        this.parent = document.getElementById('home-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = [];
        /* Properties */
        this.profile_btn = document.getElementById('profile-btn');
        this.friends_btn = document.getElementById('friends-btn');
        this.chat_btn = document.getElementById('chat-btn');
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
        this.parent = document.getElementById('profile-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = ['home'];
        /* Properties */
        this.avatar = document.getElementById('profile-avatar');
        this.username = document.getElementById('profile-username');
        this.username_i = document.getElementById('profile-username-input');
        this.password_i = document.getElementById('profile-password');
        this.btn1 = document.getElementById('profile-btn1');
        this.btn2 = document.getElementById('profile-btn2');
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
        this.parent = document.getElementById('friends-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = ['home'];
        /* Properties */
        this.founds = this.parent.querySelectorAll('.found');
        this.not_founds = this.parent.querySelectorAll('.not-found');
        this.username_i = document.getElementById('friends-username');
        this.avatar = document.getElementById('friend-avatar');
        this.status = document.getElementById('status');
        this.stat1 = document.getElementById('friend-stat1');
        this.stat2 = document.getElementById('friend-stat2');
        this.stat3 = document.getElementById('friend-stat3');
        this.stat4 = document.getElementById('friend-stat4');
        this.btn1 = document.getElementById('friends-btn1');
        this.btn2 = document.getElementById('friends-btn2');
        this.btn3 = document.getElementById('friends-btn3');
        this.FriendsClass = sections[get_section_index('friends')];
        this.anotherUser = undefined;
    }
    /* Methods */
    enter(verified) {
        if (verified !== true) {
            console.log("Try to enter Friends section as unauthenticated");
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
        this.anotherUser = undefined;
        this.btn1.onclick = () => this.search();
        this.btn1.textContent = 'Search';
        this.btn2.removeAttribute('onclick');
        this.btn2.textContent = '';
        this.btn3.removeAttribute('onclick');
        this.btn3.textContent = '';
        this.stat1.textContent = '';
        this.stat2.textContent = '';
        this.stat3.textContent = '';
        this.stat4.textContent = '';
        this.username_i.value = '';
        this.avatar.src = '';
        this.status.textContent = '';
        this.status.style.color = 'black';
    }
    search() {
        return __awaiter(this, arguments, void 0, function* (user = this.username_i.value) {
            let status = yield search(user);
            if (status instanceof Error)
                return;
            this.anotherUser = status;
            this.username_i.value = '';
            if (this.anotherUser !== undefined) {
                this.avatar.src = this.anotherUser.avatar;
                if (this.anotherUser.is_friend === true) {
                    this.btn2.onclick = () => this.remove();
                    this.btn2.textContent = 'Remove';
                }
                else {
                    this.btn2.onclick = () => this.add();
                    this.btn2.textContent = 'Add';
                }
                const stats = this.anotherUser.format_stats();
                this.stat1.textContent = stats[0];
                this.stat2.textContent = stats[1];
                this.stat3.textContent = stats[2];
                this.stat4.textContent = stats[3];
                activate(this.founds);
                deactivate(this.not_founds);
                this.update_status(this.anotherUser.is_connected);
            }
            else {
                this.reset();
                activate(this.not_founds);
                deactivate(this.founds);
            }
        });
    }
    message() {
        this.reset();
    }
    add() {
        return __awaiter(this, void 0, void 0, function* () {
            if ((yield add(this.anotherUser.username)) instanceof Error)
                return;
            let user = this.anotherUser.username;
            this.anotherUser = undefined;
            this.search(user);
        });
    }
    remove() {
        return __awaiter(this, void 0, void 0, function* () {
            if ((yield remove(this.anotherUser.username)) instanceof Error)
                return;
            let user = this.anotherUser.username;
            this.reset();
            this.search(user);
        });
    }
    update_status(online) {
        this.status.textContent = (online) ? 'Online' : 'Offline';
        this.status.style.color = (online) ? 'rgb(32, 96, 32)' : 'rgb(153, 0, 0)';
        if (online) {
            this.btn3.onclick = () => this.message();
            this.btn3.textContent = 'Message';
            this.btn3.parentElement.classList.add('active');
        }
        else {
            this.btn3.removeAttribute('onclick');
            this.btn3.textContent = '';
            this.btn3.parentElement.classList.remove('active');
        }
    }
}
class Chat extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'chat';
        this.protected = true;
        this.parent = document.getElementById('chat-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = ['home'];
        /* Properties */
        this.chat_box = document.getElementById('chat-box');
        this.msg_input = document.getElementById('msg-input');
        this.btn1 = document.getElementById('chat-btn1');
        this.btn2 = document.getElementById('chat-btn2');
        this.btn3 = document.getElementById('chat-btn3');
    }
    /* Methods */
    enter(verified) {
        if (verified !== true) {
            console.log("Try to enter Chat section as unauthenticated");
            return;
        }
        this.btn1.onclick = () => history.back();
        this.btn1.textContent = 'Back';
        this.btn2.onclick = () => this.send();
        this.btn2.textContent = 'Send';
        this.btn3.onclick = () => go_section('actions');
        this.btn3.textContent = 'Actions';
        this.load_messages(get_user_messages());
        this.msg_input.value = '';
        this.activate_section();
    }
    leave() {
        this.deactivate_section();
        this.btn1.removeAttribute('onclick');
        this.btn2.removeAttribute('onclick');
        this.btn3.removeAttribute('onclick');
        this.chat_box.childNodes.forEach((childNode) => {
            childNode.remove();
        });
        this.msg_input.value = '';
    }
    switch_logged_off() { }
    switch_logged_in() { }
    load_messages(messages) {
        if (messages == undefined)
            return;
        let chat_box_childNodes = [];
        this.chat_box.childNodes.forEach((childNode) => { chat_box_childNodes.push(childNode); });
        for (let i = 0; i < chat_box_childNodes.length; ++i)
            chat_box_childNodes[i].remove();
        for (let i = messages.length - 1; i >= 0; --i) {
            let element = document.createElement('label');
            element.textContent = messages[i].format_message();
            this.chat_box.appendChild(element);
        }
    }
    send() {
        return __awaiter(this, void 0, void 0, function* () {
            let input = this.msg_input.value;
            this.msg_input.value = '';
            if ((yield send(input, 'livechat')) === true) {
                add_message(user.name, input, 'livechat');
            }
            else
                this.leave();
        });
    }
}
class Actions extends ASection {
    constructor() {
        super(...arguments);
        /* ASection */
        this.type = 'actions';
        this.protected = true;
        this.parent = document.getElementById('actions-parent');
        this.logged_off = this.parent.querySelectorAll('.logged-off');
        this.logged_in = this.parent.querySelectorAll('.logged-in');
        this.dependencies = ['home'];
        /* Properties */
        this.free_box = document.getElementById('free_box');
        this.blocked_box = document.getElementById('blocked_box');
        this.btn1 = document.getElementById('actions-btn1');
        this.btn2 = document.getElementById('actions-btn2');
        this.btn3 = document.getElementById('actions-btn3');
        this.blocked_users = [];
        this.free_users = [];
        this.current = undefined;
    }
    /* Methods */
    enter(verified) {
        var _a, _b;
        if (verified !== true) {
            console.log("Try to enter Actions section as unauthenticated");
            return;
        }
        this.btn1.onclick = () => history.back();
        this.btn1.textContent = 'Back';
        this.btn2.setAttribute('onclick', '');
        this.btn3.setAttribute('onclick', '');
        (_a = this.btn3.parentElement) === null || _a === void 0 ? void 0 : _a.classList.add('hidden');
        (_b = this.btn2.parentElement) === null || _b === void 0 ? void 0 : _b.classList.add('hidden');
        this.load_boxes();
        this.activate_section();
    }
    leave() {
        this.clear_boxes();
        this.deactivate_section();
        this.btn1.removeAttribute('onclick');
        this.btn2.removeAttribute('onclick');
        this.btn3.removeAttribute('onclick');
        this.btn1.setAttribute('textContent', '');
        this.btn2.setAttribute('textContent', '');
        this.btn3.setAttribute('textContent', '');
    }
    switch_logged_off() { }
    switch_logged_in() { }
    clear_boxes() {
        let childs;
        childs = [];
        this.free_box.childNodes.forEach(child => { childs.push(child); });
        for (let i = 0; i < childs.length; ++i)
            childs[i].remove();
        childs = [];
        this.blocked_box.childNodes.forEach(child => { childs.push(child); });
        for (let i = 0; i < childs.length; ++i)
            childs[i].remove();
        this.blocked_users = [];
        this.free_users = [];
    }
    load_boxes() {
        return __awaiter(this, void 0, void 0, function* () {
            this.clear_boxes();
            let blocked_users = yield get_blocked_users();
            if (blocked_users === undefined)
                return;
            let free_users = user === null || user === void 0 ? void 0 : user.get_free_users();
            if (free_users === undefined)
                return;
            this.blocked_users = blocked_users;
            this.free_users = free_users;
            console.log(blocked_users, free_users);
            this.blocked_users.forEach(blocked_user => {
                let new_li = document.createElement('li');
                new_li.onclick = () => this.click(new_li);
                new_li.textContent = blocked_user;
                this.blocked_box.appendChild(new_li);
            });
            this.free_users.forEach(free_user => {
                if ((this.blocked_users instanceof Error) === true
                    && this.blocked_users.includes(free_user) === true)
                    return;
                console.log(free_user);
                let new_li = document.createElement('li');
                new_li.onclick = () => this.click(new_li);
                new_li.textContent = free_user;
                this.free_box.appendChild(new_li);
            });
        });
    }
    add_user(username) {
        if (!(this.blocked_users instanceof Error)
            && this.blocked_users.includes(username))
            return;
        if (this.free_users.includes(username) === false) {
            this.free_users.push(username);
            let new_li = document.createElement('li');
            new_li.onclick = () => this.click(new_li);
            new_li.textContent = username;
            this.free_box.appendChild(new_li);
        }
    }
    click(element) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (((_a = this.current) === null || _a === void 0 ? void 0 : _a.textContent) === element.textContent) {
            element.classList.remove('active');
            this.current = undefined;
        }
        else {
            element.classList.add('active');
            (_b = this.current) === null || _b === void 0 ? void 0 : _b.classList.remove('active');
            this.current = element;
        }
        if (this.current !== undefined) {
            (_c = this.btn2.parentElement) === null || _c === void 0 ? void 0 : _c.classList.remove('hidden');
            (_d = this.btn3.parentElement) === null || _d === void 0 ? void 0 : _d.classList.remove('hidden');
            if (((_e = this.btn2.parentElement) === null || _e === void 0 ? void 0 : _e.id) === 'free_box')
                this.btn2.textContent = 'Block';
            else
                this.btn2.textContent = 'Unblock';
            this.btn2.onclick = () => this.trigger(this.btn2.textContent);
            // Here put the invite feature of the pong-game...
            this.btn3.onclick = () => history.back();
            this.btn3.textContent = 'Invite';
            // ---
        }
        else {
            (_f = this.btn2.parentElement) === null || _f === void 0 ? void 0 : _f.classList.add('hidden');
            (_g = this.btn3.parentElement) === null || _g === void 0 ? void 0 : _g.classList.add('hidden');
            this.btn2.onclick = () => history.back();
            this.btn3.onclick = () => history.back();
            this.btn2.textContent = '';
            this.btn3.textContent = '';
        }
    }
    trigger(action) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let username = (_a = this.current) === null || _a === void 0 ? void 0 : _a.textContent;
            if (action === null || username === undefined || username === null)
                return;
            if (action === 'Block' && (yield block(username)) === true) {
                user === null || user === void 0 ? void 0 : user.block(username);
                this.load_boxes();
            }
            if (action === 'Unblock' && (yield unblock(username)) === true)
                this.load_boxes();
        });
    }
}
sections = [new Home(), new Profile(), new Friends(), new Chat(), new Actions()];
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
        element.classList.add('active');
    });
}
function deactivate(list) {
    list.forEach(element => {
        element.classList.remove('active');
    });
}
function update_status(username, online) {
    var _a;
    if (section_index == get_section_index('friends')
        && ((_a = sections[section_index].anotherUser) === null || _a === void 0 ? void 0 : _a.username) === username)
        sections[section_index].update_status(online);
    if ((user === null || user === void 0 ? void 0 : user.onlines.includes(username)) === true || (user === null || user === void 0 ? void 0 : user.name) === username)
        return;
    if (online === true)
        add_online(username);
    if (sections[section_index].type === 'actions')
        sections[section_index].load_boxes();
}
/* --------- */
