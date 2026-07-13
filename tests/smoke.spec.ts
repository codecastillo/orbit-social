import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/feed",
  "/explore",
  "/clips",
  "/live",
  "/communities",
  "/events",
  "/marketplace",
];

for (const route of PUBLIC_ROUTES) {
  test(`renders ${route} without crashing`, async ({ page }) => {
    const crashes: Error[] = [];
    page.on("pageerror", (err) => crashes.push(err));

    const response = await page.goto(route, { waitUntil: "load" });
    expect(response?.status(), `${route} should not 4xx/5xx`).toBeLessThan(400);

    // Give client hydration a beat to surface runtime exceptions.
    await page.waitForTimeout(1000);

    await expect(
      page.getByText("Application error: a client-side exception has occurred")
    ).toHaveCount(0);
    expect(
      crashes,
      `uncaught exceptions on ${route}: ${crashes.map((c) => c.message).join("; ")}`
    ).toHaveLength(0);
  });
}
