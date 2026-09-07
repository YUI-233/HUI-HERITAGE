const { realpathSync } = require("node:fs");
const { spawn } = require("node:child_process");

const mode = process.argv[2];

if (mode !== "dev") {
  throw new Error("Expected the Next.js mode to be 'dev'.");
}

const projectRoot = realpathSync.native(process.cwd());
const nextCli = require.resolve("next/dist/bin/next");
const next = spawn(process.execPath, [nextCli, "dev", "--port", "3014"], {
  cwd: projectRoot,
  stdio: "inherit",
});

next.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
