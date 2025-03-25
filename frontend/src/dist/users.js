"use strict";
/* Global variables */
var user = undefined;
/* --------- */
/* User */
class User {
    constructor(username) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
    }
}
function update_user(new_user_value) {
    user = new_user_value;
    update_sections();
}
/* --------- */
/* OtherUser */
class OtherUser {
    constructor(is_friend, stat1, stat2, stat3) {
        this.avatar = 'assets/avatar.png';
        this.is_friend = is_friend;
        this.stat1 = stat1;
        this.stat2 = stat2;
        this.stat3 = stat3;
    }
    format_stats() {
        let stats;
        if (this.is_friend === true)
            stats = ['Friends since: ', 'Wins percent: ', 'Games played with: '];
        else
            stats = ['Account creation: ', 'Wins percent: ', 'Games played: '];
        stats[0] += this.stat1;
        stats[1] += this.stat2 + '%';
        stats[2] += this.stat3 + '%';
        return stats;
    }
}
/* --------- */
