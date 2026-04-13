const { rmSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const TEST_DB_URL = process.env.DATABASE_URL || "file:./prisma/test.db";
const forwardedArgs = process.argv.slice(2);
const hasJestPatternArg = forwardedArgs.some((arg) => !arg.startsWith("-"));

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

function toSqliteFilePath(url) {
  if (!url.startsWith("file:")) {
    return null;
  }

  const rawPath = url.slice("file:".length);
  return resolve(rawPath);
}

const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: TEST_DB_URL,
};

const sqlitePath = toSqliteFilePath(TEST_DB_URL);
if (sqlitePath) {
  rmSync(sqlitePath, { force: true });
  mkdirSync(resolve(sqlitePath, ".."), { recursive: true });
}

runNpmExec(["prisma", "db", "push"], env);

runNpmExec(
  [
    "jest",
    ...(hasJestPatternArg ? [] : ["src/__tests__/integration"]),
    "--testEnvironment=node",
    ...forwardedArgs,
  ],
  env
);
