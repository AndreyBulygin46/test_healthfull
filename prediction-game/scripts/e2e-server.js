const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");

function parseEnvFile(filePath) {
  const env = {};
  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (value.startsWith(`"`) && value.endsWith(`"`)) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

const baseDir = resolve(__dirname, "..");
const fileEnv = parseEnvFile(resolve(baseDir, ".env.test"));
const env = {
  ...process.env,
  ...fileEnv,
  NODE_ENV: "test",
};

const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(
  process.execPath,
  [nextBin, "dev", "-H", "127.0.0.1", "-p", "3000"],
  {
    cwd: baseDir,
    env,
    stdio: "inherit",
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
  process.exit(0);
});
