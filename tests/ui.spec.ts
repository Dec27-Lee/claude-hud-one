import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const screenshotDir = join(process.cwd(), 'artifacts', 'screenshots')

const screenshot = async (page: import('@playwright/test').Page, name: string): Promise<void> => {
  mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true })
}

test.describe('Claude Island Win UI smoke', () => {
  test('captures compact island state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Open Claude Island' })).toBeVisible()
    await screenshot(page, '01-compact')
  })

  test('captures expanded usage, cost and overview island states', async ({ page }) => {
    await page.goto('/?view=expanded&page=usage')
    await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible()
    await expect(page.getByLabel('Current Claude Code session summary')).toBeVisible()
    await screenshot(page, '02-expanded-usage')

    await page.goto('/?view=expanded&page=cost')
    await expect(page.getByRole('heading', { name: 'Cost' })).toBeVisible()
    await screenshot(page, '03-expanded-cost')

    await page.goto('/?view=expanded&page=overview')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await screenshot(page, '04-expanded-overview')
  })

  test('captures settings window route', async ({ page }) => {
    await page.goto('/?window=settings')
    await expect(page.getByRole('heading', { name: 'Claude Island Win' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Updates' })).toBeVisible()
    await expect(page.getByText('About / Diagnostics')).toBeVisible()
    await screenshot(page, '05-settings')
  })
})
