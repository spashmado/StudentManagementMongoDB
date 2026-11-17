require('dotenv').config();
const dns = require('dns');

// Configure reliable DNS servers for SRV resolution on Windows
try {
  const currentServers = dns.getServers();
  dns.setServers(['8.8.8.8', '1.1.1.1', ...currentServers]);
} catch (e) {
  // Ignore if setting DNS servers is not permitted
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'StudentManagementDB';
const client = new MongoClient(mongoUri, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000
});
let db;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
app.use(express.static(__dirname));

app.get('/', (_req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  res.status(404).send('index.html not found.');
});

const collections = () => ({
  students: db.collection('Students'),
  courses: db.collection('Courses'),
  attendance: db.collection('Attendance'),
  results: db.collection('Results')
});

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function requireText(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${label} is required.`);
  const result = value.trim();
  if (result.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return result;
}

function optionalText(value, label, max = 120) {
  if (value == null || value === '') return '';
  return requireText(value, label, max);
}

function requiredNumber(value, label, min, max) {
  const n = Number(value);
  if (value === '' || value == null || !Number.isFinite(n) || n < min || n > max) {
    throw new HttpError(400, `${label} must be a number from ${min} to ${max}.`);
  }
  return n;
}

function validDate(value, label = 'Date') {
  const s = requireText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw new HttpError(400, `${label} must be a valid date in YYYY-MM-DD format.`);
  }
  return s;
}

function idFrom(value) {
  if (!ObjectId.isValid(value)) throw new HttpError(400, 'Invalid record ID.');
  return new ObjectId(value);
}

async function existingCourse(courseCode) {
  const code = requireText(courseCode, 'Course code', 24).toUpperCase();
  if (!await collections().courses.findOne({ courseCode: code })) throw new HttpError(400, `Course ${code} does not exist.`);
  return code;
}

async function existingStudent(studentId) {
  const sid = requireText(studentId, 'Student ID', 32);
  if (!await collections().students.findOne({ studentId: sid })) throw new HttpError(400, `Student ${sid} does not exist.`);
  return sid;
}

function studentPayload(body) {
  const gender = requireText(body.gender, 'Gender', 24);
  if (!['Female', 'Male', 'Other', 'Prefer not to say'].includes(gender)) throw new HttpError(400, 'Choose a valid gender option.');
  const yearOfStudy = requiredNumber(body.yearOfStudy, 'Year of study', 1, 10);
  if (!Number.isInteger(yearOfStudy)) throw new HttpError(400, 'Year of study must be a whole number.');
  const registeredCourseCodes = Array.isArray(body.registeredCourseCodes)
    ? [...new Set(body.registeredCourseCodes.map(c => requireText(c, 'Course code', 24).toUpperCase()))]
    : [];
  return {
    studentId: requireText(body.studentId, 'Student ID', 32),
    firstName: requireText(body.firstName, 'First name', 60),
    lastName: requireText(body.lastName, 'Last name', 60),
    gender,
    programme: requireText(body.programme, 'Programme', 120),
    yearOfStudy,
    registeredCourseCodes,
    updatedAt: new Date()
  };
}

function coursePayload(body) {
  return {
    courseCode: requireText(body.courseCode, 'Course code', 24).toUpperCase(),
    courseName: requireText(body.courseName, 'Course name', 120),
    creditUnits: requiredNumber(body.creditUnits, 'Credit units', 1, 60),
    lecturer: requireText(body.lecturer, 'Lecturer', 120),
    updatedAt: new Date()
  };
}

function attendancePayload(body) {
  const status = requireText(body.status, 'Attendance status', 16);
  if (!['Present', 'Absent', 'Late'].includes(status)) throw new HttpError(400, 'Status must be Present, Absent, or Late.');
  return {
    studentId: requireText(body.studentId, 'Student ID', 32),
    courseCode: requireText(body.courseCode, 'Course code', 24).toUpperCase(),
    attendanceDate: validDate(body.attendanceDate, 'Attendance date'),
    status,
    updatedAt: new Date()
  };
}

function resultPayload(body) {
  const courseworkMark = requiredNumber(body.courseworkMark, 'Coursework mark', 0, 100);
  const examinationMark = requiredNumber(body.examinationMark, 'Examination mark', 0, 100);
  const total = (courseworkMark + examinationMark) / 2;
  const grade = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : total >= 50 ? 'D' : 'F';
  return {
    studentId: requireText(body.studentId, 'Student ID', 32),
    courseCode: requireText(body.courseCode, 'Course code', 24).toUpperCase(),
    courseworkMark,
    examinationMark,
    totalMark: Number(total.toFixed(2)),
    grade,
    updatedAt: new Date()
  };
}

function duplicateSafe(error) {
  if (error?.code === 11000) throw new HttpError(409, 'A record with that ID or combination already exists.');
  throw error;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, database: dbName }));

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const c = collections();
    const [students, courses, attendance, results, recentAttendance, recentResults] = await Promise.all([
      c.students.countDocuments(), c.courses.countDocuments(), c.attendance.countDocuments(), c.results.countDocuments(),
      c.attendance.find().sort({ attendanceDate: -1, updatedAt: -1 }).limit(5).toArray(),
      c.results.find().sort({ updatedAt: -1 }).limit(5).toArray()
    ]);
    res.json({ counts: { students, courses, attendance, results }, recentAttendance, recentResults });
  } catch (e) { next(e); }
});

const listRoutes = [
  ['/api/students', 'students', { lastName: 1, firstName: 1 }],
  ['/api/courses', 'courses', { courseCode: 1 }],
  ['/api/attendance', 'attendance', { attendanceDate: -1, studentId: 1 }],
  ['/api/results', 'results', { updatedAt: -1, studentId: 1 }]
];
for (const [route, key, sort] of listRoutes) {
  app.get(route, async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const fields = key === 'students' ? ['studentId', 'firstName', 'lastName', 'programme'] :
        key === 'courses' ? ['courseCode', 'courseName', 'lecturer'] : ['studentId', 'courseCode'];
      const filter = q ? { $or: fields.map(field => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) } : {};
      const docs = await collections()[key].find(filter).sort(sort).limit(500).toArray();
      res.json(docs);
    } catch (e) { next(e); }
  });
}

function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const config = {
  students: { route: '/api/students', payload: studentPayload, unique: 'studentId', refs: async d => {
    const courses = collections().courses;
    for (const code of d.registeredCourseCodes) if (!await courses.findOne({ courseCode: code })) throw new HttpError(400, `Course ${code} does not exist.`);
  } },
  courses: { route: '/api/courses', payload: coursePayload, unique: 'courseCode' },
  attendance: { route: '/api/attendance', payload: attendancePayload, unique: ['studentId', 'courseCode', 'attendanceDate'], refs: async d => {
    await existingStudent(d.studentId); await existingCourse(d.courseCode);
  } },
  results: { route: '/api/results', payload: resultPayload, unique: ['studentId', 'courseCode'], refs: async d => {
    await existingStudent(d.studentId); await existingCourse(d.courseCode);
  } }
};

for (const [key, cfg] of Object.entries(config)) {
  app.post(cfg.route, async (req, res, next) => {
    try {
      const doc = cfg.payload(req.body);
      if (cfg.refs) await cfg.refs(doc);
      doc.createdAt = new Date();
      const result = await collections()[key].insertOne(doc);
      res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (e) { try { duplicateSafe(e); } catch (err) { next(err); } }
  });
  app.put(`${cfg.route}/:id`, async (req, res, next) => {
    try {
      const _id = idFrom(req.params.id);
      const doc = cfg.payload(req.body);
      if (cfg.refs) await cfg.refs(doc);
      const result = await collections()[key].findOneAndUpdate({ _id }, { $set: doc }, { returnDocument: 'after' });
      if (!result) throw new HttpError(404, 'Record not found.');
      res.json(result);
    } catch (e) { try { duplicateSafe(e); } catch (err) { next(err); } }
  });
  app.delete(`${cfg.route}/:id`, async (req, res, next) => {
    try {
      const _id = idFrom(req.params.id);
      const existing = await collections()[key].findOne({ _id });
      if (!existing) throw new HttpError(404, 'Record not found.');
      if (key === 'students') {
        const linked = await Promise.all([collections().attendance.countDocuments({ studentId: existing.studentId }), collections().results.countDocuments({ studentId: existing.studentId })]);
        if (linked.some(Boolean)) throw new HttpError(409, 'This student has attendance or results. Remove those records first.');
      }
      if (key === 'courses') {
        const linked = await Promise.all([collections().attendance.countDocuments({ courseCode: existing.courseCode }), collections().results.countDocuments({ courseCode: existing.courseCode })]);
        if (linked.some(Boolean)) throw new HttpError(409, 'This course has attendance or results. Remove those records first.');
      }
      await collections()[key].deleteOne({ _id });
      if (key === 'courses') await collections().students.updateMany({ registeredCourseCodes: existing.courseCode }, { $pull: { registeredCourseCodes: existing.courseCode } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
}

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API route not found.')));

// Serve index.html for all other GET requests (SPA fallback for direct navigation/refresh)
app.get('*', (_req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  res.status(404).send('index.html not found.');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'An unexpected server error occurred.' });
});

async function start() {
  await client.connect();
  db = client.db(dbName);
  const c = collections();
  await Promise.all([
    c.students.createIndex({ studentId: 1 }, { unique: true }),
    c.courses.createIndex({ courseCode: 1 }, { unique: true }),
    c.attendance.createIndex({ studentId: 1, courseCode: 1, attendanceDate: 1 }, { unique: true }),
    c.results.createIndex({ studentId: 1, courseCode: 1 }, { unique: true }),
    c.attendance.createIndex({ courseCode: 1, attendanceDate: -1 }),
  ]);
  const server = app.listen(port, () => console.log(`Student Management is running at http://localhost:${port} (database: ${dbName})`));
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. If the app is already running, open http://localhost:${port}. Otherwise, choose another port, for example: $env:PORT = "3001"; npm.cmd start`);
    } else {
      console.error('Could not start the web server.', error.message);
    }
    process.exitCode = 1;
    client.close().catch(closeError => {
      console.error('Could not close the MongoDB connection.', closeError.message);
    });
  });
}

start().catch(error => {
  console.error('Could not start the application. Ensure MongoDB is running and MONGODB_URI is correct.', error.message);
  if (error.message.includes('alert number 80') || error.message.includes('tlsv1 alert internal error')) {
    console.error('\n--> MongoDB Atlas SSL/TLS Error: The remote MongoDB Atlas cluster rejected the TLS handshake.');
    console.error('--> Primary Cause: Your current public IP address is not whitelisted in MongoDB Atlas.');
    console.error('--> Fix:');
    console.error('    1. Open https://cloud.mongodb.com and log in.');
    console.error('    2. Navigate to "Security" -> "Network Access".');
    console.error('    3. Click "Add IP Address" and select "Add Current IP Address" (or allow 0.0.0.0/0 for testing).');
  } else if (error.message.includes('querySrv ECONNREFUSED')) {
    console.error('\n--> DNS SRV Lookup Error: Unable to resolve _mongodb._tcp SRV record.');
    console.error('--> Fix: Switch to the standard non-SRV connection string provided in your .env file.');
  }
  process.exit(1);
});

process.on('SIGINT', async () => { await client.close(); process.exit(0); });
process.on('SIGTERM', async () => { await client.close(); process.exit(0); });
