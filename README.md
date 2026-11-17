# Student Management System

A local web application for managing student profiles, course registrations, course records, attendance, and examination results using MongoDB. The database is named `StudentManagementDB` and uses the four requested collections: `Students`, `Courses`, `Attendance`, and `Results`.

## What it does

- Create, search, edit, and delete student profiles.
- Register students for courses from the course catalogue.
- Create, search, edit, and delete courses.
- Record attendance as Present, Absent, or Late.
- Record coursework and examination marks; calculate an average and letter grade automatically.
- Keep attendance and results linked to existing student IDs and course codes.
- Show a dashboard with collection totals and recent activity.
- Prevent duplicate student IDs, course codes, same-day attendance entries, and duplicate student/course results.
- Protect records from accidental orphaning: a student or course with attendance/results cannot be deleted until those linked records are removed.

## Requirements

- Node.js 20 or newer with npm
- MongoDB 7 (local installation or Docker Desktop)

## Start with Docker Desktop (Windows)

1. Extract the ZIP file.
2. Open PowerShell in the extracted `StudentManagementMongoDB` folder.
3. Start the MongoDB database:

   ```powershell
   docker compose up -d
   ```

4. Copy `.env.example` to `.env` (the default values work for this Docker setup).
5. Install the app packages and load sample records:

   ```powershell
   npm install
   npm run seed
   ```

6. Start the app:

   ```powershell
   npm start
   ```

7. Open [http://localhost:3000](http://localhost:3000) in a browser.

If port 3000 is already in use, the app may already be running; open that address instead of starting it again. To start another instance on port 3001 in PowerShell, run `$env:PORT = "3001"; npm.cmd start`, then open [http://localhost:3001](http://localhost:3001).

To stop the database, run `docker compose down` in the project folder. MongoDB data remains in the Docker volume. To delete that stored data, use `docker compose down -v`.

## Use an existing MongoDB server

Copy `.env.example` to `.env`, then set `MONGODB_URI` to your MongoDB connection string. Keep `MONGODB_DB=StudentManagementDB`, install packages with `npm install`, optionally load samples with `npm run seed`, and run `npm start`.

## Data model

### `Students`

```js
{
  studentId: "24-BCT-001",       // unique
  firstName: "Amina",
  lastName: "Nabirye",
  gender: "Female",
  programme: "Bachelor of Computer Technology",
  yearOfStudy: 2,
  registeredCourseCodes: ["BBCT 2114"],
  createdAt: Date,
  updatedAt: Date
}
```

### `Courses`

```js
{
  courseCode: "BBCT 2114",       // unique
  courseName: "System Analysis and Design",
  creditUnits: 3,
  lecturer: "Sample Lecturer",
  createdAt: Date,
  updatedAt: Date
}
```

### `Attendance`

```js
{
  studentId: "24-BCT-001",       // logical reference to Students.studentId
  courseCode: "BBCT 2114",       // logical reference to Courses.courseCode
  attendanceDate: "2026-11-03",  // YYYY-MM-DD
  status: "Present",             // Present | Absent | Late
  createdAt: Date,
  updatedAt: Date
}
```

### `Results`

```js
{
  studentId: "24-BCT-001",       // logical reference to Students.studentId
  courseCode: "BBCT 2114",       // logical reference to Courses.courseCode
  courseworkMark: 82,
  examinationMark: 76,
  totalMark: 79,                   // simple average of the two marks
  grade: "B",
  createdAt: Date,
  updatedAt: Date
}
```

MongoDB does not enforce foreign keys. The app checks student and course references when saving Attendance and Results, and uses indexes to prevent duplicate keys. The student course registrations are stored as `registeredCourseCodes` on the student document, preserving the requested four-collection design.

## Grade calculation

For this demonstration, coursework and examination marks are equally weighted: `totalMark = (courseworkMark + examinationMark) / 2`. Grades are A ≥ 80, B ≥ 70, C ≥ 60, D ≥ 50, otherwise F. Adjust the calculation and grade bands in `server.js` and `seed.js` to match your institution's official policy before using real academic records.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Check that the app is running |
| GET | `/api/dashboard` | Counts and recent activity |
| GET | `/api/students?q=...` | List/search students |
| POST, PUT, DELETE | `/api/students` | Manage student records (`PUT`/`DELETE` add `/:id`) |
| GET | `/api/courses?q=...` | List/search courses |
| POST, PUT, DELETE | `/api/courses` | Manage courses (`PUT`/`DELETE` add `/:id`) |
| GET | `/api/attendance?q=...` | List/search attendance |
| POST, PUT, DELETE | `/api/attendance` | Manage attendance (`PUT`/`DELETE` add `/:id`) |
| GET | `/api/results?q=...` | List/search results |
| POST, PUT, DELETE | `/api/results` | Manage results (`PUT`/`DELETE` add `/:id`) |

## Project files

- `server.js` — Express API, MongoDB connection, validation, indexes, and CRUD routes
- `seed.js` — idempotent sample data loader
- `public/` — browser GUI (HTML, CSS, JavaScript)
- `docker-compose.yml` — local MongoDB service with persistent data volume
- `.env.example` — app configuration template

This setup is intended for local development and classroom demonstration. Before deployment on a public network, add user authentication, access controls, HTTPS, backups, and production secrets management.
