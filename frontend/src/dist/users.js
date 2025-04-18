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
var user = undefined;
/* --------- */
class Message {
    constructor(username, message) {
        this.date = new Date(Date.now());
        this.username = username;
        this.message = message;
    }
    format_message() {
        let message = '';
        let days = nb_to_str(this.date.getDay());
        let months = nb_to_str(this.date.getMonth());
        let hours = nb_to_str(this.date.getHours());
        let minutes = nb_to_str(this.date.getMinutes());
        message += days + '/' + months + ' ';
        message += hours + ':' + minutes + ' ';
        message += this.username + ': ';
        message += this.message;
        return message;
    }
}
function nb_to_str(nb) {
    let message;
    if (nb < 10 && nb > 0)
        message = "0" + nb;
    else if (nb < 100 && nb >= 10)
        message = "" + nb;
    else
        message = "00";
    return message;
}
/* User */
class User {
    constructor(username) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
        this.web_socket = undefined;
        this.livechat = [];
        this.direct_messages = [];
        this.onlines = [];
    }
    connect_to_ws() {
        this.web_socket = new WebSocket('ws://localhost:8080/api/ws');
        this.web_socket.onopen = () => {
            console.log('Connected to WebSocket');
        };
        this.web_socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'onlines':
                        this.init_status(data.users);
                        break;
                    case 'status_update':
                        update_status(data.username, data.online);
                        break;
                    case 'livechat':
                        add_message(data.user, data.message, 'livechat');
                        break;
                    case 'direct_message':
                        add_message(data.user, data.message, 'direct_message');
                        break;
                }
            }
            catch (error) {
                console.error('WebSocket message parsing error:', error);
            }
        };
        this.web_socket.onclose = (event) => {
            console.log(`WebSocket disconnected with code: ${event.code}`);
            update_user(undefined);
        };
        this.web_socket.onerror = (error) => {
            console.log('WebSocket error:', error);
        };
    }
    get_free_users() {
        let users = [];
        user === null || user === void 0 ? void 0 : user.onlines.forEach(elem => {
            if (elem !== (user === null || user === void 0 ? void 0 : user.name) && users.includes(elem) === false)
                users.push(elem);
        });
        return users;
    }
    init_status(status) {
        let statusMap;
        statusMap = new Map();
        for (const key in status) {
            if (status.hasOwnProperty(key)) {
                statusMap.set(key, status[key]);
            }
        }
        statusMap.forEach((value, key) => {
            if (value === true && key !== (user === null || user === void 0 ? void 0 : user.name))
                user === null || user === void 0 ? void 0 : user.onlines.push(key);
        });
        if (section_index === get_section_index('actions')) {
            sections[section_index].load_boxes();
        }
    }
    block(username) {
        this.livechat = this.livechat.filter(item => item.username !== username);
    }
}
function add_online(username) {
    return __awaiter(this, void 0, void 0, function* () {
        user.onlines.push(username);
    });
}
function update_user(new_user_value) {
    user = new_user_value;
    try {
        if (user !== undefined)
            user.connect_to_ws();
    }
    catch (error) {
        console.log('WebSocket error:', error);
        update_user(undefined);
    }
    if (user === undefined) {
        let profile_i = get_section_index('profile');
        section_index = (section_index === profile_i) ? profile_i : HOME_INDEX;
    }
    update_sections();
}
function get_user_messages() {
    return user === null || user === void 0 ? void 0 : user.livechat;
}
function add_message(username, message, type) {
    let new_message = new Message(username, message);
    let messages;
    if (type === 'livechat')
        messages = user === null || user === void 0 ? void 0 : user.livechat;
    else /*(type === 'direct_message') */
        messages = user === null || user === void 0 ? void 0 : user.direct_messages;
    if (messages === undefined)
        return;
    if (messages.length === 20)
        messages.pop();
    for (let i = messages.length - 1; i >= 0; --i)
        messages[i + 1] = messages[i];
    messages[0] = new_message;
    if (type === 'livechat' && section_index === get_section_index('chat'))
        sections[get_section_index('chat')].load_messages(user === null || user === void 0 ? void 0 : user.livechat);
}
/* --------- */
/* OtherUser */
class OtherUser {
    constructor(username, is_friend, is_connected = false, stat1, stat2, stat3) {
        this.avatar = 'assets/avatar.png';
        this.username = username;
        this.is_friend = is_friend;
        this.is_connected = is_connected;
        this.stat1 = stat1;
        this.stat2 = stat2;
        this.stat3 = stat3;
    }
    format_stats() {
        let stats;
        if (this.is_friend === true)
            stats = [`Username: ${this.username}`,
                'Friendship: ', 'Wins percent: ', 'Games played with: '];
        else
            stats = [`Username: ${this.username}`,
                'Registered: ', 'Wins percent: ', 'Games played: '];
        stats[1] += this.stat1;
        stats[2] += this.stat2 + '%';
        stats[3] += this.stat3 + '%';
        return stats;
    }
}
/* --------- */
