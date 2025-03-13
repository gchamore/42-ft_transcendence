/* Logged-in */
function switch_logged_in() {
	hide_logged_off();
	show_logged_in();
	set_modals("logged-in");
}

function show_logged_in() {
	const list = document.querySelectorAll('.logged-in');

	list.forEach((elem) => {
		elem.classList.add('active');
	});
}

function hide_logged_in() {
	const list = document.querySelectorAll('.logged-in');
	
	list.forEach((elem) => {
		elem.classList.remove('active');
	});
}
/* ---------*/



/* Logged-off */
function switch_logged_off() {
	hide_logged_in();
	show_logged_off();
	set_modals("logged-off");
}

function show_logged_off() {
	const list = document.querySelectorAll('.logged-off');

	list.forEach((elem) => {
		elem.classList.add('active');
	});
}

function hide_logged_off() {
	const list = document.querySelectorAll('.logged-off');

	list.forEach((elem) => {
		elem.classList.remove('active');
	});
}
/* ---------*/
