const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

// Initialize SQLite database
const dbPath = path.join(__dirname, 'attendance.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize all database tables
 */
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      department TEXT DEFAULT 'General',
      academic_year TEXT DEFAULT '2026-2027',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      teacher_name TEXT DEFAULT 'Instructor',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(code, class_id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      parent_phone TEXT,
      gender TEXT DEFAULT 'Other',
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      avatar_color TEXT DEFAULT '#6366f1',
      qr_token TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Late', 'Excused')),
      time TEXT,
      remarks TEXT,
      method TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, date, subject_id)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
  `);

  // Seed sample data if database is empty
  const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  if (studentCount === 0) {
    seedSampleData();
  }
}

/**
 * Seeds rich, realistic initial data for instant demo
 */
function seedSampleData() {
  console.log('Seeding initial attendance data...');

  // 1. Classes
  const insertClass = db.prepare('INSERT INTO classes (name, department, academic_year) VALUES (?, ?, ?)');
  insertClass.run('Class 10 - Sec A', 'Secondary Education', '2026-2027');
  insertClass.run('Class 11 - Science', 'Higher Secondary', '2026-2027');
  insertClass.run('Class 12 - CS & Tech', 'Higher Secondary', '2026-2027');

  const classes = db.prepare('SELECT id, name FROM classes ORDER BY id').all();
  const c1 = classes[0].id; // Class 10
  const c2 = classes[1].id; // Class 11
  const c3 = classes[2].id; // Class 12

  // 2. Subjects
  const insertSubject = db.prepare('INSERT INTO subjects (code, name, class_id, teacher_name) VALUES (?, ?, ?, ?)');
  insertSubject.run('MTH101', 'Mathematics', c1, 'Dr. Sarah Mitchell');
  insertSubject.run('SCI101', 'General Science', c1, 'Prof. Robert Jenkins');
  insertSubject.run('ENG101', 'English Literature', c1, 'Ms. Clara Davis');

  insertSubject.run('PHY201', 'Physics', c2, 'Dr. Alan Vance');
  insertSubject.run('CHE201', 'Chemistry', c2, 'Dr. Elena Rostova');
  insertSubject.run('MAT201', 'Advanced Calculus', c2, 'Prof. Marcus Chen');

  insertSubject.run('CS301', 'Computer Science & AI', c3, 'Prof. Vikram Rao');
  insertSubject.run('WEB301', 'Web Architecture', c3, 'Ms. Aisha Patel');
  insertSubject.run('DSA301', 'Data Structures', c3, 'Dr. Michael Chang');

  // 3. Students
  const initialStudents = [
    // Class 10 - Sec A
    { roll: '1001', name: 'Aarav Sharma', email: 'aarav.sharma@school.edu', phone: '+1 555-0101', parent: '+1 555-9101', gender: 'Male', classId: c1, color: '#4f46e5' },
    { roll: '1002', name: 'Sophia Chen', email: 'sophia.chen@school.edu', phone: '+1 555-0102', parent: '+1 555-9102', gender: 'Female', classId: c1, color: '#ec4899' },
    { roll: '1003', name: 'Liam Johnson', email: 'liam.johnson@school.edu', phone: '+1 555-0103', parent: '+1 555-9103', gender: 'Male', classId: c1, color: '#10b981' },
    { roll: '1004', name: 'Emma Wilson', email: 'emma.wilson@school.edu', phone: '+1 555-0104', parent: '+1 555-9104', gender: 'Female', classId: c1, color: '#f59e0b' },
    { roll: '1005', name: 'Noah Miller', email: 'noah.miller@school.edu', phone: '+1 555-0105', parent: '+1 555-9105', gender: 'Male', classId: c1, color: '#8b5cf6' },
    { roll: '1006', name: 'Olivia Brown', email: 'olivia.brown@school.edu', phone: '+1 555-0106', parent: '+1 555-9106', gender: 'Female', classId: c1, color: '#06b6d4' },
    { roll: '1007', name: 'Lucas Taylor', email: 'lucas.taylor@school.edu', phone: '+1 555-0107', parent: '+1 555-9107', gender: 'Male', classId: c1, color: '#ef4444' },
    { roll: '1008', name: 'Mia Martinez', email: 'mia.martinez@school.edu', phone: '+1 555-0108', parent: '+1 555-9108', gender: 'Female', classId: c1, color: '#14b8a6' },

    // Class 11 - Science
    { roll: '1101', name: 'Ethan Anderson', email: 'ethan.a@school.edu', phone: '+1 555-0201', parent: '+1 555-9201', gender: 'Male', classId: c2, color: '#6366f1' },
    { roll: '1102', name: 'Ava Thomas', email: 'ava.t@school.edu', phone: '+1 555-0202', parent: '+1 555-9202', gender: 'Female', classId: c2, color: '#d946ef' },
    { roll: '1103', name: 'Mason Jackson', email: 'mason.j@school.edu', phone: '+1 555-0203', parent: '+1 555-9203', gender: 'Male', classId: c2, color: '#3b82f6' },
    { roll: '1104', name: 'Isabella White', email: 'isabella.w@school.edu', phone: '+1 555-0204', parent: '+1 555-9204', gender: 'Female', classId: c2, color: '#84cc16' },
    { roll: '1105', name: 'James Harris', email: 'james.h@school.edu', phone: '+1 555-0205', parent: '+1 555-9205', gender: 'Male', classId: c2, color: '#f97316' },
    { roll: '1106', name: 'Charlotte Martin', email: 'charlotte.m@school.edu', phone: '+1 555-0206', parent: '+1 555-9206', gender: 'Female', classId: c2, color: '#0ea5e9' },
    { roll: '1107', name: 'Benjamin Clark', email: 'ben.c@school.edu', phone: '+1 555-0207', parent: '+1 555-9207', gender: 'Male', classId: c2, color: '#e11d48' },

    // Class 12 - CS & Tech
    { roll: '1201', name: 'Alexander Wright', email: 'alex.w@school.edu', phone: '+1 555-0301', parent: '+1 555-9301', gender: 'Male', classId: c3, color: '#4f46e5' },
    { roll: '1202', name: 'Amelia Scott', email: 'amelia.s@school.edu', phone: '+1 555-0302', parent: '+1 555-9302', gender: 'Female', classId: c3, color: '#10b981' },
    { roll: '1203', name: 'Daniel Adams', email: 'daniel.a@school.edu', phone: '+1 555-0303', parent: '+1 555-9303', gender: 'Male', classId: c3, color: '#f59e0b' },
    { roll: '1204', name: 'Harper Nelson', email: 'harper.n@school.edu', phone: '+1 555-0304', parent: '+1 555-9304', gender: 'Female', classId: c3, color: '#8b5cf6' },
    { roll: '1205', name: 'Henry Roberts', email: 'henry.r@school.edu', phone: '+1 555-0305', parent: '+1 555-9305', gender: 'Male', classId: c3, color: '#06b6d4' },
    { roll: '1206', name: 'Evelyn Carter', email: 'evelyn.c@school.edu', phone: '+1 555-0306', parent: '+1 555-9306', gender: 'Female', classId: c3, color: '#ec4899' },
    { roll: '1207', name: 'Sebastian Phillips', email: 'sebastian.p@school.edu', phone: '+1 555-0307', parent: '+1 555-9307', gender: 'Male', classId: c3, color: '#3b82f6' }
  ];

  const insertStudent = db.prepare(`
    INSERT INTO students (roll_number, full_name, email, phone, parent_phone, gender, class_id, avatar_color, qr_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of initialStudents) {
    const qrToken = `ATT-${s.roll}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    insertStudent.run(s.roll, s.name, s.email, s.phone, s.parent, s.gender, s.classId, s.color, qrToken);
  }

  // 4. Seed attendance for the last 14 days (excluding weekends)
  const students = db.prepare('SELECT id, class_id, roll_number FROM students').all();
  const insertAttendance = db.prepare(`
    INSERT OR REPLACE INTO attendance (student_id, class_id, subject_id, date, status, time, remarks, method)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const dates = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    // skip Sundays (0)
    if (d.getDay() !== 0) {
      dates.push(d.toISOString().split('T')[0]);
    }
  }

  for (const dateStr of dates) {
    for (const student of students) {
      // Create realistic attendance pattern:
      // High attendance students, a couple with low attendance for warning demos
      let rand = Math.random();
      let status = 'Present';
      let remarks = '';

      if (student.roll_number === '1007' || student.roll_number === '1105') {
        // Struggling students (< 70% attendance)
        if (rand < 0.45) status = 'Absent';
        else if (rand < 0.65) status = 'Late';
        else status = 'Present';
      } else {
        // High performers (> 90% attendance)
        if (rand < 0.88) {
          status = 'Present';
        } else if (rand < 0.94) {
          status = 'Late';
          remarks = 'Arrived 10 mins late';
        } else if (rand < 0.98) {
          status = 'Excused';
          remarks = 'Medical leave';
        } else {
          status = 'Absent';
          remarks = 'Unexcused';
        }
      }

      insertAttendance.run(
        student.id,
        student.class_id,
        dateStr,
        status,
        status === 'Late' ? '08:45:00' : '08:15:00',
        remarks,
        'manual'
      );
    }
  }

  console.log(`Successfully seeded ${classes.length} classes, ${initialStudents.length} students, and ${dates.length} days of attendance!`);
}

module.exports = {
  db,
  initDatabase,
  seedSampleData
};
