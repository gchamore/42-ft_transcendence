async function getLength() {
    const nameLength = document.getElementById("nameLength")! as HTMLLabelElement;
    const name = document.getElementById("name")! as HTMLInputElement;

    try {
        const response = await fetch("http://localhost:3000/name-length", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.value })
        });

        const data = await response.json();
        console.log("http://localhost:3000/name-length", data);

        nameLength.textContent = `Name length: ${data.length}`;
        nameLength.style.display = "block";
    } catch (error) {
        console.error("Error:", error);
    }

    name.value = "";
}
