# ✅ Taskflow – Full Stack Task Manager

Taskflow is a full-stack web application for organizing personal tasks and tracking weekly class attendance. Create an account, manage your to-do list, build a timetable, and review attended and missed classes by subject.

This project was created for learning and internship demonstration. It uses MongoDB for data storage and server-side sessions for login; it does not use JWT or MySQL.

---

## ✨ Features

- 🔐 Register and log in with a hashed password
- 📝 Create, edit, complete, search, filter, and delete tasks
- 📅 Add a class subject and time to one or more weekdays at once
- ✏️ Edit or delete classes for an individual weekday
- ✅ Mark a class attended or not attended, including for past and future dates
- 📊 View weekly attended and not-attended counts for each subject
- 👤 Keep each user's tasks, timetable, and attendance private to their account
- 📱 Responsive layout for desktop and mobile screens

---

## 🛠️ Tech Stack

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Node.js
- Express.js
- Express sessions (no JWT)
- bcryptjs for password hashing

### Database

- MongoDB
- Mongoose
- connect-mongo for storing login sessions

---

## 📂 Folder Structure

```text
Taskflow-task-manager/
├── public/
│   ├── app.js          # Browser actions and API requests
│   ├── index.html      # Login, tasks, timetable, and attendance interface
│   └── styles.css      # Responsive styling
├── .env.example        # Example local environment settings
├── .gitignore          # Keeps .env and node_modules out of Git
├── package.json        # Project scripts and dependencies
├── package-lock.json   # Locked dependency versions
├── README.md           # Project guide
└── server.js           # Express server, API, and MongoDB models
```

---

## ⚙️ Run Locally on Windows

### 1. Install the requirements

Install [Node.js](https://nodejs.org/) and [MongoDB Community Server](https://www.mongodb.com/try/download/community). During MongoDB setup, leave **Install MongoDB as a Service** selected.

### 2. Download the project and install its packages

Open PowerShell in the project folder and run:

```powershell
npm.cmd install
```

### 3. Set up the environment file

Copy `.env.example` and name the copy `.env`. The local MongoDB connection should look like this:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/task_manager
```

Set a private value for `SESSION_SECRET` in `.env`. Do not upload `.env` to GitHub; `.gitignore` excludes it.

### 4. Start Taskflow

```powershell
npm.cmd start
```

Open [http://localhost:3000](http://localhost:3000) and create an account. Keep PowerShell open while using the app. Press **Ctrl+C** in PowerShell to stop it.

---

## 🗄️ Database

The app creates the `task_manager` database and collections when it saves data. To view them, open MongoDB Compass and connect to:

```text
mongodb://127.0.0.1:27017
```

Collections used by the project:

- `users` – account details and hashed passwords
- `tasks` – each user's task list
- `classes` – weekly class timetable
- `attendances` – attendance result for a subject on a date
- `sessions` – signed-in user sessions

---

## 👨‍💻 Author

**Kunal Sahu**

- GitHub: [KunalSahu2005](https://github.com/KunalSahu2005)
- Project repository: [Taskflow-task-manager](https://github.com/KunalSahu2005/Taskflow-task-manager)

---

## 📄 Project Note

Taskflow is an educational portfolio project. The GitHub repository contains the source code. To let someone open the working app from a link, deploy the Node.js app and MongoDB database to hosting services and add the deployed URL to this README.
