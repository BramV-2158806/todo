const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store({ name: 'todos' })

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#F5F9FF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(() => {
  if (app.dock) {
    app.dock.setIcon(path.join(__dirname, 'renderer', 'icons', 'extension_icon@1024px.png'))
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── Todos ────────────────────────────────────────────────────

ipcMain.handle('todos:getMonth', (event, { year, month }) => {
  const key = `${year}-${String(month).padStart(2, '0')}`
  return store.get(key, {})
})

ipcMain.handle('todos:addTask', (event, { dateKey, text }) => {
  const monthKey = dateKey.slice(0, 7)
  const month = store.get(monthKey, {})
  const day = month[dateKey] || []
  const newTask = { id: crypto.randomUUID(), text, completed: false, createdAt: Date.now() }
  day.push(newTask)
  month[dateKey] = day
  store.set(monthKey, month)
  return newTask
})

ipcMain.handle('todos:toggleTask', (event, { dateKey, taskId }) => {
  const monthKey = dateKey.slice(0, 7)
  const month = store.get(monthKey, {})
  const task = (month[dateKey] || []).find(t => t.id === taskId)
  if (task) task.completed = !task.completed
  store.set(monthKey, month)
  return task
})

ipcMain.handle('todos:deleteTask', (event, { dateKey, taskId }) => {
  const monthKey = dateKey.slice(0, 7)
  const month = store.get(monthKey, {})
  month[dateKey] = (month[dateKey] || []).filter(t => t.id !== taskId)
  if (month[dateKey].length === 0) delete month[dateKey]
  store.set(monthKey, month)
  return true
})

// ── Habits ───────────────────────────────────────────────────

ipcMain.handle('habits:getAll', () => {
  return store.get('habit-definitions', [])
})

ipcMain.handle('habits:create', (event, { name, color }) => {
  const habits = store.get('habit-definitions', [])
  const habit = { id: crypto.randomUUID(), name, color, createdAt: Date.now() }
  habits.push(habit)
  store.set('habit-definitions', habits)
  return habit
})

ipcMain.handle('habits:delete', (event, { habitId }) => {
  const habits = store.get('habit-definitions', [])
  store.set('habit-definitions', habits.filter(h => h.id !== habitId))
  return true
})

ipcMain.handle('habits:getAllCompletions', () => {
  return store.get('habit-completions', {})
})

ipcMain.handle('habits:toggleCompletion', (event, { dateKey, habitId }) => {
  const completions = store.get('habit-completions', {})
  const day = completions[dateKey] ? [...completions[dateKey]] : []
  const idx = day.indexOf(habitId)
  if (idx === -1) day.push(habitId)
  else day.splice(idx, 1)
  if (day.length === 0) delete completions[dateKey]
  else completions[dateKey] = day
  store.set('habit-completions', completions)
  return completions[dateKey] || []
})
