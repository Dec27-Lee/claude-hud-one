import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const screenshotDir = join(process.cwd(), 'artifacts', 'screenshots')

const screenshot = async (page: import('@playwright/test').Page, name: string): Promise<void> => {
  mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true })
}

const expectNoHorizontalOverflow = async (page: import('@playwright/test').Page, selectors: string[]): Promise<void> => {
  const offenders = await page.evaluate((targetSelectors) => {
    return targetSelectors.flatMap((selector) => {
      const elements = Array.from(document.querySelectorAll(selector))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
      return elements.map((element, index) => ({
        selector: `${selector}[${index}]`,
        overflow: Math.ceil(element.scrollWidth - element.clientWidth),
      }))
    }).filter((item) => item.overflow > 1)
  }, selectors)

  expect(offenders).toEqual([])
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

  test('captures expanded CodeIsland session surface', async ({ page }) => {
    await page.goto('/?view=expanded&page=usage')
    await expect(page.getByLabel(/All monitored Claude Code sessions|所有已监控的 Claude Code 会话/)).toBeVisible()
    await expect(page.getByLabel('Claude Code session card').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Refresh Claude HUD One data|刷新 Claude HUD One 数据/ })).toBeVisible()
    await expect(page.getByText('Codex')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Usage' })).toHaveCount(0)
    await screenshot(page, '02-expanded-session-surface')

    await page.goto('/?view=expanded&page=cost')
    await expect(page.getByLabel(/All monitored Claude Code sessions|所有已监控的 Claude Code 会话/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cost' })).toHaveCount(0)
    await screenshot(page, '03-expanded-session-surface-cost-param')

    await page.goto('/?view=expanded&page=overview')
    await expect(page.getByLabel(/All monitored Claude Code sessions|所有已监控的 Claude Code 会话/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Overview' })).toHaveCount(0)
    await expect(page.getByText('Codex')).toHaveCount(0)
    await screenshot(page, '04-expanded-session-surface-overview-param')
  })

  test('keeps CodeIsland session surface when legacy default page config exists', async ({ page }) => {
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
    await expect(page.getByLabel(/All monitored Claude Code sessions|所有已监控的 Claude Code 会话/)).toBeVisible()
    await expect(page.getByLabel('Claude Code session card').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cost' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Usage' })).toHaveCount(0)
  })

  test('captures settings window route', async ({ page }) => {
    await page.goto('/settings.html')
    await expect(page.getByRole('heading', { name: 'Claude HUD One' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '通用' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '桌面 HUD' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '终端 HUD' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Claude' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '关于' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '界面语言' })).toBeVisible()
    await page.getByRole('tab', { name: '终端 HUD' }).click()
    await expect(page.getByRole('heading', { name: 'Terminal HUD', exact: true })).toBeVisible()
    await expect(page.getByLabel('Terminal HUD preview')).toContainText('claude-hud-one')
    await expect(page.getByRole('heading', { name: '行配置' })).toBeVisible()
    await expect(page.locator('.terminal-palette-item', { hasText: '模型' })).toHaveCount(0)
    await expect(page.getByText('活动行模式')).toBeVisible()
    await expect(page.getByRole('button', { name: '诊断' })).toHaveCount(0)
    await expect(page.locator('.terminal-row-builder__select')).toHaveCount(0)
    const toolItem = page.locator('.terminal-palette-item', { hasText: '用量' }).first()
    const firstDropzone = page.locator('.terminal-row-builder__items--dropzone').first()
    await toolItem.scrollIntoViewIfNeeded()
    const toolBox = await toolItem.boundingBox()
    const dropzoneBox = await firstDropzone.boundingBox()
    if (!toolBox || !dropzoneBox) throw new Error('Missing palette item or dropzone bounding box')
    await page.mouse.move(toolBox.x + toolBox.width / 2, toolBox.y + toolBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(toolBox.x + toolBox.width / 2 + 8, toolBox.y + toolBox.height / 2 + 8, { steps: 4 })
    await page.mouse.move(dropzoneBox.x + dropzoneBox.width / 2, dropzoneBox.y + dropzoneBox.height / 2, { steps: 12 })
    await page.mouse.up()
    await expect(firstDropzone).toContainText('用量')
    await expect(page.locator('.terminal-palette-item', { hasText: '用量' })).toHaveCount(0)
    await page.getByRole('button', { name: '颜色' }).click()
    await expect(page.getByRole('heading', { name: '颜色配置' })).toBeVisible()
    await page.getByRole('button', { name: 'JSON' }).click()
    await expect(page.getByLabel('Terminal HUD JSON editor')).toContainText('custom')
    await page.getByRole('tab', { name: '桌面 HUD' }).click()
    await expect(page.getByRole('heading', { name: '桌面展示' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Desktop HUD', exact: true })).toBeVisible()
    await expect(page.getByText('Desktop HUD parity matrix', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '关于' }).click()
    await expect(page.getByRole('heading', { name: '更新' })).toBeVisible()
    await expect(page.getByText('手动更新', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '打开发布页' })).toBeVisible()
    await expect(page.getByRole('button', { name: '立即刷新' })).toBeVisible()
    await page.getByRole('tab', { name: '通用' }).click()
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('tab', { name: 'About' })).toBeVisible()
    await page.getByRole('tab', { name: 'About' }).click()
    await expect(page.getByRole('heading', { name: 'Updates' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh now' })).toBeVisible()
    await expect(page.getByText('Codex')).toHaveCount(0)
    await screenshot(page, '05-settings')
  })

  test('keeps terminal HUD settings responsive without horizontal overflow', async ({ page }) => {
    for (const width of [960, 900, 820, 760]) {
      await page.setViewportSize({ width, height: 720 })
      await page.goto('/settings.html')
      await page.getByRole('tab', { name: '终端 HUD' }).click()
      await expect(page.getByRole('heading', { name: '行配置' })).toBeVisible()
      await expectNoHorizontalOverflow(page, [
        '.settings-content',
        '.terminal-workspace--components',
        '.terminal-canvas-panel',
        '.terminal-inspector-panel',
      ])
      const layout = await page.evaluate(() => ({
        topbarPosition: getComputedStyle(document.querySelector('.terminal-builder__topbar') as HTMLElement).position,
        paletteOverflow: getComputedStyle(document.querySelector('.terminal-palette-scroll') as HTMLElement).overflowY,
        rowsOverflow: getComputedStyle(document.querySelector('.terminal-row-builder--canvas') as HTMLElement).overflowY,
        inspectorOverflow: getComputedStyle(document.querySelector('.terminal-inspector') as HTMLElement).overflowY,
      }))
      expect(layout).toEqual({
        topbarPosition: 'sticky',
        paletteOverflow: 'auto',
        rowsOverflow: 'auto',
        inspectorOverflow: 'auto',
      })

      await page.getByRole('button', { name: '颜色' }).click()
      await expect(page.getByRole('heading', { name: '颜色配置' })).toBeVisible()
      await expectNoHorizontalOverflow(page, [
        '.settings-content',
        '.terminal-workspace--colors',
        '.terminal-color-panel',
        '.terminal-color-grid--workbench',
      ])
    }
  })
})
