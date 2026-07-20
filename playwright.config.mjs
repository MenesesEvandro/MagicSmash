import { defineConfig, devices } from "@playwright/test";

// E2E layer: real-browser proof for the behaviours jsdom can only
// approximate (native button activation, real key repeat, real dialogs,
// real pointer input). The broad fast matrix lives in test/ on jsdom;
// run this layer with `npm run test:e2e`.
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	use: {
		baseURL: "http://localhost:4173",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "node scripts/serve.mjs 4173",
		url: "http://localhost:4173",
		reuseExistingServer: true,
	},
});
