"use strict";
/* --------- */
class User {
    constructor(username) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
    }
}
/* --------- */
/* --------- */
const HOME_INDEX = 0;
const doc = document;
var user;
var sections = [new Home(), new Profile(), new Friends()];
var section_index;
/* --------- */
