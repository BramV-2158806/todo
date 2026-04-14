import { state, toDateKey } from './state.js'
import { openTaskPanel, closeTaskPanel, closePanelUI } from './app.js'

// ============================================================
// Calendar
// ============================================================
export async function loadAndRenderCalendar() {
  state.monthData = await window.todoAPI.getMonth(state.currentYear, state.currentMonth)
  renderTitlebarLabel()
  renderCalendarGrid()
}

function renderTitlebarLabel() {
  const label = document.getElementById('titlebar-month-label')
  const d = new Date(state.currentYear, state.currentMonth - 1, 1)
  label.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function bindNavigation() {
  document.getElementById('btn-prev').addEventListener('click', async () => {
    state.currentMonth--
    if (state.currentMonth < 1) { state.currentMonth = 12; state.currentYear-- }
    state.selectedDay = null; closePanelUI()
    await loadAndRenderCalendar()
  })
  document.getElementById('btn-next').addEventListener('click', async () => {
    state.currentMonth++
    if (state.currentMonth > 12) { state.currentMonth = 1; state.currentYear++ }
    state.selectedDay = null; closePanelUI()
    await loadAndRenderCalendar()
  })
  document.getElementById('btn-today').addEventListener('click', async () => {
    const t = new Date()
    state.currentYear = t.getFullYear(); state.currentMonth = t.getMonth() + 1
    state.selectedDay = null; closePanelUI()
    await loadAndRenderCalendar()
  })
}

export function renderCalendarGrid() {
  const grid = document.getElementById('calendar-grid')
  grid.innerHTML = ''
  const weeks = buildWeekMatrix(state.currentYear, state.currentMonth)
  for (const week of weeks) {
    const row = document.createElement('div')
    row.className = 'calendar-row'
    for (const date of week) row.appendChild(buildDayCell(date))
    grid.appendChild(row)
  }
  grid.classList.toggle('panel-open', !!state.selectedDay)
}

function buildWeekMatrix(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay  = new Date(year, month, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const weeks = []; let week = []
  for (let i = 0; i < startOffset; i++) week.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month - 1, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }
  return weeks
}

function buildDayCell(date) {
  const cell = document.createElement('div')
  if (!date) { cell.className = 'day-cell day-cell--empty'; return cell }

  const dateKey    = toDateKey(date)
  const tasks      = state.monthData[dateKey] || []
  const todayKey   = toDateKey(state.today)
  const isToday    = dateKey === todayKey
  const isSel      = dateKey === state.selectedDay
  const isPast     = dateKey < todayKey
  const hasOverdue = isPast && tasks.some(t => !t.completed)

  cell.className = ['day-cell', isToday ? 'day-cell--today' : '', isSel ? 'day-cell--selected' : '', hasOverdue ? 'day-cell--has-overdue' : ''].filter(Boolean).join(' ')
  cell.dataset.dateKey = dateKey

  // Day number
  const num = document.createElement('div')
  num.className = 'day-number'
  num.textContent = date.getDate()
  cell.appendChild(num)

  // Progress bar (tasks only)
  if (tasks.length > 0) cell.appendChild(buildProgressBar(tasks))

  // Task pills
  if (tasks.length > 0) {
    const ul = document.createElement('ul')
    ul.className = 'day-task-list'
    for (const t of tasks) {
      const li = document.createElement('li')
      li.className = t.completed ? 'day-task day-task--done' : 'day-task'
      li.textContent = t.text
      ul.appendChild(li)
    }
    cell.appendChild(ul)
  }

  cell.addEventListener('click', () => {
    if (state.selectedDay === dateKey) closeTaskPanel()
    else openTaskPanel(dateKey)
  })
  return cell
}

function buildProgressBar(tasks) {
  const total = tasks.length
  const done  = tasks.filter(t => t.completed).length
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100)
  const wrap  = document.createElement('div')
  wrap.className = 'progress-bar'
  wrap.setAttribute('role', 'progressbar')
  wrap.setAttribute('aria-valuenow', pct)
  wrap.setAttribute('aria-valuemin', 0)
  wrap.setAttribute('aria-valuemax', 100)
  const fill = document.createElement('div')
  fill.className = 'progress-bar__fill'
  fill.style.width = `${pct}%`
  wrap.appendChild(fill)
  return wrap
}
