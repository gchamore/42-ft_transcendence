import { update_status, update_sections, Chat, Actions, get_type_index, sections, section_index, set_section_index, GameSection, go_section } from "./sections.js";

/* Global variables */
export var user: undefined | User = undefined;

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
	readonly date: string;
	readonly username: string;
	readonly message: string;

	constructor(username: string, message: string) {
		this.date = formatter.format(new Date());
		this.username = username;
		this.message = message;
	}
	format_message(): string {
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
	readonly email: string = '';
	readonly avatar_path: string = '';
	isTournamentCreator?: boolean = false;
	web_socket: WebSocket | undefined;
	livechat: Array<Message>;
	direct_messages: Array<Message>;
	onlines: Array<string>;

	constructor(username: string, userId?: number, email?: string, avatarPath?: string) {
		if (userId !== undefined) {
			this.userId = userId;
		}
		this.name = username;

		if (email !== undefined) {
			this.email = email;
		}
		this.avatar_path = avatarPath || 'avatar/avatar.png';
		this.web_socket = undefined;
		this.livechat = [];
		this.direct_messages = [];
		this.onlines = [];
	}
	connect_to_ws() {
		this.web_socket = new WebSocket(`wss://${window.location.host}/api/ws`);

		const overlay = document.getElementById('invite-waiting-overlay') as HTMLElement;
		const message = document.getElementById('invite-waiting-message') as HTMLElement;
		const cancelBtn = document.getElementById('cancel-invite-btn') as HTMLButtonElement;
		const acceptBtn = document.getElementById('accept-invite-btn') as HTMLButtonElement;
		const declineBtn = document.getElementById('decline-invite-btn') as HTMLButtonElement;

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
					case 'tournamentResults':
						showTournamentResults(data.placements, data.message);
						break;
					case 'TournamentGameStart':
						if (data.gameId) {
							console.log('TournamentGameStart from user', data.gameId);
							const gameSection = sections[get_type_index('game')!] as GameSection;
							this.hideWaitingScreen();
							if (data.round && data.players)
								gameSection.showTournamentInfo(data.round, data.players, () => {
									gameSection.transitionToGame(data.gameId, data.settings, data.playerNumber);
								});
						} else {
							console.error('Game ID not provided');
						}
						break;
					case 'gameInvite':

						if (overlay && message && cancelBtn && acceptBtn && declineBtn) {
							message.innerHTML = `<b>${data.fromUsername}</b> invites you to a ${data.gameType} game.<br>Do you accept?`;
							overlay.style.display = 'flex';

							acceptBtn.onclick = () => {
								overlay.style.display = 'none';
								fetch('/api/invites/respond', {
									method: 'POST',
									credentials: 'include',
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										fromUserId: data.fromUserId,
										accepted: true
									})
								});
							};
							declineBtn.onclick = () => {
								overlay.style.display = 'none';
								fetch('/api/invites/respond', {
									method: 'POST',
									credentials: 'include',
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										fromUserId: data.fromUserId,
										accepted: false
									})
								});
							};
							cancelBtn.onclick = () => {
								overlay.style.display = 'none';
							};
						}
						break;
					case 'inviteResult':
						if (overlay && message) {
							overlay.style.display = 'flex';
							if (data.accepted) {
								message.innerHTML = `<b>${data.username}</b> accepted your invite!<br>Starting game...`;
							} else {
								message.innerHTML = `<b>${data.username}</b> declined your invite.`;
							}
							setTimeout(() => { overlay.style.display = 'none'; }, 1500);
						}
						break;
					default:
						console.error('Unknown message in user type:', data.type);
				}
			} catch (error) {
				console.error('WebSocket message parsing error:', error);
			}
		};

		this.web_socket.onclose = (event) => {
			console.log(`User WebSocket disconnected with code: ${event.code} and reason: ${event.reason}`);
			update_user(undefined);
		};

		this.web_socket.onerror = (error) => {
			console.log('WebSocket error:', error);
		};
	}

	hideWaitingScreen() {
		const container = document.getElementById("game-over-menu") as HTMLElement;
		if (container) {
			container.style.display = 'none';
		}
	}

	get_free_users(): Array<string> {
		let users: Array<string> = [];

		user?.onlines.forEach(elem => {
			if (elem !== user?.name && users.includes(elem) === false)
				users.push(elem);
		});

		return users;
	}
	init_status(status: { [key: string]: boolean }) {
		let statusMap: Map<string, boolean>;
		statusMap = new Map();
		for (const key in status) {
			if (status.hasOwnProperty(key)) {
				statusMap.set(key, status[key]);
			}
		}
		statusMap.forEach((value: boolean, key: string) => {
			if (value === true && key !== user?.name)
				user?.onlines.push(key);
		});
		if (section_index === get_type_index('actions')) {
			(sections[section_index] as Actions).load_boxes();
		}
	}
	block(username: string) {
		this.livechat = this.livechat.filter(item => item.username !== username);
	}
}

function tournamentStart(tournamentId: string, bracket: string) {
	go_section('chat', '');
	const queueMsg = document.getElementById('queue-message-container');
	if (queueMsg) queueMsg.style.display = 'none';
	(sections[get_type_index('chat')!] as Chat).load_messages(get_user_messages());
	let countdown = 10;

	const overlay = document.getElementById('tournament-countdown-overlay') as HTMLElement;
	const text = document.getElementById('tournament-countdown-text') as HTMLElement;
	if (!overlay || !text) return;

	overlay.style.display = 'flex';
	text.textContent = `Tournament starting in ${countdown} seconds...`;

	const interval = setInterval(() => {
		countdown--;
		if (countdown > 0) {
			text.textContent = `Tournament starting in ${countdown} seconds...`;
		} else {
			clearInterval(interval);
			text.textContent = `Tournament is starting!`;
			setTimeout(() => {
				overlay.style.display = 'none';
				go_section('game', '');
				(sections[get_type_index('game')!] as GameSection).chooseTournamentSettings(tournamentId, bracket);
			}, 1500);
		}
	}, 1000);
}

function matchFound(matchId: string) {
	go_section('game', '');
	(sections[get_type_index('game')!] as GameSection).chooseGameSettings(matchId);
}

function showTournamentResults(placements: any[], message: string) {
	const container = document.getElementById("game-over-menu") as HTMLElement;
	const messageEl = document.getElementById("game-over-message") as HTMLElement;
	const scoreEl = document.getElementById("game-over-score") as HTMLElement;

	document.getElementById("game-over-title")!.style.display = "block";
	document.getElementById("game-over-buttons")!.style.display = "none";
	messageEl.innerHTML = message + "<br>" + placements.map(p => `${p.place}. ${p.name}`).join("<br>");
	scoreEl.textContent = "";
	container.style.display = "block";

	setTimeout(() => {
		container.style.display = "none";
		(window as any).go_section('home');
	}, 6000);
}

export async function add_online(username: string) {
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
		let profile_i = get_type_index('profile')!;
		set_section_index(section_index === profile_i ? get_type_index('profile') : get_type_index('home'));
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

	if (type === 'livechat' && section_index === get_type_index('chat'))
		(sections[get_type_index('chat')!] as Chat).load_messages(user?.livechat);
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
	readonly avatar: string = 'avatar/avatar.png';

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
