import { test, expect, Page } from "@playwright/test";

// ── Mock helpers ───────────────────────────────────────────────────────────────

const COMPLETED_PROFILE = {
  name: "Test User",
  home_location: "Pittsburgh, PA",
  work_location: "CMU Campus",
  interests: ["coding"],
  projects: ["Anchorpoint"],
  onboarding_done: true,
};

const INCOMPLETE_PROFILE = {
  name: null,
  home_location: null,
  work_location: null,
  interests: null,
  projects: null,
  onboarding_done: false,
};

const DEFAULT_SETTINGS = {
  active_model: "llama3.1:8b",
  personalization_enabled: "true",
  context_window_tokens: "4096",
};

async function mockAllAPIs(page: Page, profileOverride: Record<string, unknown> = COMPLETED_PROFILE) {
  await page.route("/health", (route) =>
    route.fulfill({ json: { status: "ok", version: "0.4.0", ollama_connected: true } })
  );
  await page.route("/api/v1/profile", (route) =>
    route.fulfill({ json: profileOverride })
  );
  await page.route("/api/v1/settings", (route) =>
    route.fulfill({ json: DEFAULT_SETTINGS })
  );
  await page.route("/api/v1/conversations", (route) =>
    route.fulfill({ json: { conversations: [], total: 0 } })
  );
  await page.route("/api/v1/conversations/**", (route) =>
    route.fulfill({ status: 404, json: { detail: "Not found" } })
  );
  await page.route("/api/v1/models", (route) =>
    route.fulfill({
      json: {
        installed: [
          {
            name: "llama3.1:8b",
            description: "Meta Llama 3.1 8B",
            size_gb: 4.7,
            min_ram_gb: 8,
            is_installed: true,
            is_active: true,
          },
        ],
        available: [],
        active_model: "llama3.1:8b",
      },
    })
  );
  await page.route("/api/v1/models/recommendation", (route) =>
    route.fulfill({
      json: {
        recommended_model: "llama3.1:8b",
        tier: "standard",
        reason: "Good fit for available RAM",
        ram_gb: 16,
        os: "macOS",
      },
    })
  );
  await page.route("/api/v1/voice/profiles", (route) =>
    route.fulfill({
      json: {
        profiles: [
          { id: "neutral", name: "Neutral", rate: 1.0, pitch: 1.0 },
          { id: "warm", name: "Warm", rate: 0.9, pitch: 1.15 },
          { id: "professional", name: "Professional", rate: 1.1, pitch: 0.9 },
        ],
      },
    })
  );
  await page.route("/api/v1/voice/settings", (route) =>
    route.fulfill({
      json: { enabled: false, profile: "neutral", rate: 1.0, pitch: 1.0 },
    })
  );
  await page.route("/api/v1/voice/custom-profiles", (route) =>
    route.fulfill({ json: { profiles: [] } })
  );
  await page.route("/api/v1/memory", (route) =>
    route.fulfill({ json: { memories: [], total: 0, available: false } })
  );
  await page.route("/api/v1/memory/count", (route) =>
    route.fulfill({ json: { count: 0 } })
  );
  await page.route("/api/v1/report/status", (route) =>
    route.fulfill({
      json: {
        weather: false,
        news: false,
        commute: false,
        calendar: false,
        calendar_configured: false,
      },
    })
  );
  await page.route("/api/v1/report/schedule", (route) =>
    route.fulfill({ json: { enabled: false, time: "07:00" } })
  );
  await page.route("/api/v1/report/latest", (route) =>
    route.fulfill({ json: { content: null, generated_at: null } })
  );
  await page.route("/api/v1/activity", (route) =>
    route.fulfill({ json: { logs: [], total: 0 } })
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe("App shell", () => {
  test("loads and shows the chat page", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/");
    // Sidebar should be visible
    await expect(page.locator("nav, [role='navigation'], aside")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows Ollama disconnection banner when offline", async ({ page }) => {
    await mockAllAPIs(page);
    // Override health to report disconnected
    await page.route("/health", (route) =>
      route.fulfill({ json: { status: "ok", version: "0.4.0", ollama_connected: false } })
    );
    await page.goto("/");
    await expect(page.getByText("Ollama not connected")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("hides banner when Ollama is connected", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/");
    await expect(page.getByText("Ollama not connected")).not.toBeVisible();
  });
});

test.describe("Onboarding", () => {
  test("shows onboarding wizard when profile is incomplete", async ({ page }) => {
    await mockAllAPIs(page, INCOMPLETE_PROFILE);
    await page.goto("/");
    // The wizard should appear — look for onboarding-specific content
    await expect(
      page.getByRole("heading", { name: /welcome|get started|let's set up/i })
        .or(page.locator("form").first())
    ).toBeVisible({ timeout: 10_000 });
  });

  test("skips onboarding when profile is complete", async ({ page }) => {
    await mockAllAPIs(page, COMPLETED_PROFILE);
    await page.goto("/");
    // Should NOT show the onboarding wizard
    await expect(
      page.getByRole("heading", { name: /welcome|get started/i })
    ).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/");
    // Wait for the app shell to mount
    await page.waitForLoadState("networkidle");
  });

  test("can navigate to settings via URL", async ({ page }) => {
    await page.goto("/settings/general");
    await expect(page).toHaveURL(/\/settings/);
  });

  test("can navigate to settings/models via URL", async ({ page }) => {
    await page.goto("/settings/models");
    await expect(page).toHaveURL(/\/settings\/models/);
  });

  test("can navigate to settings/profile via URL", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/settings\/profile/);
  });

  test("can navigate to activity log via URL", async ({ page }) => {
    await page.goto("/activity");
    await expect(page).toHaveURL(/\/activity/);
  });

  test("can navigate to report page via URL", async ({ page }) => {
    await page.goto("/report");
    await expect(page).toHaveURL(/\/report/);
  });
});

test.describe("Chat page", () => {
  test("renders chat input", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Chat input or textarea should exist somewhere on page
    const input = page
      .getByRole("textbox")
      .or(page.locator("textarea"))
      .first();
    await expect(input).toBeVisible({ timeout: 10_000 });
  });

  test("shows empty conversation list in sidebar", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // The sidebar should render without error — no crash
    await expect(page.locator("body")).not.toContainText("Unhandled error");
  });
});

test.describe("Settings pages", () => {
  test("general settings page renders", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/settings/general");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Cannot read");
  });

  test("models page renders installed model", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/settings/models");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText("llama3.1:8b", { timeout: 8_000 });
  });

  test("profile settings page renders", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/settings/profile");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("TypeError");
  });

  test("memory page renders", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/settings/memory");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("TypeError");
  });

  test("voice page renders", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/settings/voice");
    await page.waitForLoadState("networkidle");
    // Voice profiles should appear
    await expect(page.getByText(/neutral|warm|professional/i).first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
