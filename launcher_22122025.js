import express from "express";
import { execFile } from "child_process";
import cors from "cors";
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import WinReg from "winreg";
import { connectMssql } from './db.js';

const app = express();
app.use(express.json());

app.use(cors({
   origin: ["http://localhost:5173", "https://erpwebapp-client.onrender.com","https://erp.bsre.binshabibgroup.ae","https://erp.saeedcont.binshabibgroup.ae","https://erp.ralscont.binshabibgroup.ae","https://erp.hamda.binshabibgroup.ae","https://erp.cs.binshabibgroup.ae"], 
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

// app.get('/catalog', async (req, res) => {
//   const username = req.query.username?.trim().toLowerCase();
//   if (!username) {
//     return res.status(400).json({ message: "Username is required" });
//   }

//   try {
//     const catalog = await getCatalogFromRegistry();
//     if (!catalog) return res.status(404).send('Catalog not found');

//     const db = await connectMongo('BinShabibEstateNet');
//     const catalogCollection = db.collection('dbo.catalog');

//     const timestamp = new Date();

//     await catalogCollection.updateOne(
//       { username },
//       { $set: { catalog, insertedAt: timestamp } },
//       { upsert: true }
//     );

//     // Respond success, no catalog sent back
//     console.log("Catalog updated successfully for user:", username);

//   } catch (err) {
//     console.error("Error in /catalog:", err);
//     res.status(500).send('Error processing request');
//   }
// });

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
      // console.log(`⬆️  Copying updated file: ${file}`);
      await fse.copy(remoteFilePath, localFilePath);
      updatedCount++;
    } else {
      // console.log(`✅ Up-to-date: ${file}`);
    }
  }
  onProgress?.(`📦 Sync complete.`);

  if (updatedCount === 0) {
    console.log(`📦 No updates were necessary. All files are up-to-date.`);
  } else {
    console.log(`✅ Sync completed. ${updatedCount} file(s) updated.`);
  }
}

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
  // console.log("🟢 /launch endpoint hit with query:", req.query);

  const { path: exePath, username, cocode, module: moduleName, companyName } = req.query;

  if (!exePath || !username || !cocode || !moduleName || !companyName) {
    console.warn("❌ Missing required parameters");
    return res.status(400).send("Missing required parameters.");
  }

  // --- Check if module is already running BEFORE copying files ---
  if (!runningProcesses.has(username)) {
    runningProcesses.set(username, new Map());
  }

  const userProcesses = runningProcesses.get(username);

  const processKey = `${moduleName}_${cocode}`;
  if (userProcesses.has(processKey)) {
    return res.status(409).send("Module already running for this fiscal year.");
  }

  try {
    // Only copy files if module is NOT running
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

    const processKey = `${moduleName}_${cocode}`;
    const child = execFile(exePath, [argString], (error, stdout, stderr) => {
      if (error && !error.killed) {
        console.error(`❌ Error launching app for ${username}:`, error);
      }
      if (stdout) console.log("stdout:", stdout);
      if (stderr) console.log("stderr:", stderr);
    });

    child.on('exit', (code, signal) => {
      // console.log(`👋 App exited for user ${username} module ${moduleName} with code ${code} and signal ${signal}`);
      userProcesses.delete(processKey); // Use processKey here!
      if (userProcesses.size === 0) {
        runningProcesses.delete(username);
      }
    });

    userProcesses.set(processKey, { process: child, cocode, companyName: req.query.companyName });
    console.log("=== Running Processes ===");
    for (const [username, userProcesses] of runningProcesses.entries()) {
      for (const [key, { process: proc, cocode, companyName }] of userProcesses.entries()) {
        const [modName, coCode] = key.split('_');
        console.log(`User: ${username}, Module: ${modName}, PID: ${proc.pid}, cocode: ${coCode}, CompanyName: ${companyName}`);
      }
    }
    console.log("========================");

    res.send("✅ Application launched successfully!");
  } catch (err) {
    console.error("❌ Launch error:", err.message);
    res.status(500).send(`Failed to launch application: ${err.message}`);
  }
});


app.get('/logout', (req, res) => {
  const { username, companyName } = req.query;

  if (!username) {
    console.warn("❌ Username required for logout");
    return res.status(400).send("Username required");
  }

  if (!runningProcesses.has(username)) {
    return res.status(404).send("No running application found for user");
  }

  const userProcesses = runningProcesses.get(username);

  // If companyName is provided, remove all processes for that company
  if (companyName) {
    let found = false;
    for (const [key, procObj] of userProcesses.entries()) {
      if (procObj.companyName === companyName) {
        if (procObj.process && typeof procObj.process.kill === "function") {
          procObj.process.kill();
        }
        userProcesses.delete(key);
        found = true;
      }
    }
    if (userProcesses.size === 0) {
      runningProcesses.delete(username);
    }
    if (found) {
      console.log(`🔒 All application processes for company '${companyName}' killed for user ${username}`);
      return res.send(`✅ All modules for company '${companyName}' closed successfully!`);
    } else {
      return res.status(404).send(`No running modules for company '${companyName}' found for user`);
    }
  }

  // If no companyName, kill all modules for user
  for (const [key, { process: child }] of userProcesses.entries()) {
    if (child && typeof child.kill === "function") {
      child.kill();
    }
  }
  runningProcesses.delete(username);
  // console.log(`🔒 All application processes killed for user ${username}`);
  return res.send("✅ All applications closed successfully!");
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

// launcher.js
app.post('/check-registry', (req, res) => {
  const { Estate, TwoBase } = req.body;

  // Check TwoBase.Net registry
  const regKey = new WinReg({
    hive: WinReg.HKLM,
    key: '\\SOFTWARE\\TwoBase.Net'
  });

  regKey.get('DataPath', (err, item) => {
    if (err || !item || !item.value) {
      return res.json({ success: false, message: "TwoBase.Net registry not set" });
    }
    const twobase = item.value;
    // Check if twobase matches your expected string (adjust as needed)
    console.log("Registry value (twobase):", TwoBase);
    const isTwoBaseOk = twobase.includes(TwoBase);
    console.log("TwoBase.Net registry check:", isTwoBaseOk);
    // Now check Estate
    const estateKey = new WinReg({
      hive: WinReg.HKLM,
      key: '\\SOFTWARE\\EstateNet'
    });

    estateKey.get('DataPath', (err2, item2) => {
      if (err2 || !item2 || !item2.value) {
        return res.json({ success: false, message: "Estate registry not set" });
      }
      const estate = item2.value;
      const isEstateOk = estate.includes(Estate);
      console.log("Estate registry check:", isEstateOk);

      if (isTwoBaseOk && isEstateOk) {
        return res.json({ success: true });
      } else {
        return res.json({ success: false, message: "Registry values incorrect" });
      }
    });
  });
});


const PORT = 5002;
app.listen(PORT, () => {
  console.log(`🚀 Local launcher running on port ${PORT}`);
});

