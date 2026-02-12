import express from "express";
import { execFile } from "child_process";
import cors from "cors";
import fs from "fs";
import fse from "fs-extra";
import path from "path";
import WinReg from "winreg";
import { connectMssql } from './db.js';
import os from 'os';
import pkg from 'node-machine-id';
const { machineIdSync } = pkg;
import { exec } from "child_process";


import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const app = express();
app.use(express.json());

app.use(cors({
   origin: ["http://localhost:5173", 
    "https://erpwebapp-client.onrender.com",
    "https://erp.bsre.binshabibgroup.ae",
    "https://erp.saeedcont.binshabibgroup.ae",
    "https://erp.ralscont.binshabibgroup.ae",
    "https://erp.hamda.binshabibgroup.ae",
    "https://erp.cs.binshabibgroup.ae",
    "https://erp.manjalgranites.ae",
    "https://erp.firehub.ae",
    "https://erp.awsinvestment.ae",   // ADDED ON 29/01/2026
    "https://erp.bsreop.binshabibgroup.ae",
    "https://erp.csop.binshabibgroup.ae",
    "https://erp.op.awsinvestment.ae"       // ADDED ON 02/02/2026
  ],    
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

// Sync updated files from remote folder to local    changed on 31/01 /2026 by agalya
// async function syncUpdatedFiles(remoteDir, localDir,onProgress) {
//   console.log(`🛠️  Starting sync from ${remoteDir} → ${localDir}`);

//   if (!fs.existsSync(remoteDir)) {
//     console.error(`❌ Remote folder does not exist: ${remoteDir}`);
//     throw new Error(`Remote folder does not exist: ${remoteDir}`);
//   }

//   await fse.ensureDir(localDir);

//     const localFilesBefore = await fse.readdir(localDir);
//   console.log(`📂 Local folder has ${localFilesBefore.length} files before sync.`);

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
//       // console.log(`⬆️  Copying updated file: ${file}`);
//       await fse.copy(remoteFilePath, localFilePath);
//       updatedCount++;
//     } else {
//       // console.log(`✅ Up-to-date: ${file}`);
//     }
//   }
//   onProgress?.(`📦 Sync complete.`);

//   const localFilesAfter = await fse.readdir(localDir);
//   console.log(`📂 Local folder has ${localFilesAfter.length} files after sync.`);

//   if (updatedCount === 0) {
//     console.log(`📦 No updates were necessary. All files are up-to-date.`);
//   } else {
//     console.log(`✅ Sync completed. ${updatedCount} file(s) updated.`);
//   }
// }

// Sync updated files from remote folder to local, and delete local files not in remote
// Recursively sync files and folders from remoteDir to localDir
async function syncUpdatedFiles(remoteDir, localDir, onProgress) {
  console.log(`🛠️  Starting sync from ${remoteDir} → ${localDir}`);

  if (!fs.existsSync(remoteDir)) {
    console.error(`❌ Remote folder does not exist: ${remoteDir}`);
    throw new Error(`Remote folder does not exist: ${remoteDir}`);
  }

  await fse.ensureDir(localDir);

  const remoteEntries = await fse.readdir(remoteDir);
  const localEntries = await fse.readdir(localDir);

  const remoteSet = new Set(remoteEntries);

  let updatedCount = 0;
  let deletedCount = 0;

  // 1. Copy files and folders from remote to local if name or mtime is different
  for (const entry of remoteEntries) {
    const remotePath = path.join(remoteDir, entry);
    const localPath = path.join(localDir, entry);

    const remoteStats = await fse.stat(remotePath).catch(() => null);
    if (!remoteStats) continue;

    if (remoteStats.isDirectory()) {
      // Recursively sync subdirectory
      await syncUpdatedFiles(remotePath, localPath, onProgress);
    } else {
      let shouldCopy = false;
      const localStats = await fse.stat(localPath).catch(() => null);
      if (!localStats) {
        shouldCopy = true; // File does not exist locally
      } else if (remoteStats.mtimeMs !== localStats.mtimeMs) {
        shouldCopy = true; // File exists but mtime is different
      }
      if (shouldCopy) {
        await fse.copy(remotePath, localPath);
        updatedCount++;
        console.log(`⬆️  Copied file: ${localPath}`);
      }
    }
  }

  // 2. Delete local files/folders not in remote
  // for (const entry of localEntries) {
  //   if (!remoteSet.has(entry)) {
  //     const localPath = path.join(localDir, entry);
  //     await fse.remove(localPath);
  //     deletedCount++;
  //     console.log(`🗑️  Deleted local entry not in remote: ${localPath}`);
  //   }
  // }
  for (const entry of localEntries) {
  if (!remoteSet.has(entry)) {
    const localPath = path.join(localDir, entry);
    try {
      await fse.remove(localPath);
      deletedCount++;
      console.log(`🗑️  Deleted local entry not in remote: ${localPath}`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`❌ Error deleting ${localPath}:`, err.message);
      }
      // Ignore ENOENT (file already missing)
    }
  }
}
  onProgress?.(`📦 Sync complete.`);

  const localFilesAfter = await fse.readdir(localDir);
  console.log(`📂 Local folder has ${localFilesAfter.length} entries after sync.`);
  console.log(`✅ Sync completed. ${updatedCount} file(s) updated/copied, ${deletedCount} file(s)/folder(s) deleted.`);
}

app.get('/sync-progress', async (req, res) => {
  const { exePath,exeServerPath } = req.query;

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
    const exeServerPathName = exeServerPath
    const remoteModulePath = path.join(exeServerPathName, moduleFolderName);
    console.log("exe")
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// app.get("/stop-launcher", (req, res) => {
//   exec('taskkill /IM wscript.exe /F', (err, stdout, stderr) => {
//     if (err) {
//       if (stderr && stderr.toLowerCase().includes("not found")) {
//         res.send("Launcher already stopped (wscript.exe not found).");
//       } else {
//         console.error("❌ Failed to stop launcher:", stderr || err.message);
//         return res.status(500).send("Failed to stop launcher");
//       }
//     } else {
//       res.send("Launcher stopped");
//     }
//     // Give the response time to be sent before exiting Node.js
//     setTimeout(() => {
//       process.exit(0);
//     }, 500);
//   });
// });

// Helper: map domain to DB config
const domainDbMap = {
  'erp.bsre.binshabibgroup.ae': 'BSREDB',
  'erp.saeedcont.binshabibgroup.ae': 'SAEEDDB',
  'erp.ralscont.binshabibgroup.ae': 'RALSDb',
  // Add more mappings as needed
};

import mssql from 'mssql';
// If you need DateTime:
const { DateTime } = mssql;
import bsredbConfig from './config/bsredb.js';
import awsdbConfig from './config/awsdb.js';
import ralsdbConfig from './config/ralsdb.js';

function getDbConfigForDomain(domain) {
  // Map domain to config
  if (domain.includes('bsre') || domain.includes('cs') || domain.includes('hamda')) return bsredbConfig;
  if (domain.includes('rals') || domain.includes('aws')) return awsdbConfig;
  if (domain.includes('saeed') || domain.includes('manjal') || domain.includes('firehub')) return ralsdbConfig;
  // Default fallback
  return null;
}

// app.get('/get-session', async (req, res) => {
//   const { username,dbName,domainName } = req.query;
//   console.log("🟢 /get-session called with:", { username,dbName,domainName });
//   if (!username) {
//     return res.status(400).json({ message: "username is required" });
//   }

//   const dbConfig = getDbConfigForDomain(domainName);
//   console.log("Using DB config for domain:", domainName, dbConfig ? "found" : "not found");
//   if (!dbConfig) {
//     return res.status(400).json({ message: "Unknown or unsupported domain" });
//   }

//   let pool;
//   try {
//     pool = await mssql.connect(dbConfig);
//     const result = await pool.request()
//       .input('username', mssql.VarChar, username)
//       .query(`SELECT * FROM ${dbName}.dbo.WebLoginSessions WHERE Username = @username`);

//     if (result.recordset.length === 0) {
//       return res.status(404).json({ message: "Session not found" });
//     }
//     console.log("✅ Session fetched successfully for user:", username);

//     // Add computerName to response
//     res.json({ success: true, session: result.recordset[0], computerName: os.hostname() });
//     console.log("🏷️  Sent computer name:", os.hostname());
//   } catch (err) {
//     console.error("❌ Error in get-session:", err);
//     res.status(500).json({ success: false, message: err.message });
//   } finally {
//     if (pool) pool.close();
//   }
// });

app.get('/get-session', (req, res) => {
  // Just return the computer name, no DB connection
  res.json({ success: true, computerName: os.hostname() });
});



app.get('/launch', async (req, res) => {
  // Extract query parameters
  const { path: exePath, username, cocode, module: moduleName, companyName, allowMultipleTabs, exeServerPath,connString } = req.query;

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

  // Only block if allowMultipleTabs is not set or is 0
  if ((!allowMultipleTabs || allowMultipleTabs === "0" || allowMultipleTabs === 0) && userProcesses.has(processKey)) {
    return res.status(409).send("Module already running for this fiscal year.");
  }

  try {
    // Only copy files if module is NOT running
    const exeServerPathName = exeServerPath;
    console.log("🔑 EXESERVERPATH from registry:", exeServerPathName);
    console.log("connString:", connString);
    const moduleDir = path.dirname(exePath);
    const moduleFolderName = path.basename(moduleDir);
    const remoteModulePath = path.join(exeServerPathName, moduleFolderName);
    console.log(`🔄 Syncing files from ${remoteModulePath} → ${moduleDir}`);
    await syncUpdatedFiles(remoteModulePath, moduleDir);

    const argString = `/nolog/guname=${username}/CoRecNo=${cocode}/connectionstring=${connString}`;
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
      userProcesses.delete(processKey);
      if (userProcesses.size === 0) {
        runningProcesses.delete(username);
      }
    });

    userProcesses.set(processKey, { process: child, cocode, companyName, lastUpdated: Date.now() });
    console.log("=== Running Processes ===");
    for (const [uname, procs] of runningProcesses.entries()) {
      for (const [key, { process: proc, cocode, companyName }] of procs.entries()) {
        const [modName, coCode] = key.split('_');
        console.log(`User: ${uname}, Module: ${modName}, PID: ${proc.pid}, cocode: ${coCode}, CompanyName: ${companyName}`);
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
// app.post('/check-registry', (req, res) => {
//   const { Estate, TwoBase } = req.body;

//   // Check TwoBase.Net registry
//   const regKey = new WinReg({
//     hive: WinReg.HKLM,
//     key: '\\SOFTWARE\\TwoBase.Net'
//   });

//   regKey.get('DataPath', (err, item) => {
//     if (err || !item || !item.value) {
//       return res.json({ success: false, message: "TwoBase.Net registry not set" });
//     }
//     const twobase = item.value;
//     // Check if twobase matches your expected string (adjust as needed)
//     console.log("Registry value (twobase):", TwoBase);
//     const isTwoBaseOk = twobase.includes(TwoBase);
//     console.log("TwoBase.Net registry check:", isTwoBaseOk);
//     // Now check Estate
//     const estateKey = new WinReg({
//       hive: WinReg.HKLM,
//       key: '\\SOFTWARE\\EstateNet'
//     });

//     estateKey.get('DataPath', (err2, item2) => {
//       if (err2 || !item2 || !item2.value) {
//         return res.json({ success: false, message: "Estate registry not set" });
//       }
//       const estate = item2.value;
//       const isEstateOk = estate.includes(Estate);
//       console.log("Estate registry check:", isEstateOk);

//       if (isTwoBaseOk && isEstateOk) {
//         return res.json({ success: true });
//       } else {
//         return res.json({ success: false, message: "Registry values incorrect" });
//       }
//     });
//   });
// });



app.get('/is-running', (req, res) => {
  const { username, module: moduleName, cocode } = req.query;
  if (!username || !moduleName || !cocode) {
    return res.status(400).json({ running: false, lastUpdated: false });
  }
  if (!runningProcesses.has(username)) {
    return res.json({ running: false, lastUpdated: false });
  }
  const userProcesses = runningProcesses.get(username);
  const processKey = `${moduleName}_${cocode}`;
  if (!userProcesses.has(processKey)) {
    return res.json({ running: false, lastUpdated: false });
  }
  const procObj = userProcesses.get(processKey);
  const child = procObj.process;
  let isAlive = false;
  if (child && child.pid) {
    try {
      process.kill(child.pid, 0); // Throws if not running
      isAlive = true;
    } catch (e) {
      isAlive = false;
    }
  }
  if (isAlive) {
    procObj.lastUpdated = Date.now();
    return res.json({ running: true, lastUpdated: true });
  } else {
    userProcesses.delete(processKey);
    if (userProcesses.size === 0) runningProcesses.delete(username);
    return res.json({ running: false, lastUpdated: false });
  }
});


app.post('/update-launcher', (req, res) => {
  const launcherKey = req.headers['x-launcher-key'];
  if (launcherKey !== "BSRE_LAUNCHER_2026") {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  const batchFilePath = "C:\\BATCHFILE\\Installer.bat";
  exec(`"${batchFilePath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Error running batch file:", error);
      return res.status(500).json({ success: false, message: "Failed to run batch file" });
    }
    res.json({ 
      success: true, 
      message: "Launcher updated successfully", 
      version: pkgJson.version 
    });
  });
});

// Endpoint to get launcher version from package.json
app.get('/launcher-version', (req, res) => {
  res.json({ version: pkgJson.version });
});

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`🚀 Local launcher running on port ${PORT}`);
});

