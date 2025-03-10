function show_logged_in_li() {
	const lis = document.querySelectorAll('li.logged-in');

	lis.forEach((li) => {
		li.removeAttribute('hidden');
	});
	console.log(lis);
}

function hide_logged_in_li() {
	const lis = document.querySelectorAll('li.logged-in');

	lis.forEach((li) => {
		li.setAttribute("hidden", "hidden");
	});
}

function profile_clicked() {
	console.log("profile_clicked");
	select_modal("profile");

}

function friends_clicked() {
	console.log("friends_clicked");
	select_modal("friends");
}

function chat_clicked() {
	console.log("chat_clicked");
	select_modal("chat");
}
