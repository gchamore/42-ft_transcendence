/* Global variables */
var sections : ASection[] = [];
var HOME_INDEX : number = 0;
var section_index : number = HOME_INDEX;
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
	}
	switch_logged_in() {
		this.logged_in_view();
		this.friends_btn.setAttribute('onclick', "go_section('friends')");
		this.chat_btn.setAttribute('onclick', "go_section('chat')");
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
		this.btn1.onclick = () => go_section('settings');

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

			this.btn3.onclick = () => {
				window.location.href = "directmessage" + '/' + this.anotherUser?.username;
			};
			this.btn3.textContent = 'Message';
			
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

class Chat extends ASection {
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
		let input : string = this.msg_input.value;
		this.msg_input.value = '';
		if (await send(input, 'livechat') === true) {
			add_message(user!.name, input, 'livechat');
		}
		else
			this.leave();
	}
}

class Actions extends ASection {
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

	current : HTMLLIElement | undefined = undefined;
	load_mutex : boolean = false;

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
		while (this.free_box.firstChild) {
			this.free_box.firstChild.remove(); 
		}
		while (this.blocked_box.firstChild) {
			this.blocked_box.firstChild.remove(); 
		}

		this.current = undefined;
		this.blocked_users = [];
		this.free_users = [];
	}
	async load_boxes() {
		if (this.load_mutex === true)
			return;
		this.load_mutex = true;

		this.clear_boxes();
		let blocked_users : Array<string> | undefined = await get_blocked_users();
		if (blocked_users === undefined)
			return;
		let free_users : Array<string> | undefined = user?.get_free_users();
		if (free_users === undefined)
			return;

		this.blocked_users = blocked_users;
		this.free_users = free_users;

		this.blocked_users.forEach(blocked_user => {
			let new_li = document.createElement('li');
			new_li.onclick = () => this.click(new_li);
			new_li.textContent = blocked_user;
			this.blocked_box.appendChild(new_li);
		});

		this.free_users.forEach(free_user => {
			if (this.blocked_users.includes(free_user) === true)
				return;
			let new_li = document.createElement('li');
			new_li.onclick = () => this.click(new_li);
			new_li.textContent = free_user;
			this.free_box.appendChild(new_li);
		});
		this.load_mutex = false;
	}
	click(element : HTMLLIElement) {
		if (this.current?.textContent === element.textContent) {
			element.classList.remove('active');
			this.current = undefined;
		}
		else {
			element.classList.add('active');
			this.current?.classList.remove('active');
			this.current = element;
		}
		if (this.current !== undefined) {
			this.btn2.parentElement?.classList.remove('hidden');
			this.btn3.parentElement?.classList.remove('hidden');

			if (this.current.parentElement?.getAttribute('id') === 'free_box') {
				this.btn2.textContent = 'Block';
				// Here put the invite feature of the pong-game...
				this.btn3.onclick = () => history.back();
				this.btn3.textContent = 'Invite';
				// ---
			}
			else {
				this.btn2.textContent = 'Unblock';
				this.btn3.parentElement?.classList.add('hidden');
				this.btn3.removeAttribute('onclick');
				this.btn3.textContent = '';
			}
			this.btn2.onclick = () => this.trigger(this.btn2.textContent);
		}
		else {
			this.btn2.parentElement?.classList.add('hidden');
			this.btn3.parentElement?.classList.add('hidden');
			this.btn2.removeAttribute('onclick');
			this.btn3.removeAttribute('onclick');
			this.btn2.textContent = '';
			this.btn3.textContent = '';
		}
	}
	async trigger(action : string | null) {
		let username : string | undefined | null = this.current?.textContent;

		if (action === null || username === undefined || username === null)
			return;

		if (action === 'Block' && await block(username) === true) {
			user?.block(username);
			this.load_boxes();
		}
		
		if (action === 'Unblock' && await unblock(username) === true) {
			this.load_boxes();
		}
		this.current = undefined;

		this.btn2.setAttribute('onclick', '');
		this.btn3.setAttribute('onclick', '');

		this.btn3.parentElement?.classList.add('hidden');
		this.btn2.parentElement?.classList.add('hidden');
	}
}

class Settings extends ASection {
	/* ASection */
	type = 'settings';
	protected = true;
	parent = document.getElementById('settings-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = [];

	/* Methods */
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Settings section as unauthenticated");
			return;
		}
		this.activate_section();
	}
	leave() {
		this.deactivate_section();
	}
	switch_logged_off() {}
	switch_logged_in() {}
}

class DirectMessage extends ASection {
	/* ASection */
	type = 'directmessage';
	protected = true;
	parent = document.getElementById('directmessage-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];

	/* Methods */
	enter(verified: boolean) {
		if (verified !== true || ) {
			console.log("Try to enter DirectMessage section as unauthenticated");
			return;
		}
		this.activate_section();
	}
	leave() {
		this.deactivate_section();
	}
	switch_logged_off() {}
	switch_logged_in() {}
}
sections = [new Home(), new Profile(), new Friends(), new Chat(), new Actions(),
			new Settings(), new DirectMessage()];
/* --------- */



/* Utils */
function	get_url_type(url : string) : string {
	let end;
	for (end = 0; end < url.length; ++end) {
		if (url[end] == '/')
			break;
	}
	let type;

	type = url.substring(0, end);
	console.log('Url type:', type);

	return type;
}

function	get_url_option(url : string) : string | undefined {
	let start;
	for (start = 0; start < url.length; ++start) {
		if (url[start] == '/')
			break;
	}

	let option;
	if (start < url.length) {
		option = url.substring(start + 1, length);
	}
	else
		option = undefined;
	console.log('Url option:', option);

	return option;
}

function get_section_index(type : string): number | undefined {
	for (let i = 0; i < sections.length; i++) {
		if (sections[i].type === type)
				return i;
	}
	return undefined;
}

function set_section_index(type : string, option : string | undefined): void {
	let index : number | undefined = get_section_index(type);
	if (index === undefined)
		section_index = HOME_INDEX;
	else if (!is_section_accessible(index))
		section_index = HOME_INDEX;
	else if (sections[index].option !== undefined
		&& sections[index].option !== option)
		section_index = HOME_INDEX;
	else if (sections[index].option === undefined
		|| sections[index].option === option)
		sections_index = index;
}

function is_section_accessible(index : number): boolean {
	return !(user === undefined && sections[index].protected === true);
}

function update_sections(): void {
	for (let i = 0; i < sections.length; i++) {
		if (i !== section_index)
			sections[i].leave();
	}
	sections[section_index].enter(user !== undefined);
};

function update_section(): void {
	if (user === undefined)
		sections[section_index].switch_logged_off();
	else
		sections[section_index].switch_logged_in();
}

function go_section(section : string, type : string) {
	if (section === sections[section_index].type)
		section = 'home';
	set_section_index(section, type);
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

function update_status(username : string, online : boolean) {
	if (section_index == get_section_index('friends')
		&& (sections[section_index] as Friends).anotherUser?.username === username)
		(sections[section_index] as Friends).update_status(online);

	if (user?.onlines.includes(username) === true || user?.name === username)
        return;

	if (online === true)
		add_online(username);

	if (sections[section_index].type === 'actions')
        (sections[section_index] as Actions).load_boxes();
}
/* --------- */
