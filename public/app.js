const authView = document.querySelector('#auth-view');
const appView = document.querySelector('#app-view');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const taskModal = document.querySelector('#task-modal');
const taskForm = document.querySelector('#task-form');
const taskMessage = document.querySelector('#task-message');
const taskList = document.querySelector('#task-list');
let mode = 'login';
let currentUser = null;
let tasks = [];
let classSchedules = [];
let weeklyAttendance = [];
let activeFilter = 'all';
let selectedWeekStart = mondayIso(new Date());
let selectedDay = new Date().getDay() || 7;
let toastTimer;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showAuth() {
  appView.classList.add('hidden');
  authView.classList.remove('hidden');
}

function showApp(user) {
  currentUser = user;
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
  document.querySelector('#profile-name').textContent = user.name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#avatar').textContent = user.name.charAt(0).toUpperCase();
  const hour = new Date().getHours();
  document.querySelector('#welcome-title').textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());
  loadTasks();
  loadClasses();
}

function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === 'register';
  document.querySelector('#name-wrap').classList.toggle('hidden', !registering);
  document.querySelector('#auth-title').textContent = registering ? 'Start with a fresh list.' : 'Make room for what matters.';
  document.querySelector('#auth-subtitle').textContent = registering ? 'Create an account and take the next step at your pace.' : 'A calmer way to capture tasks and keep your momentum.';
  document.querySelector('#auth-submit').innerHTML = registering ? 'Create account <span>→</span>' : 'Log in <span>→</span>';
  document.querySelector('#switch-copy').textContent = registering ? 'Already have an account?' : 'New to Taskflow?';
  document.querySelector('#switch-mode').textContent = registering ? 'Log in' : 'Create an account';
  authForm.elements.password.autocomplete = registering ? 'new-password' : 'current-password';
  authMessage.textContent = '';
}

document.querySelector('#switch-mode').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';
  const body = Object.fromEntries(new FormData(authForm));
  try {
    const data = await api(`/api/${mode}`, { method: 'POST', body });
    authForm.reset();
    showApp(data.user);
  } catch (error) { authMessage.textContent = error.message; }
});

document.querySelector('#logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch (_) { /* local view still returns to login */ }
  currentUser = null;
  tasks = [];
  classSchedules = [];
  weeklyAttendance = [];
  showAuth();
});

async function loadTasks() {
  try {
    const data = await api('/api/tasks');
    tasks = data.tasks;
    renderTasks();
  } catch (error) {
    if (error.message.includes('log in')) showAuth();
    else showToast(error.message);
  }
}

function renderTasks() {
  const pending = tasks.filter(task => task.status === 'pending').length;
  const completed = tasks.length - pending;
  document.querySelector('#total-count').textContent = tasks.length;
  document.querySelector('#pending-count').textContent = pending;
  document.querySelector('#completed-count').textContent = completed;
  document.querySelector('#heading-count').textContent = tasks.length;
  document.querySelector('#nav-count').textContent = tasks.length;
  document.querySelector('#filter-all').textContent = tasks.length;
  document.querySelector('#filter-pending').textContent = pending;
  document.querySelector('#filter-completed').textContent = completed;
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const visible = tasks.filter(task => (activeFilter === 'all' || task.status === activeFilter) && `${task.title} ${task.description || ''}`.toLowerCase().includes(query));
  taskList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const hasAnyTasks = tasks.length > 0;
    empty.innerHTML = `<div class="empty-icon">${hasAnyTasks ? '⌕' : '✦'}</div><h3>${hasAnyTasks ? 'No tasks match this view' : 'Your list starts here'}</h3><p>${hasAnyTasks ? 'Try another filter or search term.' : 'Add one small next step and build some momentum.'}</p>${hasAnyTasks ? '' : '<button class="button primary" data-create>Add your first task <span>→</span></button>'}`;
    taskList.append(empty);
    empty.querySelector('[data-create]')?.addEventListener('click', () => openTaskModal());
    return;
  }
  for (const task of visible) taskList.append(makeTaskCard(task));
}

function makeTaskCard(task) {
  const card = document.createElement('article');
  const done = task.status === 'completed';
  card.className = `task-card${done ? ' is-done' : ''}`;
  const toggle = document.createElement('button');
  toggle.className = `task-toggle${done ? ' is-done' : ''}`;
  toggle.setAttribute('aria-label', done ? 'Mark task in progress' : 'Mark task completed');
  toggle.textContent = done ? '✓' : '';
  toggle.addEventListener('click', () => updateTask(task, { status: done ? 'pending' : 'completed' }));
  const main = document.createElement('div');
  main.className = 'task-main';
  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;
  main.append(title);
  if (task.description) {
    const description = document.createElement('div');
    description.className = 'task-description';
    description.textContent = task.description;
    main.append(description);
  }
  const meta = document.createElement('div');
  meta.className = 'task-meta';
  const status = document.createElement('span');
  status.className = `status-pill${done ? ' done' : ''}`;
  status.textContent = done ? 'COMPLETED' : 'IN PROGRESS';
  meta.append(status);
  if (task.due_date) {
    const due = document.createElement('span');
    const date = new Date(`${task.due_date}T00:00:00`);
    due.textContent = `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)}`;
    meta.append(due);
  }
  main.append(meta);
  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const edit = document.createElement('button');
  edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => openTaskModal(task));
  const remove = document.createElement('button');
  remove.type = 'button'; remove.textContent = 'Delete'; remove.addEventListener('click', () => deleteTask(task.id));
  actions.append(edit, remove);
  card.append(toggle, main, actions);
  return card;
}

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button));
  renderTasks();
}));
document.querySelector('#search').addEventListener('input', renderTasks);

function openTaskModal(task = null) {
  taskForm.reset();
  taskMessage.textContent = '';
  taskForm.elements.taskId.value = task ? task.id : '';
  taskForm.elements.title.value = task ? task.title : '';
  taskForm.elements.description.value = task ? task.description || '' : '';
  taskForm.elements.dueDate.value = task ? task.due_date || '' : '';
  document.querySelector('#modal-title').textContent = task ? 'Edit task' : 'Add a task';
  document.querySelector('#save-task').innerHTML = task ? 'Save changes <span>→</span>' : 'Add task <span>→</span>';
  taskModal.classList.remove('hidden');
  taskForm.elements.title.focus();
}
function closeTaskModal() { taskModal.classList.add('hidden'); }
document.querySelector('#open-create').addEventListener('click', () => openTaskModal());
taskModal.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeTaskModal));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeTaskModal(); });

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  taskMessage.textContent = '';
  const taskId = taskForm.elements.taskId.value;
  const existing = tasks.find(task => String(task.id) === taskId);
  const body = {
    title: taskForm.elements.title.value,
    description: taskForm.elements.description.value,
    dueDate: taskForm.elements.dueDate.value,
    status: existing ? existing.status : 'pending'
  };
  try {
    await api(taskId ? `/api/tasks/${taskId}` : '/api/tasks', { method: taskId ? 'PUT' : 'POST', body });
    closeTaskModal();
    await loadTasks();
    showToast(taskId ? 'Your task is updated.' : 'A new task is on your list.');
  } catch (error) { taskMessage.textContent = error.message; }
});

async function updateTask(task, changes) {
  try {
    await api(`/api/tasks/${task.id}`, { method: 'PUT', body: { title: task.title, description: task.description || '', dueDate: task.due_date || '', status: changes.status || task.status } });
    await loadTasks();
  } catch (error) { showToast(error.message); }
}
async function deleteTask(id) {
  if (!window.confirm('Delete this task?')) return;
  try {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    await loadTasks();
    showToast('Task deleted.');
  } catch (error) { showToast(error.message); }
}

function isoLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayIso(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return isoLocal(monday);
}

function shiftIsoDate(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return isoLocal(date);
}

function displayDate(isoDate, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${isoDate}T00:00:00`));
}

function weekDayLabel(dayNumber) {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayNumber - 1];
}

function formatClassTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute));
}

async function loadClasses() {
  try {
    const [classData, attendanceData] = await Promise.all([
      api('/api/classes'),
      api(`/api/attendance?weekStart=${encodeURIComponent(selectedWeekStart)}`)
    ]);
    classSchedules = classData.classes;
    weeklyAttendance = attendanceData.records;
    renderClasses();
  } catch (error) {
    if (error.message.includes('log in')) showAuth();
    else showToast(error.message);
  }
}

function renderClasses() {
  const weekEnd = shiftIsoDate(selectedWeekStart, 6);
  const currentWeek = selectedWeekStart === mondayIso(new Date());
  const range = `${displayDate(selectedWeekStart)} – ${displayDate(weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  document.querySelector('#class-week-label').textContent = currentWeek ? `This week · ${range}` : range;

  const summary = document.querySelector('#attendance-summary');
  summary.replaceChildren();
  const total = document.createElement('article');
  total.className = 'attendance-total';
  const attendedRecords = weeklyAttendance.filter(record => record.status === 'attended');
  const absentRecords = weeklyAttendance.filter(record => record.status === 'absent');
  total.innerHTML = `<span>This week's results</span><strong>${attendedRecords.length} attended</strong><small>${absentRecords.length} not attended</small>`;
  summary.append(total);
  const subjectNames = new Set([
    ...classSchedules.map(item => item.subject),
    ...weeklyAttendance.map(record => record.subject)
  ]);
  const subjects = [...subjectNames].sort((a, b) => a.localeCompare(b));
  if (!subjects.length) {
    const empty = document.createElement('div');
    empty.className = 'attendance-empty';
    empty.textContent = 'Add subjects to see this week’s attendance counts.';
    summary.append(empty);
  } else {
    for (const subject of subjects) {
      const attendedCount = attendedRecords.filter(record => record.subject === subject).length;
      const absentCount = absentRecords.filter(record => record.subject === subject).length;
      const card = document.createElement('article');
      card.className = 'subject-total';
      const name = document.createElement('span');
      name.textContent = subject;
      const attended = document.createElement('strong');
      attended.textContent = `Attended: ${attendedCount}`;
      const caption = document.createElement('small');
      caption.textContent = `Not attended: ${absentCount}`;
      card.append(name, attended, caption);
      summary.append(card);
    }
  }

  const list = document.querySelector('#class-week-list');
  renderClassDayTabs();
  list.replaceChildren();
  const dayDate = shiftIsoDate(selectedWeekStart, selectedDay - 1);
  const dayClasses = classSchedules.filter(item => item.dayOfWeek === selectedDay).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const group = document.createElement('section');
  group.className = 'day-group';
  const heading = document.createElement('div');
  heading.className = 'day-heading';
  const dayName = document.createElement('strong');
  dayName.textContent = weekDayLabel(selectedDay);
  const date = document.createElement('span');
  date.textContent = displayDate(dayDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  heading.append(dayName, date);
  group.append(heading);

  if (!dayClasses.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state class-empty';
    empty.innerHTML = '<div class="empty-icon">▦</div><h3>No subjects for this day</h3><p>Add a subject using the button above. It will appear on this weekday each week.</p>';
    group.append(empty);
  } else {
    for (const classItem of dayClasses) {
      const record = weeklyAttendance.find(item => String(item.classId) === classItem.id && item.classDate === dayDate);
      const status = record?.status || null;
      const card = document.createElement('article');
      card.className = `class-card${status ? ` ${status}` : ''}`;
      const time = document.createElement('time');
      time.className = 'class-time';
      time.textContent = formatClassTime(classItem.startTime);
      const details = document.createElement('div');
      details.className = 'class-details';
      const subject = document.createElement('strong');
      subject.textContent = classItem.subject;
      const dateLabel = document.createElement('span');
      dateLabel.textContent = `${weekDayLabel(selectedDay)} · ${displayDate(dayDate, { month: 'short', day: 'numeric' })}`;
      details.append(subject, dateLabel);
      const attendanceActions = document.createElement('div');
      attendanceActions.className = 'attendance-actions';
      for (const option of [
        { value: 'attended', label: 'Attended' },
        { value: 'absent', label: 'Not attended' }
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `attendance-button${status === option.value ? ` is-${option.value}` : ''}`;
        button.textContent = status === option.value ? `✓ ${option.label}` : option.label;
        button.setAttribute('aria-pressed', String(status === option.value));
        button.addEventListener('click', () => markAttendance(classItem, dayDate, option.value));
        attendanceActions.append(button);
      }
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'class-edit';
      editButton.textContent = 'Edit';
      editButton.setAttribute('aria-label', `Edit ${classItem.subject} class`);
      editButton.addEventListener('click', () => editClass(classItem));
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'class-remove';
      removeButton.textContent = '×';
      removeButton.title = 'Remove class from timetable';
      removeButton.setAttribute('aria-label', `Remove ${classItem.subject} from timetable`);
      removeButton.addEventListener('click', () => removeClass(classItem));
      card.append(time, details, attendanceActions, editButton, removeButton);
      group.append(card);
    }
  }
  list.append(group);
}

function renderClassDayTabs() {
  const tabs = document.querySelector('#class-day-tabs');
  tabs.replaceChildren();
  for (let day = 1; day <= 7; day += 1) {
    const date = shiftIsoDate(selectedWeekStart, day - 1);
    const count = classSchedules.filter(item => item.dayOfWeek === day).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `class-day-tab${day === selectedDay ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(day === selectedDay));
    button.innerHTML = `<span>${weekDayLabel(day).slice(0, 3)}</span><small>${displayDate(date, { day: 'numeric' })} · ${count}</small>`;
    button.addEventListener('click', () => {
      selectedDay = day;
      renderClasses();
    });
    tabs.append(button);
  }
}

async function markAttendance(classItem, classDate, status) {
  try {
    const result = await api('/api/attendance/mark', {
      method: 'POST',
      body: { classId: classItem.id, classDate, status }
    });
    await loadClasses();
    showToast(result.message);
  } catch (error) { showToast(error.message); }
}

function editClass(classItem) {
  const form = document.querySelector('#class-form');
  form.elements.classId.value = classItem.id;
  form.elements.subject.value = classItem.subject;
  setClassDays([classItem.dayOfWeek]);
  form.elements.startTime.value = classItem.startTime;
  document.querySelector('#class-form-title').textContent = 'Edit this weekly class';
  form.querySelector('.class-save').textContent = 'Save changes';
  document.querySelector('#cancel-class-edit').classList.remove('hidden');
  form.classList.remove('hidden');
  form.elements.subject.focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetClassForm() {
  const form = document.querySelector('#class-form');
  form.reset();
  form.elements.classId.value = '';
  setClassDays([selectedDay]);
  form.classList.add('hidden');
  document.querySelector('#class-form-title').textContent = 'Add a subject to a day';
  form.querySelector('.class-save').textContent = 'Save subject';
  document.querySelector('#cancel-class-edit').classList.add('hidden');
  document.querySelector('#class-message').textContent = '';
}

function setClassDays(days) {
  const selected = new Set(days.map(Number));
  document.querySelectorAll('#class-form input[name="daysOfWeek"]').forEach(input => {
    input.checked = selected.has(Number(input.value));
  });
}

async function removeClass(classItem) {
  if (!window.confirm(`Remove ${classItem.subject} from your weekly timetable? Past attendance totals will stay saved.`)) return;
  try {
    await api(`/api/classes/${classItem.id}`, { method: 'DELETE' });
    await loadClasses();
    showToast('Class removed from your timetable.');
  } catch (error) { showToast(error.message); }
}

document.querySelector('#toggle-class-form').addEventListener('click', () => {
  const form = document.querySelector('#class-form');
  if (!form.classList.contains('hidden')) { resetClassForm(); return; }
  form.reset();
  form.elements.classId.value = '';
  setClassDays([selectedDay]);
  document.querySelector('#class-form-title').textContent = 'Add a subject to a day';
  form.querySelector('.class-save').textContent = 'Save subject';
  document.querySelector('#cancel-class-edit').classList.add('hidden');
  form.classList.remove('hidden');
  document.querySelector('#class-message').textContent = '';
  if (!form.classList.contains('hidden')) form.elements.subject.focus();
});
document.querySelector('#cancel-class-edit').addEventListener('click', resetClassForm);
document.querySelectorAll('#class-form input[name="daysOfWeek"]').forEach(input => {
  input.addEventListener('change', () => {
    const form = document.querySelector('#class-form');
    if (form.elements.classId.value && input.checked) {
      document.querySelectorAll('#class-form input[name="daysOfWeek"]').forEach(other => {
        if (other !== input) other.checked = false;
      });
    }
  });
});

document.querySelector('#class-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#class-message');
  message.textContent = '';
  try {
    const classId = form.elements.classId.value;
    const chosenDays = [...form.querySelectorAll('input[name="daysOfWeek"]:checked')].map(input => Number(input.value));
    if (!chosenDays.length) throw new Error('Select at least one day.');
    const result = await api(classId ? `/api/classes/${classId}` : '/api/classes', {
      method: classId ? 'PUT' : 'POST',
      body: {
        subject: form.elements.subject.value,
        dayOfWeek: classId ? chosenDays[0] : chosenDays,
        startTime: form.elements.startTime.value
      }
    });
    resetClassForm();
    await loadClasses();
    showToast(result.message);
  } catch (error) { message.textContent = error.message; }
});

document.querySelector('#previous-week').addEventListener('click', () => {
  selectedWeekStart = shiftIsoDate(selectedWeekStart, -7);
  loadClasses();
});
document.querySelector('#next-week').addEventListener('click', () => {
  selectedWeekStart = shiftIsoDate(selectedWeekStart, 7);
  loadClasses();
});

api('/api/me').then(data => data.user ? showApp(data.user) : showAuth()).catch(() => showAuth());
