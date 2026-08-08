const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const backendDirectory = path.resolve(__dirname, "..");
const pythonDirectory = path.join(backendDirectory, "python");
const pythonExecutable = process.platform === "win32"
  ? path.join(backendDirectory, ".venv", "Scripts", "python.exe")
  : path.join(backendDirectory, ".venv", "bin", "python");

if (!fs.existsSync(pythonExecutable)) {
  console.error(`Python virtual environment executable not found: ${pythonExecutable}`);
  process.exit(1);
}

const result = spawnSync(
  pythonExecutable,
  ["-m", "program_case_semantic_search.cli", ...process.argv.slice(2)],
  {
    cwd: pythonDirectory,
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) {
  console.error("Failed to start the program case semantic search CLI.");
  process.exit(1);
}
process.exit(result.status ?? 1);
