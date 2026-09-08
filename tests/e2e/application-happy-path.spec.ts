import { test, expect } from '@playwright/test';

test.describe('SafeCard synthetic application happy path', () => {
  test('completes the consent-first walkthrough without creating a real application', async ({ page }) => {
    await page.goto('/apply');

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('Synthetic walkthrough')).toBeVisible();

    await page.getByRole('button', { name: /Check my understanding/i }).click();
    await page.getByRole('radio', { name: '₱1,200 / year' }).check();
    await page.getByRole('radio', { name: 'Philippine Red Cross' }).check();
    await page.getByRole('radio', { name: 'The recipient' }).check();
    await page.getByRole('radio', { name: 'Hotline 143' }).check();
    await page.getByRole('button', { name: 'Continue →' }).click();

    await page.getByRole('button', { name: /Accept \/ Mag-apply/i }).click();
    await expect(page.getByRole('heading', { name: 'Consent before personal data.' })).toBeVisible();

    await page.getByRole('checkbox').nth(0).check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('checkbox').nth(2).check();
    await page.getByRole('button', { name: /Continue privately/i }).click();

    await expect(page.getByRole('heading', { name: 'Synthetic form demonstration' })).toBeVisible();
    await page.getByRole('button', { name: 'Review →' }).click();
    await expect(page.getByRole('heading', { name: 'Review before submitting.' })).toBeVisible();

    await page.getByRole('button', { name: 'Complete demo →' }).click();
    await expect(page.getByRole('heading', { name: 'No real application was created.' })).toBeVisible();
    await expect(page.getByText(/^DEMO-\d{4}-[A-Z0-9]{8}$/)).toBeVisible();
  });

  test('shows Filipino or natural Taglish copy through the first decision steps', async ({ page }) => {
    await page.goto('/apply');

    await expect(page.getByText('Synthetic na walkthrough')).toBeVisible();
    await expect(page.getByText(/Huwag maglagay ng totoong personal na impormasyon/i)).toBeVisible();
    await page.getByRole('button', { name: /Suriin ang pagkaunawa/i }).click();
    await expect(page.getByRole('heading', { name: 'Apat na bagay na dapat malinaw.' })).toBeVisible();
    await expect(page.getByText('Magkano ang working annual fee?')).toBeVisible();
    await page.getByRole('radio', { name: '₱1,200 / year' }).check();
    await page.getByRole('radio', { name: 'Philippine Red Cross' }).check();
    await page.getByRole('radio', { name: 'Ang recipient' }).check();
    await page.getByRole('radio', { name: 'Hotline 143' }).check();
    await page.getByRole('button', { name: 'Magpatuloy →' }).click();
    await expect(page.getByRole('heading', { name: 'Ang iyong sagot ay sa iyo lamang.' })).toBeVisible();
    await expect(page.getByText('Hindi makakatanggap ng notification ang sponsor')).toBeVisible();
  });
});
