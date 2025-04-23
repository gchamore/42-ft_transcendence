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
    format_message() : string {
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

function nb_to_str(nb : number) : string {
    let message : string;
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
    readonly name: string;
    readonly avatar_path: string;
    web_socket: WebSocket | undefined;
    livechat: Array<Message>;
    direct_messages: Array<Message>;
    onlines: Array<string>;

    constructor(username:string) {
        this.name = username;
        this.avatar_path = 'assets/avatar.png';
        this.web_socket = undefined;
        this.livechat = [];
        this.direct_messages = [];
        this.onlines = [];
    }
    connect_to_ws() {
        this.web_socket = new WebSocket(`wss://${window.location.host}/api/ws`);

        this.web_socket.onopen = () => {
            console.log('Connected to WebSocket');
        }

        this.web_socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'status_update':
                        update_friends_status(data.username, data.online);
                        break;
                    case 'livechat':
                        add_message(data.user, data.message, 'livechat');
                        break;
                    case 'direct_message':
                        add_message(data.user, data.message, 'direct_message');
                        break;
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
    get_free_users() : Array<string> {
		let users : Array<string> = [];

		user?.onlines.forEach(elem => {
			if (elem !== user?.name && users.includes(elem) === false)
				users.push(elem);
		});

		return users;
	}
}

function add_online(username : string) {
    if (!(user?.onlines.includes(username) === false && user?.name !== username))
        return;

    user?.onlines.push(username);
    if (sections[section_index].type === 'actions')
        (sections[section_index] as Actions).add_user(username);
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
        let profile_i = get_section_index('profile')!;
        section_index = (section_index === profile_i) ? profile_i : HOME_INDEX;
    }
    update_sections();
}

function get_user_messages() : Array<Message> | undefined {
    return user?.livechat;
}

function add_message(username : string, message : string, type : string) {
    let new_message : Message = new Message(username, message);
    let messages : Array<Message> | undefined;
    
    if (type === 'livechat')
        messages = user?.livechat;
    else /*(type === 'direct_message') */
        messages = user?.direct_messages;

    if (messages === undefined)
        return ;

    if (messages.length === 20)
        messages.pop();
    for (let i = messages.length - 1; i >= 0; --i)
        messages[i + 1] = messages[i];
    messages[0] = new_message;

    if (type === 'livechat' && section_index === get_section_index('chat'))
        (sections[get_section_index('chat')!] as Chat).load_messages(user?.livechat);
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
