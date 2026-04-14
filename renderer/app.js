import { loadAndRenderCalendar, renderCalendarGrid, bindNavigation } from './calendar.js'
import { state, toDateKey } from './state.js'

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
let currentTab   = 'calendar'

let habits            = []   // [{ id, name, color, createdAt }]
let habitCompletions  = {}   // { "YYYY-MM-DD": [habitId, ...] }
let selectedHabitColor = HABIT_COLORS[0].value
let overdueLoaded = false

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
  bindDayLaunchModal()
  await checkDayLaunch()
})

// ============================================================
// Day Panel — Tasks
// ============================================================
function bindTaskPanel() {
  document.getElementById('task-panel-close').addEventListener('click', closeTaskPanel)
  document.getElementById('task-add-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = document.getElementById('task-input')
    const text  = input.value.trim()
    if (!text || !state.selectedDay) return
    input.value = ''
    await handleAddTask(state.selectedDay, text)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selectedDay) closeTaskPanel()
  })
}

async function ensureOverdueData() {
  if (overdueLoaded) return
  const todayYear = state.today.getFullYear()
  const todayMonth = state.today.getMonth() + 1
  for (let i = 1; i <= 3; i++) {
    let y = todayYear
    let m = todayMonth - i
    while (m < 1) { m += 12; y-- }
    const data = await window.todoAPI.getMonth(y, m)
    Object.assign(state.overdueData, data)
  }
  overdueLoaded = true
}

export async function openTaskPanel(dateKey) {
  state.selectedDay = dateKey
  const d = new Date(dateKey + 'T12:00:00')
  document.getElementById('task-panel-date').textContent =
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const todayKey = toDateKey(state.today)
  if (dateKey === todayKey) {
    await ensureOverdueData()
    renderOverdueTasks()
  } else {
    document.getElementById('overdue-section').classList.add('hidden')
  }

  renderTaskPanelList(dateKey)
  renderHabitDayList(dateKey)
  document.getElementById('task-panel').classList.add('visible')
  document.getElementById('calendar-grid').classList.add('panel-open')
  renderCalendarGrid()
  setTimeout(() => document.getElementById('task-input').focus(), 250)
}

export function closeTaskPanel() {
  state.selectedDay = null
  closePanelUI()
  renderCalendarGrid()
}

export function closePanelUI() {
  document.getElementById('task-panel').classList.remove('visible')
  document.getElementById('calendar-grid').classList.remove('panel-open')
}

function renderTaskPanelList(dateKey) {
  const el = document.getElementById('task-list')
  el.innerHTML = ''
  for (const task of (state.monthData[dateKey] || [])) {
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
  if (!state.monthData[dateKey]) state.monthData[dateKey] = []
  state.monthData[dateKey].push(t)
  renderTaskPanelList(dateKey)
  renderCalendarGrid()
}

async function handleToggleTask(dateKey, taskId) {
  const updated = await window.todoAPI.toggleTask(dateKey, taskId)
  if (updated && state.monthData[dateKey]) {
    const t = state.monthData[dateKey].find(t => t.id === taskId)
    if (t) t.completed = updated.completed
  }
  renderTaskPanelList(dateKey)
  renderCalendarGrid()
}

async function handleDeleteTask(dateKey, taskId) {
  await window.todoAPI.deleteTask(dateKey, taskId)
  if (state.monthData[dateKey]) {
    state.monthData[dateKey] = state.monthData[dateKey].filter(t => t.id !== taskId)
    if (state.monthData[dateKey].length === 0) delete state.monthData[dateKey]
  }
  renderTaskPanelList(dateKey)
  renderCalendarGrid()
}

// ============================================================
// Day Panel — Carry Over (past incomplete tasks)
// ============================================================
function renderOverdueTasks() {
  const todayKey = toDateKey(state.today)
  const overdueSection = document.getElementById('overdue-section')
  const listEl = document.getElementById('overdue-list')
  listEl.innerHTML = ''

  const overdueTasks = []
  for (const [dateKey, tasks] of Object.entries(state.monthData)) {
    if (dateKey >= todayKey) continue
    for (const task of tasks) {
      if (!task.completed) overdueTasks.push({ dateKey, task })
    }
  }
  for (const [dateKey, tasks] of Object.entries(state.overdueData)) {
    if (dateKey >= todayKey) continue
    for (const task of tasks) {
      if (!task.completed) overdueTasks.push({ dateKey, task })
    }
  }

  overdueTasks.sort((a, b) => b.dateKey.localeCompare(a.dateKey))

  if (overdueTasks.length === 0) {
    overdueSection.classList.add('hidden')
    return
  }
  overdueSection.classList.remove('hidden')

  let lastDate = null
  for (const { dateKey, task } of overdueTasks) {
    if (dateKey !== lastDate) {
      const dateLabel = document.createElement('div')
      dateLabel.className = 'overdue-date-label'
      const d = new Date(dateKey + 'T12:00:00')
      dateLabel.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      listEl.appendChild(dateLabel)
      lastDate = dateKey
    }
    listEl.appendChild(buildOverdueTaskItem(dateKey, task))
  }
}

function buildOverdueTaskItem(dateKey, task) {
  const item = document.createElement('div')
  item.className = task.completed ? 'task-item task-item--done' : 'task-item'

  const cb = document.createElement('button')
  cb.className = 'task-checkbox'
  cb.setAttribute('role', 'checkbox')
  cb.setAttribute('aria-checked', String(task.completed))
  if (task.completed) cb.innerHTML = checkmarkSVG()
  cb.addEventListener('click', () => handleToggleOverdueTask(dateKey, task.id))

  const label = document.createElement('span')
  label.className = 'task-label'
  label.textContent = task.text

  const del = document.createElement('button')
  del.className = 'task-delete'
  del.setAttribute('aria-label', 'Delete')
  del.innerHTML = trashSVG()
  del.addEventListener('click', () => handleDeleteOverdueTask(dateKey, task.id))

  item.append(cb, label, del)
  return item
}

async function handleToggleOverdueTask(dateKey, taskId) {
  const updated = await window.todoAPI.toggleTask(dateKey, taskId)
  const source = state.monthData[dateKey] ? state.monthData : state.overdueData
  if (updated && source[dateKey]) {
    const t = source[dateKey].find(t => t.id === taskId)
    if (t) t.completed = updated.completed
  }
  renderOverdueTasks()
  renderCalendarGrid()
}

async function handleDeleteOverdueTask(dateKey, taskId) {
  await window.todoAPI.deleteTask(dateKey, taskId)
  const source = state.monthData[dateKey] ? state.monthData : state.overdueData
  if (source[dateKey]) {
    source[dateKey] = source[dateKey].filter(t => t.id !== taskId)
    if (source[dateKey].length === 0) delete source[dateKey]
  }
  renderOverdueTasks()
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
  if (!isCalendar && state.selectedDay) { state.selectedDay = null; closePanelUI() }

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
  const todayKey = toDateKey(state.today)
  const todayDone = (habitCompletions[todayKey] || []).length
  const total = habits.length

  // Overall completion rate (last 30 days across all habits)
  let totalSlots = 0, totalDone = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(state.today); d.setDate(d.getDate() - i)
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

  // All-time completion % (since habit was created)
  const createdDay = new Date(habit.createdAt); createdDay.setHours(0, 0, 0, 0)
  const todayDay   = new Date(state.today);     todayDay.setHours(0, 0, 0, 0)
  const totalEligibleDays = Math.max(1, Math.floor((todayDay - createdDay) / 86400000) + 1)
  const globalRate = Math.round((totalDone / totalEligibleDays) * 100)

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

  const donut = buildDonut(globalRate, habit.color)

  const text = document.createElement('div')
  text.className = 'habit-donut-text'
  text.innerHTML = `
    <strong>${globalRate}% overall</strong>
    <span>${totalDone} of ${totalEligibleDays} days completed</span>
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
    const d = new Date(state.today)
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
  const d = new Date(state.today)
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
// Day Launch Popup
// ============================================================
async function checkDayLaunch() {
  const todayKey = toDateKey(state.today)
  const lastLaunch = await window.todoAPI.getLastLaunchDate()
  await window.todoAPI.setLastLaunchDate(todayKey)

  // First ever launch, or already launched today — skip
  if (!lastLaunch || lastLaunch === todayKey) return
  if (habits.length === 0) return

  const yesterday = new Date(state.today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = toDateKey(yesterday)

  const yesterdayDone = habitCompletions[yesterdayKey] || []
  const missedHabits = habits.filter(h => !yesterdayDone.includes(h.id))
  if (missedHabits.length === 0) return

  showDayLaunchModal(yesterdayKey, missedHabits)
}

function showDayLaunchModal(yesterdayKey, missedHabits) {
  const count = missedHabits.length
  document.getElementById('day-launch-subtitle').textContent =
    `${count} habit${count === 1 ? '' : 's'} weren't checked yesterday. Still count them?`

  const listEl = document.getElementById('day-launch-habits')
  listEl.innerHTML = ''

  for (const habit of missedHabits) {
    const item = document.createElement('div')
    item.className = 'dl-habit-item'

    const check = document.createElement('div')
    check.className = 'dl-habit-check'
    check.style.borderColor = habit.color

    const lbl = document.createElement('span')
    lbl.className = 'dl-habit-label'
    lbl.textContent = habit.name

    item.append(check, lbl)
    item.addEventListener('click', async () => {
      const isDone = item.classList.contains('dl-habit-item--done')
      const updated = await window.todoAPI.toggleHabitCompletion(yesterdayKey, habit.id)
      habitCompletions[yesterdayKey] = updated.length === 0 ? undefined : updated
      if (!habitCompletions[yesterdayKey]) delete habitCompletions[yesterdayKey]

      if (isDone) {
        item.classList.remove('dl-habit-item--done')
        check.style.backgroundColor = ''
        check.innerHTML = ''
      } else {
        item.classList.add('dl-habit-item--done')
        check.style.backgroundColor = habit.color
        check.innerHTML = checkmarkSVG()
      }
    })

    listEl.appendChild(item)
  }

  document.getElementById('day-launch-modal').classList.remove('hidden')
}

function closeDayLaunchModal() {
  document.getElementById('day-launch-modal').classList.add('hidden')
}

function bindDayLaunchModal() {
  document.getElementById('btn-day-launch-skip').addEventListener('click', closeDayLaunchModal)
  document.getElementById('day-launch-backdrop').addEventListener('click', closeDayLaunchModal)
  document.getElementById('btn-day-launch-open').addEventListener('click', async () => {
    closeDayLaunchModal()
    const yesterday = new Date(state.today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = toDateKey(yesterday)
    const yYear = yesterday.getFullYear()
    const yMonth = yesterday.getMonth() + 1
    if (yYear !== state.currentYear || yMonth !== state.currentMonth) {
      state.currentYear = yYear
      state.currentMonth = yMonth
      await loadAndRenderCalendar()
    }
    openTaskPanel(yesterdayKey)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('day-launch-modal').classList.contains('hidden')) {
      closeDayLaunchModal()
    }
  })
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
