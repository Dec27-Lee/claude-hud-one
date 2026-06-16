import { expect, test, type Page } from '@playwright/test'

const stabilizeVisualPage = async (page: Page): Promise<void> => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  })
  await page.evaluate(() => document.fonts?.ready)
}

const resetState = async (page: Page): Promise<void> => {
  await page.addInitScript(() => window.localStorage.clear())
}

test.describe('Claude HUD One visual parity', () => {
  test('compact CodeIsland capsule matches baseline', async ({ page }) => {
    await resetState(page)
    await page.goto('/')
    await stabilizeVisualPage(page)
    const hud = page.locator('.desktop-hud').first()
    await expect(hud).toBeVisible()
    await expect(hud).toHaveScreenshot('compact-codeisland-capsule.png')
  })

  test('expanded CodeIsland session surface matches baseline', async ({ page }) => {
    await resetState(page)
    await page.goto('/?view=expanded&page=usage')
    await stabilizeVisualPage(page)
    const panel = page.locator('.desktop-hud-panel').first()
    await expect(page.getByLabel(/All monitored Claude Code sessions|所有已监控的 Claude Code 会话/)).toBeVisible()
    await expect(panel).toHaveScreenshot('expanded-session-surface.png')
  })

  test('desktop HUD settings panel matches baseline', async ({ page }) => {
    await resetState(page)
    await page.goto('/settings.html')
    await stabilizeVisualPage(page)
    await page.getByRole('tab', { name: '桌面 HUD' }).click()
    await expect(page.getByRole('heading', { name: '桌面展示' })).toBeVisible()
    await expect(page.locator('.settings-content')).toHaveScreenshot('settings-desktop-hud.png')
  })

  test('terminal HUD settings panel matches baseline', async ({ page }) => {
    await resetState(page)
    await page.goto('/settings.html')
    await stabilizeVisualPage(page)
    await page.getByRole('tab', { name: '终端 HUD' }).click()
    await expect(page.getByRole('heading', { name: 'Terminal HUD', exact: true })).toBeVisible()
    await expect(page.locator('.settings-content')).toHaveScreenshot('settings-terminal-hud.png')
  })
})
