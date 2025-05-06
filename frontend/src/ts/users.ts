import { update_status, update_sections, Chat, Actions, set_tournament_bracket, get_section_index, sections, section_index, set_section_index, set_active_game_id, set_active_tournament_id, go_section, GameSection } from "./sections.js";


/* Global variables */
export var user : undefined | User = undefined;

const options: Intl.DateTimeFormatOptions = {
timeZone: 'Europe/Paris',
year: 'numeric',
month: '2-digit',
day: '2-digit',
hour: '2-digit',
minute: '2-digit',
second: '2-digit',
hour12: false,
};
  
const formatter = new Intl.DateTimeFormat('fr-FR', options);
/* --------- */



/* Message */
export class Message {
    readonly date : string;
    readonly username : string;
    readonly message : string;

    constructor(username : string, message : string) {
        this.date = formatter.format(new Date());
        this.username = username;
        this.message = message;
    }
    format_message() : string {
        let message = '';
        let days = this.date.substring(0, 2);
        let months = this.date.substring(3, 5);
        let hours = this.date.substring(11, 13);
        let minutes = this.date.substring(14, 16);
        message += days + '/' + months + ' ';
        message += hours + ':' + minutes + ' ';
        message += this.username + ': ';
        message += this.message;
        return message;
    }
}
/* --------- */



/* User */
export class User {
	readonly name: string;
	readonly userId: number = 0;
	readonly avatar_path: string;
	isTournamentCreator?: boolean = false;
	web_socket: WebSocket | undefined;
	livechat: Array<Message>;
	direct_messages: Array<Message>;
	onlines: Array<string>;

	constructor(username: string, userId?: number) {
		if (userId !== undefined) {
			this.userId = userId;
		}
		this.name = username;
		console.log('UserId:', this.userId, this.name);
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
					case 'onlines':
						this.init_status(data.users);
						break;
					case 'refresh_request':
						refresh_cookies();
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
						case 'matchFound':
						matchFound(data.gameId);
						break;
					case 'tournamentStart':
						tournamentStart(data.tournamentId, data.bracket);
						break;
					case 'TournamentGameStart':
						if (data.gameId) {
							const gameSection = sections[get_section_index('game')!] as GameSection;
							gameSection.transitionToGame(data.gameId, data.settings);
							/*need to print the tournament match on screen using data.round and data.players */
						} else {
							console.error('Game ID not provided');
						}
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
	
	get_free_users(): Array<string> {
		let users: Array<string> = [];

		user?.onlines.forEach(elem => {
			if (elem !== user?.name && users.includes(elem) === false)
				users.push(elem);
		});

		return users;
	}
    init_status(status : { [key: string]: boolean }) {
        let statusMap: Map<string, boolean>;
        statusMap = new Map();
        for (const key in status) {
            if (status.hasOwnProperty(key)) {
                statusMap.set(key, status[key]);
            }
        }
        statusMap.forEach((value : boolean, key : string) => {
            if (value === true && key !== user?.name)
                user?.onlines.push(key);
        });
        if (section_index === get_section_index('actions')) {
            (sections[section_index] as Actions).load_boxes();
        }
    }
    block(username : string) {
        this.livechat = this.livechat.filter(item => item.username !== username);
    }
}

export async function refresh_cookies(): Promise<void> {
	try {
		const username = localStorage.getItem("username");

		if (!username) {
			console.warn("No username found in localStorage.");
			return;
		}

		const response = await fetch("/send_cookies", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			credentials: "include",
			body: JSON.stringify({ username })
		});

		const data = await response.json();

		if (!response.ok) {
			console.warn("❌ Failed to refresh cookies:", data.error || data.message);
		} else {
			console.log("✅ Cookies refreshed successfully:", data.message);
		}

	} catch (error) {
		console.error("❌ /send_cookies request failed:", error);
	}
}



function tournamentStart(tournamentId: string, bracket: string) {
	set_active_tournament_id(tournamentId);
	set_tournament_bracket(bracket);
	go_section('game');
}

function matchFound(matchId: string) {
	set_active_game_id(matchId);
	go_section('game');
}

export async function add_online(username : string) {
    user!.onlines.push(username);
}

export function update_user(new_user_value: User | undefined) {
	user = new_user_value;

	try {
		if (user !== undefined && (!user.web_socket || user.web_socket.readyState !== WebSocket.OPEN))
			user.connect_to_ws();
	}
	catch (error) {
		console.log('WebSocket error:', error);
		update_user(undefined);
	}

	if (user === undefined) {
		let profile_i = get_section_index('profile')!;
		set_section_index(section_index === profile_i ? 'profile' : 'home');
	}
	update_sections();
}

export function get_user_messages(): Array<Message> | undefined {
	return user?.livechat;
}

export function add_message(username: string, message: string, type: string) {
	let new_message: Message = new Message(username, message);
	let messages: Array<Message> | undefined;

	if (type === 'livechat')
		messages = user?.livechat;
	else /*(type === 'direct_message') */
		messages = user?.direct_messages;

	if (messages === undefined)
		return;

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
export class OtherUser {
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
		let stats: string[];

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
