require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'StudentManagementDB';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const students = db.collection('Students');
    const courses = db.collection('Courses');
    const attendance = db.collection('Attendance');
    const results = db.collection('Results');
    const now = new Date();
    const courseRows = [
      { courseCode: 'BBCT 2114', courseName: 'System Analysis and Design', creditUnits: 3, lecturer: 'Sample Lecturer' },
      { courseCode: 'BNCT 2113', courseName: 'Computer Architecture and Organization', creditUnits: 3, lecturer: 'Sample Lecturer' },
      { courseCode: 'BBCT 2101', courseName: 'Database Systems', creditUnits: 4, lecturer: 'Sample Lecturer' }
    ];
    for (const row of courseRows) await courses.updateOne({ courseCode: row.courseCode }, { $set: { ...row, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
    const studentRows = [
      { studentId: '24-BCT-001', firstName: 'Amina', lastName: 'Nabirye', gender: 'Female', programme: 'Bachelor of Computer Technology', yearOfStudy: 2, registeredCourseCodes: ['BBCT 2114', 'BNCT 2113', 'BBCT 2101'] },
      { studentId: '24-BCT-002', firstName: 'Daniel', lastName: 'Okello', gender: 'Male', programme: 'Bachelor of Computer Technology', yearOfStudy: 2, registeredCourseCodes: ['BBCT 2114', 'BBCT 2101'] },
      { studentId: '23-BIT-014', firstName: 'Miriam', lastName: 'Atim', gender: 'Female', programme: 'Bachelor of Information Technology', yearOfStudy: 3, registeredCourseCodes: ['BNCT 2113'] }
    ];
    for (const row of studentRows) await students.updateOne({ studentId: row.studentId }, { $set: { ...row, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
    const attendanceRows = [
      { studentId: '24-BCT-001', courseCode: 'BBCT 2114', attendanceDate: '2026-11-03', status: 'Present' },
      { studentId: '24-BCT-002', courseCode: 'BBCT 2114', attendanceDate: '2026-11-03', status: 'Late' },
      { studentId: '23-BIT-014', courseCode: 'BNCT 2113', attendanceDate: '2026-11-02', status: 'Present' }
    ];
    for (const row of attendanceRows) await attendance.updateOne({ studentId: row.studentId, courseCode: row.courseCode, attendanceDate: row.attendanceDate }, { $set: { ...row, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
    const resultRows = [
      { studentId: '24-BCT-001', courseCode: 'BBCT 2114', courseworkMark: 82, examinationMark: 76 },
      { studentId: '24-BCT-002', courseCode: 'BBCT 2114', courseworkMark: 68, examinationMark: 71 },
      { studentId: '23-BIT-014', courseCode: 'BNCT 2113', courseworkMark: 74, examinationMark: 80 }
    ];
    for (const row of resultRows) {
      const totalMark = Number(((row.courseworkMark + row.examinationMark) / 2).toFixed(2));
      const grade = totalMark >= 80 ? 'A' : totalMark >= 70 ? 'B' : totalMark >= 60 ? 'C' : totalMark >= 50 ? 'D' : 'F';
      await results.updateOne({ studentId: row.studentId, courseCode: row.courseCode }, { $set: { ...row, totalMark, grade, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
    }
    console.log(`Sample records are ready in ${dbName}. Existing sample records were updated safely.`);
  } finally { await client.close(); }
}

main().catch(error => { console.error('Could not load sample records:', error.message); process.exit(1); });
