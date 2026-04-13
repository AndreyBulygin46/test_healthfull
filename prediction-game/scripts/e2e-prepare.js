const { mkdirSync, rmSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

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

function runNpmExec(args, env) {
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

function runNodeScript(scriptPath, env) {
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

function removeDatabaseWithRetry(path) {
  const attempts = 5;
  for (let index = 0; index < attempts; index += 1) {
    try {
      rmSync(path, { force: true, maxRetries: 3, retryDelay: 80 });
      return;
    } catch (error) {
      if (error.code !== "EPERM" || index === attempts - 1) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 80);
    }
  }
}

const baseDir = resolve(__dirname, "..");
const envFile = resolve(baseDir, ".env.test");
const fileEnv = parseEnvFile(envFile);

const testDbUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL || "file:./prisma/e2e.db";
const testAuthSecret = process.env.NEXTAUTH_SECRET || fileEnv.NEXTAUTH_SECRET || "e2e-secret";
const testAuthUrl = process.env.NEXTAUTH_URL || fileEnv.NEXTAUTH_URL || "http://127.0.0.1:3000";

const env = {
  ...process.env,
  ...fileEnv,
  DATABASE_URL: testDbUrl,
  NEXTAUTH_SECRET: testAuthSecret,
  NEXTAUTH_URL: testAuthUrl,
  NODE_ENV: "test",
};

const sqlitePath = testDbUrl.startsWith("file:")
  ? resolve(baseDir, testDbUrl.replace(/^file:/, ""))
  : null;
if (sqlitePath) {
  removeDatabaseWithRetry(sqlitePath);
  mkdirSync(dirname(sqlitePath), { recursive: true });
}

runNpmExec(["prisma", "db", "push"], env);
runNodeScript(resolve(baseDir, "prisma/seed.js"), env);
