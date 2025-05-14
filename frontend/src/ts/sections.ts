import { SettingsPage } from './src_game/pages/settingsPage.js';
import { Game } from './src_game/pages/gamePage.js';
import { update_user, User, add_online, user, get_user_messages, get_user_directmessages, OtherUser, Message, add_message } from './users.js';
import { update} from './api.js';
import { login, register, logout, unregister, add, remove, search, send, get_blocked_users, block, unblock, setup2fa, activate2fa, verify2fa, disable2fa, get2faStatus, getUserAccountType, initiateGoogleLogin, updateAvatar, getGameHistory} from './api.js';

/* Custom types */
// const ACCEPTED = 1;
// const REFUSED = 0;
// type OptionStatus = typeof ACCEPTED | typeof REFUSED;
/* --------- */


/* Global variables */
export var sections: ASection[] = [];
export var HOME_INDEX: number = 0;
export var section_index: number = HOME_INDEX;

export var activeGameId: string | null = null; // Store the active game ID
export var activeTournamentId: string | null = null; // Store the active tournament ID
let tournamentSettingsChosen = false; // Store the tournament settings chosen
let tournamentBracket: any = null; // Store the tournament bracket
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

	abstract is_option_valid(option: string): Promise<boolean>;
	abstract enter(verified: boolean): void;
	abstract switch_logged_off(): void;
	abstract switch_logged_in(): void;
	activate_section() {
		this.dependencies.forEach(dep => {
			sections[get_type_index(dep)!].enter(user !== undefined);
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
			const index = get_type_index(dep);
			if (index !== undefined)
				sections[get_type_index(dep)!].switch_logged_off();
		});
		this.logged_off?.forEach((element) => { element.classList.add('active'); });
		this.logged_in?.forEach((element) => { element.classList.remove('active'); });
	}
	logged_in_view() {
		this.dependencies.forEach(dep => {
			const index = get_type_index(dep);
			if (index !== undefined)
				sections[get_type_index(dep)!].switch_logged_in();
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
	async is_option_valid(option: string): Promise<boolean> {
		return (option === '') ? true : false;
	}
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
		this.friends_btn.setAttribute('onclick', "go_section('friends', '')");
		this.chat_btn.setAttribute('onclick', "go_section('chat', '')");
		this.play1v1_btn.onclick = () => (sections[get_type_index('game')!] as GameSection).play1v1();
		this.playTournament_btn.onclick = () => (sections[get_type_index('game')!] as GameSection).playTournament();
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
	readonly queueMessageContainer = document.getElementById('queue-message-container') as HTMLElement;
	readonly leaveQueueBtn = document.getElementById('leave-queue-btn') as HTMLButtonElement;
	readonly queueMessage = document.getElementById('queue-message') as HTMLElement;
	readonly queueUsernameEntry = document.getElementById('queue-username-entry') as HTMLElement;
	readonly tournamentUsernameInput = document.getElementById('tournament-username-input') as HTMLInputElement;
	readonly tournamentUsernameValidateBtn = document.getElementById('tournament-username-validate-btn') as HTMLButtonElement;


	/* Methods */
	async is_option_valid(_option: string): Promise<boolean> {
		return true;
	}
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Game section as unauthenticated");
			return;
		}

		this.activate_section();
	}

	chooseGameSettings(gameId: string) {
		if (!settingsPage) {
			if (user && user.userId)
				settingsPage = new SettingsPage(gameId, false);
			this.settingsPage.style.display = 'block';
			this.gamePage.style.display = 'none';
			this.gameContainer.style.display = 'none';
			this.fpsCounter.style.display = 'none';
		} else {
			console.error('No active game ID or tournament ID found');
		}
		if (this.queueMessageContainer)
			this.queueMessageContainer.style.display = 'none';
	}

	chooseTournamentSettings(tournamentId: string, bracket: string) {
		tournamentBracket = bracket;
		if (this.queueMessageContainer)
			this.queueMessageContainer.style.display = 'none';
		if (!tournamentSettingsChosen && !settingsPage && user && user.userId && tournamentBracket) {
			settingsPage = new SettingsPage(tournamentId, true);
			this.settingsPage.style.display = 'block';
			this.gamePage.style.display = 'none';
			this.gameContainer.style.display = 'none';
			this.fpsCounter.style.display = 'none';
			tournamentSettingsChosen = true;
		} else {
			console.error('No active game ID or tournament ID found');
		}
	}

	resetTournamentState() {
		tournamentSettingsChosen = false;
		if (user) user.isTournamentCreator = false;
		activeTournamentId = null;
	}

	transitionToGame(gameId: string, settings: any, playerNumber: number) {
		// Hide settings page and show game page
		this.settingsPage.style.display = 'none';
		this.gamePage.style.display = 'block';
		this.gameContainer.style.display = 'block';
		this.fpsCounter.style.display = 'block';
		const container = document.getElementById("game-over-menu") as HTMLElement;
		if (container) {
			container.style.display = 'none';
		}

		// Initialize the game
		if (user && user.userId)
			gamePage = new Game(gameId, settings, playerNumber);
	}

	showTournamentInfo(round: string, players: string[], onDone?: () => void) {
		const gameOverMenu = document.getElementById("game-over-menu");
		if (gameOverMenu) {
			gameOverMenu.style.display = "none";
		}
		this.settingsPage.style.display = 'none';
		const container = document.getElementById("tournament-info");
		if (container) {
			container.innerHTML = `
                <div class="tournament-info-title">Tournament ${round.charAt(0).toUpperCase() + round.slice(1)}</div>
                <div class="tournament-info-players">${players.join(" vs ")}</div>
            `;
			container.style.display = "flex";
			setTimeout(() => {
				container.style.display = "none";
				if (onDone) onDone();
			}, 5000);
		} else if (onDone) {
			onDone();
		}
	}

	async leave() {

		this.settingsPage.style.display = 'none';
		this.gamePage.style.display = 'none';
		this.gameContainer.style.display = 'none';
		this.fpsCounter.style.display = 'none';
		this.queueMessageContainer.style.display = 'none';
		if (settingsPage) {
			settingsPage.cleanup();
			settingsPage = null;
		}
		if (gamePage) {
			gamePage.stopGame("leaving Game section");
			gamePage = null;
		}
		tournamentSettingsChosen = false;
		this.enableSidebarButtons();
		this.deactivate_section();
	}
	switch_logged_off() {
		this.logged_off_view();
	}
	switch_logged_in() {
		this.logged_in_view();
	}

	showQueueMessage(msg: string, type: 'game' | 'tournament' = 'game', inQueue: boolean = true, showUsernameEntry: boolean = false): Promise<string | null> | void {
		if (!showUsernameEntry) {
			if (this.queueMessage)
				this.queueMessage.textContent = msg;
			if (this.queueMessageContainer) {
				this.queueMessageContainer.style.display = 'block';
				this.queueMessageContainer.setAttribute('data-queue-type', type);
			}
			if (this.leaveQueueBtn) {
				this.leaveQueueBtn.style.display = inQueue ? 'inline-block' : 'none';
			}
			if (this.queueUsernameEntry) {
				this.queueUsernameEntry.style.display = 'none';
			}
			if (inQueue) {
				this.disableSidebarButtons();
			}
			return;
		}

		// If username entry is needed, return a Promise
		return new Promise<string | null>((resolve) => {
			if (this.queueMessage)
				this.queueMessage.textContent = msg;
			if (this.queueMessageContainer) {
				this.queueMessageContainer.style.display = 'block';
				this.queueMessageContainer.setAttribute('data-queue-type', type);
			}
			if (this.leaveQueueBtn) {
				this.leaveQueueBtn.style.display = inQueue ? 'inline-block' : 'none';
			}
			if (this.queueUsernameEntry) {
				this.queueUsernameEntry.style.display = 'block';
			}
			if ( inQueue) {
				this.disableSidebarButtons();
			}
			if (this.tournamentUsernameInput && this.tournamentUsernameValidateBtn) {
				this.tournamentUsernameInput.value = '';
				const validateHandler = () => {
					const username = this.tournamentUsernameInput.value.trim();
					this.tournamentUsernameValidateBtn.removeEventListener('click', validateHandler);
					resolve(username.length > 0 ? username : null);
				};
				this.tournamentUsernameValidateBtn.addEventListener('click', validateHandler);
			}
		});
	}

	hideQueueMessage() {
		if (this.queueMessageContainer)
			this.queueMessageContainer.style.display = 'none';
		this.enableSidebarButtons();
	};

	// Add inside GameSection class

	disableSidebarButtons() {
		const home = sections[get_type_index('home')!] as any;
		home.profile_btn.disabled = true;
		home.friends_btn.disabled = true;
		home.chat_btn.disabled = true;
		home.play1v1_btn.disabled = true;
		home.playTournament_btn.disabled = true;
	}

	enableSidebarButtons() {
		const home = sections[get_type_index('home')!] as any;
		home.profile_btn.disabled = false;
		home.friends_btn.disabled = false;
		home.chat_btn.disabled = false;
		home.play1v1_btn.disabled = false;
		home.playTournament_btn.disabled = false;
	}

	async play1v1() {
		if (!user) {
			console.error('play1v1: not logged in');
			return;
		}

		if (this.leaveQueueBtn) {
			this.leaveQueueBtn.onclick = async () => {
				try {
					await fetch('/api/game/queue/leave', {
						method: 'DELETE',
						credentials: 'include',
						headers: { "Content-Type": "application/json" }
					});
				} catch (err) {
					console.error('Error leaving queue:');
					setTimeout(this.hideQueueMessage, 2000);
				}
				this.hideQueueMessage();
			};
		}
		try {
			const resp = await fetch('/api/game/queue', {
				method: 'POST',
				credentials: 'include',
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: user.userId })
			});
			if (resp.status === 202) {
				this.showQueueMessage('Waiting for an opponent...', 'game', true, false);
			} else if (resp.ok) {
				return;
			} else {
				const err = await resp.json();
				this.showQueueMessage(`Queue error: ${err.error}`, 'game', false, false);
			}
		} catch (err) {
			console.error('play1v1: error');
			this.showQueueMessage('Failed to join 1v1 queue', 'game', false, false);
			go_section('home', '');
			setTimeout(this.hideQueueMessage, 2000);
		}
	}


	async playTournament() {
		if (!user) {
			console.error('playTournament: not logged in');
			return;
		}
		let displayName = await this.showQueueMessage(
			'Enter your Username for the tournament:',
			'tournament',
			false,
			true
		) as string | null;
		if (!displayName || displayName.trim().length === 0) {
			this.showQueueMessage('Display name is required for tournaments', 'tournament', false, false);
			setTimeout(() => this.playTournament(), 2000);
			return;
		}
		displayName = displayName.trim();
		if (this.leaveQueueBtn) {
			this.leaveQueueBtn.onclick = async () => {
				try {
					await fetch('/api/tournament/queue/leave', {
						method: 'DELETE',
						credentials: 'include',
						headers: { "Content-Type": "application/json" }
					});
				} catch (err) {
					console.error('Error leaving tournament queue:');
				}
				this.hideQueueMessage();
			};
		}
		try {
			const resp = await fetch('/api/tournament/queue', {
				method: 'POST',
				credentials: 'include',
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: user.userId, displayName })
			});
			const data = await resp.json();
			if (user)
				user.isTournamentCreator = !!data.isCreator;
			if (resp.status === 409) {
				this.showQueueMessage('Display name already taken. Please try another.', 'tournament', false, false);
				setTimeout(() => this.playTournament(), 2000);
				return;
			} else if (resp.status === 202) {
				this.showQueueMessage('Waiting for tournament players...', 'tournament', true, false);
			} else if (resp.ok) {
				return;
			} else {
				this.showQueueMessage(`Tournament queue error: ${data.error}`, 'tournament', false, false);
			}
		} catch (err) {
			console.error('playTournament: error');
			this.showQueueMessage('Failed to join tournament queue', 'tournament', false, false);
			go_section('home', '');
			setTimeout(this.hideQueueMessage, 2000);
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
	readonly btn3 = document.getElementById('profile-btn3') as HTMLButtonElement;

	/* Methods */

	async check2FAStatus() {
		try {
			const isEnabled = await get2faStatus();

			if (isEnabled) {
				this.btn2.textContent = "disable 2FA";
				this.btn2.onclick = () => this.disable2FAConfirmation();
			} else {
				this.btn2.textContent = "enable 2FA";
				this.btn2.onclick = () => this.show2FAModal();
			}
		} catch (error) {
			console.error("Error checking 2FA status:", error);
		}
	}

	async show2FAModal() {
		try {
			const response = await setup2fa();
			if (!response) {
				console.error("Failed to set up 2FA");
				return;
			}

			const qrcodeImg = document.getElementById('qrcode-img') as HTMLImageElement;
			qrcodeImg.src = response.qrCode;

			const secretKey = document.getElementById('secret-key') as HTMLElement;
			const secretMatch = response.otpauth_url.match(/secret=([A-Z0-9]+)/i);
			if (secretMatch && secretMatch[1]) {
				secretKey.textContent = secretMatch[1];
			}

			const modal = document.getElementById('twofa-modal') as HTMLElement;
			modal.style.display = 'flex';

			const activateBtn = document.getElementById('activate-2fa-btn') as HTMLButtonElement;
			activateBtn.onclick = async () => {
				const tokenInput = document.getElementById('twofa-token') as HTMLInputElement;
				const token = tokenInput.value.trim();

				if (token.length !== 6 || !/^\d+$/.test(token)) {
					const errorMsg = document.getElementById('twofa-error') as HTMLElement;
					errorMsg.textContent = "Le code doit contenir 6 chiffres";
					return;
				}

				const success = await activate2fa(token);
				if (success) {
					modal.style.display = 'none';
					alert("2FA activé avec succès!");
					this.check2FAStatus();
				} else {
					const errorMsg = document.getElementById('twofa-error') as HTMLElement;
					errorMsg.textContent = "Code invalide ou expiré. Veuillez réessayer.";
				}
			};

			const cancelBtn = document.getElementById('cancel-2fa-btn') as HTMLButtonElement;
			cancelBtn.onclick = () => {
				modal.style.display = 'none';
			};

			const closeBtn = document.querySelector('.close-modal') as HTMLElement;
			closeBtn.onclick = () => {
				modal.style.display = 'none';
			};

			window.onclick = (event) => {
				if (event.target === modal) {
					modal.style.display = 'none';
				}
			};
		} catch (error) {
			console.error("Error showing 2FA modal:", error);
		}
	}
	async handleDisable2FA() {
		try {
			const accountType = await getUserAccountType();

			if (!accountType) {
				alert("Impossible de vérifier le type de compte");
				return;
			}
			let success = false;

			if (accountType.has_password) {
				const password = prompt("Veuillez entrer votre mot de passe pour désactiver la 2FA:");
				if (!password) return; // User cancelled

				success = await disable2fa(password);
			} else if (accountType.is_google_account && !accountType.has_password){
				success = await disable2fa();
			}

			if (success) {
				alert("2FA désactivé avec succès.");
				this.check2FAStatus();
			} else {
				alert("Échec de la désactivation de la 2FA.");
			}
		} catch (err) {
			console.error("Error disabling 2FA:", err);
			alert("Une erreur s'est produite lors de la désactivation de la 2FA.");
		}
	}
	disable2FAConfirmation() {
		if (confirm("Êtes-vous sûr de vouloir désactiver l'authentification à deux facteurs?")) {
			this.handleDisable2FA();
		}
	}
	async is_option_valid(option: string): Promise<boolean> {
		return (option === '') ? true : false;
	}
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

		this.btn2.textContent = "Google Login";
		this.btn2.onclick = () => initiateGoogleLogin();

		this.btn3.textContent = "Login";
		this.btn3.onclick = () => login(this.username_i.value, this.password_i.value);

	}
	switch_logged_in() {
		if (user === undefined) {
			console.error("Profile.switch_logged_off: user undefined");
			return;
		}

		this.avatar.src = user.avatar_path;
		this.username.textContent = user.name;
		this.username_i.value = "";
		this.password_i.value = "";

		this.avatar.onclick = () => {
			const updateAvatarInput = document.getElementById('update-avatar') as HTMLInputElement;
			if (updateAvatarInput) {
				updateAvatarInput.click();
			}
		};

		// Ajouter le gestionnaire pour l'upload d'avatar
		const updateAvatarInput = document.getElementById('update-avatar') as HTMLInputElement;
		if (updateAvatarInput) {
			updateAvatarInput.onchange = async (e: Event) => {
				const input = e.target as HTMLInputElement;
				if (!input.files || input.files.length === 0) return;

				const success = await updateAvatar(input.files[0]);
				if (success) {
					alert('Avatar updated successfully!');
				} else {
					alert('Failed to update avatar');
				}
			};
		}

		this.btn1.textContent = "Settings";
		this.btn1.onclick = () => go_section('settings', 'account');

		this.check2FAStatus();

		this.btn3.textContent = "Logout";
		this.btn3.onclick = () => logout();

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
	readonly FriendsClass = sections[get_type_index('friends')!] as Friends;

	anotherUser: OtherUser | undefined = undefined;

	/* Methods */
	async is_option_valid(option: string): Promise<boolean> {
		return (option === '') ? true : false;
	}
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
	switch_logged_off() { }
	switch_logged_in() { }

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
	async search(user: string = this.username_i.value) {
		let status: OtherUser | Error | undefined = await search(user);
		if (status instanceof Error)
			return;

		this.anotherUser = status;
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

			this.update_status(this.anotherUser.username, this.anotherUser.is_connected);
		}
		else {
			this.reset();
			activate(this.not_founds);
			deactivate(this.founds);
		}
	}
	async add() {
		if (await add(this.anotherUser!.username) instanceof Error)
			return;
		let user = this.anotherUser!.username;
		this.anotherUser = undefined;
		this.search(user);
	}
	async remove() {
		if (await remove(this.anotherUser!.username) instanceof Error)
			return;
		let user = this.anotherUser!.username;
		this.reset();
		this.search(user);
	}
	update_status(username : string, online: boolean) {
		if (username !== this.anotherUser?.username)
			return;

		this.status.textContent = (online) ? 'Online' : 'Offline';
		this.status.style.color = (online) ? 'rgb(32, 96, 32)' : 'rgb(153, 0, 0)';

		if (online)
			(this.btn3.parentElement as HTMLLIElement).classList.add('active');
		else
			(this.btn3.parentElement as HTMLLIElement).classList.remove('active');
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
	async is_option_valid(_option: string): Promise<boolean> {
		return true;
	}
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Chat section as unauthenticated");
			return;
		}
		this.btn1.onclick = () => history.back();
		this.btn1.textContent = 'Back';

		this.btn2.onclick = () => this.send();
		this.btn2.textContent = 'Send';

		this.btn3.onclick = () => go_section('actions', '');
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
	switch_logged_off() { }
	switch_logged_in() { }
	load_messages(messages: Array<Message> | undefined) {
		if (messages === undefined)
			return;

		let chat_box_childNodes: Array<ChildNode> = [];
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
		let input: string = this.msg_input.value;
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

	blocked_users: Array<string> = [];
	free_users: Array<string> = [];

	current: HTMLLIElement | undefined = undefined;
	load_mutex: boolean = false;

	/* Methods */
	async is_option_valid(option: string): Promise<boolean> {
		return (option === '') ? true : false;
	}
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Actions section as unauthenticated");
			return;
		}
		this.btn1.onclick = () => go_section('chat', '');
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
	switch_logged_off() { }
	switch_logged_in() { }

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
		let blocked_users: Array<string> | undefined = await get_blocked_users();
		if (blocked_users === undefined)
			return;
		let free_users: Array<string> | undefined = user?.get_free_users();
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
	click(element: HTMLLIElement) {
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
				this.btn3.onclick = () => this.invite(this.current!.textContent!);
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
	async trigger(action: string | null) {
		let username: string | undefined | null = this.current?.textContent;

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
	async invite(username: string) {
		try {
			const resp = await fetch('/api/invites', {
				method: 'POST',
				credentials: 'include',
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					toUsername: username,
					gameType: '1v1'
				})
			});
			const data = await resp.json();
			if (resp.ok && data.invited) {
				this.showInviteWaitingScreen(username);
			} else {
				alert(data.error || 'Failed to send invite');
			}
		} catch (err) {
			console.error('Error sending invite:');
		}
	}

	showInviteWaitingScreen(username: string) {
		const overlay = document.getElementById('invite-waiting-overlay') as HTMLElement;
		const message = document.getElementById('invite-waiting-message') as HTMLElement;
		const cancelBtn = document.getElementById('cancel-invite-btn') as HTMLElement;
		const acceptBtn = document.getElementById('accept-invite-btn') as HTMLElement;
		const declineBtn = document.getElementById('decline-invite-btn') as HTMLElement;

		if (overlay && message) {
			message.innerHTML = `Waiting for <b>${username}</b> to accept your invite...`;
			overlay.style.display = 'flex';

			// Show only the Cancel button for the inviter
			if (cancelBtn) cancelBtn.style.display = 'block';
			if (acceptBtn) acceptBtn.style.display = 'none';
			if (declineBtn) declineBtn.style.display = 'none';
		}
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


	/* Properties */
	readonly options : Array<string> = ['account', 'stats', 'confidentiality'];
	/* Sidebar */
	readonly account_btn = document.getElementById('account-btn') as HTMLLIElement;
	readonly stats_btn = document.getElementById('stats-btn') as HTMLLIElement;
	readonly confidentiality_btn = document.getElementById('confidentiality-btn') as HTMLLIElement;
	readonly back_btn = document.getElementById('back-btn') as HTMLLIElement;
	/* Account */
	username_l = document.getElementById('l-username-account') as HTMLLabelElement;
	username_i = document.getElementById('i-username-account') as HTMLInputElement;
	email_l = document.getElementById('l-email-account') as HTMLLabelElement;
	email_i = document.getElementById('i-email-account') as HTMLInputElement;
	password_l = document.getElementById('l-password-account') as HTMLLabelElement;
	password_i = document.getElementById('i-password-account') as HTMLInputElement;
	update_btn = document.getElementById('update-btn') as HTMLButtonElement;
	/* Confidentiality */
	unregister_btn = document.getElementById('unregister-btn') as HTMLButtonElement;

	/* Methods */
	async is_option_valid(option: string): Promise<boolean> {
		return this.is_option(option);
	}
	clear() {
		this.account_btn.onclick = () => go_section('settings', 'account');
		this.stats_btn.onclick = () => go_section('settings', 'stats');
		this.confidentiality_btn.onclick = () => go_section('settings', 'confidentiality');
		this.back_btn.onclick = () => go_section('profile', '');

		this.username_l.textContent = 'Username: ';
		this.email_l.textContent = 'Email: ';
		this.password_l.textContent = 'Password: ********';
		this.update_btn.removeAttribute('onclick');
		let inputs : NodeListOf<HTMLInputElement> = document.querySelectorAll('.account-input');
			inputs.forEach(input => {
				input.classList.remove('active');
			input.value = '';
		});
	}
	async account() {
		if (user === undefined)
			return;
		console.log(user?.email);

		this.username_l.textContent += user?.name;
		this.email_l.textContent += user?.email;
		this.update_btn.textContent = 'Edit';
		this.update_btn.onclick = async () => {
			this.clear();
			let inputs : NodeListOf<HTMLInputElement> = document.querySelectorAll('.account-input');
			inputs.forEach(input => {
				input.classList.add('active');
			});

			this.update_btn.textContent = 'Save';
			this.update_btn.onclick = async () => {
				let old_password : string = await this.get_old_password();
				if (await update(this.username_i.value, this.email_i.value, old_password, this.password_i.value) === true)
					update_user(new User(this.username_i.value, user?.userId, this.email_i.value, user?.avatar_path));
				this.clear();
				this.account();
			}
		}
	}
	async get_old_password() : Promise<string> {
        try {
            const accountType = await getUserAccountType();

            if (!accountType) {
                alert("Impossible de vérifier le type de compte");
                return '';
            }

            if (accountType.has_password) {
                const password = prompt("Veuillez entrer votre mot de passe:");
                return (password === null) ? '' : password;
			}

			return '';
		} catch (err) {
            console.error("Error edition of the account:", err);
            alert("Une erreur s'est produite lors de l'edit du compte.");
        }
		return '';
    }
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter Settings section as unauthenticated");
			return;
		}

		this.clear();
		this.account_btn.onclick = () => go_section('settings', 'account');
		this.stats_btn.onclick = () => go_section('settings', 'stats');
		this.confidentiality_btn.onclick = () => go_section('settings', 'confidentiality');
		this.back_btn.onclick = () => go_section('profile', '');
		this.unregister_btn.onclick = () => this.UnregisterConfirmation();


		let option = get_url_option(window.location.pathname);
		this.select(option);
		if (option === 'account')
			this.account();
		this.activate_section();
	}
	leave() {
		this.deactivate_section();

		this.account_btn.removeAttribute('onclick');
		this.stats_btn.removeAttribute('onclick');
		this.confidentiality_btn.removeAttribute('onclick');
		this.back_btn.removeAttribute('onclick');
		this.unregister_btn.removeAttribute('onclick');
	}
	switch_logged_off() {}
	switch_logged_in() {}
	
	/* Settings methods */
	is_option(option : string) : boolean {
		for (let i = 0; i < this.options.length; ++i) {
			if (this.options[i] === option)
				return true;
		}
		return false;
	}
	print(option : string) {
		for (let i = 0; i < this.options.length; ++i) {
			let id : string = this.options[i] + '-content';
			let subsection = (document.getElementById(id)! as HTMLDivElement);
			if (this.options[i] === option)
				subsection.classList.add('active');
			else
			subsection.classList.remove('active');
			console.log(option, ':', subsection.classList);
		}
		const statsTableContainer = document.getElementById('stats-content');
		if (statsTableContainer) {
			statsTableContainer.style.display = (option === 'stats') ? 'block' : 'none';
		}
		if (option === 'stats') {
			this.printStats();
		}
	}
	select(option: string) {
		console.log('Selecting', option);
		if (!this.is_option(option)) {
			go_section('profile', '');
			return;
		}
		this.print(option);
	}
	async printStats() {
		const statsTable = document.getElementById('stats-table') as HTMLTableElement;
		const statsMessage = document.getElementById('stats-message') as HTMLElement;
		if (!statsTable || !statsMessage || !user) return;

		const tbody = statsTable.querySelector('tbody');
		if (tbody) tbody.innerHTML = '';
		statsMessage.textContent = "Loading game history...";

		try {
			const result = await getGameHistory(String(user.userId));
			const games = Array.isArray(result) ? result : result?.games || [];
			if (!games || games.length === 0) {
				statsMessage.textContent = "No games played yet.";
				return;
			}
			statsMessage.textContent = "";
			for (const g of games) {
				const isPlayer1 = g.player1_username === user.name;
				const opponent = isPlayer1 ? g.player2_username : g.player1_username;
				const score1 = g.score_player1 ?? 0;
				const score2 = g.score_player2 ?? 0;
				const score = `${score1} - ${score2}`;
				const win = g.winner_username === user.name;
				const date = new Date(g.created_at).toLocaleString();

				const row = document.createElement('tr');
				row.innerHTML = `
                <td>${date}</td>
                <td>${opponent ?? '-'}</td>
                <td>${score}</td>
                <td style="color:${win ? 'green' : 'red'}">${win ? 'Win' : 'Loss'}</td>
            `;
				tbody?.appendChild(row);
			}
		} catch (err) {
			statsMessage.textContent = `Error loading history.`;
			console.error('Error loading game history:', err);
		}
	}

	async handleUnregisterClick() {
		try {
			const accountType = await getUserAccountType();

			if (!accountType) {
				alert("Impossible de vérifier le type de compte");
				return;
			}

			let success;
			if (accountType.has_password) {
				const password = prompt("Veuillez entrer votre mot de passe pour SUPPRIMER votre compte:");
				if (!password) return;

				success = await unregister(password);
			} else if (accountType.is_google_account && !accountType.has_password) {
				success = await unregister();
			} else {
				alert("Impossible de supprimer le compte.");
				return;
			}

			if (success) {
				alert("Your account has been successfully deleted.");
				go_section('home', '');
			} else {
				alert("Error unregistering account:");
			}
		} catch (err) {
			console.error("Error unregistering account:", err);
			alert("Une erreur s'est produite lors de la suppression du compte.");
		}
	}

	UnregisterConfirmation() {
		if (confirm("Êtes-vous sûr de vouloir Supprimer votre compte?")) {
			this.handleUnregisterClick();
		}
	}
}

class DirectMessage extends ASection {
	/* ASection */
	type = 'directmessage';
	protected = true;
	parent = document.getElementById('directmessage-parent') as HTMLElement;
	logged_off = this.parent.querySelectorAll('.logged-off') as NodeListOf<Element>;
	logged_in = this.parent.querySelectorAll('.logged-in') as NodeListOf<Element>;
	dependencies = ['home'];

	/* Properties */
	friend_username : undefined | string = undefined;
	btn1 = document.getElementById('directmessage-btn1') as HTMLButtonElement;
	btn2 = document.getElementById('directmessage-btn2') as HTMLButtonElement;
	message = document.getElementById('directmessage-input') as HTMLInputElement;
	readonly chat_box = document.getElementById('directmessage-box') as HTMLUListElement;


	/* Methods */
	async is_option_valid(option: string): Promise<boolean> {
		let user : OtherUser | Error | undefined = await search(option);
		if (user instanceof Error || user === undefined)
			return false;

		this.friend_username = user.username;
		return true;
	}
	enter(verified: boolean) {
		if (verified !== true) {
			console.log("Try to enter DirectMessage section as unauthenticated");
			return;
		}

		this.btn1.textContent = 'Back';
		this.btn2.textContent = 'Send';
		this.message.value = '';

		this.btn1.onclick = () => go_section('friends', '');
		this.btn2.onclick = () => {
			send(this.message.value, 'direct_chat_message', this.friend_username);
			add_message(user?.name!, this.message.value, 'direct_message');
			this.message.value = '';
		}
		this.load_messages(get_user_directmessages());
		this.activate_section();
	}
	leave() {
		this.btn1.textContent = '';
		this.btn2.textContent = '';
		this.message.value = '';

		this.btn1.removeAttribute('onclick');
		this.btn2.removeAttribute('onclick');

		this.friend_username = undefined;
		this.deactivate_section();
	}
	switch_logged_off() { }
	switch_logged_in() { }
	load_messages(messages: Array<Message> | undefined) {
		console.log('load_messages');
		if (messages === undefined)
			return;

		let chat_box_childNodes: Array<ChildNode> = [];
		this.chat_box.childNodes.forEach((childNode) => { chat_box_childNodes.push(childNode); });
		for (let i = 0; i < chat_box_childNodes.length; ++i)
			chat_box_childNodes[i].remove();

		for (let i = messages.length - 1; i >= 0; --i) {
			let element = document.createElement('label');
			element.textContent = messages[i].format_message();
			this.chat_box.appendChild(element);
		}
	}

}

sections = [new Home(), new Profile(), new Friends(), new Chat(), new Actions(),
new GameSection(), new Settings(), new DirectMessage()];
/* --------- */



/* Utils */
export function get_url_type(url: string): string {
	let start: number = 0;
	if (url[0] === '/')
		start = 1;

	let end;
	for (end = start; end < url.length; ++end) {
		if (url[end] === '/')
			break;
	}
	let type;

	type = url.substring(start, end);
	return type;
}

export function get_url_option(url: string): string {
	let start: number = 0;
	if (url[0] === '/')
		start++;

	for (; start < url.length; ++start) {
		if (url[start] === '/')
			break;
	}

	let option;
	if (start < url.length) {
		option = url.substring(start + 1, url.length);
	}
	else
		option = '';
	return option;
}

export function get_type_index(type: string): number | undefined {
	for (let i = 0; i < sections.length; i++) {
		if (sections[i].type === type)
			return i;
	}
	return undefined;
}

export function set_section_index(index: number | undefined): void {
	if (index === undefined)
		index = HOME_INDEX;
	section_index = index;
}

export async function is_section_accessible(type: string, option: string): Promise<boolean> {
	let index: number = get_type_index(type)!;

	if (sections[index].protected && user === undefined)
		return false;
	if (await sections[index].is_option_valid(option) === false)
		return false;

	return true;
}

export function build_url(type: string, option: string): string {
	if (option !== '')
		return type + '/' + option;
	else
		return type;
}

export function update_sections(): void {
	for (let i = 0; i < sections.length; i++) {
		if (i !== section_index)
			sections[i].leave();
	}
	sections[section_index].enter(user !== undefined);
}

const sidebar_sections: Array<string> = ['profile', 'friends', 'chat'];
function is_sidebar_section(type: string, option: string): boolean {
	if (option !== '')
		return false;

	for (let i = 0; i < sidebar_sections.length; i++) {
		if (type === sidebar_sections[i])
			return true;
	}

	return false;
}

export async function go_section(type : string, option : string) {
	let previous_type = get_url_type(window.location.pathname);
	let previous_option = get_url_option(window.location.pathname);
	if (is_sidebar_section(type, option) && is_sidebar_section(previous_type, previous_option)
		&& previous_type === type) {
		type = 'home';
		option = '';
	}

	if (!(await is_section_accessible(type, option))) {
		type = 'home';
		option = '';
	}

	let url: string = build_url(type, option);
	history.pushState({ section: url }, "", url);
	set_section_index(get_type_index(type));
	update_sections();
}

function activate(list: NodeListOf<Element>): void {
	list.forEach(element => {
		element.classList.add('active');
	});
}

function deactivate(list: NodeListOf<Element>): void {
	list.forEach(element => {
		element.classList.remove('active');
	});
}


export function update_status(username: string, online: boolean) {
	if (section_index === get_type_index('friends'))
		(sections[section_index] as Friends).update_status(username, online);

	if (user?.onlines.includes(username) === true || user?.name === username)
		return;

	if (online === true)
		add_online(username);

	if (sections[section_index].type === 'actions')
		(sections[section_index] as Actions).load_boxes();
}


(window as any).go_section = go_section;
/* --------- */

export function showTwofaVerificationModal(tempToken: string, username: string) {
	const modal = document.getElementById('twofa-verification-modal') as HTMLElement;
	const verifyBtn = document.getElementById('verify-2fa-btn') as HTMLButtonElement;
	const cancelBtn = document.getElementById('cancel-2fa-verification-btn') as HTMLButtonElement;
	const closeBtn = modal.querySelector('.close-modal') as HTMLElement;
	const errorMsg = document.getElementById('twofa-verification-error') as HTMLElement;
	const tokenInput = document.getElementById('twofa-verification-token') as HTMLInputElement;

	const headerElement = modal.querySelector('.modal-header h2') as HTMLHeadingElement;
	if (headerElement) {
		headerElement.textContent = `2FA Verification for ${username}`;
	}

	errorMsg.textContent = '';
	tokenInput.value = '';

	modal.style.display = 'flex';

	verifyBtn.onclick = async () => {
		const token = tokenInput.value.trim();

		if (token.length !== 6 || !/^\d+$/.test(token)) {
			errorMsg.textContent = "The code must contain 6 digits";
			return;
		}

		try {
			const success = await verify2fa(token, tempToken);
			if (success) {
				modal.style.display = 'none';
			} else {
				errorMsg.textContent = "Invalid verification code. Please try again.";
			}
		} catch (error) {
			console.error("2FA verification error:", error);
			errorMsg.textContent = "An error occurred during verification. Please try again.";
		}
	};

	cancelBtn.onclick = () => {
		modal.style.display = 'none';
	};

	closeBtn.onclick = () => {
		modal.style.display = 'none';
	};

	window.onclick = (event) => {
		if (event.target === modal) {
			modal.style.display = 'none';
		}
	};
}