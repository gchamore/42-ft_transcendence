/* User */
class User {
    constructor(name) {
        this.name = name;
        this.avatar_path = "assets/avatar.png";
    }
}
/* --------- */
/* Sections */
class ISection {
}
class Home extends ISection {
    constructor() {
        super(...arguments);
        this.type = "home";
        this.is_protected = false;
    }
    leave() {
        console.log(`Leaving ${this.type}`);
    }
}
class Profile extends ISection {
    constructor() {
        super(...arguments);
        this.type = "profile";
        this.is_protected = false;
    }
    leave() {
    }
}
class Friends extends ISection {
    constructor() {
        super(...arguments);
        this.type = "friends";
        this.is_protected = true;
    }
    leave() {
    }
}
class MyError extends ISection {
    constructor() {
        super(...arguments);
        this.type = "error";
        this.is_protected = false;
    }
    leave() { return true; }
    arrive() {
        return true;
    }
}
/* --------- */
