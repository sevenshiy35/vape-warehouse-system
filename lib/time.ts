export const EASTERN_TIME_ZONE = 'America/New_York'

const easternDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const easternPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

type DateParts = {
  year: number
  month: number
  day: number
}

type DateTimeParts = DateParts & {
  hour: number
  minute: number
  second: number
}

export function formatEasternTime(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return `${easternDateTimeFormatter.format(date)} ET`
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) return null

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }

  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))

  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() !== parts.month - 1 ||
    check.getUTCDate() !== parts.day
  ) {
    return null
  }

  return parts
}

function addDays(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function getEasternParts(date: Date): DateTimeParts {
  const values = Object.fromEntries(
    easternPartsFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  )

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function easternLocalTimeToUtc(parts: DateTimeParts) {
  const desiredUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  let adjustedUtc = desiredUtc

  for (let i = 0; i < 3; i += 1) {
    const actual = getEasternParts(new Date(adjustedUtc))
    const actualUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    )

    adjustedUtc += desiredUtc - actualUtc
  }

  return new Date(adjustedUtc)
}

export function getEasternDateRangeUtc(dateFrom: string, dateTo: string) {
  const fromParts = parseDateInput(dateFrom)
  const toParts = parseDateInput(dateTo)

  return {
    fromIso: fromParts
      ? easternLocalTimeToUtc({
          ...fromParts,
          hour: 0,
          minute: 0,
          second: 0,
        }).toISOString()
      : null,
    toExclusiveIso: toParts
      ? easternLocalTimeToUtc({
          ...addDays(toParts, 1),
          hour: 0,
          minute: 0,
          second: 0,
        }).toISOString()
      : null,
  }
}
