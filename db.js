const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hostel.db');

let dbInstance = null;

function getDB() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
  }
  return dbInstance;
}

function initDB() {
  const db = getDB();

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'admin' or 'warden'
      email TEXT,
      phone TEXT,
      block_assigned TEXT, -- 'All', 'Block A', 'Block B', 'Block C'
      permissions TEXT, -- JSON flags for room allocation, complaints, visitors, fees, reports
      status TEXT DEFAULT 'Active', -- 'Active', 'Suspended'
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT UNIQUE NOT NULL,
      block TEXT NOT NULL, -- 'Block A', 'Block B', 'Block C'
      floor INTEGER NOT NULL,
      room_type TEXT NOT NULL, -- 'Single Deluxe AC', 'Double Sharing AC', 'Double Sharing Standard', 'Triple Sharing'
      capacity INTEGER NOT NULL,
      occupied_beds INTEGER DEFAULT 0,
      monthly_rent REAL NOT NULL,
      status TEXT DEFAULT 'Available', -- 'Available', 'Full', 'Maintenance'
      amenities TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_no TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      gender TEXT NOT NULL,
      course TEXT NOT NULL,
      year_of_study INTEGER NOT NULL,
      blood_group TEXT,
      guardian_name TEXT NOT NULL,
      guardian_phone TEXT NOT NULL,
      emergency_address TEXT,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      bed_number TEXT,
      allocation_date DATE,
      status TEXT DEFAULT 'Active',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      hostel_rent REAL NOT NULL,
      mess_fee REAL NOT NULL,
      amenities_fee REAL NOT NULL,
      security_deposit REAL NOT NULL,
      discount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      balance_amount REAL NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL, -- 'Paid', 'Partial', 'Pending', 'Overdue'
      last_payment_date DATE,
      payment_mode TEXT,
      transaction_ref TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      category TEXT NOT NULL, -- 'Electrical', 'Plumbing', 'Wi-Fi / Network', 'Cleanliness', 'Mess / Food', 'Furniture'
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL, -- 'Low', 'Medium', 'High', 'Emergency'
      status TEXT DEFAULT 'Open', -- 'Open', 'In Progress', 'Resolved'
      assigned_staff TEXT,
      warden_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pass_code TEXT UNIQUE NOT NULL,
      visitor_name TEXT NOT NULL,
      visitor_phone TEXT NOT NULL,
      id_type TEXT NOT NULL, -- 'Aadhaar', 'Driver License', 'Passport', 'Voter ID'
      id_number TEXT NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      relationship TEXT NOT NULL,
      purpose TEXT NOT NULL,
      in_time DATETIME NOT NULL,
      out_time DATETIME,
      status TEXT DEFAULT 'Inside Campus', -- 'Inside Campus', 'Departed'
      approved_by TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_name TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration checks for permissions & status columns
  try {
    db.exec(`ALTER TABLE users ADD COLUMN permissions TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active';`);
  } catch (e) {}

  // Update existing users without permissions
  db.exec(`
    UPDATE users SET permissions = '{"can_allocate_rooms":1,"can_manage_complaints":1,"can_issue_gatepass":1,"can_manage_fees":1,"can_view_reports":1}' 
    WHERE role = 'admin' AND (permissions IS NULL OR permissions = '');

    UPDATE users SET permissions = '{"can_allocate_rooms":1,"can_manage_complaints":1,"can_issue_gatepass":1,"can_manage_fees":0,"can_view_reports":1}' 
    WHERE role = 'warden' AND (permissions IS NULL OR permissions = '');

    UPDATE users SET status = 'Active' WHERE status IS NULL;
  `);

  // Seed sample data if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    seedDatabase(db);
  }
}

function seedDatabase(db) {
  console.log('Seeding Smart Hostel database with realistic data...');

  // 1. Users (Admins & Wardens)
  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, role, email, phone, block_assigned, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'admin',
    'admin123',
    'Dr. Rajeshwar Sharma',
    'admin',
    'dean.hostels@campus.edu',
    '+91 98765 43210',
    'All',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  );

  insertUser.run(
    'warden_a',
    'warden123',
    'Prof. K. V. Raman',
    'warden',
    'warden.blocka@campus.edu',
    '+91 98111 22334',
    'Block A',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  );

  insertUser.run(
    'warden_b',
    'warden123',
    'Dr. Sunita Deshmukh',
    'warden',
    'warden.blockb@campus.edu',
    '+91 98222 33445',
    'Block B',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  );

  // 2. Rooms
  const insertRoom = db.prepare(`
    INSERT INTO rooms (room_number, block, floor, room_type, capacity, occupied_beds, monthly_rent, status, amenities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialRooms = [
    // Block A - Boys Emerald Wing
    ['A-101', 'Block A', 1, 'Single Deluxe AC', 1, 1, 9500, 'Full', 'AC, High-Speed Wi-Fi, Attached Bath, Study Desk, Balcony'],
    ['A-102', 'Block A', 1, 'Double Sharing AC', 2, 2, 7000, 'Full', 'AC, Wi-Fi, Attached Bath, Wardrobe, Study Lamps'],
    ['A-103', 'Block A', 1, 'Double Sharing AC', 2, 1, 7000, 'Available', 'AC, Wi-Fi, Attached Bath, Study Desk'],
    ['A-104', 'Block A', 1, 'Triple Sharing', 3, 3, 5000, 'Full', 'Wi-Fi, Balcony, Shared Bath, Personal Lockers'],
    ['A-201', 'Block A', 2, 'Single Deluxe AC', 1, 0, 9500, 'Available', 'AC, Wi-Fi, Attached Bath, Mini Fridge, Study Table'],
    ['A-202', 'Block A', 2, 'Double Sharing AC', 2, 1, 7000, 'Available', 'AC, Wi-Fi, Attached Bath, Dual Cupboards'],
    ['A-203', 'Block A', 2, 'Triple Sharing', 3, 2, 5000, 'Available', 'Wi-Fi, Ceiling Fan, Balcony, Lockers'],
    ['A-204', 'Block A', 2, 'Double Sharing AC', 2, 0, 7000, 'Maintenance', 'AC under servicing, Wi-Fi, Attached Bath'],

    // Block B - Girls Ruby Wing
    ['B-101', 'Block B', 1, 'Single Deluxe AC', 1, 1, 9500, 'Full', 'AC, High-Speed Wi-Fi, Attached Bath, Balcony Garden View'],
    ['B-102', 'Block B', 1, 'Double Sharing AC', 2, 2, 7000, 'Full', 'AC, Wi-Fi, Attached Bath, Dressing Mirror, Cupboard'],
    ['B-103', 'Block B', 1, 'Double Sharing AC', 2, 1, 7000, 'Available', 'AC, Wi-Fi, Attached Bath, Study Tables'],
    ['B-104', 'Block B', 1, 'Triple Sharing', 3, 3, 5000, 'Full', 'Wi-Fi, Balcony, Personal Wardrobes, Common Lounge Access'],
    ['B-201', 'Block B', 2, 'Single Deluxe AC', 1, 1, 9500, 'Full', 'AC, Wi-Fi, Attached Bath, Bookshelf, Executive Chair'],
    ['B-202', 'Block B', 2, 'Double Sharing AC', 2, 0, 7000, 'Available', 'AC, Wi-Fi, Attached Bath, High-Speed Fiber'],
    ['B-203', 'Block B', 2, 'Triple Sharing', 3, 1, 5000, 'Available', 'Wi-Fi, Garden Facing, Wooden Wardrobes'],

    // Block C - International / Scholar Sapphire Wing
    ['C-101', 'Block C', 1, 'Single Deluxe AC', 1, 1, 11000, 'Full', 'Climate AC, High-Speed Wi-Fi, Ensuite Luxury Bath, Smart TV, Refrigerator'],
    ['C-102', 'Block C', 1, 'Double Sharing AC', 2, 2, 8500, 'Full', 'AC, Ergonomic Setup, Attached Bath, Soundproofing'],
    ['C-201', 'Block C', 2, 'Single Deluxe AC', 1, 0, 11000, 'Available', 'AC, High-Speed Wi-Fi, Ensuite Bath, Balcony'],
    ['C-202', 'Block C', 2, 'Double Sharing AC', 2, 1, 8500, 'Available', 'AC, Modern Furniture, Ensuite Bath, Study Cubicles']
  ];

  initialRooms.forEach(r => insertRoom.run(...r));

  // 3. Students
  const insertStudent = db.prepare(`
    INSERT INTO students (
      roll_no, full_name, email, phone, gender, course, year_of_study,
      blood_group, guardian_name, guardian_phone, emergency_address,
      room_id, bed_number, allocation_date, status, avatar
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialStudents = [
    // Allocated students in Block A
    ['STU-2024-001', 'Aarav Mehta', 'aarav.m@campus.edu', '+91 98450 11223', 'Male', 'B.Tech CSE', 3, 'O+', 'Suresh Mehta', '+91 94480 33441', '1204 Lakeview Towers, Bengaluru, KA', 1, 'Bed A', '2025-07-15', 'Active', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-002', 'Vikramaditya Rao', 'vikram.rao@campus.edu', '+91 98770 22334', 'Male', 'B.Tech ECE', 2, 'B+', 'K. Narayana Rao', '+91 94455 66778', 'Plot 45, Banjara Hills, Hyderabad, TS', 2, 'Bed A', '2025-07-16', 'Active', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-003', 'Kabir Singhania', 'kabir.s@campus.edu', '+91 98330 44556', 'Male', 'B.Tech CSE', 2, 'A+', 'Rajiv Singhania', '+91 98200 11992', 'Flat 8B, Cuffe Parade, Mumbai, MH', 2, 'Bed B', '2025-07-16', 'Active', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-004', 'Rohan Kulkarni', 'rohan.k@campus.edu', '+91 97660 55667', 'Male', 'B.Sc Data Science', 1, 'AB+', 'Milind Kulkarni', '+91 94220 88990', '402 Shivajinagar, Pune, MH', 3, 'Bed A', '2025-08-01', 'Active', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-005', 'Arjun Nambiar', 'arjun.n@campus.edu', '+91 94470 66778', 'Male', 'B.Tech Mechanical', 4, 'O-', 'Gopalan Nambiar', '+91 94460 77889', 'Panampilly Nagar, Kochi, KL', 4, 'Bed A', '2025-07-10', 'Active', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-006', 'Devansh Bose', 'devansh.b@campus.edu', '+91 98300 77889', 'Male', 'B.Tech CSE', 3, 'B-', 'Subhash Bose', '+91 98311 22334', 'Salt Lake Sector 3, Kolkata, WB', 4, 'Bed B', '2025-07-10', 'Active', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-007', 'Tushar Verma', 'tushar.v@campus.edu', '+91 98100 88990', 'Male', 'MBA Tech', 1, 'A+', 'Anand Verma', '+91 98110 99001', 'Sector 15, Chandigarh', 4, 'Bed C', '2025-07-10', 'Active', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-008', 'Nikhil Agarwal', 'nikhil.a@campus.edu', '+91 99350 99001', 'Male', 'B.Tech AI', 2, 'O+', 'Pankaj Agarwal', '+91 94150 11223', 'Civil Lines, Kanpur, UP', 6, 'Bed A', '2025-07-20', 'Active', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-009', 'Siddharth Iyer', 'siddharth.i@campus.edu', '+91 98400 12345', 'Male', 'M.Tech AI', 1, 'B+', 'Venkatesh Iyer', '+91 94440 23456', 'Mylapore, Chennai, TN', 7, 'Bed A', '2025-08-05', 'Active', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-010', 'Farhan Khan', 'farhan.k@campus.edu', '+91 98910 23456', 'Male', 'B.Tech CSE', 2, 'O+', 'Tariq Khan', '+91 98180 34567', 'Zakir Nagar, New Delhi, DL', 7, 'Bed B', '2025-08-05', 'Active', 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80'],

    // Allocated students in Block B (Girls)
    ['STU-2024-011', 'Ananya Sharma', 'ananya.s@campus.edu', '+91 98710 34567', 'Female', 'B.Tech CSE', 3, 'A+', 'Col. Vinod Sharma', '+91 98105 45678', 'Defence Colony, New Delhi, DL', 9, 'Bed A', '2025-07-15', 'Active', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-012', 'Pooja Hegde', 'pooja.h@campus.edu', '+91 98451 45678', 'Female', 'B.Tech ECE', 3, 'O+', 'Shankar Hegde', '+91 94481 56789', 'Kodialbail, Mangaluru, KA', 10, 'Bed A', '2025-07-15', 'Active', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-013', 'Diya Sen', 'diya.sen@campus.edu', '+91 98312 56789', 'Female', 'B.Sc Data Science', 2, 'B+', 'Partha Sen', '+91 98302 67890', 'Ballygunge, Kolkata, WB', 10, 'Bed B', '2025-07-16', 'Active', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-014', 'Rhea Chakraborty', 'rhea.c@campus.edu', '+91 98205 67890', 'Female', 'B.Tech Biotech', 2, 'AB+', 'Dr. Alok Chakraborty', '+91 98215 78901', 'Bandra West, Mumbai, MH', 11, 'Bed A', '2025-08-01', 'Active', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-015', 'Meera Krishnan', 'meera.k@campus.edu', '+91 98412 78901', 'Female', 'B.Tech CSE', 4, 'O+', 'S. Krishnan', '+91 94442 89012', 'Anna Nagar, Chennai, TN', 12, 'Bed A', '2025-07-10', 'Active', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-016', 'Tanvi Parekh', 'tanvi.p@campus.edu', '+91 98250 89012', 'Female', 'MBA Tech', 1, 'B-', 'Jitin Parekh', '+91 98240 90123', 'Navrangpura, Ahmedabad, GJ', 12, 'Bed B', '2025-07-10', 'Active', 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-017', 'Sneha Reddy', 'sneha.r@campus.edu', '+91 98490 90123', 'Female', 'B.Tech IT', 1, 'A+', 'P. Ramana Reddy', '+91 94400 01234', 'Madhapur, Hyderabad, TS', 12, 'Bed C', '2025-07-10', 'Active', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-018', 'Kavya Pillai', 'kavya.p@campus.edu', '+91 94475 01234', 'Female', 'M.Tech CSE', 2, 'O-', 'Madhavan Pillai', '+91 94465 12345', 'Vazhuthacaud, Thiruvananthapuram, KL', 13, 'Bed A', '2025-07-12', 'Active', 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-019', 'Ishita Bansal', 'ishita.b@campus.edu', '+91 98115 12345', 'Female', 'B.Tech AI', 2, 'A+', 'Sunil Bansal', '+91 98102 23456', 'Model Town, Jaipur, RJ', 15, 'Bed A', '2025-08-04', 'Active', 'https://images.unsplash.com/photo-1558898479-33c0057a5d12?w=150&auto=format&fit=crop&q=80'],

    // Allocated students in Block C
    ['STU-2024-020', 'Zaid Al-Mansoor', 'zaid.m@campus.edu', '+91 98765 09876', 'Male', 'B.Tech CSE', 3, 'B+', 'Rashid Al-Mansoor', '+971 50 1234567', 'Al Barsha, Dubai, UAE', 16, 'Bed A', '2025-07-14', 'Active', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-021', 'Kiran Patel', 'kiran.p@campus.edu', '+91 98980 12345', 'Male', 'B.Tech Robotics', 4, 'O+', 'Dinesh Patel', '+91 98255 23456', 'Alkapuri, Vadodara, GJ', 17, 'Bed A', '2025-07-15', 'Active', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-022', 'Marcus Chen', 'marcus.c@campus.edu', '+91 99887 66554', 'Male', 'B.Sc Data Science', 2, 'A-', 'David Chen', '+65 9123 4567', 'Tampines Ave 4, Singapore', 17, 'Bed B', '2025-07-15', 'Active', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-023', 'Elena Rostova', 'elena.r@campus.edu', '+91 98112 99887', 'Female', 'M.Tech AI', 1, 'AB+', 'Igor Rostov', '+7 916 555 4321', 'Arbat Street, Moscow, Russia', 19, 'Bed A', '2025-08-01', 'Active', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'],

    // Unallocated Students (Ready for room allocation demo)
    ['STU-2024-024', 'Pranav Mukherjee', 'pranav.m@campus.edu', '+91 98319 00112', 'Male', 'B.Tech Mechanical', 1, 'O+', 'Biplab Mukherjee', '+91 98309 11223', 'Howrah, Kolkata, WB', null, null, null, 'Active', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-025', 'Shruti Shrivastava', 'shruti.s@campus.edu', '+91 98270 33445', 'Female', 'B.Tech CSE', 1, 'B+', 'Hemant Shrivastava', '+91 94250 44556', 'Arera Colony, Bhopal, MP', null, null, null, 'Active', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'],
    ['STU-2024-026', 'Yashraj Chauhan', 'yashraj.c@campus.edu', '+91 98290 55667', 'Male', 'B.Tech Civil', 1, 'A+', 'Vikram Chauhan', '+91 94140 66778', 'C-Scheme, Jaipur, RJ', null, null, null, 'Active', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80']
  ];

  initialStudents.forEach(s => insertStudent.run(...s));

  // 4. Fees
  const insertFee = db.prepare(`
    INSERT INTO fees (
      invoice_no, student_id, academic_year, semester,
      hostel_rent, mess_fee, amenities_fee, security_deposit, discount,
      total_amount, paid_amount, balance_amount, due_date, status,
      last_payment_date, payment_mode, transaction_ref, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialFees = [
    // Paid fees
    ['INV-2026-001', 1, '2025-2026', 'Fall 2025', 57000, 24000, 6000, 10000, 0, 97000, 97000, 0, '2025-08-15', 'Paid', '2025-08-10', 'UPI', 'UPI/20250810/893271', 'Full payment verified via HDFC Gateway'],
    ['INV-2026-002', 2, '2025-2026', 'Fall 2025', 42000, 24000, 5000, 10000, 2000, 79000, 79000, 0, '2025-08-15', 'Paid', '2025-08-12', 'Net Banking', 'NEFT/SBIN002931/092', 'Merit scholarship discount ₹2,000 applied'],
    ['INV-2026-003', 3, '2025-2026', 'Fall 2025', 42000, 24000, 5000, 10000, 0, 81000, 81000, 0, '2025-08-15', 'Paid', '2025-08-14', 'Credit Card', 'TXN-ICICI-881902', 'Paid online via Razorpay'],
    ['INV-2026-004', 11, '2025-2026', 'Fall 2025', 57000, 24000, 6000, 10000, 0, 97000, 97000, 0, '2025-08-15', 'Paid', '2025-08-09', 'UPI', 'UPI/20250809/119283', 'Defence personnel child fee concession checked'],
    ['INV-2026-005', 12, '2025-2026', 'Fall 2025', 42000, 24000, 5000, 10000, 0, 81000, 81000, 0, '2025-08-15', 'Paid', '2025-08-11', 'Net Banking', 'NEFT/AXIS89102/441', 'Verified by accounts desk'],
    ['INV-2026-006', 20, '2025-2026', 'Fall 2025', 66000, 24000, 8000, 15000, 0, 113000, 113000, 0, '2025-08-15', 'Paid', '2025-08-05', 'Net Banking', 'SWIFT/DXB889021', 'International student wire transfer'],

    // Partial payments
    ['INV-2026-007', 4, '2025-2026', 'Fall 2025', 42000, 24000, 5000, 10000, 0, 81000, 50000, 31000, '2025-09-30', 'Partial', '2025-08-20', 'UPI', 'UPI/20250820/998123', 'First installment cleared; second installment due Sep 30'],
    ['INV-2026-008', 13, '2025-2026', 'Fall 2025', 42000, 24000, 5000, 10000, 0, 81000, 45000, 36000, '2025-09-30', 'Partial', '2025-08-18', 'Debit Card', 'POS/HDFC/554109', 'Installment 1 paid'],
    ['INV-2026-009', 21, '2025-2026', 'Fall 2025', 51000, 24000, 6000, 15000, 0, 96000, 60000, 36000, '2025-09-30', 'Partial', '2025-08-15', 'Net Banking', 'NEFT/BOB99812/332', 'Cheque cleared for 1st half'],

    // Overdue Defaulters
    ['INV-2026-010', 5, '2025-2026', 'Fall 2025', 30000, 24000, 4000, 10000, 0, 68000, 20000, 48000, '2025-08-15', 'Overdue', '2025-07-28', 'Cash', 'RCP-CASH-0982', 'Reminder notice #2 sent to guardian'],
    ['INV-2026-011', 6, '2025-2026', 'Fall 2025', 30000, 24000, 4000, 10000, 0, 68000, 0, 68000, '2025-08-15', 'Overdue', null, null, null, 'Final notice sent via email and SMS'],
    ['INV-2026-012', 14, '2025-2026', 'Fall 2025', 42000, 24000, 5000, 10000, 0, 81000, 0, 81000, '2025-08-15', 'Overdue', null, null, null, 'Medical emergency leave reported, payment awaited'],
    ['INV-2026-013', 8, '2025-2026', 'Fall 2025', 42000, 24000, 5000, 10000, 0, 81000, 25000, 56000, '2025-08-15', 'Overdue', '2025-08-01', 'UPI', 'UPI/20250801/665421', 'Guardian promised clearance by next week'],

    // Pending regular
    ['INV-2026-014', 7, '2025-2026', 'Fall 2025', 30000, 24000, 4000, 10000, 0, 68000, 0, 68000, '2025-11-15', 'Pending', null, null, null, 'New admission fee payment pending'],
    ['INV-2026-015', 15, '2025-2026', 'Fall 2025', 30000, 24000, 4000, 10000, 0, 68000, 0, 68000, '2025-11-15', 'Pending', null, null, null, 'Fee challan generated']
  ];

  initialFees.forEach(f => insertFee.run(...f));

  // 5. Complaints
  const insertComplaint = db.prepare(`
    INSERT INTO complaints (
      ticket_no, student_id, room_id, category, title, description,
      priority, status, assigned_staff, warden_notes, created_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialComplaints = [
    ['CMP-2026-001', 1, 1, 'Electrical', 'AC Unit not cooling effectively', 'The split AC is blowing normal fan air and showing E4 error code intermittently.', 'High', 'In Progress', 'Suresh - Technician', 'Technician dispatched to inspect refrigerant pressure.', '2026-10-24 10:15:00', null],
    ['CMP-2026-002', 2, 2, 'Wi-Fi / Network', 'Frequent Wi-Fi disconnects on 5GHz', 'Signal strength fluctuates between 1 bar and full; online exam portal disconnected.', 'Medium', 'Open', 'Pravin - IT Support', null, '2026-10-25 09:30:00', null],
    ['CMP-2026-003', 11, 9, 'Plumbing', 'Bathroom tap dripping continuously', 'Cold water tap in the bathroom washbasin has a steady drip, wasting water.', 'Low', 'Resolved', 'Mani - Plumber', 'Washer replaced. Issue resolved.', '2026-10-22 14:00:00', '2026-10-23 11:20:00'],
    ['CMP-2026-004', 12, 10, 'Furniture', 'Study table drawer lock jammed', 'Key got stuck inside drawer cylinder lock, cannot access textbooks.', 'Low', 'In Progress', 'Govind - Carpenter', 'Lock lubricant applied, replacement cylinder ordered.', '2026-10-24 16:45:00', null],
    ['CMP-2026-005', 5, 4, 'Electrical', 'Power socket sparking near bed C', 'The wall plug sparks when charging laptop charger. Potential safety hazard!', 'Emergency', 'Open', 'Suresh - Technician', 'Urgent work order created. Power circuit breaker turned off for socket.', '2026-10-25 15:10:00', null],
    ['CMP-2026-006', 15, 12, 'Cleanliness', 'Balcony drain clogged due to dry leaves', 'Rainwater is not draining smoothly from the balcony terrace.', 'Medium', 'Resolved', 'Lata - Housekeeping', 'Balcony cleaned and drain unclogged.', '2026-10-23 08:30:00', '2026-10-23 12:00:00'],
    ['CMP-2026-007', 20, 16, 'Mess / Food', 'Request for lactose-free meal option in Block C mess', 'Requesting soy/almond milk and curd alternatives for dinner.', 'Low', 'Resolved', 'Chef Anand - Mess Warden', 'Approved by hostel dietitian. Special counter designated.', '2026-10-21 19:00:00', '2026-10-22 10:00:00']
  ];

  initialComplaints.forEach(c => insertComplaint.run(...c));

  // 6. Visitors
  const insertVisitor = db.prepare(`
    INSERT INTO visitors (
      pass_code, visitor_name, visitor_phone, id_type, id_number,
      student_id, relationship, purpose, in_time, out_time, status, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialVisitors = [
    // Currently Inside Campus
    ['VP-9101', 'Suresh Mehta', '+91 94480 33441', 'Aadhaar', '8821-4432-1920', 1, 'Father', 'Delivering study materials and seasonal clothing', '2026-10-25 16:30:00', null, 'Inside Campus', 'Prof. K. V. Raman'],
    ['VP-9102', 'Partha Sen', '+91 98302 67890', 'Driver License', 'WB-01-2018-9921', 13, 'Father', 'Weekend family meetup before semester exams', '2026-10-25 17:15:00', null, 'Inside Campus', 'Dr. Sunita Deshmukh'],
    ['VP-9103', 'Ananya Deshpande', '+91 98221 44556', 'Aadhaar', '3342-9901-2341', 11, 'Friend', 'Group study project submission discussion', '2026-10-25 18:00:00', null, 'Inside Campus', 'Dr. Sunita Deshmukh'],

    // Past Visitors (Departed)
    ['VP-9088', 'Rajiv Singhania', '+91 98200 11992', 'Passport', 'Z-8910231', 3, 'Father', 'Hostel admission fee verification and room check', '2026-10-24 11:00:00', '2026-10-24 14:30:00', 'Departed', 'Prof. K. V. Raman'],
    ['VP-9089', 'Milind Kulkarni', '+91 94220 88990', 'Aadhaar', '9912-3344-5566', 4, 'Father', 'Checking on student health and medical checkup', '2026-10-23 10:15:00', '2026-10-23 13:00:00', 'Departed', 'Prof. K. V. Raman'],
    ['VP-9090', 'Dr. Alok Chakraborty', '+91 98215 78901', 'Aadhaar', '4412-8822-1100', 14, 'Father', 'Medical leave documents handover to hostel office', '2026-10-22 15:30:00', '2026-10-22 17:45:00', 'Departed', 'Dr. Sunita Deshmukh']
  ];

  initialVisitors.forEach(v => insertVisitor.run(...v));

  // 7. Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (action, user_name, details, timestamp)
    VALUES (?, ?, ?, ?)
  `);

  insertAudit.run('System Initialized', 'System', 'Smart Hostel Management System database initialized with complete schemas.', '2026-10-20 08:00:00');
  insertAudit.run('Room Allocation', 'admin', 'Allocated Student Aarav Mehta (STU-2024-001) to Room A-101 (Bed A).', '2026-10-20 09:30:00');
  insertAudit.run('Fee Payment Recorded', 'admin', 'Recorded ₹97,000 payment for Invoice INV-2026-001 (Aarav Mehta).', '2026-10-20 11:15:00');
  insertAudit.run('Visitor Pass Generated', 'warden_a', 'Issued Visitor Pass VP-9101 for Suresh Mehta visiting Aarav Mehta.', '2026-10-25 16:30:00');
  insertAudit.run('Emergency Complaint Logged', 'warden_a', 'Logged Emergency Complaint CMP-2026-005 for Room A-104 (Electrical Spark).', '2026-10-25 15:10:00');

  console.log('Smart Hostel database seeded successfully!');
}

module.exports = {
  getDB,
  initDB
};
