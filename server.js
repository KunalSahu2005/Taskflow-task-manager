require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/task_manager';

if (!process.env.SESSION_SECRET) {
  console.error('Missing SESSION_SECRET. Copy .env.example to .env and set a secret.');
  process.exit(1);
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 255 },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 },
  dueDate: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'task_manager.sid',
  secret: process.env.SESSION_SECRET,
  store: MongoStore.create({ mongoUrl, collectionName: 'sessions', ttl: 60 * 60 * 24 }),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(express.static(path.join(__dirname, 'public')));

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validDate(value) {
  return !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)));
}

function publicTask(task) {
  return { id: task._id, title: task.title, description: task.description, due_date: task.dueDate, status: task.status, created_at: task.createdAt };
}

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  res.json({ user: { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } });
});

app.post('/api/register', async (req, res, next) => {
  try {
    const name = cleanString(req.body.name, 100);
    const email = cleanString(req.body.email, 255).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return res.status(400).json({ error: 'Enter your name, a valid email, and a password of at least 8 characters.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' });
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const email = cleanString(req.body.email, 255).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      req.session.userName = user.name;
      req.session.userEmail = user.email;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ user: { id: user.id, name: user.name, email: user.email } });
      });
    });
  } catch (error) { next(error); }
});

app.post('/api/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('task_manager.sid');
    res.json({ message: 'Logged out.' });
  });
});

app.get('/api/tasks', requireLogin, async (req, res, next) => {
  try {
    const documents = await Task.find({ userId: req.session.userId }).sort({ status: 1, dueDate: 1, createdAt: -1 });
    res.json({ tasks: documents.map(publicTask) });
  } catch (error) { next(error); }
});

app.post('/api/tasks', requireLogin, async (req, res, next) => {
  try {
    const title = cleanString(req.body.title, 200);
    const description = cleanString(req.body.description, 2000);
    const dueDate = cleanString(req.body.dueDate, 10);
    if (!title) return res.status(400).json({ error: 'Task title is required.' });
    if (!validDate(dueDate)) return res.status(400).json({ error: 'Choose a valid due date.' });
    const task = await Task.create({ userId: req.session.userId, title, description, dueDate });
    res.status(201).json({ id: task.id, message: 'Task added.' });
  } catch (error) { next(error); }
});

app.put('/api/tasks/:id', requireLogin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid task.' });
    const title = cleanString(req.body.title, 200);
    const description = cleanString(req.body.description, 2000);
    const dueDate = cleanString(req.body.dueDate, 10);
    const status = req.body.status;
    if (!title || !['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Check the task details and try again.' });
    if (!validDate(dueDate)) return res.status(400).json({ error: 'Choose a valid due date.' });
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { title, description, dueDate, status },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json({ message: 'Task updated.' });
  } catch (error) { next(error); }
});

app.delete('/api/tasks/:id', requireLogin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid task.' });
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json({ message: 'Task deleted.' });
  } catch (error) { next(error); }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Something went wrong. Check the server and database settings.' });
});

async function start() {
  try {
    await mongoose.connect(mongoUrl);
    app.listen(port, () => console.log(`Task Manager running at http://localhost:${port}`));
  } catch (error) {
    console.error('Could not connect to MongoDB. Check that MongoDB is running and MONGODB_URI in .env is correct.', error.message);
    process.exit(1);
  }
}

start();
