const today = new Date()

export const state = {
  currentYear: today.getFullYear(),
  currentMonth: today.getMonth() + 1,
  selectedDay: null,
  monthData: {},
  overdueData: {},
  today
}

export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
