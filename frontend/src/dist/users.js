"use strict";
/* Global variables */
var user = undefined;
/* --------- */
class Message {
    constructor(username, message) {
        this.date = new Date(Date.now());
        this.username = username;
        this.message = message;
    }
}
/* User */
class User {
    constructor(username) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
        this.web_socket = undefined;
        this.livechat = [];
        this.direct_messages = [];
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
                    case 'status_update':
                        update_friends_status(data.username, data.online);
                        console.log(data.username, data.online);
                        break;
                    // case 'live-chat':
                    //     add_livechat_message(data.username, data.message);
                    //     break;
                    // case 'direct_message':
                    //     add_direct_message(data.username, data.message);
                    //     break;
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
        section_index = HOME_INDEX;
    }
    update_sections();
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
