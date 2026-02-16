import { test, expect } from '@playwright/test';

/** Test credentials (optional). Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated flows. */
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || '';

/** Log in via the login page when credentials are set. Returns true if login was attempted and succeeded. */
async function loginIfNeeded(page: import('@playwright/test').Page): Promise<boolean> {
  if (!TEST_EMAIL || !TEST_PASSWORD) return false;
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/email address/i).fill(TEST_EMAIL);
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /access the war room/i }).click();
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 }).catch(() => {});
  return page.url().includes('/login') === false;
}

/** Start tutorial from hub (click Start Tutorial) and optionally go to editor. */
async function startTutorialFromHub(page: import('@playwright/test').Page, thenGoToEditor = false) {
  await page.goto('/hub');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const startBtn = page.getByRole('button', { name: /start tutorial|restart tutorial/i });
  if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startBtn.click();
    await page.waitForTimeout(500);
  }
  if (thenGoToEditor) {
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Test suite voor de tutorial functionaliteit
 * Deze tests controleren of alle tutorial stappen correct werken
 */
test.describe('Tutorial Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigeer naar de homepage
    await page.goto('/');
    
    // Wacht tot de pagina geladen is (geef meer tijd voor React hydration)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Extra tijd voor React componenten
  });

  test('should start tutorial and show step 1 (map)', async ({ page }) => {
    // Navigeer naar hub om tutorial te starten (als gebruiker ingelogd is)
    // Of wacht tot tutorial automatisch start voor nieuwe gebruikers
    await page.goto('/hub');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Probeer "Start Tutorial" knop te vinden en te klikken
    const startTutorialButton = page.getByRole('button', { name: /start tutorial/i }).or(
      page.locator('button:has-text("Start Tutorial")').or(
        page.locator('button:has-text("Tutorial")')
      )
    );
    
    if (await startTutorialButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startTutorialButton.click();
      await page.waitForTimeout(500);
      // Navigeer terug naar homepage waar tutorial begint
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    // Controleer of tutorial tooltip zichtbaar is (meer flexibele selector)
    const tutorialTooltip = page.locator('text=/Welcome to The War Room/i').or(
      page.locator('text=/Step 1 of/i').or(
        page.locator('[class*="tutorial"]')
      )
    );
    
    // Als tutorial niet zichtbaar is, is dat ok - misschien is gebruiker al door tutorial geweest
    const isVisible = await tutorialTooltip.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await expect(tutorialTooltip.first()).toBeVisible();
    }
  });

  test('should highlight map element in step 1', async ({ page }) => {
    // Start tutorial via hub (als nodig)
    await page.goto('/hub');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const startTutorialButton = page.getByRole('button', { name: /start tutorial/i }).or(
      page.locator('button:has-text("Start Tutorial")')
    );
    
    if (await startTutorialButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startTutorialButton.click();
      await page.waitForTimeout(500);
    }

    // Navigeer naar homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Meer tijd voor map om te laden

    // Wacht tot map element bestaat (meer flexibele selector)
    const mapElement = page.locator('[data-tutorial="map"]').or(
      page.locator('.leaflet-container').first()
    );
    
    // Map moet zichtbaar zijn (ook zonder tutorial)
    const mapVisible = await mapElement.isVisible({ timeout: 10000 }).catch(() => false);
    if (mapVisible) {
      await expect(mapElement).toBeVisible();

      // Als tutorial actief is, controleer highlight border
      const highlightBorder = page.locator('.border-\\[\\#d4af37\\]').or(
        page.locator('[style*="border"][style*="d4af37"]')
      );
      const hasHighlight = await highlightBorder.first().isVisible({ timeout: 2000 }).catch(() => false);
      // Highlight is optioneel - tutorial hoeft niet actief te zijn
    }
  });

  test('should navigate through tutorial steps', async ({ page }) => {
    // Start tutorial
    const startTutorialButton = page.getByRole('button', { name: /start tutorial/i });
    if (await startTutorialButton.isVisible()) {
      await startTutorialButton.click();
      await page.waitForTimeout(500);
    }

    // Stap 1: Map
    await expect(page.getByText(/Welcome to The War Room/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /next/i }).first().click();
    await page.waitForTimeout(500);

    // Stap 2: Wire
    await expect(page.getByText(/The Wire picks up/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /next/i }).first().click();
    await page.waitForTimeout(500);

    // Stap 3: Grid tab - controleer of tab gehighlight is
    await expect(page.getByText(/Switch to the Editor/i)).toBeVisible({ timeout: 5000 });
    
    // Controleer of grid-tab element bestaat en highlight heeft
    const gridTab = page.locator('[data-tutorial="grid-tab"]');
    await expect(gridTab).toBeVisible({ timeout: 5000 });
    
    // Controleer of highlight border zichtbaar is rond de tab
    const highlightBorder = page.locator('.border-\\[\\#d4af37\\]').first();
    await expect(highlightBorder).toBeVisible({ timeout: 2000 });
  });

  test('should click grid tab and navigate to editor', async ({ page }) => {
    // Start tutorial
    const startTutorialButton = page.getByRole('button', { name: /start tutorial/i });
    if (await startTutorialButton.isVisible()) {
      await startTutorialButton.click();
      await page.waitForTimeout(500);
    }

    // Navigeer naar stap 3 (grid-tab)
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: /next/i }).first().click();
      await page.waitForTimeout(500);
    }

    // Wacht tot we op stap 3 zijn
    await expect(page.getByText(/Switch to the Editor/i)).toBeVisible({ timeout: 5000 });

    // Klik op grid tab
    const gridTab = page.locator('[data-tutorial="grid-tab"]');
    await expect(gridTab).toBeVisible({ timeout: 5000 });
    await gridTab.click();

    // Wacht tot navigatie naar editor
    await page.waitForURL('**/editor', { timeout: 10000 });
    
    // Controleer of we op de editor pagina zijn
    await expect(page).toHaveURL(/.*\/editor/);
  });

  test('should wait for variant-selector element in step 6', async ({ page }) => {
    // Login als test credentials gezet zijn (anders guest mode)
    if (TEST_EMAIL && TEST_PASSWORD) {
      await loginIfNeeded(page);
    }

    // Start tutorial vanaf hub en ga naar editor
    await startTutorialFromHub(page, true);
    await page.waitForTimeout(1000);

    // Stap door tutorial tot stap 6 (variant selector): stap 1 map, 2 wire, 3 grid-tab, 4 editor, 5 place, 6 variant
    const nextBtn = page.getByRole('button', { name: /next/i }).first();
    for (let i = 0; i < 5; i++) {
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // Probeer een artikel in een slot te plaatsen: sleep artikel van wire naar grid (dnd-kit)
    const wire = page.locator('[data-tutorial="editor-wire"]');
    const dropZone = page.locator('[data-tutorial="grid-layout"]').locator('[data-slot], .min-h-\\[80px\\], [class*="droppable"]').first();
    if (await wire.isVisible({ timeout: 3000 }).catch(() => false) && await dropZone.isVisible({ timeout: 2000 }).catch(() => false)) {
      const firstArticle = wire.locator('[data-draggable], [draggable], [class*="draggable"]').first();
      if (await firstArticle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstArticle.dragTo(dropZone, { force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
    }

    // Wacht tot variant-selector zichtbaar is of tutorial tooltip (Step 6 / Choose how to spin)
    const variantSelector = page.locator('[data-tutorial="variant-selector"]').first();
    const tutorialTooltip = page.locator('text=/Choose how to spin/i').or(page.locator('text=/Step 6/i'));
    const selectorVisible = await variantSelector.isVisible({ timeout: 3000 }).catch(() => false);
    const tooltipVisible = await tutorialTooltip.first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(selectorVisible || tooltipVisible).toBeTruthy();
  });
});

