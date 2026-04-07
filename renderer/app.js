// ============================================================
// Constants
// ============================================================
const HABIT_COLORS = [
  { name: 'Sky',      value: '#90C8F0' },
  { name: 'Lavender', value: '#C4A8E8' },
  { name: 'Mint',     value: '#88D8B8' },
  { name: 'Blush',    value: '#F0A8C0' },
  { name: 'Peach',    value: '#F5C4A0' },
  { name: 'Butter',   value: '#F0E090' },
]

// ============================================================
// State
// ============================================================
const today = new Date()
let currentYear  = today.getFullYear()
let currentMonth = today.getMonth() + 1
let monthData    = {}
let selectedDay  = null
let currentTab   = 'calendar'

let habits            = []   // [{ id, name, color, createdAt }]
let habitCompletions  = {}   // { "YYYY-MM-DD": [habitId, ...] }
let selectedHabitColor = HABIT_COLORS[0].value

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  startMatrixRain()
  await Promise.all([
    loadAndRenderCalendar(),
    loadHabits(),
  ])
  bindNavigation()
  bindTaskPanel()
  bindTabs()
  bindHabitModal()
})

// ============================================================
// Calendar
// ============================================================
async function loadAndRenderCalendar() {
  monthData = await window.todoAPI.getMonth(currentYear, currentMonth)
  renderTitlebarLabel()
  renderCalendarGrid()
}

function renderTitlebarLabel() {
  const label = document.getElementById('titlebar-month-label')
  const d = new Date(currentYear, currentMonth - 1, 1)
  label.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function bindNavigation() {
  document.getElementById('btn-prev').addEventListener('click', async () => {
    currentMonth--
    if (currentMonth < 1) { currentMonth = 12; currentYear-- }
    selectedDay = null; closePanelUI()
    await loadAndRenderCalendar()
  })
  document.getElementById('btn-next').addEventListener('click', async () => {
    currentMonth++
    if (currentMonth > 12) { currentMonth = 1; currentYear++ }
    selectedDay = null; closePanelUI()
    await loadAndRenderCalendar()
  })
  document.getElementById('btn-today').addEventListener('click', async () => {
    const t = new Date()
    currentYear = t.getFullYear(); currentMonth = t.getMonth() + 1
    selectedDay = null; closePanelUI()
    await loadAndRenderCalendar()
  })
}

function renderCalendarGrid() {
  const grid = document.getElementById('calendar-grid')
  grid.innerHTML = ''
  const weeks = buildWeekMatrix(currentYear, currentMonth)
  for (const week of weeks) {
    const row = document.createElement('div')
    row.className = 'calendar-row'
    for (const date of week) row.appendChild(buildDayCell(date))
    grid.appendChild(row)
  }
  grid.classList.toggle('panel-open', !!selectedDay)
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

  const dateKey  = toDateKey(date)
  const tasks    = monthData[dateKey] || []
  const isToday  = dateKey === toDateKey(today)
  const isSel    = dateKey === selectedDay

  cell.className = ['day-cell', isToday ? 'day-cell--today' : '', isSel ? 'day-cell--selected' : ''].filter(Boolean).join(' ')
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
    if (selectedDay === dateKey) closeTaskPanel()
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

// ============================================================
// Day Panel — Tasks
// ============================================================
function bindTaskPanel() {
  document.getElementById('task-panel-close').addEventListener('click', closeTaskPanel)
  document.getElementById('task-add-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = document.getElementById('task-input')
    const text  = input.value.trim()
    if (!text || !selectedDay) return
    input.value = ''
    await handleAddTask(selectedDay, text)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedDay) closeTaskPanel()
  })
}

function openTaskPanel(dateKey) {
  selectedDay = dateKey
  const d = new Date(dateKey + 'T12:00:00')
  document.getElementById('task-panel-date').textContent =
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  renderTaskPanelList(dateKey)
  renderHabitDayList(dateKey)
  document.getElementById('task-panel').classList.add('visible')
  document.getElementById('calendar-grid').classList.add('panel-open')
  renderCalendarGrid()
  setTimeout(() => document.getElementById('task-input').focus(), 250)
}

function closeTaskPanel() {
  selectedDay = null
  closePanelUI()
  renderCalendarGrid()
}

function closePanelUI() {
  document.getElementById('task-panel').classList.remove('visible')
  document.getElementById('calendar-grid').classList.remove('panel-open')
}

function renderTaskPanelList(dateKey) {
  const el = document.getElementById('task-list')
  el.innerHTML = ''
  for (const task of (monthData[dateKey] || [])) {
    el.appendChild(buildTaskItem(dateKey, task))
  }
}

function buildTaskItem(dateKey, task) {
  const item = document.createElement('div')
  item.className = task.completed ? 'task-item task-item--done' : 'task-item'

  const cb = document.createElement('button')
  cb.className = 'task-checkbox'
  cb.setAttribute('role', 'checkbox')
  cb.setAttribute('aria-checked', String(task.completed))
  if (task.completed) cb.innerHTML = checkmarkSVG()
  cb.addEventListener('click', () => handleToggleTask(dateKey, task.id))

  const label = document.createElement('span')
  label.className = 'task-label'
  label.textContent = task.text

  const del = document.createElement('button')
  del.className = 'task-delete'
  del.setAttribute('aria-label', 'Delete')
  del.innerHTML = trashSVG()
  del.addEventListener('click', () => handleDeleteTask(dateKey, task.id))

  item.append(cb, label, del)
  return item
}

async function handleAddTask(dateKey, text) {
  const t = await window.todoAPI.addTask(dateKey, text)
  if (!monthData[dateKey]) monthData[dateKey] = []
  monthData[dateKey].push(t)
  renderTaskPanelList(dateKey)
  renderCalendarGrid()
}

async function handleToggleTask(dateKey, taskId) {
  const updated = await window.todoAPI.toggleTask(dateKey, taskId)
  if (updated && monthData[dateKey]) {
    const t = monthData[dateKey].find(t => t.id === taskId)
    if (t) t.completed = updated.completed
  }
  renderTaskPanelList(dateKey)
  renderCalendarGrid()
}

async function handleDeleteTask(dateKey, taskId) {
  await window.todoAPI.deleteTask(dateKey, taskId)
  if (monthData[dateKey]) {
    monthData[dateKey] = monthData[dateKey].filter(t => t.id !== taskId)
    if (monthData[dateKey].length === 0) delete monthData[dateKey]
  }
  renderTaskPanelList(dateKey)
  renderCalendarGrid()
}

// ============================================================
// Day Panel — Habits
// ============================================================
function renderHabitDayList(dateKey) {
  const el = document.getElementById('habit-day-list')
  el.innerHTML = ''
  if (habits.length === 0) return  // empty-state handled by CSS :empty

  for (const habit of habits) {
    const dayCompletions = habitCompletions[dateKey] || []
    const done = dayCompletions.includes(habit.id)
    const item = document.createElement('div')
    item.className = done ? 'habit-day-item habit-day-item--done' : 'habit-day-item'

    const check = document.createElement('div')
    check.className = done ? 'habit-day-check habit-day-check--done' : 'habit-day-check'
    check.style.borderColor = habit.color
    if (done) {
      check.style.backgroundColor = habit.color
      check.innerHTML = checkmarkSVG()
    }

    const lbl = document.createElement('span')
    lbl.className = 'habit-day-label'
    lbl.textContent = habit.name

    item.append(check, lbl)
    item.addEventListener('click', () => handleToggleHabitDay(dateKey, habit.id))
    el.appendChild(item)
  }
}

async function handleToggleHabitDay(dateKey, habitId) {
  const updated = await window.todoAPI.toggleHabitCompletion(dateKey, habitId)
  habitCompletions[dateKey] = updated.length === 0 ? undefined : updated
  if (!habitCompletions[dateKey]) delete habitCompletions[dateKey]
  renderHabitDayList(dateKey)
  // If habits view is rendered, refresh it
  if (currentTab === 'habits') renderHabitsView()
}

// ============================================================
// Tabs
// ============================================================
function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })
}

function switchTab(tab) {
  currentTab = tab
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('tab-btn--active', b.dataset.tab === tab)
  })

  const isCalendar = tab === 'calendar'

  // Views
  document.getElementById('view-calendar').classList.toggle('view-hidden', !isCalendar)
  document.getElementById('view-habits').classList.toggle('view-hidden', isCalendar)

  // Titlebar labels
  document.getElementById('titlebar-month-label').classList.toggle('hidden', !isCalendar)
  document.getElementById('titlebar-habits-label').classList.toggle('hidden', isCalendar)

  // Titlebar right controls
  document.getElementById('calendar-nav').classList.toggle('hidden', !isCalendar)
  document.getElementById('btn-add-habit').classList.toggle('hidden', isCalendar)

  // Close day panel when switching away
  if (!isCalendar && selectedDay) { selectedDay = null; closePanelUI() }

  if (tab === 'habits') renderHabitsView(true)
}

// ============================================================
// Habits — Load & View
// ============================================================
async function loadHabits() {
  ;[habits, habitCompletions] = await Promise.all([
    window.todoAPI.getHabits(),
    window.todoAPI.getAllCompletions(),
  ])
}

async function renderHabitsView(reloadFromStore = false) {
  if (reloadFromStore) {
    habitCompletions = await window.todoAPI.getAllCompletions()
  }
  renderHabitsSummary()
  renderHabitCards()
}

function renderHabitsSummary() {
  const el = document.getElementById('habits-summary')
  const todayKey = toDateKey(today)
  const todayDone = (habitCompletions[todayKey] || []).length
  const total = habits.length

  // Overall completion rate (last 30 days across all habits)
  let totalSlots = 0, totalDone = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const key = toDateKey(d)
    for (const h of habits) {
      if (d.getTime() >= h.createdAt) {
        totalSlots++
        if ((habitCompletions[key] || []).includes(h.id)) totalDone++
      }
    }
  }
  const rate = totalSlots === 0 ? 0 : Math.round((totalDone / totalSlots) * 100)

  el.innerHTML = `
    <div class="summary-stat">
      <span class="summary-stat__value">${total}</span>
      <span class="summary-stat__label">Habits tracked</span>
    </div>
    <div class="summary-stat">
      <span class="summary-stat__value">${todayDone}/${total}</span>
      <span class="summary-stat__label">Done today</span>
    </div>
    <div class="summary-stat">
      <span class="summary-stat__value">${rate}%</span>
      <span class="summary-stat__label">30-day rate</span>
    </div>
  `
}

function renderHabitCards() {
  const list    = document.getElementById('habits-list')
  const emptyEl = document.getElementById('habits-empty')
  list.innerHTML = ''

  if (habits.length === 0) {
    emptyEl.classList.remove('hidden')
    return
  }
  emptyEl.classList.add('hidden')

  for (const habit of habits) {
    list.appendChild(buildHabitCard(habit))
  }
}

function buildHabitCard(habit) {
  const card = document.createElement('div')
  card.className = 'habit-card'

  // ── Header ──
  const header = document.createElement('div')
  header.className = 'habit-card-header'

  const dot = document.createElement('div')
  dot.className = 'habit-color-dot'
  dot.style.backgroundColor = habit.color

  const name = document.createElement('span')
  name.className = 'habit-card-name'
  name.textContent = habit.name

  const del = document.createElement('button')
  del.className = 'habit-card-delete'
  del.setAttribute('aria-label', 'Delete habit')
  del.innerHTML = trashSVG()
  del.addEventListener('click', () => handleDeleteHabit(habit.id))

  header.append(dot, name, del)

  // ── Stats ──
  const currentStreak = computeCurrentStreak(habit)
  const longestStreak = computeLongestStreak(habit)
  const totalDone     = countTotalCompletions(habit)

  // This month completion %
  const now = new Date()
  const daysThisMonth = now.getDate()
  let doneThisMonth = 0
  for (let d = 1; d <= daysThisMonth; d++) {
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const createdDate = new Date(habit.createdAt); createdDate.setHours(0, 0, 0, 0)
    const dayDate = new Date(now.getFullYear(), now.getMonth(), d)
    if (dayDate >= createdDate && (habitCompletions[key] || []).includes(habit.id)) doneThisMonth++
  }
  const eligibleDays = Math.max(1, daysThisMonth - Math.max(0, Math.ceil((new Date(habit.createdAt) - new Date(now.getFullYear(), now.getMonth(), 1)) / 86400000)))
  const monthRate = Math.round((doneThisMonth / eligibleDays) * 100)

  const stats = document.createElement('div')
  stats.className = 'habit-stats'
  stats.innerHTML = `
    <div class="habit-stat">
      <span class="habit-stat__value">${currentStreak}</span>
      <span class="habit-stat__label">Streak</span>
    </div>
    <div class="habit-stat">
      <span class="habit-stat__value">${longestStreak}</span>
      <span class="habit-stat__label">Best</span>
    </div>
    <div class="habit-stat">
      <span class="habit-stat__value">${totalDone}</span>
      <span class="habit-stat__label">Total</span>
    </div>
    <div class="habit-stat">
      <span class="habit-stat__value">${monthRate}%</span>
      <span class="habit-stat__label">This month</span>
    </div>
  `

  // ── 30-day timeline ──
  const timeline = buildHabitTimeline(habit)

  // ── Footer: donut + description ──
  const footer   = document.createElement('div')
  footer.className = 'habit-footer'

  const donut = buildDonut(monthRate, habit.color)

  const text = document.createElement('div')
  text.className = 'habit-donut-text'
  text.innerHTML = `
    <strong>${monthRate}% this month</strong>
    <span>${doneThisMonth} of ${eligibleDays} days completed</span>
    ${currentStreak > 0 ? `<span>🔥 ${currentStreak} day streak</span>` : '<span>Start your streak today!</span>'}
  `

  footer.append(donut, text)
  card.append(header, stats, timeline, footer)
  return card
}

function buildHabitTimeline(habit) {
  const wrap = document.createElement('div')
  wrap.className = 'habit-timeline'

  const createdDay = new Date(habit.createdAt); createdDay.setHours(0, 0, 0, 0)

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key     = toDateKey(d)
    const done    = (habitCompletions[key] || []).includes(habit.id)
    const thisDay = new Date(d); thisDay.setHours(0, 0, 0, 0)
    const beforeCreation = thisDay < createdDay

    const dot = document.createElement('div')
    dot.className = 'timeline-dot'
    dot.title = i === 0 ? `Today (${key})` : key
    if (i === 0) dot.classList.add('timeline-dot--today')

    if (done) {
      dot.classList.add('timeline-dot--done')
      dot.style.backgroundColor = habit.color
    } else if (beforeCreation) {
      dot.classList.add('timeline-dot--inactive')
    }

    wrap.appendChild(dot)
  }
  return wrap
}

function buildDonut(pct, color) {
  const donut = document.createElement('div')
  donut.className = 'habit-donut'
  const clampedPct = Math.max(0, Math.min(100, pct))
  donut.style.background = clampedPct === 0
    ? 'var(--color-bg-surface)'
    : `conic-gradient(${color} ${clampedPct}%, var(--color-bg-surface) ${clampedPct}%)`

  const label = document.createElement('div')
  label.className = 'habit-donut-label'
  label.textContent = `${clampedPct}%`
  donut.appendChild(label)
  return donut
}

// ── Streak calculations ──
function computeCurrentStreak(habit) {
  let streak = 0
  const d = new Date(today)
  // If today not done, start counting from yesterday
  const todayKey = toDateKey(d)
  const todayDone = (habitCompletions[todayKey] || []).includes(habit.id)
  if (!todayDone) d.setDate(d.getDate() - 1)

  const createdDay = new Date(habit.createdAt); createdDay.setHours(0, 0, 0, 0)
  while (true) {
    const cur = new Date(d); cur.setHours(0, 0, 0, 0)
    if (cur < createdDay) break
    const key = toDateKey(d)
    if (!(habitCompletions[key] || []).includes(habit.id)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function computeLongestStreak(habit) {
  const dates = Object.keys(habitCompletions)
    .filter(k => (habitCompletions[k] || []).includes(habit.id))
    .sort()
  if (dates.length === 0) return 0
  let longest = 1, current = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T12:00:00')
    const curr = new Date(dates[i]     + 'T12:00:00')
    if ((curr - prev) / 86400000 === 1) { current++; longest = Math.max(longest, current) }
    else current = 1
  }
  return longest
}

function countTotalCompletions(habit) {
  return Object.values(habitCompletions)
    .filter(ids => ids.includes(habit.id))
    .length
}

// ── Habit CRUD ──
async function handleDeleteHabit(habitId) {
  await window.todoAPI.deleteHabit(habitId)
  habits = habits.filter(h => h.id !== habitId)
  renderHabitsView()
}

// ============================================================
// Add Habit Modal
// ============================================================
function bindHabitModal() {
  // Build color swatches
  const picker = document.getElementById('habit-color-picker')
  for (const c of HABIT_COLORS) {
    const swatch = document.createElement('div')
    swatch.className = 'color-swatch'
    swatch.style.backgroundColor = c.value
    swatch.dataset.color = c.value
    swatch.title = c.name
    if (c.value === selectedHabitColor) swatch.classList.add('color-swatch--selected')
    swatch.addEventListener('click', () => {
      selectedHabitColor = c.value
      picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch--selected'))
      swatch.classList.add('color-swatch--selected')
    })
    picker.appendChild(swatch)
  }

  document.getElementById('btn-add-habit').addEventListener('click', openHabitModal)
  document.getElementById('btn-habit-cancel').addEventListener('click', closeHabitModal)
  document.getElementById('habit-modal-backdrop').addEventListener('click', closeHabitModal)

  document.getElementById('btn-habit-save').addEventListener('click', async () => {
    const name = document.getElementById('habit-name-input').value.trim()
    if (!name) return
    const habit = await window.todoAPI.createHabit(name, selectedHabitColor)
    habits.push(habit)
    closeHabitModal()
    renderHabitsView()
  })

  document.getElementById('habit-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-habit-save').click()
    if (e.key === 'Escape') closeHabitModal()
  })
}

function openHabitModal() {
  document.getElementById('habit-name-input').value = ''
  document.getElementById('habit-modal').classList.remove('hidden')
  setTimeout(() => document.getElementById('habit-name-input').focus(), 50)
}

function closeHabitModal() {
  document.getElementById('habit-modal').classList.add('hidden')
}

// ============================================================
// Utilities
// ============================================================
function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function checkmarkSVG() {
  return `<svg width="10" height="8" viewBox="0 0 10 8" fill="none">
    <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

function trashSVG() {
  return `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M4.5 3.5l.5 6.5h3l.5-6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

// ============================================================
// Matrix Rain
// ============================================================
function startMatrixRain() {
  const canvas = document.getElementById('matrix-canvas')
  const ctx = canvas.getContext('2d')
  const fontSize = 14
  let columns, drops

  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
                '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*<>{}[]/\\'

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const newColumns = Math.floor(canvas.width / fontSize)
    if (!drops) {
      drops = new Array(newColumns).fill(0).map(() => Math.floor(Math.random() * -80))
    } else {
      while (drops.length < newColumns) drops.push(Math.floor(Math.random() * -80))
      drops.length = newColumns
    }
    columns = newColumns
  }
  resize()
  window.addEventListener('resize', resize)

  function draw() {
    // Fade previous frame — creates the glowing trail
    ctx.fillStyle = 'rgba(0, 4, 0, 0.045)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let i = 0; i < columns; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)]
      const x = i * fontSize
      const y = drops[i] * fontSize

      if (y > 0 && y < canvas.height + fontSize) {
        // Bright white-green head of each column
        ctx.fillStyle = '#CCFFCC'
        ctx.font = `bold ${fontSize}px monospace`
        ctx.fillText(char, x, y)
      }

      // Reset column when it goes past the screen
      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = Math.floor(Math.random() * -40)
      }
      drops[i]++
    }
  }

  setInterval(draw, 40)
}
