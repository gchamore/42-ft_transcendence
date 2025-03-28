/* Global variables */
var user : undefined | User = undefined;
/* --------- */

class Message {
    readonly date : Date;
    readonly username : string;
    readonly message : string;

    constructor(username : string, message : string) {
        this.date = new Date(Date.now());
        this.username = username;
        this.message = message;
    }
}

/* User */
class User {
    readonly name: string;
    readonly avatar_path: string;
    web_socket: WebSocket | undefined;
    livechat: Array<Message>;
    direct_messages: Array<Message>;

    constructor(username:string) {
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
        }

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
            } catch (error) {
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

function update_user(new_user_value : User | undefined) {
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
    readonly username: string;
    readonly is_friend: boolean;
    readonly is_connected: boolean;
    readonly stat1: string;
    readonly stat2: number;
    readonly stat3: number;
    readonly avatar: string = 'assets/avatar.png';

    constructor(username: string, is_friend: boolean, is_connected: boolean = false,
        stat1: string, stat2: number, stat3: number) {
        this.username = username;
        this.is_friend = is_friend;
        this.is_connected = is_connected;
        this.stat1 = stat1;
        this.stat2 = stat2;
        this.stat3 = stat3;
    }

    format_stats(): string[] {
        let stats : string[];

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
