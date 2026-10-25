import type { Page } from '@playwright/test'

import { e2eClockOrigin } from '../clock-port'

export async function setServerClock(epochMs: number | null): Promise<void> {
  const response = await fetch(`${e2eClockOrigin}/clock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ epochMs }),
  })
  if (!response.ok) {
    throw new Error(`设置测试时钟失败：${response.status} ${await response.text()}`)
  }
}

export function beijingEpoch(isoDate: string, time = '12:00:00'): number {
  const epoch = Date.parse(`${isoDate}T${time}+08:00`)
  if (Number.isNaN(epoch)) throw new Error(`无法解析北京时间 ${isoDate} ${time}`)
  return epoch
}

export async function installBrowserClock(page: Page, epochMs: number): Promise<void> {
  await page.clock.install({ time: epochMs })
}

// 公历日差。只用来把已经核对过的两个公历日期换成“剩余天数”，不计算农历。
export function daysBetween(earlierIsoDate: string, laterIsoDate: string): number {
  const earlier = Date.parse(`${earlierIsoDate}T00:00:00Z`)
  const later = Date.parse(`${laterIsoDate}T00:00:00Z`)
  if (Number.isNaN(earlier) || Number.isNaN(later)) {
    throw new Error(`无法计算天数 ${earlierIsoDate} ${laterIsoDate}`)
  }
  return Math.round((later - earlier) / 86_400_000)
}
