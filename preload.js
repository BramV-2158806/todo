const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('todoAPI', {
  // Todos
  getMonth:     (year, month)        => ipcRenderer.invoke('todos:getMonth',     { year, month }),
  addTask:      (dateKey, text)      => ipcRenderer.invoke('todos:addTask',      { dateKey, text }),
  toggleTask:   (dateKey, taskId)    => ipcRenderer.invoke('todos:toggleTask',   { dateKey, taskId }),
  deleteTask:   (dateKey, taskId)    => ipcRenderer.invoke('todos:deleteTask',   { dateKey, taskId }),

  // Habits
  getHabits:            ()                    => ipcRenderer.invoke('habits:getAll'),
  createHabit:          (name, color)         => ipcRenderer.invoke('habits:create',           { name, color }),
  deleteHabit:          (habitId)             => ipcRenderer.invoke('habits:delete',            { habitId }),
  getAllCompletions:     ()                    => ipcRenderer.invoke('habits:getAllCompletions'),
  toggleHabitCompletion:(dateKey, habitId)    => ipcRenderer.invoke('habits:toggleCompletion',  { dateKey, habitId }),
})
