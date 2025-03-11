let username : string = null;

async function verify_token(): Promise<boolean> {
	try {
        const response = await fetch(`http://localhost:8080/verify_token`, {
            method: "POST",
			credentials: 'include'
        });
        const data = await response.json();

		if (data.valid) {
			username = data.username;
			console.log(username, "authenticated");

			switch_logged_in();
			return true;
		}
		
		switch_logged_off();
		console.log("Not authenticated");
		return false;
    } catch (error) {
		console.error("Error:", error);
    }
	switch_logged_off();
}

function switch_logged_in() {
	hide_logged_off();
	show_logged_in();
}

function switch_logged_off() {
	hide_logged_in();
	show_logged_off();
}

function show_logged_in() {
	const list = document.querySelectorAll('.logged-in');

	list.forEach((elem) => {
		elem.removeAttribute('hidden');
	});
}

function hide_logged_in() {
	const list = document.querySelectorAll('.logged-in');

	list.forEach((elem) => {
		elem.setAttribute('hidden', 'hidden');
	});
}

function show_logged_off() {
	const list = document.querySelectorAll('.logged-off');

	list.forEach((elem) => {
		elem.removeAttribute('hidden');
	});
}

function hide_logged_off() {
	const list = document.querySelectorAll('.logged-off');

	list.forEach((elem) => {
		elem.setAttribute('hidden', 'hidden');
	});
}
