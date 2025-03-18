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
		doc.querySelectorAll(".section." + this.type).forEach(container => {
			container.classList.add('active');
		});
	}
	deactivate_section() {
		doc.querySelectorAll(".section." + this.type).forEach(container => {
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
	parent = doc.getElementById('home-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = [];

	/* Properties */
	readonly profile_btn = doc.getElementById('profile-btn') as HTMLButtonElement;
	readonly friends_btn = doc.getElementById('friends-btn') as HTMLButtonElement;
	readonly chat_btn = doc.getElementById('chat-btn') as HTMLButtonElement;

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
	parent = doc.getElementById('profile-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];

	/* Properties */
	readonly avatar = doc.getElementById('profile-avatar') as HTMLImageElement;
	readonly username = doc.getElementById('profile-username') as HTMLLabelElement;
	readonly username_i = doc.getElementById('profile-username-input') as HTMLInputElement;
	readonly password_i = doc.getElementById('profile-password') as HTMLInputElement;
	readonly btn1 = doc.getElementById('profile-btn1') as HTMLButtonElement;
	readonly btn2 = doc.getElementById('profile-btn2') as HTMLButtonElement;

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
	parent = doc.getElementById('friends-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];
	
	/* Properties */
	readonly founds = this.parent.querySelectorAll('.found') as NodeListOf<Element>;
	readonly not_founds = this.parent.querySelectorAll('.not-found') as NodeListOf<Element>;

	readonly username_i = doc.getElementById('friends-username') as HTMLInputElement;

	readonly avatar = doc.getElementById('friend-avatar') as HTMLImageElement;
	readonly status = doc.getElementById('status') as HTMLLabelElement;
	
	readonly stat1 = doc.getElementById('friend-stat1') as HTMLLabelElement;
	readonly stat2 = doc.getElementById('friend-stat2') as HTMLLabelElement;
	readonly stat3 = doc.getElementById('friend-stat3') as HTMLLabelElement;
	
	readonly btn1 = doc.getElementById('friends-btn1') as HTMLButtonElement;
	readonly btn2 = doc.getElementById('friends-btn2') as HTMLButtonElement;
	readonly btn3 = doc.getElementById('friends-btn3') as HTMLButtonElement;

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
		const username = this.username_i.value;
		this.reset();
		if (await search(username) === true) {
			console.log(username, "found");
		}
		// To be continued...
	}
}
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

function clear_friends(section : Friends): void {
	
}
/* --------- */
