"use strict";

const { mkdirSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join, resolve } = require("node:path");

const root = resolve(__dirname, "..");
const stateDir = join(root, ".wrangler", "test-state");
const configDir = join(stateDir, "config");
const wranglerBin = join(root, "node_modules", "wrangler", "bin", "wrangler.js");

mkdirSync(configDir, { recursive: true });

const result = spawnSync(process.execPath, [
  wranglerBin,
  "d1",
  "migrations",
  "apply",
  "AI_BUDGET_DB",
  "--local",
  "--persist-to",
  stateDir,
], {
  cwd: root,
  env: {
    ...process.env,
    XDG_CONFIG_HOME: configDir,
    WRANGLER_SEND_METRICS: "false",
  },
  encoding: "utf8",
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
