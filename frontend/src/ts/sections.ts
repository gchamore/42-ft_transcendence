import { SettingsPage } from './src_game/pages/settingsPage.js';
import { Game } from './src_game/pages/gamePage.js';
import { add_online, user, get_user_messages, OtherUser, Message, add_message } from './users.js';
import { login, register, add , remove, search, send, get_blocked_users } from './api.js';
/* Global variables */
export var sections : ASection[] = [];
export var HOME_INDEX : number = 0;
export var section_index : number = HOME_INDEX;
export var activeGameId: string | null = null; // Store the active game ID
var settingsPage: SettingsPage | null = null;
var gamePage: Game | null = null;
/* --------- */



/* Classes */
abstract class ASection {
    abstract readonly type: string;
    abstract readonly protected: boolean;
    abstract readonly parent: HTMLElement;
    abstract readonly logged_off: NodeListOf<Element>;
    abstract readonly logged_in: NodeListOf<Element>;
    abstract readonly dependencies: Array<string>;

    abstract enter(verified: boolean): void;
	abstract switch_logged_off(): void;
	abstract switch_logged_in(): void;
	activate_section() {
		this.dependencies.forEach(dep => {
			sections[get_section_index(dep)!].enter(user !== undefined);
		});
		document.querySelectorAll(".section." + this.type).forEach(container => {
			container.classList.add('active');
		});
	}
	deactivate_section() {
		document.querySelectorAll(".section." + this.type).forEach(container => {
			container.classList.remove('active');
		});
	}
    leave() {
		this.deactivate_section();
		this.switch_logged_off();
	};
	logged_off_view() {
		this.dependencies.forEach(dep => {
			const index = get_section_index(dep);
			if (index !== undefined)
				sections[get_section_index(dep)!].switch_logged_off();
		});
		this.logged_off?.forEach((element) => { element.classList.add('active'); });
		this.logged_in?.forEach((element) => { element.classList.remove('active'); });
	}
	logged_in_view() {
		this.dependencies.forEach(dep => {
			const index = get_section_index(dep);
			if (index !== undefined)
				sections[get_section_index(dep)!].switch_logged_in();
		});
		this.logged_off?.forEach((element) => { element.classList.remove('active'); });
		this.logged_in?.forEach((element) => { element.classList.add('active'); });
	}
}

class Home extends ASection {
	/* ASection */
	type = 'home';
	protected = false;
	parent = document.getElementById('home-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = [];

	/* Properties */
	readonly profile_btn = document.getElementById('profile-btn') as HTMLButtonElement;
	readonly friends_btn = document.getElementById('friends-btn') as HTMLButtonElement;
	readonly chat_btn = document.getElementById('chat-btn') as HTMLButtonElement;
	readonly play1v1_btn = document.getElementById('play1v1-btn') as HTMLButtonElement;
	readonly playTournament_btn = document.getElementById('playTournament-btn') as HTMLButtonElement;

	/* Methods */
	enter(verified: boolean) {
		if (verified === true)
			this.switch_logged_in();
		else
			this.switch_logged_off();
		this.activate_section();
	}
	switch_logged_off() {
		this.logged_off_view();
		this.chat_btn.removeAttribute('onclick');
		this.friends_btn.removeAttribute('onclick');
		this.play1v1_btn.removeAttribute('onclick');
		this.playTournament_btn.removeAttribute('onclick');
	}
	switch_logged_in() {
		this.logged_in_view();
		this.friends_btn.setAttribute('onclick', "go_section('friends')");
		this.chat_btn.setAttribute('onclick', "go_section('chat')");
		this.play1v1_btn.onclick = () => (sections[get_section_index('game')!]as GameSection).play1v1();
		this.playTournament_btn.onclick = () => (sections[get_section_index('game')!]as GameSection).playTournament();
	}
}


export class GameSection extends ASection {
	/* ASection */
	type = 'game';
	protected = true;
	parent = document.getElementById('game-overlay') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.non-existent-class') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.non-existent-class') as NodeListOf<Element>;
	dependencies = ['home'];


	readonly settingsPage = document.getElementById('settings-page') as HTMLElement;
    readonly gamePage = document.getElementById('gameCanvas') as HTMLCanvasElement;
    readonly gameContainer = document.getElementById('game-container') as HTMLElement;
    readonly fpsCounter = document.getElementById('fps-counter') as HTMLElement;


	/* Methods */
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Game section as unauthenticated");
			return;
		}

		this.activate_section();

		if (activeGameId) {
			if (!settingsPage) {
				settingsPage = new SettingsPage(activeGameId);
				this.settingsPage.style.display = 'block';
				this.gamePage.style.display = 'none';
				this.gameContainer.style.display = 'none';
				this.fpsCounter.style.display = 'none';
			} else if (!gamePage) {
				gamePage = new Game(activeGameId);
				this.settingsPage.style.display = 'none';
				this.gamePage.style.display = 'block';
				this.gameContainer.style.display = 'block';
				this.fpsCounter.style.display = 'block';
			}
		} else {
			console.error('No active game ID found');
		}
	}

	transitionToGame(gameId: string) {
		// Hide settings page and show game page
		this.settingsPage.style.display = 'none';
		this.gamePage.style.display = 'block';
		this.gameContainer.style.display = 'block';
		this.fpsCounter.style.display = 'block';

		// Initialize the game
		gamePage = new Game(gameId);
	}

	async leave() {
		super.leave();
		if (settingsPage) {
			settingsPage.cleanup();
			settingsPage = null;
		}
		if (gamePage) {
			gamePage.stopGame();
			gamePage = null;
		}
		this.deactivate_section();
	}
	switch_logged_off() {
		this.logged_off_view();
	}
	switch_logged_in() {
		this.logged_in_view();
	}


	async play1v1() {
		if (!user) { 
			console.error('play1v1: not logged in');
			return ;
		}
		try { 
			const resp = await fetch('/api/game/queue', {
				method: 'POST',
				credentials: 'include',
				headers: { "Content-Type": "application/json"},
				body: JSON.stringify({ userId: user.userId })
			});
			if (resp.status === 202) { 
				alert('waiting for an opponent');
			} else if (resp.ok) { 
				alert('Match found! Waiting for game to start...');
			} else { 
				const err = await resp.json();
				alert(`Queue error: ${err.error}`);
			}
		} catch (err) {
			console.error('play1v1: error', err);
			alert('Failed to join 1v1 queue');
		}

	}


	async playTournament() {
		if (!user) {
			console.error('playTournament: not logged in');
			return;
		}
		const maxPlayers = parseInt(prompt('Enter max players:', '4') || '4', 10);
		if (isNaN(maxPlayers) || maxPlayers < 2) {
			alert('Invalid number of players');
			return;
		}
		try {
			const createResp = await fetch('/api/game/tournament', {
				method: 'POST',
				credentials: 'include',
				body: JSON.stringify({
					creatorId: user.name,
					name: '',
					maxPlayers
				})
			});
			if (!createResp.ok) {
				const err = await createResp.json();
				alert(`Tournament creation error: ${err.error}`);
				return;
			}
			const { tournamentId: tid } = await createResp.json();
			const joinResp = await fetch(`/api/tournament/${tid}/join`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerId: user.name })
			});
			if (joinResp.status === 202) {
				alert(`Joined tournament ${tid}, waiting for players…`);
			} else if (joinResp.ok) {
				activeGameId = tid;
				go_section('game');
			} else {
				const err = await joinResp.json();
				alert(`Tournament join error: ${err.error}`);
			}
		} catch (err) {
			console.error('playTournament: error', err);
			alert('Failed to create / join tournament');
		}

	}
}


class Profile extends ASection {
	/* ASection */
	type = 'profile';
	protected = false;
	parent = document.getElementById('profile-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];

	/* Properties */
	readonly avatar = document.getElementById('profile-avatar') as HTMLImageElement;
	readonly username = document.getElementById('profile-username') as HTMLLabelElement;
	readonly username_i = document.getElementById('profile-username-input') as HTMLInputElement;
	readonly password_i = document.getElementById('profile-password') as HTMLInputElement;
	readonly btn1 = document.getElementById('profile-btn1') as HTMLButtonElement;
	readonly btn2 = document.getElementById('profile-btn2') as HTMLButtonElement;

	/* Methods */
	enter(verified: boolean) {
		if (verified === true)
			this.switch_logged_in();
		else
			this.switch_logged_off();
		this.activate_section();
	}
	switch_logged_off() {
		this.logged_off_view();

		this.avatar.src = "";
		this.username.textContent = "";
		this.username_i.value = "";
		this.password_i.value = "";

		this.btn1.textContent = "Register";
		this.btn1.onclick = () => register(this.username_i.value, this.password_i.value);
		this.btn2.textContent = "Login";
		this.btn2.onclick = () => login(this.username_i.value, this.password_i.value);
	}
	switch_logged_in() {
		if (user === undefined) {
			console.error("Profile.switch_logged_off: user undefined");
			return ;
		}
		
		this.avatar.src = user.avatar_path;
		this.username.textContent = user.name;
		this.username_i.value = "";
		this.password_i.value = "";

		this.btn1.textContent = "Settings";
		this.btn2.setAttribute("onclick", "verify_token()");
		this.btn2.textContent = "Logout";
		this.btn2.setAttribute("onclick", "logout()");

		this.logged_in_view();
	}
}

class Friends extends ASection {
	/* ASection */
	type = 'friends';
	protected = true;
	parent = document.getElementById('friends-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];
	
	/* Properties */
	readonly founds = this.parent.querySelectorAll('.found') as NodeListOf<Element>;
	readonly not_founds = this.parent.querySelectorAll('.not-found') as NodeListOf<Element>;

	readonly username_i = document.getElementById('friends-username') as HTMLInputElement;

	readonly avatar = document.getElementById('friend-avatar') as HTMLImageElement;
	readonly status = document.getElementById('status') as HTMLLabelElement;
	
	readonly stat1 = document.getElementById('friend-stat1') as HTMLLabelElement;
	readonly stat2 = document.getElementById('friend-stat2') as HTMLLabelElement;
	readonly stat3 = document.getElementById('friend-stat3') as HTMLLabelElement;
	readonly stat4 = document.getElementById('friend-stat4') as HTMLLabelElement;
	
	readonly btn1 = document.getElementById('friends-btn1') as HTMLButtonElement;
	readonly btn2 = document.getElementById('friends-btn2') as HTMLButtonElement;
	readonly btn3 = document.getElementById('friends-btn3') as HTMLButtonElement;
	readonly FriendsClass = sections[get_section_index('friends')!] as Friends;

	anotherUser : OtherUser | undefined = undefined;

	/* Methods */
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Friends section as unauthenticated");
			return;
		}

		this.reset();
		this.logged_in_view();
		this.activate_section();
	}
	leave() {
		this.reset();
		this.deactivate_section();

		this.btn1.removeAttribute('onclick');
		this.btn2.removeAttribute('onclick');
		this.btn3.removeAttribute('onclick');
	}
	switch_logged_off() {}
	switch_logged_in() {}

	reset() {
		deactivate(this.founds);
		deactivate(this.not_founds);

		this.anotherUser = undefined;
		this.btn1.onclick = () => this.search();
		this.btn1.textContent = 'Search';
		this.btn2.removeAttribute('onclick');
		this.btn2.textContent = '';
		this.btn3.removeAttribute('onclick');
		this.btn3.textContent = '';

		this.stat1.textContent = '';
		this.stat2.textContent = '';
		this.stat3.textContent = '';
		this.stat4.textContent = '';

		this.username_i.value = '';
		this.avatar.src = '';
		this.status.textContent = '';
		this.status.style.color = 'black';
	}
	async search(user : string = this.username_i.value) {
		let status : OtherUser | Error | undefined = await search(user);
		if (status instanceof Error)
			return ;

		this.anotherUser = (status as OtherUser | undefined);
		this.username_i.value = '';

		if (this.anotherUser !== undefined) {
			this.avatar.src = this.anotherUser.avatar;
			
			if (this.anotherUser.is_friend === true) {
				this.btn2.onclick = () => this.remove();
				this.btn2.textContent = 'Remove';
			}
			else {
				this.btn2.onclick = () => this.add();
				this.btn2.textContent = 'Add';
			}

			
			const stats = this.anotherUser.format_stats();
			this.stat1.textContent = stats[0];
			this.stat2.textContent = stats[1];
			this.stat3.textContent = stats[2];
			this.stat4.textContent = stats[3];
			
			activate(this.founds);
			deactivate(this.not_founds);

			this.update_status(this.anotherUser.is_connected);
		}
		else {
			this.reset();
			activate(this.not_founds);
			deactivate(this.founds);
		}
	}
	message() {
		this.reset();
	}
	async add() {
		if (await add(this.anotherUser!.username) instanceof Error)
			return ;
		let user = this.anotherUser!.username;
		this.anotherUser = undefined;
		this.search(user);
	}
	async remove() {
		if (await remove(this.anotherUser!.username) instanceof Error)
			return ;
		let user = this.anotherUser!.username;
		this.reset();
		this.search(user);
	}
	update_status(online : boolean) {
		this.status.textContent = (online) ? 'Online' : 'Offline';
		this.status.style.color = (online) ? 'rgb(32, 96, 32)': 'rgb(153, 0, 0)';

		if (online) {
			this.btn3.onclick = () => this.message();
			this.btn3.textContent = 'Message';
			(this.btn3.parentElement as HTMLLIElement).classList.add('active');
		}
		else {
			this.btn3.removeAttribute('onclick');
			this.btn3.textContent = '';
			(this.btn3.parentElement as HTMLLIElement).classList.remove('active');
		}
	}
}

export class Chat extends ASection {
	/* ASection */
	type = 'chat';
	protected = true;
	parent = document.getElementById('chat-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];
	
	/* Properties */
	readonly chat_box = document.getElementById('chat-box') as HTMLUListElement;
	readonly msg_input = document.getElementById('msg-input') as HTMLButtonElement;
	readonly btn1 = document.getElementById('chat-btn1') as HTMLButtonElement;
	readonly btn2 = document.getElementById('chat-btn2') as HTMLButtonElement;
	readonly btn3 = document.getElementById('chat-btn3') as HTMLButtonElement;

	/* Methods */
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Chat section as unauthenticated");
			return;
		}
		this.btn1.onclick = () => history.back();
		this.btn1.textContent = 'Back';

		this.btn2.onclick = () => this.send();
		this.btn2.textContent = 'Send';
	
		this.btn3.onclick = () => go_section('actions');
		this.btn3.textContent = 'Actions';
		
		this.load_messages(get_user_messages());
		this.msg_input.value = '';
		this.activate_section();
	}
	leave() {
		this.deactivate_section();

		this.btn1.removeAttribute('onclick');
		this.btn2.removeAttribute('onclick');
		this.btn3.removeAttribute('onclick');
		this.chat_box.childNodes.forEach((childNode) => {
			childNode.remove();
		});
		this.msg_input.value = '';
	}
	switch_logged_off() {}
	switch_logged_in() {}
	load_messages(messages : Array<Message> | undefined) {
		if (messages == undefined)
			return;

		let chat_box_childNodes : Array<ChildNode> = [];
		this.chat_box.childNodes.forEach((childNode) => { chat_box_childNodes.push(childNode); });
		for (let i = 0; i < chat_box_childNodes.length; ++i)
			chat_box_childNodes[i].remove();

		for (let i = messages.length - 1; i >= 0; --i) {
			let element = document.createElement('label');
			element.textContent = messages[i].format_message();
			this.chat_box.appendChild(element);
		}
	}
	async send() {
		let input = this.msg_input.value;
		this.msg_input.value = '';
		if (await send(input, 'livechat') === true) {
			add_message(user!.name, input, 'livechat');
		}
		else
			this.leave();
	}
}

export class Actions extends ASection {
	/* ASection */
	type = 'actions';
	protected = true;
	parent = document.getElementById('actions-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];
	
	/* Properties */
	readonly free_box = document.getElementById('free_box') as HTMLUListElement;
	readonly blocked_box = document.getElementById('blocked_box') as HTMLUListElement;

	readonly btn1 = document.getElementById('actions-btn1') as HTMLButtonElement;
	readonly btn2 = document.getElementById('actions-btn2') as HTMLButtonElement;
	readonly btn3 = document.getElementById('actions-btn3') as HTMLButtonElement;

	blocked_users : Array<string> = [];
	free_users : Array<string> = [];

	/* Methods */
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Actions section as unauthenticated");
			return;
		}
		this.btn1.onclick = () => history.back();
		this.btn1.textContent = 'Back';
		
		this.btn2.setAttribute('onclick', '');
		this.btn3.setAttribute('onclick', '');
		this.btn3.parentElement?.classList.add('hidden');
		this.btn2.parentElement?.classList.add('hidden');

		this.load_boxes();
		this.activate_section();
	}
	leave() {
		this.clear_boxes();
		this.deactivate_section();

		this.btn1.removeAttribute('onclick');
		this.btn2.removeAttribute('onclick');
		this.btn3.removeAttribute('onclick');
		this.btn1.setAttribute('textContent', '');
		this.btn2.setAttribute('textContent', '');
		this.btn3.setAttribute('textContent', '');
	}
	switch_logged_off() {}
	switch_logged_in() {}
	
	clear_boxes() {
		let childs : Array<ChildNode>;

		childs = [];
		this.free_box.childNodes.forEach(child => { childs.push(child); });
		for (let i = 0; i < childs.length; ++i)
			childs[i].remove();
		
		childs = [];
		this.blocked_box.childNodes.forEach(child => { childs.push(child); });
		for (let i = 0; i < childs.length; ++i)
			childs[i].remove();
	}
	async load_boxes() {
		let blocked_users : Array<string> | Error = await get_blocked_users();
		if (blocked_users instanceof Error)
			return;
		let free_users : Array<string> | undefined = user?.get_free_users();
		if (free_users === undefined)
			return;

		this.blocked_users = blocked_users;
		this.free_users = free_users;

		this.blocked_users.forEach(blocked_user => {
			let new_li = document.createElement('li');
			new_li.textContent = blocked_user;
			this.blocked_box.appendChild(new_li);
		});

		this.free_users?.forEach(free_user => {
			if ((this.blocked_users instanceof Error) === true
				|| this.blocked_users.includes(free_user) === false)
				return;
			let new_li = document.createElement('li');
			new_li.textContent = free_user;
			this.free_box.appendChild(new_li);
		});
	}
	add_user(username: string) {
		if (!(this.blocked_users instanceof Error)
			&& this.blocked_users.includes(username))
			return;

		if (this.free_users.includes(username) === false) {
			this.free_users.push(username);
			let new_li = document.createElement('li');
			new_li.textContent = username;
			this.free_box.appendChild(new_li);
		}
	}
}
sections = [new Home(), new Profile(), new Friends(), new Chat(), new Actions(), new GameSection()];
/* --------- */


/* Utils */
export function get_section_index(type : string): number | undefined {
	for (let i = 0; i < sections.length; i++) {
		if (sections[i].type === type)
			return i;
	}
	return undefined;
}

export function set_new_section_index(type : string): void {
	let index : number | undefined = get_section_index(type);
	section_index = (index !== undefined && is_section_accessible(index)) ? index : HOME_INDEX;
}

function is_section_accessible(index : number): boolean {
	return !(user === undefined && sections[index].protected === true);
}

export function update_sections(): void {
	for (let i = 0; i < sections.length; i++) {
		if (i !== section_index)
			sections[i].leave();
	}
	sections[section_index].enter(user !== undefined);
};

// function update_section(): void {
// 	if (user === undefined)
// 		sections[section_index].switch_logged_off();
// 	else
// 		sections[section_index].switch_logged_in();
// }

export function go_section(section : string) {
	if (section === sections[section_index].type)
		section = 'home';
	set_new_section_index(section);
	update_sections();
	history.pushState({ section : sections[section_index].type }, "",
		sections[section_index].type);
}

function activate(list : NodeListOf<Element>): void {
	list.forEach(element => {
		element.classList.add('active');
	});
}

function deactivate(list : NodeListOf<Element>): void {
	list.forEach(element => {
		element.classList.remove('active');
	});
}

export function update_friends_status(username : string, online : boolean) {
	add_online(username);
	if (section_index == get_section_index('friends')
		&& (sections[section_index] as Friends).anotherUser?.username === username) {
		(sections[section_index] as Friends).update_status(online);
	}
}

export function set_section_index(index : number): void {
	section_index = index;
}

export function set_active_game_id(gameId: string): void {
	activeGameId = gameId;
}
/* --------- */
