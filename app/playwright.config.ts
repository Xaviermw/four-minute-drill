import { defineConfig, devices } from "@playwright/test";

// One smoke test covering draft -> drive -> result, the path unit tests can't
// see. The dev server binds IPv6 (::1) by default, which Playwright's 127.0.0.1
// can't reach -- so start it explicitly on 127.0.0.1 (and a dedicated port so
// it never collides with a running `npm run dev`).
const PORT = 5175;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  use: { baseURL: BASE_URL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
