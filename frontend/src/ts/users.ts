/* Global variables */
var user : undefined | User = undefined;
/* --------- */



/* User */
class User {
    readonly name: string;
    readonly avatar_path: string;

    constructor(username:string) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
    }
}

function update_user(new_user_value : User | undefined) {
    user = new_user_value;
    update_sections();
}
/* --------- */



/* OtherUser */
class OtherUser {
    readonly is_friend: boolean;
    readonly stat1: string;
    readonly stat2: number;
    readonly stat3: number;
    readonly avatar: string = 'assets/avatar.png';

    constructor(is_friend: boolean, stat1: string, stat2: number, stat3: number) {
        this.is_friend = is_friend;
        this.stat1 = stat1;
        this.stat2 = stat2;
        this.stat3 = stat3;
    }

    format_stats(): string[] {
        let stats : string[];

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
