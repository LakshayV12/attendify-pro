const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db, initDatabase, seedSampleData } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to format today's date YYYY-MM-DD in local time
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// -------------------------------------------------------------
// 1. CLASSES API
// -------------------------------------------------------------
app.get('/api/classes', (req, res) => {
  try {
    const classes = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'Active') as student_count,
        (SELECT COUNT(*) FROM subjects sub WHERE sub.class_id = c.id) as subject_count
      FROM classes c 
      ORDER BY c.name ASC
    `).all();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/classes', (req, res) => {
  try {
    const { name, department, academic_year } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required' });

    const stmt = db.prepare('INSERT INTO classes (name, department, academic_year) VALUES (?, ?, ?)');
    const result = stmt.run(name.trim(), department || 'General', academic_year || '2026-2027');
    res.status(201).json({ id: result.lastInsertRowid, name, department, academic_year });
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Class name already exists' : error.message });
  }
});

app.put('/api/classes/:id', (req, res) => {
  try {
    const { name, department, academic_year } = req.body;
    const stmt = db.prepare('UPDATE classes SET name = ?, department = ?, academic_year = ? WHERE id = ?');
    stmt.run(name.trim(), department, academic_year, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/classes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 2. SUBJECTS API
// -------------------------------------------------------------
app.get('/api/subjects', (req, res) => {
  try {
    const { class_id } = req.query;
    let query = 'SELECT s.*, c.name as class_name FROM subjects s JOIN classes c ON s.class_id = c.id';
    const params = [];
    if (class_id) {
      query += ' WHERE s.class_id = ?';
      params.push(class_id);
    }
    query += ' ORDER BY s.name ASC';
    const subjects = db.prepare(query).all(...params);
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', (req, res) => {
  try {
    const { code, name, class_id, teacher_name } = req.body;
    if (!code || !name || !class_id) {
      return res.status(400).json({ error: 'Code, name, and class are required' });
    }
    const stmt = db.prepare('INSERT INTO subjects (code, name, class_id, teacher_name) VALUES (?, ?, ?, ?)');
    const result = stmt.run(code.trim().toUpperCase(), name.trim(), class_id, teacher_name || 'Instructor');
    res.status(201).json({ id: result.lastInsertRowid, code, name, class_id, teacher_name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/subjects/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 3. STUDENTS API
// -------------------------------------------------------------
app.get('/api/students', (req, res) => {
  try {
    const { class_id, search, status } = req.query;
    let query = `
      SELECT s.*, c.name as class_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.subject_id IS NULL) as total_days,
        (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'Present' AND a.subject_id IS NULL) as present_days,
        (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'Late' AND a.subject_id IS NULL) as late_days
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      query += ' AND s.class_id = ?';
      params.push(class_id);
    }
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.email LIKE ?)';
      const sTerm = `%${search}%`;
      params.push(sTerm, sTerm, sTerm);
    }

    query += ' ORDER BY s.roll_number ASC';
    const rawStudents = db.prepare(query).all(...params);

    const students = rawStudents.map(student => {
      const total = student.total_days || 0;
      const present = student.present_days || 0;
      const late = student.late_days || 0;
      // Calculate attendance rate (Present + 0.5 * Late)
      const effectivePresent = present + (late * 0.5);
      const rate = total > 0 ? Math.round((effectivePresent / total) * 100) : 100;
      return {
        ...student,
        attendance_rate: rate,
        is_low_attendance: rate < 75 && total >= 3
      };
    });

    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:id', (req, res) => {
  try {
    const student = db.prepare(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      JOIN classes c ON s.class_id = c.id 
      WHERE s.id = ?
    `).get(req.params.id);

    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Fetch full attendance history
    const history = db.prepare(`
      SELECT a.*, sub.name as subject_name, sub.code as subject_code
      FROM attendance a
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      WHERE a.student_id = ?
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT 100
    `).all(req.params.id);

    // Calculate overall stats
    const totalDays = history.filter(h => h.subject_id === null).length;
    const presentDays = history.filter(h => h.subject_id === null && h.status === 'Present').length;
    const lateDays = history.filter(h => h.subject_id === null && h.status === 'Late').length;
    const absentDays = history.filter(h => h.subject_id === null && h.status === 'Absent').length;
    const rate = totalDays > 0 ? Math.round(((presentDays + (lateDays * 0.5)) / totalDays) * 100) : 100;

    res.json({
      ...student,
      stats: { totalDays, presentDays, lateDays, absentDays, rate },
      history
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students', (req, res) => {
  try {
    const { roll_number, full_name, email, phone, parent_phone, gender, class_id, avatar_color } = req.body;
    if (!roll_number || !full_name || !class_id) {
      return res.status(400).json({ error: 'Roll number, full name, and class are required' });
    }

    const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
    const assignedColor = avatar_color || colors[Math.floor(Math.random() * colors.length)];
    const qrToken = `ATT-${roll_number.trim().toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const stmt = db.prepare(`
      INSERT INTO students (roll_number, full_name, email, phone, parent_phone, gender, class_id, avatar_color, qr_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      roll_number.trim(),
      full_name.trim(),
      email ? email.trim() : null,
      phone ? phone.trim() : null,
      parent_phone ? parent_phone.trim() : null,
      gender || 'Other',
      class_id,
      assignedColor,
      qrToken
    );

    res.status(201).json({ id: result.lastInsertRowid, roll_number, full_name, qr_token: qrToken });
  } catch (error) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Roll number already in use' : error.message });
  }
});

app.put('/api/students/:id', (req, res) => {
  try {
    const { roll_number, full_name, email, phone, parent_phone, gender, class_id, status } = req.body;
    const stmt = db.prepare(`
      UPDATE students 
      SET roll_number = ?, full_name = ?, email = ?, phone = ?, parent_phone = ?, gender = ?, class_id = ?, status = ?
      WHERE id = ?
    `);
    stmt.run(roll_number, full_name, email, phone, parent_phone, gender, class_id, status || 'Active', req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/students/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 4. ATTENDANCE API
// -------------------------------------------------------------
app.get('/api/attendance', (req, res) => {
  try {
    const { class_id, date = getTodayString(), subject_id } = req.query;
    if (!class_id) {
      return res.status(400).json({ error: 'class_id is required' });
    }

    // Fetch all active students in this class along with their attendance for this date & subject
    const subjectParam = subject_id && subject_id !== 'general' ? parseInt(subject_id) : null;

    let query = `
      SELECT s.id as student_id, s.roll_number, s.full_name, s.avatar_color, s.email, s.parent_phone,
             a.id as attendance_id, a.status, a.time, a.remarks, a.method, a.date
      FROM students s
      LEFT JOIN attendance a ON a.student_id = s.id 
        AND a.date = ? 
        AND (${subjectParam ? 'a.subject_id = ?' : 'a.subject_id IS NULL'})
      WHERE s.class_id = ? AND s.status = 'Active'
      ORDER BY s.roll_number ASC
    `;

    const params = subjectParam ? [date, subjectParam, class_id] : [date, class_id];
    const records = db.prepare(query).all(...params);

    res.json({
      date,
      class_id: parseInt(class_id),
      subject_id: subjectParam,
      students: records
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance/batch', (req, res) => {
  try {
    const { date, class_id, subject_id, records } = req.body;
    if (!date || !class_id || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid batch data format' });
    }

    const subjectVal = subject_id && subject_id !== 'general' ? parseInt(subject_id) : null;
    const nowTime = new Date().toTimeString().split(' ')[0];

    const insertOrUpdate = db.prepare(`
      INSERT INTO attendance (student_id, class_id, subject_id, date, status, time, remarks, method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, date, subject_id) DO UPDATE SET
        status = excluded.status,
        time = excluded.time,
        remarks = excluded.remarks,
        method = excluded.method
    `);

    // Execute batch within database transaction
    db.exec('BEGIN TRANSACTION;');
    try {
      for (const rec of records) {
        insertOrUpdate.run(
          rec.student_id,
          class_id,
          subjectVal,
          date,
          rec.status || 'Present',
          nowTime,
          rec.remarks || '',
          rec.method || 'manual'
        );
      }
      db.exec('COMMIT;');
      res.json({ success: true, count: records.length });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// QR Code / ID Scan Endpoint
app.post('/api/attendance/scan-qr', (req, res) => {
  try {
    const { qr_token, roll_number, date = getTodayString(), subject_id, status = 'Present' } = req.body;
    if (!qr_token && !roll_number) {
      return res.status(400).json({ error: 'qr_token or roll_number required' });
    }

    let student;
    if (qr_token) {
      student = db.prepare(`
        SELECT s.*, c.name as class_name 
        FROM students s 
        JOIN classes c ON s.class_id = c.id 
        WHERE s.qr_token = ? OR s.roll_number = ?
      `).get(qr_token.trim(), qr_token.trim());
    } else {
      student = db.prepare(`
        SELECT s.*, c.name as class_name 
        FROM students s 
        JOIN classes c ON s.class_id = c.id 
        WHERE s.roll_number = ?
      `).get(roll_number.trim());
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student ID not recognized' });
    }

    if (student.status !== 'Active') {
      return res.status(400).json({ success: false, message: `Student profile is ${student.status}` });
    }

    const subjectVal = subject_id && subject_id !== 'general' ? parseInt(subject_id) : null;
    const nowTime = new Date().toTimeString().split(' ')[0];

    const stmt = db.prepare(`
      INSERT INTO attendance (student_id, class_id, subject_id, date, status, time, remarks, method)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'qr')
      ON CONFLICT(student_id, date, subject_id) DO UPDATE SET
        status = excluded.status,
        time = excluded.time,
        method = 'qr'
    `);

    stmt.run(student.id, student.class_id, subjectVal, date, status, nowTime, 'Scanned via Digital ID');

    res.json({
      success: true,
      student,
      marked: {
        date,
        time: nowTime,
        status,
        method: 'qr'
      },
      message: `Successfully verified & marked ${status} for ${student.full_name} (${student.roll_number})`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 5. DASHBOARD & ANALYTICS API
// -------------------------------------------------------------
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const { date = getTodayString(), class_id } = req.query;

    let classFilterStudents = '';
    let classFilterAttendance = '';
    const studentParams = [];
    const attParams = [date];

    if (class_id) {
      classFilterStudents = ' AND class_id = ?';
      studentParams.push(class_id);
      classFilterAttendance = ' AND class_id = ?';
      attParams.push(class_id);
    }

    const totalStudents = db.prepare(`SELECT COUNT(*) as count FROM students WHERE status = 'Active' ${classFilterStudents}`).get(...studentParams).count;

    // Today's attendance counts
    const todayCounts = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) as excused,
        COUNT(*) as total_recorded
      FROM attendance
      WHERE date = ? AND subject_id IS NULL ${classFilterAttendance}
    `).get(...attParams);

    const present = todayCounts.present || 0;
    const absent = todayCounts.absent || 0;
    const late = todayCounts.late || 0;
    const excused = todayCounts.excused || 0;
    const totalRecorded = todayCounts.total_recorded || 0;

    // Overall attendance rate across all historical records
    let overallQuery = "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Present' THEN 1 WHEN status = 'Late' THEN 0.5 ELSE 0 END) as present_equivalent FROM attendance WHERE subject_id IS NULL";
    const overallParams = [];
    if (class_id) {
      overallQuery += ' AND class_id = ?';
      overallParams.push(class_id);
    }
    const overallRow = db.prepare(overallQuery).get(...overallParams);
    const overallRate = overallRow.total > 0 ? Math.round((overallRow.present_equivalent / overallRow.total) * 100) : 100;

    // Low attendance student count (< 75%)
    const lowAttCount = getLowAttendanceStudents(class_id).length;

    res.json({
      date,
      totalStudents,
      today: {
        present,
        absent,
        late,
        excused,
        unmarked: Math.max(0, totalStudents - totalRecorded),
        rate: totalRecorded > 0 ? Math.round(((present + (late * 0.5)) / totalRecorded) * 100) : 0
      },
      overallRate,
      lowAttendanceCount: lowAttCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper for low attendance list
function getLowAttendanceStudents(classId) {
  let query = `
    SELECT s.id, s.roll_number, s.full_name, s.avatar_color, s.parent_phone, s.email, c.name as class_name,
      COUNT(a.id) as total_recorded,
      SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count
    FROM students s
    JOIN classes c ON s.class_id = c.id
    LEFT JOIN attendance a ON a.student_id = s.id AND a.subject_id IS NULL
    WHERE s.status = 'Active'
  `;
  const params = [];
  if (classId) {
    query += ' AND s.class_id = ?';
    params.push(classId);
  }
  query += ' GROUP BY s.id HAVING total_recorded >= 3 ORDER BY roll_number ASC';

  const rows = db.prepare(query).all(...params);
  return rows
    .map(r => {
      const effective = (r.present_count || 0) + ((r.late_count || 0) * 0.5);
      const rate = r.total_recorded > 0 ? Math.round((effective / r.total_recorded) * 100) : 100;
      return { ...r, rate };
    })
    .filter(r => r.rate < 75)
    .sort((a, b) => a.rate - b.rate);
}

app.get('/api/dashboard/low-attendance', (req, res) => {
  try {
    const { class_id } = req.query;
    res.json(getLowAttendanceStudents(class_id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/trend', (req, res) => {
  try {
    const { days = 14, class_id } = req.query;

    let classFilter = '';
    const params = [];
    if (class_id) {
      classFilter = ' AND class_id = ?';
      params.push(class_id);
    }

    const rows = db.prepare(`
      SELECT date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) as excused
      FROM attendance
      WHERE subject_id IS NULL ${classFilter}
      GROUP BY date
      ORDER BY date DESC
      LIMIT ?
    `).all(...params, parseInt(days));

    // Reverse to chronological order (oldest to newest)
    const trend = rows.reverse().map(r => {
      const effective = (r.present || 0) + ((r.late || 0) * 0.5);
      const rate = r.total > 0 ? Math.round((effective / r.total) * 100) : 0;
      return {
        date: r.date,
        present: r.present || 0,
        absent: r.absent || 0,
        late: r.late || 0,
        excused: r.excused || 0,
        total: r.total,
        rate
      };
    });

    res.json(trend);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/class-comparison', (req, res) => {
  try {
    const classes = db.prepare('SELECT id, name FROM classes ORDER BY name ASC').all();
    const result = classes.map(c => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late
        FROM attendance
        WHERE class_id = ? AND subject_id IS NULL
      `).get(c.id);

      const effective = (stats.present || 0) + ((stats.late || 0) * 0.5);
      const rate = stats.total > 0 ? Math.round((effective / stats.total) * 100) : 0;
      const count = db.prepare('SELECT COUNT(*) as cnt FROM students WHERE class_id = ? AND status = "Active"').get(c.id).cnt;

      return {
        id: c.id,
        name: c.name,
        studentCount: count,
        totalRecords: stats.total,
        rate
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 6. REPORTS & EXPORT API
// -------------------------------------------------------------
app.get('/api/reports/export-csv', (req, res) => {
  try {
    const { class_id, startDate, endDate, subject_id } = req.query;

    let query = `
      SELECT 
        s.roll_number,
        s.full_name,
        c.name as class_name,
        COALESCE(sub.name, 'General Daily') as subject_name,
        a.date,
        a.status,
        COALESCE(a.time, '') as time,
        COALESCE(a.method, 'manual') as method,
        COALESCE(a.remarks, '') as remarks
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      query += ' AND a.class_id = ?';
      params.push(class_id);
    }
    if (startDate) {
      query += ' AND a.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND a.date <= ?';
      params.push(endDate);
    }
    if (subject_id && subject_id !== 'general') {
      query += ' AND a.subject_id = ?';
      params.push(subject_id);
    } else if (subject_id === 'general') {
      query += ' AND a.subject_id IS NULL';
    }

    query += ' ORDER BY a.date DESC, s.roll_number ASC';

    const records = db.prepare(query).all(...params);

    // Build CSV content
    const headers = ['Roll Number', 'Full Name', 'Class', 'Subject', 'Date', 'Status', 'Time', 'Method', 'Remarks'];
    const csvRows = [headers.join(',')];

    for (const r of records) {
      const row = [
        `"${r.roll_number}"`,
        `"${r.full_name.replace(/"/g, '""')}"`,
        `"${r.class_name.replace(/"/g, '""')}"`,
        `"${r.subject_name.replace(/"/g, '""')}"`,
        `"${r.date}"`,
        `"${r.status}"`,
        `"${r.time}"`,
        `"${r.method}"`,
        `"${r.remarks.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${getTodayString()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seed data reset endpoint
app.post('/api/seed/reset', (req, res) => {
  try {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('DROP TABLE IF EXISTS attendance;');
    db.exec('DROP TABLE IF EXISTS students;');
    db.exec('DROP TABLE IF EXISTS subjects;');
    db.exec('DROP TABLE IF EXISTS classes;');
    db.exec('PRAGMA foreign_keys = ON;');

    initDatabase();
    res.json({ success: true, message: 'Sample dataset reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback to index.html for SPA routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Attendify Pro Attendance System is Live!`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Environment: Node.js ${process.version} with SQLite`);
  console.log(`=======================================================`);
});
