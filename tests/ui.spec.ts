import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const screenshotDir = join(process.cwd(), 'artifacts', 'screenshots')

const screenshot = async (page: import('@playwright/test').Page, name: string): Promise<void> => {
  mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true })
}

test.describe('Claude HUD One UI smoke', () => {
  test('captures compact island state', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Open Claude HUD One' })).toBeVisible()
    await screenshot(page, '01-compact')
  })

  test('hides island when desktop HUD is disabled', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('claude-hud-one:island-state', JSON.stringify({
        settings: { desktopHud: { enabled: false } },
      }))
    })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Open Claude HUD One' })).toHaveCount(0)
  })

  test('captures expanded usage, cost and overview island states', async ({ page }) => {
    await page.goto('/?view=expanded&page=usage')
    await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible()
    await expect(page.getByLabel('Current Claude Code session summary')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh Claude HUD One data' })).toBeVisible()
    await expect(page.getByText('Codex')).toHaveCount(0)
    await screenshot(page, '02-expanded-usage')

    await page.goto('/?view=expanded&page=cost')
    await expect(page.getByRole('heading', { name: 'Cost' })).toBeVisible()
    await screenshot(page, '03-expanded-cost')

    await page.goto('/?view=expanded&page=overview')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(page.getByText('Codex')).toHaveCount(0)
    await screenshot(page, '04-expanded-overview')
  })

  test('applies desktop HUD default page and visible items', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('claude-hud-one:island-state', JSON.stringify({
        settings: {
          desktopHud: {
            defaultPage: 'cost',
            visibleItems: { usage: false, cost: true },
          },
        },
      }))
    })
    await page.goto('/?view=expanded')
    await expect(page.getByRole('heading', { name: 'Cost' })).toBeVisible()
    await expect(page.getByText('git main*')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Usage' })).toHaveCount(0)
  })

  test('captures settings window route', async ({ page }) => {
    await page.goto('/settings.html')
    await expect(page.getByRole('heading', { name: 'Claude HUD One' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '通用' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '终端 HUD' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '桌面 HUD' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '更新' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '界面语言' })).toBeVisible()
    await page.getByRole('tab', { name: '终端 HUD' }).click()
    await expect(page.getByRole('heading', { name: 'Terminal HUD', exact: true })).toBeVisible()
    await expect(page.getByText('Terminal HUD parity matrix', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Terminal HUD preview')).toContainText('claude-hud-one')
    await expect(page.getByRole('heading', { name: 'Rows builder' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Color Workbench' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '诊断' })).toBeVisible()
    await expect(page.getByLabel('Terminal HUD JSON editor')).toContainText('hud-plus-default')
    await page.getByRole('tab', { name: '桌面 HUD' }).click()
    await expect(page.getByRole('heading', { name: 'Desktop HUD', exact: true })).toBeVisible()
    await expect(page.getByText('Desktop HUD parity matrix', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '更新' }).click()
    await expect(page.getByRole('heading', { name: '更新' })).toBeVisible()
    await expect(page.getByText('手动更新', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '打开发布页' })).toBeVisible()
    await page.getByRole('tab', { name: '关于' }).click()
    await expect(page.getByRole('button', { name: '立即刷新' })).toBeVisible()
    await page.getByRole('tab', { name: '通用' }).click()
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('tab', { name: 'Updates' })).toBeVisible()
    await page.getByRole('tab', { name: 'Updates' }).click()
    await expect(page.getByRole('heading', { name: 'Updates' })).toBeVisible()
    await page.getByRole('tab', { name: 'About' }).click()
    await expect(page.getByRole('button', { name: 'Refresh now' })).toBeVisible()
    await expect(page.getByText('Codex')).toHaveCount(0)
    await screenshot(page, '05-settings')
  })
})
