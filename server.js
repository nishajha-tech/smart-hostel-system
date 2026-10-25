const express = require('express');
const path = require('path');
const { initDB, getDB } = require('./db');
const { SQL_REPORTS } = require('./reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory session tracking for active demo user
let currentUser = {
  id: 1,
  username: 'admin',
  name: 'Dr. Rajeshwar Sharma',
  role: 'admin',
  email: 'dean.hostels@campus.edu',
  phone: '+91 98765 43210',
  block_assigned: 'All',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
};

// ==========================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ==========================================
app.get('/api/auth/current', (req, res) => {
  res.json({ success: true, user: currentUser });
});

app.post('/api/auth/switch-demo', (req, res) => {
  const { username } = req.body;
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  currentUser = user;
  res.json({ success: true, user: currentUser });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. Try admin / admin123 or warden_a / warden123' });
  }
  if (user.status === 'Suspended') {
    return res.status(403).json({ success: false, message: 'Your account access has been suspended by the Admin.' });
  }
  currentUser = user;
  res.json({ success: true, user: currentUser });
});

// Update Admin Profile (User can set their own name, credentials, avatar)
app.post('/api/auth/update-profile', (req, res) => {
  const db = getDB();
  const { name, email, phone, password, avatar } = req.body;

  try {
    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        password = COALESCE(?, password),
        avatar = COALESCE(?, avatar)
      WHERE id = ?
    `).run(name, email, phone, password || null, avatar || null, currentUser.id);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(currentUser.id);
    currentUser = updated;

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Profile Updated', currentUser.name, `Admin profile updated for ${currentUser.name}`);

    res.json({ success: true, message: 'Profile updated successfully!', user: currentUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 1B. WARDEN ACCESS CONTROL (ADMIN ONLY)
// ==========================================
app.get('/api/wardens', (req, res) => {
  const db = getDB();
  try {
    const wardens = db.prepare(`
      SELECT id, username, name, role, email, phone, block_assigned, permissions, status, created_at
      FROM users
      WHERE role = 'warden'
      ORDER BY id ASC
    `).all();

    const formatted = wardens.map(w => ({
      ...w,
      permissions: w.permissions ? JSON.parse(w.permissions) : {
        can_allocate_rooms: 1,
        can_manage_complaints: 1,
        can_issue_gatepass: 1,
        can_manage_fees: 0,
        can_view_reports: 1
      }
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/wardens', (req, res) => {
  const db = getDB();
  const { username, password, name, email, phone, block_assigned, permissions } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ success: false, message: 'Username, Password, and Full Name are required.' });
  }

  try {
    const permString = typeof permissions === 'object' ? JSON.stringify(permissions) : permissions;
    const defaultAvatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80';

    const stmt = db.prepare(`
      INSERT INTO users (username, password, name, role, email, phone, block_assigned, permissions, status, avatar)
      VALUES (?, ?, ?, 'warden', ?, ?, ?, ?, 'Active', ?)
    `);

    const result = stmt.run(
      username,
      password,
      name,
      email || `${username}@campus.edu`,
      phone || '+91 98000 00000',
      block_assigned || 'Block A',
      permString || '{"can_allocate_rooms":1,"can_manage_complaints":1,"can_issue_gatepass":1,"can_manage_fees":0,"can_view_reports":1}',
      defaultAvatar
    );

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Warden Access Created', currentUser.name, `Admin created warden account: ${name} (${username}) assigned to ${block_assigned}`);

    res.json({ success: true, id: result.lastInsertRowid, message: `Warden ${name} created and access granted successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/wardens/:id', (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { name, email, phone, block_assigned, permissions, status, password } = req.body;

  try {
    const warden = db.prepare('SELECT * FROM users WHERE id = ? AND role = "warden"').get(id);
    if (!warden) {
      return res.status(404).json({ success: false, message: 'Warden account not found.' });
    }

    const permString = permissions ? (typeof permissions === 'object' ? JSON.stringify(permissions) : permissions) : warden.permissions;

    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        block_assigned = COALESCE(?, block_assigned),
        permissions = COALESCE(?, permissions),
        status = COALESCE(?, status),
        password = COALESCE(?, password)
      WHERE id = ?
    `).run(
      name, email, phone, block_assigned, permString, status, password || null, id
    );

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Warden Access Updated', currentUser.name, `Admin updated access & permissions for Warden: ${warden.name} (${status || 'Active'})`);

    res.json({ success: true, message: `Warden ${warden.name} access updated successfully!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/wardens/:id', (req, res) => {
  const db = getDB();
  const { id } = req.params;

  try {
    const warden = db.prepare('SELECT * FROM users WHERE id = ? AND role = "warden"').get(id);
    if (!warden) {
      return res.status(404).json({ success: false, message: 'Warden not found.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Warden Access Revoked', currentUser.name, `Admin removed warden account for ${warden.name}`);

    res.json({ success: true, message: `Warden ${warden.name} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. DASHBOARD KPI METRICS & STATS
// ==========================================
app.get('/api/dashboard/stats', (req, res) => {
  const db = getDB();

  // Metrics
  const totalStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'Active'").get().c;
  const roomStats = db.prepare(`
    SELECT 
      COUNT(*) as total_rooms,
      SUM(capacity) as total_beds,
      SUM(occupied_beds) as occupied_beds
    FROM rooms
  `).get();

  const totalBeds = roomStats.total_beds || 0;
  const occupiedBeds = roomStats.occupied_beds || 0;
  const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : 0;

  const feeStats = db.prepare(`
    SELECT 
      SUM(total_amount) as total_billed,
      SUM(paid_amount) as total_collected,
      SUM(balance_amount) as total_dues,
      SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) as overdue_count
    FROM fees
  `).get();

  const openComplaints = db.prepare(`
    SELECT 
      COUNT(*) as total_open,
      SUM(CASE WHEN priority = 'Emergency' THEN 1 ELSE 0 END) as emergency_count
    FROM complaints
    WHERE status != 'Resolved'
  `).get();

  const activeVisitors = db.prepare(`
    SELECT COUNT(*) as count FROM visitors WHERE status = 'Inside Campus'
  `).get().count;

  // Block-wise occupancy
  const blockStats = db.prepare(`
    SELECT 
      block,
      COUNT(id) as rooms_count,
      SUM(capacity) as total_beds,
      SUM(occupied_beds) as occupied_beds
    FROM rooms
    GROUP BY block
    ORDER BY block
  `).all();

  // Complaints by category
  const complaintsByCategory = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM complaints
    GROUP BY category
    ORDER BY count DESC
  `).all();

  // Recent 6 audit activities
  const recentActivities = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY id DESC
    LIMIT 6
  `).all();

  // Recent 4 active visitors
  const recentVisitors = db.prepare(`
    SELECT v.*, s.full_name as student_name, r.room_number
    FROM visitors v
    JOIN students s ON v.student_id = s.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE v.status = 'Inside Campus'
    ORDER BY v.in_time DESC
    LIMIT 4
  `).all();

  // 6 sample resident students for live dashboard showcase
  const sampleStudents = db.prepare(`
    SELECT 
      s.id, s.roll_no, s.full_name, s.email, s.phone, s.gender, s.course, s.year_of_study,
      s.blood_group, s.guardian_name, s.guardian_phone, s.avatar, s.bed_number,
      COALESCE(r.room_number, 'Unallocated') as room_number,
      COALESCE(r.block, 'N/A') as block,
      COALESCE(f.status, 'Pending') as fee_status,
      COALESCE(f.balance_amount, 0) as balance_amount
    FROM students s
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN fees f ON f.student_id = s.id
    GROUP BY s.id
    ORDER BY s.id ASC
    LIMIT 6
  `).all();

  res.json({
    success: true,
    data: {
      totalStudents,
      totalRooms: roomStats.total_rooms,
      totalBeds,
      occupiedBeds,
      vacantBeds: totalBeds - occupiedBeds,
      occupancyRate,
      feeStats: {
        totalBilled: feeStats.total_billed || 0,
        totalCollected: feeStats.total_collected || 0,
        totalDues: feeStats.total_dues || 0,
        overdueCount: feeStats.overdue_count || 0
      },
      complaints: {
        totalOpen: openComplaints.total_open || 0,
        emergencyCount: openComplaints.emergency_count || 0,
        byCategory: complaintsByCategory
      },
      activeVisitors,
      blockStats,
      recentActivities,
      recentVisitors,
      sampleStudents
    }
  });
});

// ==========================================
// 3. STUDENT REGISTRATION & DIRECTORY
// ==========================================
app.get('/api/students', (req, res) => {
  const db = getDB();
  const { search, block, allocation, course } = req.query;

  let query = `
    SELECT 
      s.*,
      r.room_number,
      r.block,
      r.floor,
      r.room_type,
      r.monthly_rent
    FROM students s
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (s.full_name LIKE ? OR s.roll_no LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)`;
    const sTerm = `%${search}%`;
    params.push(sTerm, sTerm, sTerm, sTerm);
  }

  if (block && block !== 'All') {
    query += ` AND r.block = ?`;
    params.push(block);
  }

  if (course && course !== 'All') {
    query += ` AND s.course = ?`;
    params.push(course);
  }

  if (allocation === 'allocated') {
    query += ` AND s.room_id IS NOT NULL`;
  } else if (allocation === 'unallocated') {
    query += ` AND s.room_id IS NULL`;
  }

  query += ` ORDER BY s.id DESC`;

  const students = db.prepare(query).all(...params);
  res.json({ success: true, data: students });
});

app.post('/api/students', (req, res) => {
  const db = getDB();
  const {
    roll_no, full_name, email, phone, gender, course, year_of_study,
    blood_group, guardian_name, guardian_phone, emergency_address
  } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ success: false, message: 'Student full name is required.' });
  }

  let finalRollNo = (roll_no || '').trim();
  if (!finalRollNo) {
    finalRollNo = `STU-2024-${Math.floor(100 + Math.random() * 900)}`;
  }

  const finalEmail = (email || '').trim() || `${finalRollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}@campus.edu`;
  const finalPhone = (phone || '').trim() || '+91 98000 00000';

  try {
    const defaultAvatar = gender === 'Female'
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80';

    const stmt = db.prepare(`
      INSERT INTO students (
        roll_no, full_name, email, phone, gender, course, year_of_study,
        blood_group, guardian_name, guardian_phone, emergency_address,
        avatar, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `);

    const result = stmt.run(
      finalRollNo, full_name.trim(), finalEmail, finalPhone, gender || 'Male', course || 'B.Tech CSE',
      parseInt(year_of_study, 10) || 1, blood_group || 'O+',
      guardian_name || 'N/A', guardian_phone || finalPhone,
      emergency_address || '', defaultAvatar
    );

    // Audit log
    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Student Registered', currentUser.name, `Registered new student: ${full_name} (${finalRollNo})`);

    res.json({ success: true, id: result.lastInsertRowid, message: `Student ${full_name} registered successfully with Roll No ${finalRollNo}!` });
  } catch (err) {
    let msg = err.message;
    if (err.message.includes('UNIQUE constraint failed: students.roll_no')) {
      msg = `Roll Number "${finalRollNo}" already exists. Please choose a different roll number.`;
    } else if (err.message.includes('UNIQUE constraint failed: students.email')) {
      msg = `Email "${finalEmail}" is already registered.`;
    }
    res.status(400).json({ success: false, message: msg });
  }
});

app.put('/api/students/:id', (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const {
    full_name, email, phone, course, year_of_study,
    blood_group, guardian_name, guardian_phone, emergency_address, status
  } = req.body;

  try {
    db.prepare(`
      UPDATE students SET
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        course = COALESCE(?, course),
        year_of_study = COALESCE(?, year_of_study),
        blood_group = COALESCE(?, blood_group),
        guardian_name = COALESCE(?, guardian_name),
        guardian_phone = COALESCE(?, guardian_phone),
        emergency_address = COALESCE(?, emergency_address),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      full_name, email, phone, course, year_of_study,
      blood_group, guardian_name, guardian_phone, emergency_address, status, id
    );

    res.json({ success: true, message: 'Student updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/students/:id', (req, res) => {
  const db = getDB();
  const { id } = req.params;

  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // If student had a room, decrement occupancy
    if (student.room_id) {
      db.prepare(`
        UPDATE rooms 
        SET occupied_beds = MAX(0, occupied_beds - 1),
            status = 'Available'
        WHERE id = ?
      `).run(student.room_id);
    }

    db.prepare('DELETE FROM students WHERE id = ?').run(id);

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Student Removed', currentUser.name, `Deleted student record: ${student.full_name} (${student.roll_no})`);

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. ROOMS & VISUAL BED ALLOCATION
// ==========================================
app.get('/api/rooms', (req, res) => {
  const db = getDB();
  const { block, floor, status } = req.query;

  let query = `SELECT * FROM rooms WHERE 1=1`;
  const params = [];

  if (block && block !== 'All') {
    query += ` AND block = ?`;
    params.push(block);
  }

  if (floor && floor !== 'All') {
    query += ` AND floor = ?`;
    params.push(parseInt(floor, 10));
  }

  if (status && status !== 'All') {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY block, floor, room_number`;

  const rooms = db.prepare(query).all(...params);

  // Fetch residents for each room
  const roomsWithResidents = rooms.map(room => {
    const residents = db.prepare(`
      SELECT id, roll_no, full_name, bed_number, avatar, phone, course, allocation_date
      FROM students
      WHERE room_id = ?
    `).all(room.id);

    return {
      ...room,
      residents
    };
  });

  res.json({ success: true, data: roomsWithResidents });
});

app.post('/api/rooms/allocate', (req, res) => {
  const db = getDB();
  const { student_id, room_id, bed_number } = req.body;

  if (!student_id || !room_id || !bed_number) {
    return res.status(400).json({ success: false, message: 'Student ID, Room ID, and Bed Number are required.' });
  }

  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);

    if (!room || !student) {
      return res.status(404).json({ success: false, message: 'Room or Student not found' });
    }

    if (room.occupied_beds >= room.capacity) {
      return res.status(400).json({ success: false, message: 'Room is already at full capacity!' });
    }

    // Check if bed is already taken in this room
    const bedTaken = db.prepare('SELECT id FROM students WHERE room_id = ? AND bed_number = ?').get(room_id, bed_number);
    if (bedTaken) {
      return res.status(400).json({ success: false, message: `${bed_number} is already occupied in room ${room.room_number}` });
    }

    // If student was in another room, decrement previous room's occupied_beds
    if (student.room_id) {
      db.prepare(`
        UPDATE rooms 
        SET occupied_beds = MAX(0, occupied_beds - 1),
            status = 'Available'
        WHERE id = ?
      `).run(student.room_id);
    }

    // Allocate new room
    const today = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE students 
      SET room_id = ?, bed_number = ?, allocation_date = ?
      WHERE id = ?
    `).run(room_id, bed_number, today, student_id);

    // Update room occupancy
    const newOccupancy = room.occupied_beds + 1;
    const newStatus = newOccupancy >= room.capacity ? 'Full' : 'Available';
    db.prepare(`
      UPDATE rooms 
      SET occupied_beds = ?, status = ?
      WHERE id = ?
    `).run(newOccupancy, newStatus, room_id);

    // Automatically create a fee invoice for Fall 2025 semester if none exists
    const existingFee = db.prepare("SELECT id FROM fees WHERE student_id = ? AND semester = 'Fall 2025'").get(student_id);
    if (!existingFee) {
      const invNo = `INV-2026-${Math.floor(100 + Math.random() * 900)}`;
      const rent = room.monthly_rent * 6; // 6 months sem
      const mess = 24000;
      const amenities = 5000;
      const deposit = 10000;
      const total = rent + mess + amenities + deposit;

      db.prepare(`
        INSERT INTO fees (
          invoice_no, student_id, academic_year, semester,
          hostel_rent, mess_fee, amenities_fee, security_deposit, discount,
          total_amount, paid_amount, balance_amount, due_date, status, notes
        ) VALUES (?, ?, '2025-2026', 'Fall 2025', ?, ?, ?, ?, 0, ?, 0, ?, '2025-11-30', 'Pending', ?)
      `).run(invNo, student_id, rent, mess, amenities, deposit, total, total, `Generated on room allocation to ${room.room_number}`);
    }

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Room Allocated', currentUser.name, `Allocated ${student.full_name} (${student.roll_no}) to ${room.room_number} (${bed_number})`);

    res.json({ success: true, message: `Successfully allocated to Room ${room.room_number} (${bed_number})` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/rooms/deallocate', (req, res) => {
  const db = getDB();
  const { student_id } = req.body;

  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
    if (!student || !student.room_id) {
      return res.status(400).json({ success: false, message: 'Student does not have an active room allocation.' });
    }

    const roomId = student.room_id;
    const room = db.prepare('SELECT room_number FROM rooms WHERE id = ?').get(roomId);

    // Free student room
    db.prepare('UPDATE students SET room_id = NULL, bed_number = NULL, allocation_date = NULL WHERE id = ?').run(student_id);

    // Update room occupancy
    db.prepare(`
      UPDATE rooms 
      SET occupied_beds = MAX(0, occupied_beds - 1),
          status = 'Available'
      WHERE id = ?
    `).run(roomId);

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Room Deallocated', currentUser.name, `Deallocated ${student.full_name} (${student.roll_no}) from Room ${room ? room.room_number : roomId}`);

    res.json({ success: true, message: 'Student room deallocated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. FEES, BILLING & RECEIPTS
// ==========================================
app.get('/api/fees', (req, res) => {
  const db = getDB();
  const { status, search, semester } = req.query;

  let query = `
    SELECT 
      f.*,
      s.full_name,
      s.roll_no,
      s.phone,
      s.guardian_phone,
      r.room_number,
      r.block
    FROM fees f
    JOIN students s ON f.student_id = s.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'All') {
    query += ` AND f.status = ?`;
    params.push(status);
  }

  if (semester && semester !== 'All') {
    query += ` AND f.semester = ?`;
    params.push(semester);
  }

  if (search) {
    query += ` AND (s.full_name LIKE ? OR s.roll_no LIKE ? OR f.invoice_no LIKE ?)`;
    const sTerm = `%${search}%`;
    params.push(sTerm, sTerm, sTerm);
  }

  query += ` ORDER BY f.id DESC`;

  const fees = db.prepare(query).all(...params);
  res.json({ success: true, data: fees });
});

app.post('/api/fees/pay', (req, res) => {
  const db = getDB();
  const { fee_id, amount, payment_mode, transaction_ref, notes } = req.body;

  if (!fee_id || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Valid Fee ID and payment amount are required.' });
  }

  try {
    const fee = db.prepare('SELECT * FROM fees WHERE id = ?').get(fee_id);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });

    const payVal = parseFloat(amount);
    const newPaid = fee.paid_amount + payVal;
    const newBalance = Math.max(0, fee.total_amount - newPaid);
    const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';
    const today = new Date().toISOString().split('T')[0];
    const txn = transaction_ref || `TXN-${payment_mode.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    db.prepare(`
      UPDATE fees SET
        paid_amount = ?,
        balance_amount = ?,
        status = ?,
        last_payment_date = ?,
        payment_mode = ?,
        transaction_ref = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(newPaid, newBalance, newStatus, today, payment_mode, txn, notes, fee_id);

    const student = db.prepare('SELECT full_name, roll_no FROM students WHERE id = ?').get(fee.student_id);

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Fee Payment Recorded', currentUser.name, `Recorded ₹${payVal.toLocaleString('en-IN')} payment for ${student.full_name} (${fee.invoice_no}) via ${payment_mode}`);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        status: newStatus,
        transactionRef: txn
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/fees/receipt/:id', (req, res) => {
  const db = getDB();
  const { id } = req.params;

  const receipt = db.prepare(`
    SELECT 
      f.*,
      s.full_name,
      s.roll_no,
      s.email,
      s.phone,
      s.course,
      s.year_of_study,
      r.room_number,
      r.block,
      r.room_type,
      s.bed_number
    FROM fees f
    JOIN students s ON f.student_id = s.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE f.id = ?
  `).get(id);

  if (!receipt) return res.status(404).json({ success: false, message: 'Invoice not found' });
  res.json({ success: true, data: receipt });
});

// ==========================================
// 6. COMPLAINTS & MAINTENANCE DESK
// ==========================================
app.get('/api/complaints', (req, res) => {
  const db = getDB();
  const { status, category, priority } = req.query;

  let query = `
    SELECT 
      c.*,
      s.full_name as student_name,
      s.roll_no,
      s.phone as student_phone,
      COALESCE(r.room_number, 'N/A') as room_number,
      COALESCE(r.block, 'N/A') as block
    FROM complaints c
    JOIN students s ON c.student_id = s.id
    LEFT JOIN rooms r ON c.room_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'All') {
    query += ` AND c.status = ?`;
    params.push(status);
  }

  if (category && category !== 'All') {
    query += ` AND c.category = ?`;
    params.push(category);
  }

  if (priority && priority !== 'All') {
    query += ` AND c.priority = ?`;
    params.push(priority);
  }

  query += ` ORDER BY CASE c.priority WHEN 'Emergency' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, c.id DESC`;

  const complaints = db.prepare(query).all(...params);
  res.json({ success: true, data: complaints });
});

app.post('/api/complaints', (req, res) => {
  const db = getDB();
  const { student_id, category, title, description, priority } = req.body;

  if (!student_id || !title || !description) {
    return res.status(400).json({ success: false, message: 'Student, Title, and Description are required.' });
  }

  try {
    const student = db.prepare('SELECT room_id, full_name, roll_no FROM students WHERE id = ?').get(student_id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const ticketNo = `CMP-2026-${Math.floor(100 + Math.random() * 900)}`;

    db.prepare(`
      INSERT INTO complaints (
        ticket_no, student_id, room_id, category, title, description,
        priority, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')
    `).run(ticketNo, student_id, student.room_id, category || 'General', title, description, priority || 'Medium');

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Complaint Lodged', currentUser.name, `New ${priority || 'Medium'} priority complaint logged: ${ticketNo} by ${student.full_name}`);

    res.json({ success: true, message: `Complaint ticket ${ticketNo} created successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/complaints/:id/status', (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { status, assigned_staff, warden_notes } = req.body;

  try {
    const complaint = db.prepare('SELECT ticket_no FROM complaints WHERE id = ?').get(id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    let resolvedAt = null;
    if (status === 'Resolved') {
      resolvedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    db.prepare(`
      UPDATE complaints SET
        status = COALESCE(?, status),
        assigned_staff = COALESCE(?, assigned_staff),
        warden_notes = COALESCE(?, warden_notes),
        resolved_at = CASE WHEN ? = 'Resolved' THEN ? ELSE resolved_at END
      WHERE id = ?
    `).run(status, assigned_staff, warden_notes, status, resolvedAt, id);

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Complaint Status Updated', currentUser.name, `Complaint ${complaint.ticket_no} status changed to ${status}`);

    res.json({ success: true, message: `Ticket ${complaint.ticket_no} updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 7. VISITOR GATE PASS MANAGEMENT
// ==========================================
app.get('/api/visitors', (req, res) => {
  const db = getDB();
  const { status } = req.query;

  let query = `
    SELECT 
      v.*,
      s.full_name as student_name,
      s.roll_no as student_roll,
      COALESCE(r.room_number, 'N/A') as room_number,
      COALESCE(r.block, 'N/A') as block
    FROM visitors v
    JOIN students s ON v.student_id = s.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'All') {
    query += ` AND v.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY v.id DESC`;

  const visitors = db.prepare(query).all(...params);
  res.json({ success: true, data: visitors });
});

app.post('/api/visitors/checkin', (req, res) => {
  const db = getDB();
  const { visitor_name, visitor_phone, id_type, id_number, student_id, relationship, purpose } = req.body;

  if (!visitor_name || !visitor_phone || !student_id || !purpose) {
    return res.status(400).json({ success: false, message: 'Visitor name, phone, student, and purpose are required.' });
  }

  try {
    const student = db.prepare('SELECT full_name FROM students WHERE id = ?').get(student_id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const passCode = `VP-${Math.floor(9000 + Math.random() * 900)}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      INSERT INTO visitors (
        pass_code, visitor_name, visitor_phone, id_type, id_number,
        student_id, relationship, purpose, in_time, status, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Inside Campus', ?)
    `).run(
      passCode, visitor_name, visitor_phone, id_type || 'Aadhaar',
      id_number || 'N/A', student_id, relationship || 'Guardian',
      purpose, now, currentUser.name
    );

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Visitor Pass Issued', currentUser.name, `Issued gate pass ${passCode} to ${visitor_name} visiting ${student.full_name}`);

    res.json({ success: true, passCode, message: `Gate pass ${passCode} issued for ${visitor_name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/visitors/:id/checkout', (req, res) => {
  const db = getDB();
  const { id } = req.params;

  try {
    const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(id);
    if (!visitor) return res.status(404).json({ success: false, message: 'Visitor record not found' });

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      UPDATE visitors SET
        out_time = ?,
        status = 'Departed'
      WHERE id = ?
    `).run(now, id);

    db.prepare('INSERT INTO audit_logs (action, user_name, details) VALUES (?, ?, ?)')
      .run('Visitor Checked Out', currentUser.name, `Visitor ${visitor.visitor_name} (${visitor.pass_code}) departed campus`);

    res.json({ success: true, message: `Visitor ${visitor.visitor_name} marked as departed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 8. SQL REPORTS & INTERACTIVE SQL CONSOLE
// ==========================================
app.get('/api/sql/reports', (req, res) => {
  res.json({ success: true, data: SQL_REPORTS });
});

app.get('/api/sql/schema', (req, res) => {
  const db = getDB();
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    const schema = tables.map(t => {
      const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
      const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
      return {
        table: t.name,
        rowCount: count,
        columns: cols.map(c => ({
          name: c.name,
          type: c.type,
          notNull: !!c.notnull,
          isPrimary: !!c.pk
        }))
      };
    });

    res.json({ success: true, data: schema });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sql/execute', (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ success: false, message: 'SQL query cannot be empty.' });
  }

  const trimmed = query.trim();
  const startTime = Date.now();
  const db = getDB();

  try {
    // Check if query is a SELECT / PRAGMA / EXPLAIN
    const isSelect = /^(SELECT|PRAGMA|EXPLAIN|WITH)/i.test(trimmed);

    if (isSelect) {
      const rows = db.prepare(trimmed).all();
      const elapsed = Date.now() - startTime;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      res.json({
        success: true,
        isSelect: true,
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: elapsed
      });
    } else {
      // DDL or DML statement
      const info = db.prepare(trimmed).run();
      const elapsed = Date.now() - startTime;

      res.json({
        success: true,
        isSelect: false,
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid,
        executionTimeMs: elapsed,
        message: `Query executed successfully in ${elapsed}ms (${info.changes} row(s) affected).`
      });
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    res.status(400).json({
      success: false,
      message: err.message,
      executionTimeMs: elapsed
    });
  }
});

// 404 for unmatched API endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Wildcard fallback for frontend Single Page Application
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Frontend file could not be loaded.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Smart Hostel Management System server running at http://localhost:${PORT}`);
});
