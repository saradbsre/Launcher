// import express from "express";
// import { execFile } from "child_process";
// import cors from "cors";
// import fs from "fs";
// import fse from "fs-extra";
// import path from "path";
// import WinReg from "winreg";

// const app = express();

// app.use(cors({
//   origin: ["http://localhost:5173", "https://erpwebapp-client.onrender.com"],
// }));

// const runningProcesses = new Map();

// // Read EXESERVERPATH from registry
// function getExeServerPathFromRegistry() {
//   return new Promise((resolve, reject) => {
//     const regKey = new WinReg({
//       hive: WinReg.HKLM,                 // Make sure this matches your registry location
//       key: '\\SOFTWARE\\TwoBase.Net'    // Correct registry key path
//     });

//     regKey.get('ExeServerPath', (err, item) => {
//       if (err) {
//         console.error("❌ Registry read error:", err);
//         return reject(err);
//       }
//       console.log("🔑 Registry value found:", item.value);
//       resolve(item.value);
//     });
//   });
// }

// // Sync updated files from remote folder to local
// async function syncUpdatedFiles(remoteDir, localDir) {
//   console.log(`🛠️  Starting sync from ${remoteDir} → ${localDir}`);

//   if (!fs.existsSync(remoteDir)) {
//     console.error(`❌ Remote folder does not exist: ${remoteDir}`);
//     throw new Error(`Remote folder does not exist: ${remoteDir}`);
//   }

//   await fse.ensureDir(localDir);

//   const files = await fse.readdir(remoteDir);
//   console.log(`📁 Found ${files.length} files in remote folder.`);

//   let updatedCount = 0;

//   for (const file of files) {
//     const remoteFilePath = path.join(remoteDir, file);
//     const localFilePath = path.join(localDir, file);

//     const remoteStats = await fse.stat(remoteFilePath).catch(() => null);
//     const localStats = await fse.stat(localFilePath).catch(() => null);

//     if (!remoteStats) {
//       console.warn(`⚠️  Skipping ${file} - remote file does not exist or can't be read.`);
//       continue;
//     }

//     const isUpdated = !localStats || remoteStats.mtime > localStats.mtime;

//     if (isUpdated) {
//       console.log(`⬆️  Copying updated file: ${file}`);
//       await fse.copy(remoteFilePath, localFilePath);
//       updatedCount++;
//     } else {
//       console.log(`✅ Up-to-date: ${file}`);
//     }
//   }

//   if (updatedCount === 0) {
//     console.log(`📦 No updates were necessary. All files are up-to-date.`);
//   } else {
//     console.log(`✅ Sync completed. ${updatedCount} file(s) updated.`);
//   }
// }

// // Launch application endpoint
// app.get('/launch', async (req, res) => {
//   console.log("🟢 /launch endpoint hit with query:", req.query);

//   const { path: exePath, username, cocode, module: moduleName } = req.query;

//   if (!exePath || !username || !cocode || !moduleName) {
//     console.warn("❌ Missing required parameters");
//     return res.status(400).send("Missing required parameters.");
//   }

//   // if (runningProcesses.has(username)) {
//   //   const { module: runningModule } = runningProcesses.get(username);
//   //   if (runningModule === moduleName) {
//   //     return res.status(409).send("Module already running.");
//   //   } else {
//   //     return res.status(409).send("Another module is already running.");
//   //   }
//   // }
//    if (runningProcesses.has(username)) {
//     const { module: runningModule, cocode: runningCocode } = runningProcesses.get(username);

//     // console.log("🧠 runningProcesses:", runningProcesses.get(username));
//     // console.log("🧠 Incoming:", { moduleName, cocode });

//     if (
//       runningModule === moduleName &&
//       String(runningCocode) === String(cocode)
//     ) {
//       return res.status(409).send("Module already running.");
//     } else {
//       return res.status(409).send("Another module is already running.");
//     }
//   }

//   try {
//     const exeServerPath = await getExeServerPathFromRegistry();
//     console.log("🔑 EXESERVERPATH from registry:", exeServerPath);

//     const moduleDir = path.dirname(exePath);
//     const moduleFolderName = path.basename(moduleDir);
//     const remoteModulePath = path.join(exeServerPath, moduleFolderName);

//     console.log(`🔄 Syncing files from ${remoteModulePath} → ${moduleDir}`);
//     await syncUpdatedFiles(remoteModulePath, moduleDir);

//     const argString = `/nolog/guname=${username}/CoRecNo=${cocode}`;
//     console.log(`🚀 Launching EXE: ${exePath} ${argString}`);

//     const child = execFile(exePath, [argString], (error, stdout, stderr) => {
//       if (error) {
//         if (error.killed && error.signal === 'SIGTERM') {
//           console.log(`🛑 Process killed intentionally for user ${username}`);
//         } else {
//           console.error(`❌ Error launching app for ${username}:`, error);
//         }
//       }

//       console.log(`👋 App exited for user ${username}`);
//       if (stdout) console.log("stdout:", stdout);
//       if (stderr) console.log("stderr:", stderr);

//       runningProcesses.delete(username);
//     });

//     runningProcesses.set(username, { process: child, module: moduleName, cocode });
//     res.send("✅ Application launched successfully!");
//   } catch (err) {
//     console.error("❌ Launch error:", err.message);
//     res.status(500).send(`Failed to launch application: ${err.message}`);
//   }
// });

// // Logout and kill running app
// app.get('/logout', (req, res) => {
//   const { username } = req.query;

//   if (!username) {
//     console.warn("❌ Username required for logout");
//     return res.status(400).send("Username required");
//   }

//   const entry = runningProcesses.get(username);
//   if (entry) {
//     const { process: child } = entry;
//     if (child && typeof child.kill === "function") {
//       child.kill();
//     }

//     runningProcesses.delete(username);
//     console.log(`🔒 Application process killed for user ${username}`);
//     return res.send("✅ Application closed successfully!");
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
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import WinReg from "winreg";
import { connectMongo } from './db.js';

const app = express();

app.use(cors({
   origin: ["http://localhost:5173", "https://erpwebapp-client.onrender.com","https://erp.binshabibgroup.ae","https://saeedcont.erp.binshabibgroup.ae","https://ralscont.erp.binshabibgroup.ae","https://hamda.erp.binshabibgroup.ae"], 
}));

const runningProcesses = new Map();

function extractCatalog(connectionString) {
  const match = /Initial catalog=([^;]+)/i.exec(connectionString);
  return match ? match[1].trim() : null;
}

function getConnectionStringFromRegistry() {
  return new Promise((resolve, reject) => {
    const regKey = new WinReg({
      hive: WinReg.HKLM,
      key: '\\SOFTWARE\\TwoBase.Net'
    });

    regKey.get('DataPath', (err, item) => {
      if (err) {
        console.error("❌ Registry read error for data path:", err);
        return reject(err);
      }
      resolve(item.value);
    });
  });
}

async function getCatalogFromRegistry() {
  try {
    const connectionString = await getConnectionStringFromRegistry();
    const catalog = extractCatalog(connectionString);
    console.log("📂 Catalog extracted:", catalog);
    return catalog;
  } catch (err) {
    console.error("❌ Failed to get catalog:", err);
    return null;
  }
}

app.get('/catalog', async (req, res) => {
  const username = req.query.username?.trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    const catalog = await getCatalogFromRegistry();
    if (!catalog) return res.status(404).send('Catalog not found');

    const db = await connectMongo('BinShabibEstateNet');
    const catalogCollection = db.collection('dbo.catalog');

    const timestamp = new Date();

    await catalogCollection.updateOne(
      { username },
      { $set: { catalog, insertedAt: timestamp } },
      { upsert: true }
    );

    // Respond success, no catalog sent back
    console.log("Catalog updated successfully for user:", username);

  } catch (err) {
    console.error("Error in /catalog:", err);
    res.status(500).send('Error processing request');
  }
});

// Read EXESERVERPATH from registry
function getExeServerPathFromRegistry() {
  return new Promise((resolve, reject) => {
    const regKey = new WinReg({
      hive: WinReg.HKLM,                 // Make sure this matches your registry location
      key: '\\SOFTWARE\\TwoBase.Net'    // Correct registry key path
    });

    regKey.get('ExeServerPath', (err, item) => {
      if (err) {
        console.error("❌ Registry read error:", err);
        return reject(err);
      }
      console.log("🔑 Registry value found:", item.value);
      resolve(item.value);
    });
  });
}

// Sync updated files from remote folder to local
async function syncUpdatedFiles(remoteDir, localDir,onProgress) {
  console.log(`🛠️  Starting sync from ${remoteDir} → ${localDir}`);

  if (!fs.existsSync(remoteDir)) {
    console.error(`❌ Remote folder does not exist: ${remoteDir}`);
    throw new Error(`Remote folder does not exist: ${remoteDir}`);
  }

  await fse.ensureDir(localDir);

  const files = await fse.readdir(remoteDir);
  console.log(`📁 Found ${files.length} files in remote folder.`);

  let updatedCount = 0;

  for (const file of files) {
    const remoteFilePath = path.join(remoteDir, file);
    const localFilePath = path.join(localDir, file);

    const remoteStats = await fse.stat(remoteFilePath).catch(() => null);
    const localStats = await fse.stat(localFilePath).catch(() => null);

    if (!remoteStats) {
      console.warn(`⚠️  Skipping ${file} - remote file does not exist or can't be read.`);
      continue;
    }

    const isUpdated = !localStats || remoteStats.mtime > localStats.mtime;

    if (isUpdated) {
      console.log(`⬆️  Copying updated file: ${file}`);
      await fse.copy(remoteFilePath, localFilePath);
      updatedCount++;
    } else {
      console.log(`✅ Up-to-date: ${file}`);
    }
  }
  onProgress?.(`📦 Sync complete.`);

  if (updatedCount === 0) {
    console.log(`📦 No updates were necessary. All files are up-to-date.`);
  } else {
    console.log(`✅ Sync completed. ${updatedCount} file(s) updated.`);
  }
}


// app.get('/sync-progress', async (req, res) => {
//   const { exePath } = req.query;

//   if (!exePath) {
//     return res.status(400).send("exePath query param is required");
//   }

//   const moduleDir = path.dirname(exePath);
//   const moduleFolderName = path.basename(moduleDir);

//   try {
//     const exeServerPath = await getExeServerPathFromRegistry();
//     const remoteModulePath = path.join(exeServerPath, moduleFolderName);

//     // Setup SSE headers
//     res.writeHead(200, {
//       'Content-Type': 'text/event-stream',
//       'Cache-Control': 'no-cache',
//       'Connection': 'keep-alive',
//     });

//     function sendEvent(data) {
//       res.write(`data: ${data}\n\n`);
//     }

//     sendEvent(`🔄 Starting sync from ${remoteModulePath} → ${moduleDir}`);

//     await syncUpdatedFiles(remoteModulePath, moduleDir, (msg) => {
//       sendEvent(msg);
//     });

//     sendEvent("✅ Sync finished.");
//     res.end();
//   } catch (err) {
//     sendEvent(`❌ Sync error: ${err.message}`);
//     res.end();
//   }
// });


// Launch application endpoint
// app.get('/launch', async (req, res) => {
//   console.log("🟢 /launch endpoint hit with query:", req.query);

//   const { path: exePath, username, cocode, module: moduleName } = req.query;

//   if (!exePath || !username || !cocode || !moduleName) {
//     console.warn("❌ Missing required parameters");
//     return res.status(400).send("Missing required parameters.");
//   }

//   // if (runningProcesses.has(username)) {
//   //   const { module: runningModule } = runningProcesses.get(username);
//   //   if (runningModule === moduleName) {
//   //     return res.status(409).send("Module already running.");
//   //   } else {
//   //     return res.status(409).send("Another module is already running.");
//   //   }
//   // }
//    if (runningProcesses.has(username)) {
//     const { module: runningModule, cocode: runningCocode } = runningProcesses.get(username);

//     // console.log("🧠 runningProcesses:", runningProcesses.get(username));
//     // console.log("🧠 Incoming:", { moduleName, cocode });

//     if (
//       runningModule === moduleName &&
//       String(runningCocode) === String(cocode)
//     ) {
//       return res.status(409).send("Module already running.");
//     } else {
//       return res.status(409).send("Another module is already running.");
//     }
//   }

//   try {
//     const exeServerPath = await getExeServerPathFromRegistry();
//     console.log("🔑 EXESERVERPATH from registry:", exeServerPath);

//     const moduleDir = path.dirname(exePath);
//     const moduleFolderName = path.basename(moduleDir);
//     const remoteModulePath = path.join(exeServerPath, moduleFolderName);

//     console.log(`🔄 Syncing files from ${remoteModulePath} → ${moduleDir}`);
//     await syncUpdatedFiles(remoteModulePath, moduleDir);

//     const argString = `/nolog/guname=${username}/CoRecNo=${cocode}`;
//     console.log(`🚀 Launching EXE: ${exePath} ${argString}`);
//     console.log(`${username} is launching ${moduleName} for CoRecNo=${cocode}`);

//     const child = execFile(exePath, [argString], (error, stdout, stderr) => {
//       if (error) {
//         if (error.killed && error.signal === 'SIGTERM') {
//           console.log(`🛑 Process killed intentionally for user ${username}`);
//         } else {
//           console.error(`❌ Error launching app for ${username}:`, error);
//         }
//       }

//       console.log(`👋 App exited for user ${username}`);
//       if (stdout) console.log("stdout:", stdout);
//       if (stderr) console.log("stderr:", stderr);

//       runningProcesses.delete(username);
//     });

//     runningProcesses.set(username, { process: child, module: moduleName, cocode });
//     res.send("✅ Application launched successfully!");
//   } catch (err) {
//     console.error("❌ Launch error:", err.message);
//     res.status(500).send(`Failed to launch application: ${err.message}`);
//   }
// });



// app.get('/launch', async (req, res) => {
//   console.log("🟢 /launch endpoint hit with query:", req.query);

//   const { path: exePath, username, cocode, module: moduleName } = req.query;

//   if (!exePath || !username || !cocode || !moduleName) {
//     console.warn("❌ Missing required parameters");
//     return res.status(400).send("Missing required parameters.");
//   }

//   if (!runningProcesses.has(username)) {
//     runningProcesses.set(username, new Map());
//   }

//   const userProcesses = runningProcesses.get(username);

//   if (userProcesses.has(moduleName)) {
//     const runningCocode = userProcesses.get(moduleName).cocode;

//     if (String(runningCocode) === String(cocode)) {
//       return res.status(409).send("Module already running.");
//     }
//     // If you want to allow different cocodes for the same module to run simultaneously,
//     // then you can skip blocking here.
//   }

//   try {
//     const exeServerPath = await getExeServerPathFromRegistry();
//     console.log("🔑 EXESERVERPATH from registry:", exeServerPath);

//     const moduleDir = path.dirname(exePath);
//     const moduleFolderName = path.basename(moduleDir);
//     const remoteModulePath = path.join(exeServerPath, moduleFolderName);

//     console.log(`🔄 Syncing files from ${remoteModulePath} → ${moduleDir}`);
//     await syncUpdatedFiles(remoteModulePath, moduleDir);

//     const argString = `/nolog/guname=${username}/CoRecNo=${cocode}`;
//     console.log(`🚀 Launching EXE: ${exePath} ${argString}`);
//     console.log(`${username} is launching ${moduleName} for CoRecNo=${cocode}`);

//     const child = execFile(exePath, [argString], (error, stdout, stderr) => {
//       if (error) {
//         if (error.killed && error.signal === 'SIGTERM') {
//           console.log(`🛑 Process killed intentionally for user ${username}`);
//         } else {
//           console.error(`❌ Error launching app for ${username}:`, error);
//         }
//       }

//       console.log(`👋 App exited for user ${username}`);
//       if (stdout) console.log("stdout:", stdout);
//       if (stderr) console.log("stderr:", stderr);

//       // Remove this module from user's running processes
//       userProcesses.delete(moduleName);

//       // If user has no more running modules, remove the user entry
//       if (userProcesses.size === 0) {
//         runningProcesses.delete(username);
//       }
//     });

//     // Store running process for this module under the user
//     userProcesses.set(moduleName, { process: child, cocode });

//     res.send("✅ Application launched successfully!");
//   } catch (err) {
//     console.error("❌ Launch error:", err.message);
//     res.status(500).send(`Failed to launch application: ${err.message}`);
//   }
// });


// // Logout and kill running app
// app.get('/logout', (req, res) => {
//   const { username } = req.query;

//   if (!username) {
//     console.warn("❌ Username required for logout");
//     return res.status(400).send("Username required");
//   }

//   const entry = runningProcesses.get(username);
//   if (entry) {
//     const { process: child } = entry;
//     if (child && typeof child.kill === "function") {
//       child.kill();
//     }

//     runningProcesses.delete(username);
//     console.log(`🔒 Application process killed for user ${username}`);
//     return res.send("✅ Application closed successfully!");
//   }

//   res.status(404).send("No running application found for user");
// });

app.get('/sync-progress', async (req, res) => {
  const { exePath } = req.query;

  if (!exePath) {
    return res.status(400).send("exePath query param is required");
  }

  const moduleDir = path.dirname(exePath);
  const moduleFolderName = path.basename(moduleDir);

  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  function sendEvent(data) {
    res.write(`data: ${data}\n\n`);
  }

  try {
    const exeServerPath = await getExeServerPathFromRegistry();
    const remoteModulePath = path.join(exeServerPath, moduleFolderName);

    sendEvent(`🔄 Starting sync from ${remoteModulePath} → ${moduleDir}`);

    await syncUpdatedFiles(remoteModulePath, moduleDir, (msg) => {
      sendEvent(msg);
    });

    sendEvent("✅ Sync finished.");
    res.end();
  } catch (err) {
    sendEvent(`❌ Sync error: ${err.message}`);
    res.end();
  }
});

app.get('/launch', async (req, res) => {
  console.log("🟢 /launch endpoint hit with query:", req.query);

  const { path: exePath, username, cocode, module: moduleName } = req.query;

  if (!exePath || !username || !cocode || !moduleName) {
    console.warn("❌ Missing required parameters");
    return res.status(400).send("Missing required parameters.");
  }

  if (!runningProcesses.has(username)) {
    runningProcesses.set(username, new Map());
  }

  const userProcesses = runningProcesses.get(username);

  if (userProcesses.has(moduleName)) {
    const runningCocode = userProcesses.get(moduleName).cocode;

    if (String(runningCocode) === String(cocode)) {
      return res.status(409).send("Module already running.");
    }
  }

  try {
    // Replace this with your actual logic to get exe server path
    const exeServerPath = await getExeServerPathFromRegistry();
    console.log("🔑 EXESERVERPATH from registry:", exeServerPath);

    const moduleDir = path.dirname(exePath);
    const moduleFolderName = path.basename(moduleDir);
    const remoteModulePath = path.join(exeServerPath, moduleFolderName);

    console.log(`🔄 Syncing files from ${remoteModulePath} → ${moduleDir}`);
    await syncUpdatedFiles(remoteModulePath, moduleDir);

    const argString = `/nolog/guname=${username}/CoRecNo=${cocode}`;
    console.log(`🚀 Launching EXE: ${exePath} ${argString}`);
    console.log(`${username} is launching ${moduleName} for CoRecNo=${cocode}`);

    const child = execFile(exePath, [argString], (error, stdout, stderr) => {
      if (error && !error.killed) {
        console.error(`❌ Error launching app for ${username}:`, error);
      }
      if (stdout) console.log("stdout:", stdout);
      if (stderr) console.log("stderr:", stderr);
    });

    child.on('exit', (code, signal) => {
      console.log(`👋 App exited for user ${username} module ${moduleName} with code ${code} and signal ${signal}`);

      userProcesses.delete(moduleName);

      if (userProcesses.size === 0) {
        runningProcesses.delete(username);
      }
    });

    userProcesses.set(moduleName, { process: child, cocode });

    res.send("✅ Application launched successfully!");
  } catch (err) {
    console.error("❌ Launch error:", err.message);
    res.status(500).send(`Failed to launch application: ${err.message}`);
  }
});


app.get('/logout', (req, res) => {
  const { username, module: moduleName } = req.query;

  if (!username) {
    console.warn("❌ Username required for logout");
    return res.status(400).send("Username required");
  }

  if (!runningProcesses.has(username)) {
    return res.status(404).send("No running application found for user");
  }

  const userProcesses = runningProcesses.get(username);

  if (moduleName) {
    // Kill specific module process
    if (!userProcesses.has(moduleName)) {
      return res.status(404).send(`No running module '${moduleName}' found for user`);
    }

    const { process: child } = userProcesses.get(moduleName);
    if (child && typeof child.kill === "function") {
      child.kill();
    }

    userProcesses.delete(moduleName);

    if (userProcesses.size === 0) {
      runningProcesses.delete(username);
    }

    console.log(`🔒 Application process for module '${moduleName}' killed for user ${username}`);
    return res.send(`✅ Module '${moduleName}' closed successfully!`);
  } else {
    // Kill all modules for user
    for (const [modName, { process: child }] of userProcesses.entries()) {
      if (child && typeof child.kill === "function") {
        child.kill();
      }
    }
    runningProcesses.delete(username);
    console.log(`🔒 All application processes killed for user ${username}`);
    return res.send("✅ All applications closed successfully!");
  }
});

app.get("/check-folder", (req, res) => {
  const folderPath = req.query.path; // e.g., ?path=C:\Launcher

  if (!folderPath) {
    return res.status(400).send("Path is required");
  }

  const requiredFiles = ["launcher.js", "package.json", "package-lock.json"];

  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error("❌ Error reading folder:", err.message);
      return res.status(500).send("Failed to read folder or folder doesn't exist");
    }

    // Filter out hidden/system files/folders if needed
    const visibleFiles = files.filter(file => !file.startsWith('.'));

    // Check which required files are missing
    const missingFiles = requiredFiles.filter(file => !visibleFiles.includes(file));

    if (missingFiles.length > 0) {
      return res.send({
        hasFiles: false,
        missingFiles,
        message: `Missing files: ${missingFiles.join(", ")}`
      });
    }

    res.send({ hasFiles: true, files: visibleFiles });
  });
});


app.get("/create-launcher-folder", (req, res) => {
  const folderPath = "C:\\Launcher"; // folder to create

  fs.access(folderPath, fs.constants.F_OK, (err) => {
    if (!err) {
      // Folder already exists
      return res.send({ created: false, message: "Folder already exists." });
    }

    // Folder doesn't exist, create it
    fs.mkdir(folderPath, { recursive: true }, (err) => {
      if (err) {
        console.error("❌ Error creating folder:", err.message);
        return res.status(500).send({ created: false, message: "Failed to create folder." });
      }
      res.send({ created: true, message: "Folder created successfully." });
    });
  });
});


const PORT = 5002;
app.listen(PORT, () => {
  console.log(`🚀 Local launcher running on port ${PORT}`);
});

