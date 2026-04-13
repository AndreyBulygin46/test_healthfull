require("dotenv").config();

const { spawnSync } = require("node:child_process");

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || "file:./prisma/dev.db",
};

function runNpmExec(args) {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) {
    throw new Error("npm_execpath is not set");
  }

  const result = spawnSync(process.execPath, [npmCliPath, "exec", "--", ...args], {
    stdio: "inherit",
    env,
    shell: false,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env,
    shell: false,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

runNpmExec(["prisma", "db", "push"]);
runNodeScript("prisma/seed.js");
