
// import express from "express";
// import { execFile } from "child_process";
// import cors from "cors";

// const app = express();

// app.use(cors({
//   origin: 'http://localhost:5173', // Adjust if needed
// }));

// // Map to store running child processes keyed by username
// const runningProcesses = new Map();

// app.get('/launch', (req, res) => {
//   const {
//     path: exePath,
//     username,
//     cocode
//   } = req.query;

//   if (!exePath || !username || !cocode) {
//     return res.status(400).send("Missing required parameters.");
//   }

//   // Compose the single argument string exactly like you want
//   const argString = `/nolog/guname=${username}/CoRecNo=${cocode}`;

//   console.log("Launching EXE with arguments:", argString);

//   // If a process already running for this username, kill it before launching new
//   if (runningProcesses.has(username)) {
//     const oldProcess = runningProcesses.get(username);
//     oldProcess.kill();
//     runningProcesses.delete(username);
//     console.log(`Killed existing process for user ${username}`);
//   }

//   // Launch EXE with argument string
//   const child = execFile(exePath, [argString], (error, stdout, stderr) => {
//    if (error) {
//     if (error.killed && error.signal === 'SIGTERM') {
//       console.log(`Application process killed intentionally for user ${username}`);
//     } else {
//       console.error(`Failed to launch app for user ${username}:`, error);
//     }
//   }

//     console.log(`Application for user ${username} exited.`);
//     console.log("stdout:", stdout);
//     console.log("stderr:", stderr);

//     // Remove from map when process exits
//     runningProcesses.delete(username);
//   });

//   // Store the child process by username
//   runningProcesses.set(username, child);

//   // Immediately respond that launch succeeded
//   res.send("Application launched successfully!");
// });

// // Add logout endpoint to kill running exe on logout
// app.get('/logout', (req, res) => {
//   const { username } = req.query;
//   if (!username) return res.status(400).send("Username required");

//   const child = runningProcesses.get(username);
//   if (child) {
//     child.kill();
//     runningProcesses.delete(username);
//     console.log(`Application process killed for user ${username}`);
//     return res.send("Application closed successfully!");
//   }
//   res.status(404).send("No running application found for user");
// });

// const PORT = 5002;
// app.listen(PORT, () => {
//   console.log(`🚀 Local launcher running on port ${PORT}`);
// });



import express from "express";
import { execFile } from "child_process";
import cors from "cors";

const app = express();

app.use(cors({
  origin: ["http://localhost:5173", "https://erpwebapp-client.onrender.com"],
}));

// Map to store running child processes and module name keyed by username
const runningProcesses = new Map();

app.get('/launch', (req, res) => {
  const { path: exePath, username, cocode, module: moduleName } = req.query;

  if (!exePath || !username || !cocode || !moduleName) {
    return res.status(400).send("Missing required parameters.");
  }

  // Check if user has a running process
  if (runningProcesses.has(username)) {
    const { module: runningModule, process: oldProcess } = runningProcesses.get(username);

    if (runningModule === moduleName) {
      // Same module already running
      return res.status(409).send("Module already running.");
    } else {
      // Different module already running
      return res.status(409).send("Another module is already running.");
    }
  }

  // Compose the argument string
  const argString = `/nolog/guname=${username}/CoRecNo=${cocode}`;

  console.log("Launching EXE with arguments:", argString);

  // Launch EXE
  const child = execFile(exePath, [argString], (error, stdout, stderr) => {
    if (error) {
      if (error.killed && error.signal === 'SIGTERM') {
        console.log(`Application process killed intentionally for user ${username}`);
      } else {
        console.error(`Failed to launch app for user ${username}:`, error);
      }
    }

    console.log(`Application for user ${username} exited.`);
    console.log("stdout:", stdout);
    console.log("stderr:", stderr);

    runningProcesses.delete(username);
  });

  // Store child and moduleName
  runningProcesses.set(username, { process: child, module: moduleName });

  res.send("Application launched successfully!");
});


app.get('/logout', (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).send("Username required");

  const entry = runningProcesses.get(username);
  if (entry) {
    const { process: child } = entry;

    if (child && typeof child.kill === "function") {
      child.kill();
    }

    runningProcesses.delete(username);
    console.log(`Application process killed for user ${username}`);
    return res.send("Application closed successfully!");
  }

  res.status(404).send("No running application found for user");
});

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`🚀 Local launcher running on port ${PORT}`);
});
