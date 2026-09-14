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
