# End-to-End Tests met Playwright

Deze tests controleren automatisch of de applicatie correct werkt na aanpassingen.

## Installatie

```bash
cd frontend
npm install
npx playwright install
```

## Tests uitvoeren

### Alle tests
```bash
npm run test:e2e
```

### Tests met UI (interactief)
```bash
npm run test:e2e:ui
```

### Tests in debug mode
```bash
npm run test:e2e:debug
```

### Tests met zichtbare browser
```bash
npm run test:e2e:headed
```

## Test structuur

- `tutorial.spec.ts` - Tests voor de tutorial functionaliteit
- `basic-navigation.spec.ts` - Tests voor basis navigatie

## Nieuwe tests toevoegen

1. Maak een nieuw `.spec.ts` bestand in de `e2e/` folder
2. Gebruik de Playwright API om interacties te simuleren
3. Gebruik `expect()` voor assertions

Voorbeeld:
```typescript
import { test, expect } from '@playwright/test';

test('mijn test', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welkom')).toBeVisible();
});
```

## CI/CD

Tests worden automatisch uitgevoerd bij:
- Push naar `main` of `develop` branch
- Pull requests naar `main` of `develop` branch

Zie `.github/workflows/playwright.yml` voor de configuratie.

## Optionele login voor E2E

Voor tests die ingelogde flows nodig hebben (bijv. tutorial met editor):

```bash
E2E_TEST_EMAIL=your@email.com E2E_TEST_PASSWORD=yourpassword npm run test:e2e
```

Zonder deze variabelen draaien de tests in guest mode waar mogelijk.

## Tips

- Gebruik `page.waitForLoadState('networkidle')` om te wachten tot de pagina volledig geladen is
- Gebruik `page.waitForTimeout()` spaarzaam - probeer te wachten op specifieke elementen
- Gebruik `page.locator()` voor element selectie
- Screenshots worden automatisch gemaakt bij falende tests

