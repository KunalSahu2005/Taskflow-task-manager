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
let activeFilter = 'all';
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

api('/api/me').then(data => data.user ? showApp(data.user) : showAuth()).catch(() => showAuth());
