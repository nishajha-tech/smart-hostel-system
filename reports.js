// Curated SQL Reports for Smart Hostel Management System

const SQL_REPORTS = [
  {
    id: 'occupancy_by_block',
    title: 'Block Occupancy & Capacity Utilization',
    category: 'Occupancy & Rooms',
    description: 'Calculates total rooms, bed capacity, occupied beds, vacancy, and utilization percentage for each residential block.',
    chartType: 'bar',
    recommendedFor: 'Warden & Dean',
    query: `SELECT 
  r.block AS "Block Name",
  COUNT(r.id) AS "Total Rooms",
  SUM(r.capacity) AS "Total Beds",
  SUM(r.occupied_beds) AS "Occupied Beds",
  SUM(r.capacity - r.occupied_beds) AS "Vacant Beds",
  ROUND((CAST(SUM(r.occupied_beds) AS REAL) / SUM(r.capacity)) * 100, 1) || '%' AS "Occupancy Rate"
FROM rooms r
GROUP BY r.block
ORDER BY r.block ASC;`
  },
  {
    id: 'fee_defaulters_priority',
    title: 'Outstanding Fee Defaulters (> ₹10,000)',
    category: 'Finance & Billing',
    description: 'Lists all students with pending dues exceeding ₹10,000 along with guardian contacts for billing follow-up.',
    chartType: 'table',
    recommendedFor: 'Admin & Accounts',
    query: `SELECT 
  s.roll_no AS "Roll Number",
  s.full_name AS "Student Name",
  COALESCE(r.room_number, 'Unallocated') AS "Room",
  r.block AS "Block",
  f.invoice_no AS "Invoice No",
  '₹' || printf('%,d', CAST(f.total_amount AS INT)) AS "Total Billed",
  '₹' || printf('%,d', CAST(f.paid_amount AS INT)) AS "Amount Paid",
  '₹' || printf('%,d', CAST(f.balance_amount AS INT)) AS "Balance Due",
  f.due_date AS "Due Date",
  f.status AS "Status",
  s.phone AS "Student Phone",
  s.guardian_phone AS "Guardian Contact"
FROM fees f
JOIN students s ON f.student_id = s.id
LEFT JOIN rooms r ON s.room_id = r.id
WHERE f.balance_amount > 10000
ORDER BY f.balance_amount DESC;`
  },
  {
    id: 'complaint_sla_analytics',
    title: 'Complaints Turnaround & SLA Matrix',
    category: 'Maintenance & Operations',
    description: 'Breaks down maintenance tickets by category, displaying resolution counts and active emergency tickets.',
    chartType: 'bar',
    recommendedFor: 'Hostel Warden',
    query: `SELECT 
  c.category AS "Category",
  COUNT(c.id) AS "Total Lodged",
  SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) AS "Resolved",
  SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END) AS "In Progress",
  SUM(CASE WHEN c.status = 'Open' THEN 1 ELSE 0 END) AS "Open / Pending",
  SUM(CASE WHEN c.priority = 'Emergency' THEN 1 ELSE 0 END) AS "Emergency Priority"
FROM complaints c
GROUP BY c.category
ORDER BY "Open / Pending" DESC, "Total Lodged" DESC;`
  },
  {
    id: 'active_campus_visitors',
    title: 'Visitors Currently Inside Campus',
    category: 'Security & Gate Pass',
    description: 'Displays all non-resident visitors currently checked in, duration of stay, and security approval officers.',
    chartType: 'table',
    recommendedFor: 'Chief Security & Warden',
    query: `SELECT 
  v.pass_code AS "Gate Pass",
  v.visitor_name AS "Visitor Name",
  v.visitor_phone AS "Phone",
  s.full_name AS "Student Visited",
  s.roll_no AS "Student Roll",
  COALESCE(r.room_number, 'N/A') AS "Room",
  v.relationship AS "Relationship",
  v.purpose AS "Visit Purpose",
  v.in_time AS "Entry Time",
  v.approved_by AS "Approved By"
FROM visitors v
JOIN students s ON v.student_id = s.id
LEFT JOIN rooms r ON s.room_id = r.id
WHERE v.status = 'Inside Campus'
ORDER BY v.in_time DESC;`
  },
  {
    id: 'room_type_yield',
    title: 'Room Type Distribution & Revenue Potential',
    category: 'Finance & Planning',
    description: 'Aggregates monthly rental revenue yield and capacity based on room tier (Deluxe, AC, Standard).',
    chartType: 'pie',
    recommendedFor: 'Dean & Financial Controller',
    query: `SELECT 
  r.room_type AS "Room Category",
  COUNT(r.id) AS "Total Rooms",
  SUM(r.capacity) AS "Total Beds",
  SUM(r.occupied_beds) AS "Occupied",
  '₹' || printf('%,d', CAST(SUM(r.occupied_beds * r.monthly_rent) AS INT)) AS "Current Monthly Rent Yield",
  '₹' || printf('%,d', CAST(SUM(r.capacity * r.monthly_rent) AS INT)) AS "Max Revenue Potential"
FROM rooms r
GROUP BY r.room_type
ORDER BY "Total Beds" DESC;`
  },
  {
    id: 'emergency_blood_registry',
    title: 'Hostel Emergency Contacts & Blood Group Directory',
    category: 'Student Welfare',
    description: 'Essential medical emergency directory showing blood groups, resident rooms, and guardian numbers.',
    chartType: 'table',
    recommendedFor: 'Medical Officer & Warden',
    query: `SELECT 
  s.roll_no AS "Roll No",
  s.full_name AS "Student Name",
  s.blood_group AS "Blood Group",
  r.block AS "Block",
  r.room_number AS "Room",
  s.phone AS "Student Phone",
  s.guardian_name AS "Guardian",
  s.guardian_phone AS "Emergency Contact",
  s.emergency_address AS "Home Address"
FROM students s
LEFT JOIN rooms r ON s.room_id = r.id
WHERE s.status = 'Active'
ORDER BY r.block, r.room_number;`
  }
];

module.exports = { SQL_REPORTS };
