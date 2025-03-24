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
	
	readonly btn1 = document.getElementById('friends-btn1') as HTMLButtonElement;
	readonly btn2 = document.getElementById('friends-btn2') as HTMLButtonElement;
	readonly btn3 = document.getElementById('friends-btn3') as HTMLButtonElement;
	readonly FriendsClass = sections[get_section_index('friends')!] as Friends;

	anotherUser : OtherUser | undefined = undefined;

	/* Methods */
	enter(verified: boolean) {
		if (verified !== true) {
			console.error("Try to enter Friends section as unauthenticated");
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

		this.username_i.value = '';
		this.avatar.src = '';
		this.status.textContent = '';
	}
	async search() {
		console.log("Searching:", this.username_i.value);
		this.anotherUser = await search(this.username_i.value);
		this.reset();
		if (this.anotherUser !== undefined) {
			console.log("found");
			this.btn2.onclick = () => this.message();
			this.btn2.setAttribute('textContent', 'Message');
			if (this.anotherUser.is_friend === true) {
				this.btn3.onclick = () => this.remove();
				this.btn3.setAttribute('textContent', 'Remove');
			}
			else {
				this.btn3.setAttribute('onclick', '');
				this.btn3.setAttribute('textContent', 'Add');
			}

			const stats : string[] = this.anotherUser.format_stats();
			this.stat1.textContent = stats[0];
			this.stat2.textContent = stats[1];
			this.stat3.textContent = stats[2];

			activate(this.founds);
		}
		else {
			console.log("not-found");
			activate(this.not_founds);
		}
	}
	message() {
		this.reset();
	}
	remove() {
		this.reset();
	}
}
sections = [new Home(), new Profile(), new Friends()];
/* --------- */


/* Utils */
function get_section_index(type : string): number | undefined {
	for (let i = 0; i < sections.length; i++) {
		if (sections[i].type === type)
			return i;
	}
	return undefined;
}

function set_new_section_index(type : string): void {
	let index : number | undefined = get_section_index(type);
	section_index = (index !== undefined && is_section_accessible(index)) ? index : HOME_INDEX;
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

function go_section(section : string) {
	if (section === sections[section_index].type)
		section = 'home';
	set_new_section_index(section);
	update_sections();
	history.pushState({ section : sections[section_index].type }, "",
		sections[section_index].type);
}

function activate(list : NodeListOf<Element>): void {
	list.forEach(element => {
		element.classList.add('activate');
	});
}

function deactivate(list : NodeListOf<Element>): void {
	list.forEach(element => {
		element.classList.remove('activate');
	});
}
/* --------- */
