import { expect, test } from '@playwright/test';

const routes = ['/', '/benefits', '/apply'];

test.describe('production performance budgets', () => {
  for (const route of routes) {
    test(`${route} stays within the launch performance budget`, async ({ page }) => {
      await page.addInitScript(() => {
        const metrics = { cls: 0, lcp: 0, longestTask: 0 };
        Object.defineProperty(window, '__safecardPerformance', { value: metrics, writable: false });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) metrics.lcp = Math.max(metrics.lcp, entry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) metrics.longestTask = Math.max(metrics.longestTask, entry.duration);
        }).observe({ type: 'longtask', buffered: true });
      });
      // Public pages intentionally make resilient background requests (for
      // example approved storyboard content). `networkidle` is therefore not a
      // valid readiness signal and can hang on a slow or unavailable backend.
      await page.goto(route, { waitUntil: 'load' });
      await page.locator('main').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const observed = (window as unknown as { __safecardPerformance: { cls: number; lcp: number; longestTask: number } }).__safecardPerformance;
        return {
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          jsTransferBytes: resources.filter((item) => item.initiatorType === 'script').reduce((sum, item) => sum + item.transferSize, 0),
          resourceCount: resources.length,
          ...observed,
        };
      });
      expect(metrics.domContentLoadedMs).toBeLessThan(5_000);
      expect(metrics.lcp).toBeLessThan(4_000);
      expect(metrics.cls).toBeLessThanOrEqual(0.1);
      expect(metrics.longestTask).toBeLessThan(500);
      expect(metrics.jsTransferBytes).toBeLessThan(2_500_000);
      expect(metrics.resourceCount).toBeLessThan(80);
    });
  }
});
