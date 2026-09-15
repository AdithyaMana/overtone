// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/* The game is a single file with no server, so specs load it over file://.
   Each test gets a fresh context, which means fresh localStorage — so the
   first-run help card and the coach appear deterministically. */
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  /* Eight workers on one machine starve each other, and a handful of specs
     write a preference and reload in the same breath — Chromium hands
     localStorage to the browser process over an async channel with no event to
     wait on, so under load the write occasionally loses the race. The specs
     already wait for the value to be readable before reloading (see
     reloadKeeping); this is the last of it. One retry, so the runner reports
     these as flaky rather than failed, and a real failure still fails twice
     and stays red. */
  retries: 1,
  reporter: [["list"]],
  use: {
    headless: true,
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "phone", use: { ...devices["Pixel 5"] } }
  ]
});
