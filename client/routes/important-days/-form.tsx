import type { FormEvent } from 'react'
import { useState } from 'react'

import { isFestivalCode } from '@/shared/important-day/festivals'
import type { FestivalOption, ImportantDayInput, ImportantDayResponse } from '@/shared/schema/important-day'

const inputClass = 'mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700'
const lunarMonths = Array.from({ length: 12 }, (_, index) => index + 1)
const lunarDays = Array.from({ length: 30 }, (_, index) => index + 1)
const solarMonths = Array.from({ length: 12 }, (_, index) => index + 1)

export type Draft =
  | {
      type: 'lunar_birthday'
      title: string
      lunarMonth: string
      lunarDay: string
      isLeapMonth: boolean
      birthYear: string
    }
  | {
      type: 'solar_anniversary'
      title: string
      solarMonth: string
      solarDay: string
      anniversaryYear: string
    }
  | {
      type: 'festival'
      festivalCode: string
    }

export const emptyDraft: Draft = {
  type: 'lunar_birthday',
  title: '',
  lunarMonth: '1',
  lunarDay: '1',
  isLeapMonth: false,
  birthYear: '',
}

const emptySolarDraft: Draft = {
  type: 'solar_anniversary',
  title: '',
  solarMonth: '1',
  solarDay: '1',
  anniversaryYear: '',
}

function solarMonthLength(month: number): number {
  if (month === 2) return 29
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

export function draftFromItem(item: ImportantDayResponse): Draft {
  if (item.type === 'solar_anniversary') {
    return {
      type: 'solar_anniversary',
      title: item.title,
      solarMonth: String(item.solarMonth ?? 1),
      solarDay: String(item.solarDay ?? 1),
      anniversaryYear: item.anniversaryYear === null ? '' : String(item.anniversaryYear),
    }
  }
  if (item.type === 'festival') {
    return { type: 'festival', festivalCode: item.festivalCode ?? '' }
  }
  return {
    type: 'lunar_birthday',
    title: item.title,
    lunarMonth: String(item.lunarMonth ?? 1),
    lunarDay: String(item.lunarDay ?? 1),
    isLeapMonth: item.isLeapMonth ?? false,
    birthYear: item.birthYear === null ? '' : String(item.birthYear),
  }
}

function SolarAnniversaryFields({
  draft,
  onChange,
}: {
  draft: Extract<Draft, { type: 'solar_anniversary' }>
  onChange: (draft: Draft) => void
}) {
  const month = Number(draft.solarMonth)
  const dayCount = solarMonthLength(Number.isInteger(month) ? month : 1)
  const solarDays = Array.from({ length: dayCount }, (_, index) => index + 1)

  return (
    <>
      <label className="block text-sm">
        名称
        <input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          aria-label="名称"
          className={inputClass}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          公历月
          <select
            value={draft.solarMonth}
            onChange={(event) => {
              const solarMonth = event.target.value
              const maxDay = solarMonthLength(Number(solarMonth))
              const solarDay = String(Math.min(Number(draft.solarDay), maxDay))
              onChange({ ...draft, solarMonth, solarDay })
            }}
            className={inputClass}
          >
            {solarMonths.map((item) => (
              <option key={item} value={item}>
                {item} 月
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          公历日
          <select
            value={draft.solarDay}
            onChange={(event) => onChange({ ...draft, solarDay: event.target.value })}
            className={inputClass}
          >
            {solarDays.map((day) => (
              <option key={day} value={day}>
                {day} 日
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        起始年（选填）
        <input
          value={draft.anniversaryYear}
          inputMode="numeric"
          placeholder="例如 2021"
          onChange={(event) => onChange({ ...draft, anniversaryYear: event.target.value })}
          className={inputClass}
        />
      </label>
      <p className="text-sm text-zinc-500">
        每年同一公历月日重复。2 月 29 日在非闰年记为 2 月 28 日。填写起始年后会校验该年确实有这一天。
      </p>
    </>
  )
}

type ImportantDayFormProps = {
  draft: Draft
  festivals: FestivalOption[]
  festivalsPending: boolean
  festivalsError: string | null
  pending: boolean
  formError: string | null
  editing: boolean
  onDraftChange: (draft: Draft) => void
  onSubmit: (input: ImportantDayInput) => void
  onCancel: () => void
  onRetryFestivals: () => void
}

function parseYear(value: string): number | null | 'invalid' {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^[1-9]\d{0,3}$/.test(trimmed)) return 'invalid'
  const year = Number(trimmed)
  if (year < 1 || year > 9999) return 'invalid'
  return year
}

function validateTitle(title: string): string | null {
  if (!title) return '请填写名称'
  if (title.length > 50) return '名称不能超过 50 个字'
  return null
}

function validate(draft: Draft, festivals: FestivalOption[]): string | null {
  if (draft.type === 'festival') {
    if (!festivals.some((item) => item.code === draft.festivalCode)) return '请选择节日'
    return null
  }
  const titleError = validateTitle(draft.title.trim())
  if (titleError) return titleError
  if (draft.type === 'solar_anniversary') {
    const month = Number(draft.solarMonth)
    const day = Number(draft.solarDay)
    if (!Number.isInteger(month) || month < 1 || month > 12) return '请选择公历月'
    const maxDay = solarMonthLength(month)
    if (!Number.isInteger(day) || day < 1 || day > maxDay) return '请选择公历日'
    if (parseYear(draft.anniversaryYear) === 'invalid') return '起始年须为 1 到 9999 的整数，或留空'
    return null
  }
  const month = Number(draft.lunarMonth)
  const day = Number(draft.lunarDay)
  if (!Number.isInteger(month) || month < 1 || month > 12) return '请选择农历月'
  if (!Number.isInteger(day) || day < 1 || day > 30) return '请选择农历日'
  if (parseYear(draft.birthYear) === 'invalid') return '农历出生年份须为 1 到 9999 的整数，或留空'
  return null
}

function toInput(draft: Draft): ImportantDayInput {
  if (draft.type === 'festival') {
    if (!isFestivalCode(draft.festivalCode)) throw new Error('请选择节日')
    return { type: 'festival', festivalCode: draft.festivalCode }
  }
  if (draft.type === 'solar_anniversary') {
    const anniversaryYear = parseYear(draft.anniversaryYear)
    if (anniversaryYear === 'invalid') throw new Error('起始年须为 1 到 9999 的整数，或留空')
    return {
      type: 'solar_anniversary',
      title: draft.title.trim(),
      anniversaryYear,
      solarMonth: Number(draft.solarMonth),
      solarDay: Number(draft.solarDay),
    }
  }
  const birthYear = parseYear(draft.birthYear)
  if (birthYear === 'invalid') throw new Error('农历出生年份须为 1 到 9999 的整数，或留空')
  return {
    type: 'lunar_birthday',
    title: draft.title.trim(),
    birthYear,
    lunarMonth: Number(draft.lunarMonth),
    lunarDay: Number(draft.lunarDay),
    isLeapMonth: draft.isLeapMonth,
  }
}

export function ImportantDayForm({
  draft,
  festivals,
  festivalsPending,
  festivalsError,
  pending,
  formError,
  editing,
  onDraftChange,
  onSubmit,
  onCancel,
  onRetryFestivals,
}: ImportantDayFormProps) {
  const [fieldError, setFieldError] = useState<string | null>(null)
  const selectedFestival =
    draft.type === 'festival' ? festivals.find((item) => item.code === draft.festivalCode) : undefined

  function change(next: Draft) {
    setFieldError(null)
    onDraftChange(next)
  }

  function handleType(type: Draft['type']) {
    if (editing || type === draft.type) return
    if (type === 'lunar_birthday') {
      change(emptyDraft)
      return
    }
    if (type === 'solar_anniversary') {
      change(emptySolarDraft)
      return
    }
    change({ type: 'festival', festivalCode: '' })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const error = validate(draft, festivals)
    setFieldError(error)
    if (error) return
    onSubmit(toInput(draft))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
      <label className="block text-sm">
        类型
        <select
          value={draft.type}
          disabled={editing}
          onChange={(event) => handleType(event.target.value as Draft['type'])}
          className={inputClass}
        >
          <option value="lunar_birthday">农历生日</option>
          <option value="solar_anniversary">公历纪念日</option>
          <option value="festival">节日</option>
        </select>
      </label>
      {draft.type === 'lunar_birthday' ? (
        <>
          <label className="block text-sm">
            名称
            <input
              value={draft.title}
              onChange={(event) => change({ ...draft, title: event.target.value })}
              aria-label="名称"
              className={inputClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              农历月
              <select
                value={draft.lunarMonth}
                onChange={(event) => change({ ...draft, lunarMonth: event.target.value })}
                className={inputClass}
              >
                {lunarMonths.map((month) => (
                  <option key={month} value={month}>
                    {month} 月
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              农历日
              <select
                value={draft.lunarDay}
                onChange={(event) => change({ ...draft, lunarDay: event.target.value })}
                className={inputClass}
              >
                {lunarDays.map((day) => (
                  <option key={day} value={day}>
                    {day} 日
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isLeapMonth}
              onChange={(event) => change({ ...draft, isLeapMonth: event.target.checked })}
            />
            闰月
          </label>
          <label className="block text-sm">
            农历出生年份（选填）
            <input
              value={draft.birthYear}
              inputMode="numeric"
              placeholder="例如 1990"
              onChange={(event) => change({ ...draft, birthYear: event.target.value })}
              className={inputClass}
            />
          </label>
          <p className="text-sm text-zinc-500">
            有对应闰月时用闰月，否则用普通同月；没有三十则用廿九。填写农历出生年后会校验该年确实有这一天，页面不显示年龄。
          </p>
        </>
      ) : null}
      {draft.type === 'solar_anniversary' ? <SolarAnniversaryFields draft={draft} onChange={change} /> : null}
      {draft.type === 'festival' ? (
        <>
          <label className="block text-sm">
            节日
            <select
              value={draft.festivalCode}
              onChange={(event) => change({ type: 'festival', festivalCode: event.target.value })}
              disabled={festivalsPending || festivals.length === 0}
              className={inputClass}
            >
              <option value="">请选择节日</option>
              {festivals.map((festival) => (
                <option key={festival.code} value={festival.code}>
                  {festival.name}
                </option>
              ))}
            </select>
          </label>
          {festivalsPending ? <p className="text-sm text-zinc-500">节日加载中</p> : null}
          {festivalsError ? (
            <p className="text-sm text-red-600">
              {festivalsError}{' '}
              <button type="button" className="underline" onClick={onRetryFestivals}>
                重试
              </button>
            </p>
          ) : null}
          {selectedFestival ? <p className="text-sm text-zinc-500">{selectedFestival.ruleLabel}</p> : null}
        </>
      ) : null}
      {fieldError ? <p className="text-sm text-red-600">{fieldError}</p> : null}
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? '保存中...' : editing ? '保存' : '添加'}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-4 py-2 dark:border-zinc-700"
          >
            取消
          </button>
        ) : null}
      </div>
    </form>
  )
}
