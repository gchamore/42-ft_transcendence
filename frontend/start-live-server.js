const readline = require("readline");
const { spawn, exec } = require("child_process");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for PORT and FILE
rl.question("Enter port (default: 5500): ", (port) => {
  port = port || "5500"; // Default to 5500 if empty

  rl.question("Enter entry file (default: src/index.html): ", (file) => {
    file = file || "src/index.html"; // Default to src/index.html if empty

    console.log(`✅ Starting Live Server on port ${port} with file ${file}...`);

    // Use spawn to start Live Server as a background process
    const liveServer = spawn("npx", ["live-server", `--port=${port}`, "--no-browser", `--entry-file=${file}`, `&`], {
      stdio: "inherit", // Show live-server output in the terminal
      shell: true,
      detached: true // Run in background
    });

    liveServer.on("error", (err) => {
      console.error(`❌ Error starting Live Server: ${err.message}`);
    });

    // Wait 1 second for the server to start, then open Firefox
    setTimeout(() => {
      const url = `http://localhost:${port}`;
      console.log(`🌍 Opening Firefox at ${url}...`);
      exec(`firefox ${url} &`, (err) => {
        if (err) {
          console.error("⚠️ Failed to open Firefox. Make sure it's installed.");
        }
      });

      rl.close(); // Close input after everything is done
    }, 1000);
  });
});
