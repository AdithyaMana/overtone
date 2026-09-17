// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/* The specs load the game over http from tools/test-server.js rather than
   straight off disk. Chromium gives a file:// document its own corner of
   localStorage, and under load a reload there can come up with the whole area
   empty — five to eight runs in thirty lost every key they had just written,
   which is what made the handful of "survives a reload" specs flake. The same
   measurement over http came back thirty for thirty, and http is what a player
   gets anyway. Each test still gets a fresh context, which means fresh
   localStorage — so the first-run help card and the coach appear
   deterministically. */
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  /* The localStorage race this was originally for is gone: it was file://, and
     the specs serve the game over http now. What is left is plain starvation —
     parallel workers on one machine, and a browser that can be slow enough to
     miss a beat. One retry, so the runner reports that as flaky rather than
     failed, and a real failure still fails twice and stays red.

     It does mean a new flake reports as green. `npx playwright test
     --retries=0` is the honest picture; the suite passes it. */
  retries: 1,
  reporter: [["list"]],
  use: {
    headless: true,
    trace: "retain-on-failure",
    baseURL: "http://127.0.0.1:8787"
  },
  webServer: {
    command: "node tools/test-server.js 8787",
    url: "http://127.0.0.1:8787/index.html",
    reuseExistingServer: true,
    stdout: "ignore"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "phone", use: { ...devices["Pixel 5"] } }
  ]
});
