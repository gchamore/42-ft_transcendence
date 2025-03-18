"use strict";
/* User */
class User {
    constructor(username) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
    }
}
function update_user(new_user_value) {
    user = new_user_value;
    update_section();
}
/* --------- */
/* Global variables */
const HOME_INDEX = 0;
const doc = document;
var user = undefined;
var sections = [new Home(), new Profile(), new Friends()];
var section_index = HOME_INDEX;
/* --------- */
/* Friend */
// To be continued here...
/* --------- */
