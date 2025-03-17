/* Classes */
abstract class ASection {
    abstract readonly type: string;
    abstract readonly protected: boolean;
    abstract readonly parent: HTMLElement;
    abstract readonly logged_off: NodeListOf<Element>;
    abstract readonly logged_in: NodeListOf<Element>;

    abstract enter(verified: boolean): void;
	abstract switch_logged_off(): void;
	abstract switch_logged_in(): void;
    leave() {
		doc.querySelectorAll(".section." + this.type).forEach(container => {
			container.classList.remove('active');
		});
		this.switch_logged_off();
	};
	logged_off_view() {
		this.logged_off?.forEach((element) => { element.classList.add('active'); });
		this.logged_in?.forEach((element) => { element.classList.remove('active'); });
	}
	logged_in_view() {
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
		doc.querySelectorAll(".section." + this.type).forEach(container => {
			container.classList.add('active');
		});
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
		doc.querySelectorAll(".section." + this.type).forEach(container => {
			container.classList.add('active');
		});
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
		
		this.avatar.setAttribute('src', user.avatar_path);
		this.username.textContent = "";
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

	/* Properties */
	readonly avatar = doc.getElementById('profile-avatar') as HTMLImageElement;
	readonly username = doc.getElementById('profile-username') as HTMLLabelElement;
	readonly username_i = doc.getElementById('profile-username-input') as HTMLInputElement;
	readonly password_i = doc.getElementById('profile-password') as HTMLInputElement;
	readonly btn1 = doc.getElementById('profile-btn1') as HTMLButtonElement;
	readonly btn2 = doc.getElementById('profile-btn1') as HTMLButtonElement;

	/* Methods */
	enter(verified: boolean) {
		if (verified !== true) {
			console.error("Try to enter Friends section as unauthenticated");
			return;
		}

		this.switch_logged_in();
		doc.querySelectorAll(".section." + this.type).forEach(container => {
			container.classList.add('active');
		});
		return true;
	}
	switch_logged_off() {}
	switch_logged_in() {}
}
/* --------- */



/* Utils */
function get_section_index(url_path : string): number {
	for (let i = 0; i < sections.length; i++) {
		if (sections[i].type === url_path
			&& !(user === undefined && sections[i].protected === true))
			return i;
	}
	return HOME_INDEX;
}

function select_section(section_index: number): void {
	for (let i = 0; i < sections.length; i++) {
		if (i !== section_index)
			sections[i].leave();
	}
	sections[section_index].enter(user !== undefined);
};
/* --------- */
