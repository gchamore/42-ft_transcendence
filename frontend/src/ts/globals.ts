/* --------- */
class User {
    readonly name: string;
    readonly avatar_path: string;

    constructor(username:string) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
    }
}
/* --------- */



/* --------- */
const HOME_INDEX = 0;
const doc : Document = document;

var user : User | undefined = undefined;
var sections: ASection[] = [new Home(), new Profile(), new Friends()];
var section_index : number;
/* --------- */
