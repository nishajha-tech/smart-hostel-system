// ==========================================================================
// SMARTHOSTEL 360 - FRONTEND APPLICATION CORE ENGINE
// ==========================================================================

const STATE = {
  currentView: 'dashboard',
  currentUser: null,
  students: [],
  rooms: [],
  fees: [],
  complaints: [],
  visitors: [],
  sqlReports: [],
  dbSchema: [],
  currentSqlResult: null,
  selectedBlock: 'Block A'
};

// ==========================================
// UTILITY FUNCTIONS (TOASTS & HTML ESCAPING)
// ==========================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const icon = iconMap[type] || 'ℹ';
  toast.innerHTML = `
    <span style="font-weight: 700; font-size: 1.1rem; flex-shrink: 0;">${icon}</span>
    <span style="flex: 1; word-break: break-word;">${escapeHtml(message)}</span>
    <button style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1rem; padding: 0 4px; line-height: 1;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  await loadCurrentUser();
  await refreshDashboard();
  setupRouteFromHash();
});

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link[data-view]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      navigateTo(targetView);
    });
  });

  window.addEventListener('hashchange', setupRouteFromHash);
}

function setupRouteFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash && ['dashboard', 'students', 'rooms', 'fees', 'complaints', 'visitors', 'sql', 'wardens'].includes(hash)) {
    navigateTo(hash);
  } else {
    navigateTo('dashboard');
  }
}

function navigateTo(viewId) {
  STATE.currentView = viewId;
  window.location.hash = viewId;

  // Update active sidebar nav
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Switch view section visibility
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  const targetSection = document.getElementById(`view-${viewId}`);
  if (targetSection) targetSection.classList.add('active');

  // Update Topbar Title & Subtitle
  const titles = {
    dashboard: { title: 'Hostel Overview & Metrics', sub: 'Campus residential status, occupancy analytics and active alerts' },
    students: { title: 'Student Registration & Directory', sub: 'Comprehensive records, enrollments, and room allocation profiles' },
    rooms: { title: 'Room Allocation & Interactive Matrix', sub: 'Visual floor plan, bed assignments, and capacity tracking' },
    fees: { title: 'Fee Records & Payment Ledger', sub: 'Semester dues tracking, payment processing, and digital invoice receipts' },
    complaints: { title: 'Complaints & Maintenance Desk', sub: 'Facility service requests, technician assignment, and SLA turnaround' },
    visitors: { title: 'Visitor Gate Pass & Campus Security', sub: 'Live visitor tracking, digital gate passes, and entry/exit logs' },
    sql: { title: 'SQL Reports & Analytical Query Lab', sub: 'Run live SQLite queries, explore database schema, and export analytics' },
    wardens: { title: 'Warden Accounts & Access Control', sub: 'Admin Authority: Grant, modify, or revoke block access and privileges' }
  };

  if (titles[viewId]) {
    document.getElementById('topbarTitle').textContent = titles[viewId].title;
    document.getElementById('topbarSubtitle').textContent = titles[viewId].sub;
  }

  // Load relevant data for the view
  switch (viewId) {
    case 'dashboard':
      refreshDashboard();
      break;
    case 'students':
      loadStudents();
      break;
    case 'rooms':
      loadRoomsMatrix();
      break;
    case 'fees':
      loadFees();
      break;
    case 'complaints':
      loadComplaints();
      break;
    case 'visitors':
      loadVisitors();
      break;
    case 'sql':
      loadSqlEnvironment();
      break;
    case 'wardens':
      loadWardens();
      break;
  }
}

// ==========================================================================
// USER & ROLE MANAGEMENT
// ==========================================================================
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/current');
    const data = await res.json();
    if (data.success) {
      STATE.currentUser = data.user;
      renderCurrentUser();
    }
  } catch (err) {
    console.error('Failed to load user:', err);
  }
}

function renderCurrentUser() {
  const user = STATE.currentUser;
  if (!user) return;

  document.getElementById('topbarUserName').textContent = user.name;
  document.getElementById('topbarUserRole').textContent = user.role === 'admin' 
    ? 'Chief Warden & Admin' 
    : `Hostel Warden (${user.block_assigned || 'Block A'})`;

  if (user.avatar) {
    document.getElementById('topbarUserAvatar').src = user.avatar;
  }

  // Update switcher buttons state
  const btnAdmin = document.getElementById('btnRoleAdmin');
  const btnWarden = document.getElementById('btnRoleWarden');
  if (user.role === 'admin') {
    btnAdmin.classList.add('active');
    btnWarden.classList.remove('active');
  } else {
    btnWarden.classList.add('active');
    btnAdmin.classList.remove('active');
  }
}

async function switchUserRole(username) {
  try {
    const res = await fetch('/api/auth/switch-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (data.success) {
      STATE.currentUser = data.user;
      renderCurrentUser();
      showToast(`Switched active profile to ${data.user.name} (${data.user.role.toUpperCase()})`, 'info');
      // Refresh current view to update permissions
      navigateTo(STATE.currentView);
    }
  } catch (err) {
    showToast('Failed to switch user persona: ' + err.message, 'error');
  }
}

function showUserProfileModal() {
  const user = STATE.currentUser;
  if (!user) return;
  if (user.role === 'admin') {
    openAdminProfileModal();
  } else {
    alert(`Logged in as Hostel Warden:\nName: ${user.name}\nBlock Assigned: ${user.block_assigned}\nEmail: ${user.email}`);
  }
}

// ==========================================================================
// 1. DASHBOARD OVERVIEW LOGIC
// ==========================================================================
async function refreshDashboard() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const json = await res.json();
    if (!json.success) return;

    const d = json.data;

    // KPI Numbers
    document.getElementById('kpiTotalStudents').textContent = d.totalStudents;
    document.getElementById('kpiOccupancyRate').textContent = `${d.occupancyRate}%`;
    document.getElementById('kpiBedsRatio').textContent = `${d.occupiedBeds} of ${d.totalBeds} Beds Occupied (${d.vacantBeds} Vacant)`;
    document.getElementById('kpiFeeCollected').textContent = `₹${(d.feeStats.totalCollected || 0).toLocaleString('en-IN')}`;
    document.getElementById('kpiPendingDues').textContent = `₹${(d.feeStats.totalDues || 0).toLocaleString('en-IN')}`;
    document.getElementById('kpiOverdueCount').textContent = `${d.feeStats.overdueCount} Defaulters`;
    document.getElementById('kpiOpenComplaints').textContent = d.complaints.totalOpen;
    document.getElementById('kpiEmergencyAlert').textContent = `${d.complaints.emergencyCount} Emergency Alert${d.complaints.emergencyCount === 1 ? '' : 's'}`;
    document.getElementById('kpiActiveVisitors').textContent = d.activeVisitors;

    // Badges in Sidebar
    document.getElementById('navOverduePill').textContent = `${d.feeStats.overdueCount} Overdue`;
    document.getElementById('navEmergencyPill').textContent = `${d.complaints.emergencyCount} Alert`;
    document.getElementById('navActiveVisitorsPill').textContent = `${d.activeVisitors} In`;
    document.getElementById('badgeActiveCount').textContent = `${d.activeVisitors} Active`;

    // Render Block Occupancy Bars
    const barsContainer = document.getElementById('blockOccupancyBars');
    barsContainer.innerHTML = d.blockStats.map(b => {
      const pct = b.total_beds > 0 ? ((b.occupied_beds / b.total_beds) * 100).toFixed(0) : 0;
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
            <span style="font-weight: 600; color: #FFF;">${b.block}</span>
            <span style="color: var(--accent-cyan); font-weight: 600;">${b.occupied_beds}/${b.total_beds} Beds (${pct}%)</span>
          </div>
          <div style="height: 10px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; position: relative;">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #6366F1, #06B6D4); border-radius: 6px; transition: width 0.6s ease;"></div>
          </div>
        </div>
      `;
    }).join('');

    // Render Active Visitors List
    const visitorsContainer = document.getElementById('dashboardVisitorsList');
    if (d.recentVisitors && d.recentVisitors.length > 0) {
      visitorsContainer.innerHTML = d.recentVisitors.map(v => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(30, 41, 59, 0.5); border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-size: 0.86rem; font-weight: 600; color: #FFF;">${escapeHtml(v.visitor_name)} <span style="font-size: 0.72rem; color: var(--accent-cyan);">(${v.relationship})</span></div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">Visiting ${escapeHtml(v.student_name)} (${v.room_number || 'N/A'})</div>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-success">${v.pass_code}</span>
            <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">In: ${v.in_time.split(' ')[1] || v.in_time}</div>
          </div>
        </div>
      `).join('');
    } else {
      visitorsContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">No visitors currently on campus.</div>`;
    }

    // Render Sample Students Roster on Dashboard
    const stuTable = document.getElementById('dashboardStudentsTable');
    if (stuTable && d.sampleStudents) {
      stuTable.innerHTML = d.sampleStudents.map(s => {
        const roomBadge = s.room_number !== 'Unallocated'
          ? `<span class="badge badge-success">${s.room_number} (${s.bed_number || 'Bed'})</span>`
          : `<span class="badge badge-warning">Unallocated</span>`;

        let feeBadge = 'badge-success';
        if (s.fee_status === 'Partial') feeBadge = 'badge-warning';
        if (s.fee_status === 'Overdue') feeBadge = 'badge-danger';
        if (s.fee_status === 'Pending') feeBadge = 'badge-info';

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${s.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" alt="${escapeHtml(s.full_name)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-subtle);">
                <div>
                  <div style="font-weight: 600; color: #FFF;">${escapeHtml(s.full_name)}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(s.email)}</div>
                </div>
              </div>
            </td>
            <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);">${escapeHtml(s.roll_no)}</td>
            <td>
              <div style="font-weight: 500;">${escapeHtml(s.course)}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">Year ${s.year_of_study}</div>
            </td>
            <td>
              ${roomBadge}
              <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">${s.block}</div>
            </td>
            <td>
              <div style="font-weight: 500;">${escapeHtml(s.guardian_name)}</div>
              <div style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-muted);">${escapeHtml(s.guardian_phone)}</div>
            </td>
            <td>
              <span class="badge badge-purple">${s.blood_group || 'O+'}</span>
            </td>
            <td>
              <span class="badge ${feeBadge}">${s.fee_status}</span>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render Recent Activity Logs
    const actBody = document.getElementById('dashboardActivityTable');
    actBody.innerHTML = d.recentActivities.map(a => `
      <tr>
        <td style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted); white-space: nowrap;">${a.timestamp}</td>
        <td><span class="badge badge-purple">${escapeHtml(a.action)}</span></td>
        <td style="font-weight: 600;">${escapeHtml(a.user_name)}</td>
        <td style="color: var(--text-muted); font-size: 0.82rem;">${escapeHtml(a.details)}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ==========================================
// 2. STUDENT DIRECTORY LOGIC
// ==========================================
async function loadStudents() {
  const search = document.getElementById('searchStudentInput').value;
  const block = document.getElementById('filterStudentBlock').value;
  const alloc = document.getElementById('filterStudentAllocation').value;
  const course = document.getElementById('filterStudentCourse').value;

  const url = new URL('/api/students', window.location.origin);
  if (search) url.searchParams.set('search', search);
  if (block && block !== 'All') url.searchParams.set('block', block);
  if (alloc && alloc !== 'All') url.searchParams.set('allocation', alloc);
  if (course && course !== 'All') url.searchParams.set('course', course);

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    STATE.students = json.data;
    renderStudentsTable(STATE.students);
  } catch (err) {
    showToast('Failed to load students: ' + err.message, 'error');
  }
}

function filterStudents() {
  loadStudents();
}

function renderStudentsTable(students) {
  // Render Spotlight Cards for Students Directory (Khaas Baache & Profiles)
  const spotlightGrid = document.getElementById('studentsDirectorySpotlightGrid');
  if (spotlightGrid) {
    const featured = students.slice(0, 4);
    if (featured.length === 0) {
      spotlightGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-dim); text-align: center; padding: 20px;">No students to display.</div>`;
    } else {
      spotlightGrid.innerHTML = featured.map(s => `
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${s.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" alt="${escapeHtml(s.full_name)}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
            <div style="overflow: hidden;">
              <div style="font-weight: 700; color: #FFF; font-size: 0.9rem; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${escapeHtml(s.full_name)}</div>
              <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--accent-cyan);">${escapeHtml(s.roll_no)}</div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
            <span>${escapeHtml(s.course)} (${s.year_of_study} yr)</span>
            <span style="font-weight: 600; color: #FFF;">${s.room_number ? `${s.room_number}` : 'Waiting Bed'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem;">
            <span class="badge badge-purple">${s.block || 'General'}</span>
            <span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${s.status}</span>
          </div>
        </div>
      `).join('');
    }
  }

  const tbody = document.getElementById('studentsTableBody');
  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">No students matching your search criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const roomBadge = s.room_number 
      ? `<span class="badge badge-success" style="font-size: 0.78rem;">${s.room_number} (${s.bed_number || 'Bed'})</span>`
      : `<span class="badge badge-warning" style="font-size: 0.78rem;">Unallocated</span>`;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${s.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" alt="${escapeHtml(s.full_name)}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-subtle);">
            <div>
              <div style="font-weight: 600; color: #FFF;">${escapeHtml(s.full_name)}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">${escapeHtml(s.email)}</div>
            </div>
          </div>
        </td>
        <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);">${escapeHtml(s.roll_no)}</td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(s.course)}</div>
          <div style="font-size: 0.74rem; color: var(--text-dim);">Year ${s.year_of_study}</div>
        </td>
        <td>
          ${roomBadge}
          <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 3px;">${s.block || 'No Block'}</div>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 500;">${escapeHtml(s.guardian_name)}</div>
          <div style="font-size: 0.74rem; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(s.guardian_phone)}</div>
        </td>
        <td>
          <span class="badge ${s.status === 'Active' ? 'badge-info' : 'badge-danger'}">${s.status}</span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${s.room_id ? `
              <button class="btn btn-sm btn-secondary" onclick="deallocateStudent(${s.id}, '${escapeHtml(s.full_name)}')">Deallocate</button>
            ` : `
              <button class="btn btn-sm btn-cyan" onclick="navigateTo('rooms')">Assign Bed</button>
            `}
            <button class="btn btn-sm btn-danger btn-icon-only" title="Delete Student" onclick="deleteStudent(${s.id}, '${escapeHtml(s.full_name)}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openStudentModal() {
  const form = document.getElementById('formStudent');
  form.reset();
  const rollInput = form.querySelector('input[name="roll_no"]');
  if (rollInput) {
    const nextNum = (STATE.students && STATE.students.length > 0)
      ? Math.max(...STATE.students.map(s => {
          const m = (s.roll_no || '').match(/\d+$/);
          return m ? parseInt(m[0], 10) : 0;
        })) + 1
      : 29;
    rollInput.value = `STU-2024-${String(nextNum).padStart(3, '0')}`;
  }
  openModal('modalStudent');
}

async function handleRegisterStudent(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : 'Complete Registration';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';
  }

  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Student ${body.full_name} registered successfully!`, 'success');
      closeModal('modalStudent');
      e.target.reset();
      await loadStudents();
      await refreshDashboard();
    } else {
      showToast(json.message || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Failed to register student: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

async function deallocateStudent(studentId, studentName) {
  if (!confirm(`Are you sure you want to deallocate room for ${studentName}?`)) return;

  try {
    const res = await fetch('/api/rooms/deallocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Room deallocated for ${studentName}`, 'success');
      loadStudents();
      loadRoomsMatrix();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Deallocation failed: ' + err.message, 'error');
  }
}

async function deleteStudent(studentId, studentName) {
  if (!confirm(`Permanently remove student ${studentName}? This will deallocate any room and clear fee records.`)) return;

  try {
    const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(`Student ${studentName} removed`, 'info');
      loadStudents();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to delete student: ' + err.message, 'error');
  }
}

// ==========================================
// 3. ROOM ALLOCATION MATRIX LOGIC
// ==========================================
function selectRoomBlock(blockName) {
  STATE.selectedBlock = blockName;
  document.querySelectorAll('.block-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (blockName === 'Block A') document.getElementById('tabBlockA').classList.add('active');
  if (blockName === 'Block B') document.getElementById('tabBlockB').classList.add('active');
  if (blockName === 'Block C') document.getElementById('tabBlockC').classList.add('active');
  loadRoomsMatrix();
}

async function loadRoomsMatrix() {
  const floor = document.getElementById('filterRoomFloor').value;
  const status = document.getElementById('filterRoomStatus').value;

  const url = new URL('/api/rooms', window.location.origin);
  url.searchParams.set('block', STATE.selectedBlock);
  if (floor && floor !== 'All') url.searchParams.set('floor', floor);
  if (status && status !== 'All') url.searchParams.set('status', status);

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    STATE.rooms = json.data;
    renderRoomsMatrix(STATE.rooms);
  } catch (err) {
    showToast('Failed to load rooms: ' + err.message, 'error');
  }
}

function renderRoomsMatrix(rooms) {
  const grid = document.getElementById('roomsMatrixGrid');
  if (rooms.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-dim);">No rooms match your filter.</div>`;
    return;
  }

  grid.innerHTML = rooms.map(room => {
    // Generate bed slots based on room capacity (Bed A, Bed B, Bed C, Bed D)
    const bedLabels = ['Bed A', 'Bed B', 'Bed C', 'Bed D'].slice(0, room.capacity);

    const bedsHtml = bedLabels.map(label => {
      const occupant = room.residents.find(r => r.bed_number === label);

      if (occupant) {
        return `
          <div class="bed-slot occupied" title="Occupied by ${escapeHtml(occupant.full_name)} (${occupant.roll_no})">
            <div class="bed-info-left">
              <span class="bed-label" style="color: var(--primary);">${label}</span>
              <span class="bed-student-name">${escapeHtml(occupant.full_name.split(' ')[0])}</span>
            </div>
            <button class="btn btn-sm btn-danger btn-icon-only" style="padding: 3px 6px; font-size: 0.65rem;" title="Deallocate Bed" onclick="deallocateStudent(${occupant.id}, '${escapeHtml(occupant.full_name)}')">
              &times;
            </button>
          </div>
        `;
      } else {
        const isMaintenance = room.status === 'Maintenance';
        return `
          <div class="bed-slot empty ${isMaintenance ? 'disabled' : ''}" onclick="${isMaintenance ? '' : `openAllocateBedModal(${room.id}, '${room.room_number}', '${label}')`}">
            <div class="bed-info-left">
              <span class="bed-label">${label}</span>
              <span style="font-size: 0.72rem; color: ${isMaintenance ? 'var(--danger)' : 'var(--success)'};">${isMaintenance ? 'Service' : '+ Empty'}</span>
            </div>
            <svg class="bed-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </div>
        `;
      }
    }).join('');

    const statusBadge = room.status === 'Full' 
      ? '<span class="badge badge-danger">Full</span>'
      : room.status === 'Maintenance'
      ? '<span class="badge badge-warning">Maintenance</span>'
      : '<span class="badge badge-success">Available</span>';

    return `
      <div class="room-card">
        <div class="room-card-header">
          <div class="room-number-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            ${room.room_number}
          </div>
          ${statusBadge}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
          <span class="room-type-pill">${room.room_type}</span>
          <span style="font-weight: 700; color: #FFF;">₹${room.monthly_rent.toLocaleString('en-IN')}<span style="font-size: 0.7rem; color: var(--text-dim); font-weight: normal;">/mo</span></span>
        </div>

        <div style="font-size: 0.74rem; color: var(--text-dim);">
          ${room.amenities ? room.amenities.split(',').slice(0, 3).join(' • ') : 'Standard Amenities'}
        </div>

        <!-- Bed Allocation Matrix for this Room -->
        <div class="room-beds-container">
          ${bedsHtml}
        </div>
      </div>
    `;
  }).join('');

  // Populate Resident Students in this Block (Baacho Ka Room Allocation)
  const residents = [];
  rooms.forEach(r => {
    if (r.residents && r.residents.length > 0) {
      r.residents.forEach(res => {
        residents.push({
          ...res,
          room_number: r.room_number,
          room_type: r.room_type,
          monthly_rent: r.monthly_rent,
          block: r.block
        });
      });
    }
  });

  const countEl = document.getElementById('roomBlockStudentsCount');
  if (countEl) {
    countEl.textContent = `${residents.length} Allocated Students in ${STATE.selectedBlock}`;
  }

  const tableBody = document.getElementById('roomResidentsTableBody');
  if (tableBody) {
    if (residents.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">No students allocated in ${STATE.selectedBlock} yet. Click an empty bed above to assign a student.</td></tr>`;
    } else {
      tableBody.innerHTML = residents.map(s => `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${s.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" alt="${escapeHtml(s.full_name)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-subtle);">
              <div>
                <div style="font-weight: 600; color: #FFF;">${escapeHtml(s.full_name)}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(s.email)}</div>
              </div>
            </div>
          </td>
          <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);">${escapeHtml(s.roll_no)}</td>
          <td>
            <span class="badge badge-success" style="font-size: 0.8rem;">Room ${s.room_number} (${s.bed_number || 'Bed'})</span>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">${STATE.selectedBlock} • ₹${(s.monthly_rent || 0).toLocaleString('en-IN')}/mo</div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(s.course)}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim);">Year ${s.year_of_study}</div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(s.guardian_name)}</div>
            <div style="font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-muted);">${escapeHtml(s.guardian_phone)}</div>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="deallocateStudent(${s.id}, '${escapeHtml(s.full_name)}')">Deallocate Bed</button>
          </td>
        </tr>
      `).join('');
    }
  }
}

async function openAllocateBedModal(roomId, roomNumber, bedLabel) {
  document.getElementById('allocRoomId').value = roomId;
  document.getElementById('allocBedNumber').value = bedLabel;
  document.getElementById('allocTargetInfo').textContent = `Room ${roomNumber} (${bedLabel})`;

  // Fetch unallocated students to populate dropdown
  try {
    const res = await fetch('/api/students?allocation=unallocated');
    const json = await res.json();
    const select = document.getElementById('allocStudentSelect');
    select.innerHTML = '<option value="">-- Choose student waiting for room allocation --</option>';

    if (json.data && json.data.length > 0) {
      json.data.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${escapeHtml(s.full_name)} (${s.roll_no} - ${s.gender} - ${s.course})</option>`;
      });
    } else {
      select.innerHTML += '<option value="" disabled>No unallocated students available. Register a student first.</option>';
    }

    openModal('modalAllocateBed');
  } catch (err) {
    showToast('Failed to load unallocated students: ' + err.message, 'error');
  }
}

async function handleAllocateBed(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/rooms/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeModal('modalAllocateBed');
      loadRoomsMatrix();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Allocation failed: ' + err.message, 'error');
  }
}

// ==========================================
// 4. FEES & BILLING LOGIC
// ==========================================
async function loadFees() {
  const status = document.getElementById('filterFeeStatus').value;
  const semester = document.getElementById('filterFeeSemester').value;
  const search = document.getElementById('searchFeeInput').value;

  const url = new URL('/api/fees', window.location.origin);
  if (status && status !== 'All') url.searchParams.set('status', status);
  if (semester && semester !== 'All') url.searchParams.set('semester', semester);
  if (search) url.searchParams.set('search', search);

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    STATE.fees = json.data;
    renderFeesTable(STATE.fees);
  } catch (err) {
    showToast('Failed to load fees: ' + err.message, 'error');
  }
}

function filterFees() {
  loadFees();
}

function renderFeesTable(fees) {
  // Populate Resident Students Fee Profiles (Baacho Ka Fee Record Spotlight)
  const feesSpotlight = document.getElementById('feesStudentsSpotlightGrid');
  if (feesSpotlight) {
    if (fees.length === 0) {
      feesSpotlight.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 20px;">No student fee records found.</div>`;
    } else {
      const sampleFees = fees.slice(0, 4);
      feesSpotlight.innerHTML = sampleFees.map(f => {
        const pct = f.total_amount > 0 ? Math.min(100, Math.round((f.paid_amount / f.total_amount) * 100)) : 0;
        let badgeClass = 'badge-success';
        if (f.status === 'Partial') badgeClass = 'badge-warning';
        if (f.status === 'Overdue') badgeClass = 'badge-danger';
        if (f.status === 'Pending') badgeClass = 'badge-info';

        return `
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-weight: 700; color: #FFF; font-size: 0.9rem;">${escapeHtml(f.full_name)}</div>
                <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--accent-cyan);">${escapeHtml(f.roll_no)} • Room ${f.room_number || 'N/A'}</div>
              </div>
              <span class="badge ${badgeClass}">${f.status}</span>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.74rem; margin-bottom: 4px;">
                <span style="color: var(--text-muted);">Paid: <strong style="color: var(--success);">₹${f.paid_amount.toLocaleString('en-IN')}</strong></span>
                <span style="color: var(--text-muted);">Due: <strong style="color: ${f.balance_amount > 0 ? 'var(--warning)' : '#FFF'};">₹${f.balance_amount.toLocaleString('en-IN')}</strong></span>
              </div>
              <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: ${f.balance_amount === 0 ? 'var(--success)' : 'linear-gradient(90deg, #6366F1, #06B6D4)'}; border-radius: 4px;"></div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
              <span style="font-size: 0.72rem; color: var(--text-dim);">${f.semester || 'Fall 2025'}</span>
              <div style="display: flex; gap: 6px;">
                ${f.balance_amount > 0 ? `<button class="btn btn-sm btn-primary" style="padding: 3px 8px; font-size: 0.72rem;" onclick="openPaymentForInvoice(${f.id})">Pay Now</button>` : ''}
                <button class="btn btn-sm btn-secondary" style="padding: 3px 8px; font-size: 0.72rem;" onclick="viewReceipt(${f.id})">Receipt</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const tbody = document.getElementById('feesTableBody');
  if (fees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-dim);">No fee invoices found.</td></tr>`;
    return;
  }

  tbody.innerHTML = fees.map(f => {
    let statusClass = 'badge-success';
    if (f.status === 'Partial') statusClass = 'badge-warning';
    if (f.status === 'Overdue') statusClass = 'badge-danger';
    if (f.status === 'Pending') statusClass = 'badge-info';

    return `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 600; color: #FFF;">${f.invoice_no}</td>
        <td>
          <div style="font-weight: 600; color: #FFF;">${escapeHtml(f.full_name)}</div>
          <div style="font-size: 0.74rem; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(f.roll_no)}</div>
        </td>
        <td>
          <span style="font-weight: 600;">${f.room_number || 'N/A'}</span>
          <div style="font-size: 0.72rem; color: var(--text-dim);">${f.block || ''}</div>
        </td>
        <td style="font-weight: 700; color: #FFF;">₹${f.total_amount.toLocaleString('en-IN')}</td>
        <td style="font-weight: 600; color: var(--success);">₹${f.paid_amount.toLocaleString('en-IN')}</td>
        <td style="font-weight: 700; color: ${f.balance_amount > 0 ? 'var(--warning)' : 'var(--text-dim)'};">₹${f.balance_amount.toLocaleString('en-IN')}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${f.due_date}</td>
        <td><span class="badge ${statusClass}">${f.status}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${f.balance_amount > 0 ? `
              <button class="btn btn-sm btn-primary" onclick="openPaymentForInvoice(${f.id})">Pay</button>
            ` : ''}
            <button class="btn btn-sm btn-secondary" onclick="viewReceipt(${f.id})">Receipt</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function openPaymentModal() {
  document.getElementById('formPayment').reset();
  const select = document.getElementById('payFeeSelect');
  select.innerHTML = '<option value="">-- Select student invoice --</option>';

  try {
    const res = await fetch('/api/fees');
    const json = await res.json();
    if (json.data) {
      json.data.forEach(f => {
        if (f.balance_amount > 0) {
          select.innerHTML += `<option value="${f.id}" data-total="${f.total_amount}" data-paid="${f.paid_amount}" data-balance="${f.balance_amount}">
            ${f.invoice_no} - ${escapeHtml(f.full_name)} (Balance: ₹${f.balance_amount.toLocaleString('en-IN')})
          </option>`;
        }
      });
    }
    document.getElementById('payFeeDetailsBox').style.display = 'none';
    openModal('modalPayment');
  } catch (err) {
    showToast('Failed to open payment modal: ' + err.message, 'error');
  }
}

function openPaymentForInvoice(feeId) {
  openPaymentModal().then(() => {
    const select = document.getElementById('payFeeSelect');
    select.value = feeId;
    onFeeSelectChange();
  });
}

function onFeeSelectChange() {
  const select = document.getElementById('payFeeSelect');
  const opt = select.options[select.selectedIndex];
  const box = document.getElementById('payFeeDetailsBox');
  const amountInput = document.getElementById('payAmountInput');

  if (!opt || !opt.value) {
    box.style.display = 'none';
    amountInput.value = '';
    return;
  }

  const total = parseFloat(opt.getAttribute('data-total') || 0);
  const paid = parseFloat(opt.getAttribute('data-paid') || 0);
  const balance = parseFloat(opt.getAttribute('data-balance') || 0);

  document.getElementById('payDetailTotal').textContent = `₹${total.toLocaleString('en-IN')}`;
  document.getElementById('payDetailPaid').textContent = `₹${paid.toLocaleString('en-IN')}`;
  document.getElementById('payDetailBalance').textContent = `₹${balance.toLocaleString('en-IN')}`;
  box.style.display = 'block';

  amountInput.value = balance; // Default to full remaining balance
}

async function handleRecordPayment(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/fees/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeModal('modalPayment');
      loadFees();
      refreshDashboard();
      // Open receipt automatically for instant confirmation
      viewReceipt(body.fee_id);
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Payment processing failed: ' + err.message, 'error');
  }
}

async function viewReceipt(feeId) {
  try {
    const res = await fetch(`/api/fees/receipt/${feeId}`);
    const json = await res.json();
    if (!json.success) return;

    const r = json.data;
    const body = document.getElementById('receiptModalBody');

    body.innerHTML = `
      <div class="receipt-paper">
        ${r.status === 'Paid' ? '<div class="receipt-stamp-watermark">PAID IN FULL</div>' : ''}
        
        <div class="receipt-header">
          <div>
            <div class="receipt-college-title">CAMPUS RESIDENTIAL HOSTEL SERVICES</div>
            <div style="font-size: 0.8rem; color: #64748B;">National Institute Campus • University Residential Board</div>
            <div style="font-size: 0.75rem; color: #64748B;">Official Digital Tax Invoice & Payment Receipt</div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 800; color: #0F172A;">${r.invoice_no}</div>
            <div style="font-size: 0.78rem; color: #64748B;">Date: ${r.last_payment_date || new Date().toISOString().split('T')[0]}</div>
          </div>
        </div>

        <!-- Student & Room Credentials -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 0.85rem;">
          <div style="background: #F8FAFC; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Resident Details</div>
            <div style="font-weight: 700; font-size: 1rem; color: #0F172A; margin-top: 2px;">${escapeHtml(r.full_name)}</div>
            <div>Roll No: <span style="font-family: var(--font-mono); font-weight: 600;">${escapeHtml(r.roll_no)}</span></div>
            <div>Program: ${escapeHtml(r.course)} (Year ${r.year_of_study})</div>
            <div>Contact: ${escapeHtml(r.phone)}</div>
          </div>

          <div style="background: #F8FAFC; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Allocation Details</div>
            <div style="font-weight: 700; font-size: 1rem; color: #0F172A; margin-top: 2px;">Room: ${r.room_number || 'N/A'} (${r.bed_number || 'Slot'})</div>
            <div>Block: ${r.block || 'N/A'} • Type: ${r.room_type || 'Standard'}</div>
            <div>Academic Term: ${r.academic_year} (${r.semester})</div>
            <div>Payment Channel: <span style="font-weight: 600; color: #059669;">${r.payment_mode || 'Online Portal'}</span></div>
          </div>
        </div>

        <!-- Itemized Breakdown Table -->
        <table class="receipt-table">
          <thead>
            <tr>
              <th>Fee Head / Component</th>
              <th>Period</th>
              <th style="text-align: right;">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Hostel Room Rent (${r.room_type || 'Standard'})</td>
              <td>${r.semester}</td>
              <td style="text-align: right; font-weight: 600;">₹${r.hostel_rent.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td>Hostel Dining & Mess Catering Dues</td>
              <td>${r.semester}</td>
              <td style="text-align: right; font-weight: 600;">₹${r.mess_fee.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td>Electricity, High-Speed Wi-Fi & Maintenance Amenities</td>
              <td>${r.semester}</td>
              <td style="text-align: right; font-weight: 600;">₹${r.amenities_fee.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td>Hostel Caution Security Deposit (Refundable)</td>
              <td>One-Time</td>
              <td style="text-align: right; font-weight: 600;">₹${r.security_deposit.toLocaleString('en-IN')}</td>
            </tr>
            ${r.discount > 0 ? `
              <tr>
                <td style="color: #059669;">Merit Scholarship / Fee Concession</td>
                <td>Applied</td>
                <td style="text-align: right; font-weight: 600; color: #059669;">-₹${r.discount.toLocaleString('en-IN')}</td>
              </tr>
            ` : ''}
            <tr style="background: #F1F5F9; font-weight: 800; font-size: 0.95rem;">
              <td colspan="2">TOTAL BILLED AMOUNT</td>
              <td style="text-align: right;">₹${r.total_amount.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="color: #059669; font-weight: 700;">
              <td colspan="2">TOTAL AMOUNT RECEIVED</td>
              <td style="text-align: right;">₹${r.paid_amount.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="font-weight: 800; color: ${r.balance_amount > 0 ? '#DC2626' : '#059669'};">
              <td colspan="2">OUTSTANDING BALANCE DUE</td>
              <td style="text-align: right;">₹${r.balance_amount.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        <!-- Receipt Verification Footer -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 16px; border-top: 1px dashed #CBD5E1; font-size: 0.78rem; color: #64748B;">
          <div>
            <div>Txn Ref: <span style="font-family: var(--font-mono);">${r.transaction_ref || 'SYSTEM-SETTLED'}</span></div>
            <div>This receipt is computer generated and requires no physical seal.</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #0F172A;">Authorized Accounts Desk</div>
            <div>Campus Finance & Residence Directorate</div>
          </div>
        </div>
      </div>
    `;

    openModal('modalReceipt');
  } catch (err) {
    showToast('Failed to generate receipt: ' + err.message, 'error');
  }
}

// ==========================================
// 5. COMPLAINTS & MAINTENANCE LOGIC
// ==========================================
async function loadComplaints() {
  const status = document.getElementById('filterComplaintStatus').value;
  const category = document.getElementById('filterComplaintCategory').value;
  const priority = document.getElementById('filterComplaintPriority').value;

  const url = new URL('/api/complaints', window.location.origin);
  if (status && status !== 'All') url.searchParams.set('status', status);
  if (category && category !== 'All') url.searchParams.set('category', category);
  if (priority && priority !== 'All') url.searchParams.set('priority', priority);

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    STATE.complaints = json.data;
    renderComplaintsTable(STATE.complaints);
  } catch (err) {
    showToast('Failed to load complaints: ' + err.message, 'error');
  }
}

function renderComplaintsTable(complaints) {
  // Populate Students with Active Complaints Spotlight (Baacho Ki Complaints)
  const compSpotlight = document.getElementById('complaintsStudentsSpotlightGrid');
  if (compSpotlight) {
    if (complaints.length === 0) {
      compSpotlight.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 20px;">No student complaints logged currently.</div>`;
    } else {
      const sampleComplaints = complaints.slice(0, 4);
      compSpotlight.innerHTML = sampleComplaints.map(c => {
        let pBadge = 'badge-info';
        if (c.priority === 'Emergency') pBadge = 'badge-danger';
        if (c.priority === 'High') pBadge = 'badge-warning';

        let sBadge = 'badge-warning';
        if (c.status === 'Resolved') sBadge = 'badge-success';
        if (c.status === 'Open') sBadge = 'badge-danger';

        return `
          <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-weight: 700; color: #FFF; font-size: 0.88rem;">${escapeHtml(c.student_name)}</div>
                <div style="font-size: 0.72rem; color: var(--accent-cyan); font-family: var(--font-mono);">Room ${c.room_number || 'N/A'} (${c.block || 'Hostel'})</div>
              </div>
              <span class="badge ${pBadge}">${c.priority}</span>
            </div>

            <div style="font-size: 0.82rem; color: #E2E8F0; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(c.title)}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; font-size: 0.72rem;">
              <span class="badge badge-purple">${c.category}</span>
              <span class="badge ${sBadge}">${c.status}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const tbody = document.getElementById('complaintsTableBody');
  if (complaints.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-dim);">No complaints found matching filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = complaints.map(c => {
    let priorityBadge = 'badge-info';
    if (c.priority === 'Emergency') priorityBadge = 'badge-danger';
    if (c.priority === 'High') priorityBadge = 'badge-warning';
    if (c.priority === 'Low') priorityBadge = 'badge-purple';

    let statusBadge = 'badge-warning';
    if (c.status === 'Resolved') statusBadge = 'badge-success';
    if (c.status === 'Open') statusBadge = 'badge-danger';

    return `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 600; color: #FFF;">${c.ticket_no}</td>
        <td><span class="badge badge-purple">${c.category}</span></td>
        <td>
          <div style="font-weight: 600; color: #FFF;">${escapeHtml(c.title)}</div>
          <div style="font-size: 0.76rem; color: var(--text-muted); max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.description)}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(c.student_name)}</div>
          <div style="font-size: 0.72rem; color: var(--text-dim);">${c.room_number} (${c.block})</div>
        </td>
        <td><span class="badge ${priorityBadge}">${c.priority}</span></td>
        <td><span class="badge ${statusBadge}">${c.status}</span></td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(c.assigned_staff || 'Unassigned')}</td>
        <td style="font-size: 0.72rem; color: var(--text-dim); white-space: nowrap;">${c.created_at.split(' ')[0]}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openResolveComplaintModal(${c.id}, '${c.ticket_no}', '${escapeHtml(c.title)}', '${c.status}', '${escapeHtml(c.assigned_staff || '')}', '${escapeHtml(c.warden_notes || '')}')">
            Update
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function openComplaintModal() {
  document.getElementById('formComplaint').reset();
  const select = document.getElementById('complaintStudentSelect');
  select.innerHTML = '<option value="">-- Select resident student --</option>';

  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (json.data) {
      json.data.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${escapeHtml(s.full_name)} (${s.roll_no} - Room: ${s.room_number || 'N/A'})</option>`;
      });
    }
    openModal('modalComplaint');
  } catch (err) {
    showToast('Failed to open complaint modal: ' + err.message, 'error');
  }
}

async function handleLodgeComplaint(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeModal('modalComplaint');
      loadComplaints();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to lodge complaint: ' + err.message, 'error');
  }
}

function openResolveComplaintModal(id, ticketNo, title, status, staff, notes) {
  document.getElementById('resolveComplaintId').value = id;
  document.getElementById('resolveTicketNo').textContent = ticketNo;
  document.getElementById('resolveTicketTitle').textContent = title;
  document.getElementById('resolveStatusSelect').value = status;
  document.getElementById('resolveStaffInput').value = staff;
  document.getElementById('resolveNotesInput').value = notes;
  openModal('modalResolveComplaint');
}

async function handleUpdateComplaintStatus(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());
  const complaintId = body.complaint_id;

  try {
    const res = await fetch(`/api/complaints/${complaintId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeModal('modalResolveComplaint');
      loadComplaints();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Update failed: ' + err.message, 'error');
  }
}

// ==========================================
// 6. VISITOR GATE PASS LOGIC
// ==========================================
async function loadVisitors() {
  const status = document.getElementById('filterVisitorStatus').value;
  const url = new URL('/api/visitors', window.location.origin);
  if (status && status !== 'All') url.searchParams.set('status', status);

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    STATE.visitors = json.data;
    renderVisitorsTable(STATE.visitors);
  } catch (err) {
    showToast('Failed to load visitors: ' + err.message, 'error');
  }
}

function renderVisitorsTable(visitors) {
  // Populate Students with Active Visitors Spotlight (Baacho Ke Visitors)
  const visSpotlight = document.getElementById('visitorsStudentsSpotlightGrid');
  if (visSpotlight) {
    if (visitors.length === 0) {
      visSpotlight.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 20px;">No active visitors on campus.</div>`;
    } else {
      const sampleVis = visitors.slice(0, 3);
      visSpotlight.innerHTML = sampleVis.map(v => `
        <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-weight: 700; color: #FFF; font-size: 0.88rem;">Student: ${escapeHtml(v.student_name)}</div>
              <div style="font-size: 0.72rem; color: var(--accent-cyan); font-family: var(--font-mono);">${v.room_number || 'Room N/A'} (${v.student_roll || ''})</div>
            </div>
            <span class="badge ${v.status === 'Inside Campus' ? 'badge-success' : 'badge-info'}">${v.status}</span>
          </div>

          <div style="background: rgba(255,255,255,0.03); border-radius: 6px; padding: 8px 10px; font-size: 0.78rem;">
            <div style="color: #FFF; font-weight: 600;">Guest: ${escapeHtml(v.visitor_name)} <span style="color: var(--accent-cyan);">(${v.relationship})</span></div>
            <div style="color: var(--text-muted); font-size: 0.72rem; margin-top: 2px;">Purpose: ${escapeHtml(v.purpose)}</div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-dim); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
            <span>Pass: <strong style="color: var(--primary);">${v.pass_code}</strong></span>
            <span>In: ${v.in_time.split(' ')[1] || v.in_time}</span>
          </div>
        </div>
      `).join('');
    }
  }

  const tbody = document.getElementById('visitorsTableBody');
  if (visitors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-dim);">No visitor gate logs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = visitors.map(v => {
    const isInside = v.status === 'Inside Campus';
    return `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">${v.pass_code}</td>
        <td>
          <div style="font-weight: 600; color: #FFF;">${escapeHtml(v.visitor_name)}</div>
          <div style="font-size: 0.72rem; color: var(--text-dim);">Approved by: ${escapeHtml(v.approved_by || 'Admin')}</div>
        </td>
        <td>
          <div style="font-family: var(--font-mono); font-size: 0.8rem;">${escapeHtml(v.visitor_phone)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${v.id_type}: ${escapeHtml(v.id_number)}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(v.student_name)}</div>
          <div style="font-size: 0.72rem; color: var(--text-dim);">${v.room_number || 'Room N/A'} (${v.student_roll})</div>
        </td>
        <td><span class="badge badge-purple">${escapeHtml(v.relationship)}</span></td>
        <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 180px;">${escapeHtml(v.purpose)}</td>
        <td style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted); white-space: nowrap;">${v.in_time}</td>
        <td style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-dim); white-space: nowrap;">${v.out_time || '--'}</td>
        <td>
          <span class="badge ${isInside ? 'badge-success' : 'badge-info'}">${v.status}</span>
        </td>
        <td>
          ${isInside ? `
            <button class="btn btn-sm btn-cyan" onclick="checkoutVisitor(${v.id}, '${escapeHtml(v.visitor_name)}')">
              Mark Exit
            </button>
          ` : `
            <span style="font-size: 0.74rem; color: var(--text-dim);">Departed</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function openGatePassModal() {
  document.getElementById('formGatePass').reset();
  const select = document.getElementById('visitorStudentSelect');
  select.innerHTML = '<option value="">-- Select resident student --</option>';

  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (json.data) {
      json.data.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${escapeHtml(s.full_name)} (${s.roll_no} - ${s.room_number || 'Unallocated'})</option>`;
      });
    }
    openModal('modalGatePass');
  } catch (err) {
    showToast('Failed to open gate pass modal: ' + err.message, 'error');
  }
}

async function handleIssueGatePass(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const body = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/visitors/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Gate pass ${json.passCode} issued for ${body.visitor_name}`, 'success');
      closeModal('modalGatePass');
      loadVisitors();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to issue gate pass: ' + err.message, 'error');
  }
}

async function checkoutVisitor(visitorId, visitorName) {
  try {
    const res = await fetch(`/api/visitors/${visitorId}/checkout`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(`Visitor ${visitorName} marked as departed.`, 'info');
      loadVisitors();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to checkout visitor: ' + err.message, 'error');
  }
}

// ==========================================
// 7. SQL REPORTS & INTERACTIVE SQL CONSOLE
// ==========================================
async function loadSqlEnvironment() {
  await Promise.all([loadSqlReports(), loadSqlSchema(), loadSqlStudentsTable()]);
}

async function loadSqlStudentsTable() {
  const tbody = document.getElementById('sqlStudentsTableBody');
  if (!tbody) return;
  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const sampleStudents = json.data.slice(0, 8);
    tbody.innerHTML = sampleStudents.map(s => `
      <tr style="cursor: pointer;" onclick="querySingleStudent(${s.id})" title="Click to generate SQL query for ${escapeHtml(s.full_name)}">
        <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);">${escapeHtml(s.roll_no)}</td>
        <td style="font-weight: 600; color: #FFF;">${escapeHtml(s.full_name)}</td>
        <td>${escapeHtml(s.course)} (Yr ${s.year_of_study})</td>
        <td><span class="badge badge-success">${s.room_number || 'Unallocated'} (${s.bed_number || 'Bed'})</span></td>
        <td style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(s.phone)}</td>
        <td style="font-size: 0.76rem;">${escapeHtml(s.guardian_name)} (${escapeHtml(s.guardian_phone)})</td>
        <td><span class="badge badge-purple">${s.blood_group || 'O+'}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load SQL students sample:', err);
  }
}

function querySingleStudent(id) {
  const query = `SELECT s.*, r.room_number, r.block, f.status AS fee_status, f.balance_amount
FROM students s
LEFT JOIN rooms r ON s.room_id = r.id
LEFT JOIN fees f ON s.id = f.student_id
WHERE s.id = ${id};`;
  document.getElementById('sqlQueryInput').value = query;
  executeSqlQuery();
}

async function loadSqlReports() {
  try {
    const res = await fetch('/api/sql/reports');
    const json = await res.json();
    if (!json.success) return;

    STATE.sqlReports = json.data;
    const list = document.getElementById('sqlPresetReportsList');
    list.innerHTML = STATE.sqlReports.map((r, idx) => `
      <div class="sql-preset-item" onclick="loadAndRunPresetReport('${r.id}')">
        <div class="sql-preset-title">${r.title}</div>
        <div class="sql-preset-category">${r.category} • ${r.recommendedFor}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load SQL reports:', err);
  }
}

async function loadSqlSchema() {
  try {
    const res = await fetch('/api/sql/schema');
    const json = await res.json();
    if (!json.success) return;

    STATE.dbSchema = json.data;
    const list = document.getElementById('sqlSchemaList');
    list.innerHTML = STATE.dbSchema.map(t => `
      <div style="padding: 8px 10px; background: rgba(30, 41, 59, 0.4); border-radius: 6px; cursor: pointer;" onclick="insertTableQuery('${t.table}')" title="Click to query ${t.table}">
        <div style="display: flex; justify-content: space-between; font-weight: 600; color: #FFF;">
          <span>${t.table}</span>
          <span style="color: var(--accent-cyan);">${t.rowCount} rows</span>
        </div>
        <div style="color: var(--text-dim); font-size: 0.7rem; margin-top: 2px;">
          ${t.columns.map(c => c.name).slice(0, 4).join(', ')}...
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load SQL schema:', err);
  }
}

function insertTableQuery(tableName) {
  const query = `SELECT * FROM ${tableName} LIMIT 15;`;
  document.getElementById('sqlQueryInput').value = query;
  executeSqlQuery();
}

function loadAndRunPresetReport(reportId) {
  const report = STATE.sqlReports.find(r => r.id === reportId);
  if (!report) return;

  document.getElementById('sqlQueryInput').value = report.query.trim();
  executeSqlQuery();
  showToast(`Loaded Report: ${report.title}`, 'info');
}

function formatSqlQuery() {
  const val = document.getElementById('sqlQueryInput').value;
  // Basic query beautification
  const formatted = val
    .replace(/\s+/g, ' ')
    .replace(/\bSELECT\b/gi, 'SELECT\n ')
    .replace(/\bFROM\b/gi, '\nFROM')
    .replace(/\bWHERE\b/gi, '\nWHERE')
    .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
    .replace(/\bORDER BY\b/gi, '\nORDER BY')
    .replace(/\bJOIN\b/gi, '\nJOIN')
    .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
    .trim();

  document.getElementById('sqlQueryInput').value = formatted;
}

async function executeSqlQuery() {
  const query = document.getElementById('sqlQueryInput').value.trim();
  if (!query) {
    showToast('Please enter an SQL query to execute.', 'warning');
    return;
  }

  const thead = document.getElementById('sqlResultsThead');
  const tbody = document.getElementById('sqlResultsTbody');
  thead.innerHTML = `<tr><th>Executing...</th></tr>`;
  tbody.innerHTML = `<tr><td style="text-align: center; padding: 30px;"><span class="status-dot"></span> Running query against SQLite engine...</td></tr>`;

  try {
    const res = await fetch('/api/sql/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const json = await res.json();

    document.getElementById('sqlExecTime').textContent = `${json.executionTimeMs} ms`;

    if (!json.success) {
      document.getElementById('sqlRowCount').textContent = 'Error';
      thead.innerHTML = `<tr><th style="color: var(--danger);">Execution Error</th></tr>`;
      tbody.innerHTML = `<tr><td style="color: var(--danger); font-family: var(--font-mono); padding: 20px;">${escapeHtml(json.message)}</td></tr>`;
      showToast('Query error: ' + json.message, 'error');
      return;
    }

    if (json.isSelect) {
      STATE.currentSqlResult = { columns: json.columns, rows: json.rows };
      document.getElementById('sqlRowCount').textContent = `${json.rowCount} rows`;

      if (json.rows.length === 0) {
        thead.innerHTML = `<tr><th>Result</th></tr>`;
        tbody.innerHTML = `<tr><td style="text-align: center; color: var(--text-dim); padding: 30px;">Query returned 0 rows.</td></tr>`;
        return;
      }

      // Render Table Columns
      thead.innerHTML = `<tr>${json.columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}</tr>`;

      // Render Table Rows
      tbody.innerHTML = json.rows.map(row => `
        <tr>
          ${json.columns.map(col => {
            const val = row[col];
            return `<td>${val !== null && val !== undefined ? escapeHtml(String(val)) : '<span style="color: var(--text-dim);">NULL</span>'}</td>`;
          }).join('')}
        </tr>
      `).join('');

      showToast(`Executed in ${json.executionTimeMs}ms (${json.rowCount} rows returned)`, 'success');
    } else {
      document.getElementById('sqlRowCount').textContent = `${json.changes} changes`;
      thead.innerHTML = `<tr><th>Command Status</th></tr>`;
      tbody.innerHTML = `<tr><td style="color: var(--success); font-weight: 600; padding: 20px;">${escapeHtml(json.message)}</td></tr>`;
      showToast(json.message, 'success');
    }

  } catch (err) {
    showToast('Failed to execute query: ' + err.message, 'error');
  }
}

function exportSqlResultsToCsv() {
  if (!STATE.currentSqlResult || !STATE.currentSqlResult.rows || STATE.currentSqlResult.rows.length === 0) {
    showToast('No query data to export. Run a SELECT query first.', 'warning');
    return;
  }

  const { columns, rows } = STATE.currentSqlResult;
  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\r\n';

  rows.forEach(r => {
    const rowStr = columns.map(c => {
      const val = r[c] !== null && r[c] !== undefined ? String(r[c]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
    csvContent += rowStr + '\r\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `hostel_sql_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Query report downloaded as CSV', 'success');
}

// ==========================================
// MODAL CONTROLS & UTILITIES
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Close modals when clicking outside backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ==========================================
// 8. WARDEN ACCESS CONTROL (ADMIN EXCLUSIVE)
// ==========================================
async function loadWardens() {
  try {
    const res = await fetch('/api/wardens');
    const json = await res.json();
    if (!json.success) return;

    STATE.wardens = json.data;
    renderWardensTable(STATE.wardens);
  } catch (err) {
    showToast('Failed to load wardens: ' + err.message, 'error');
  }
}

function renderWardensTable(wardens) {
  const tbody = document.getElementById('wardensTableBody');
  if (!tbody) return;

  if (wardens.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">No warden accounts registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = wardens.map(w => {
    const perms = w.permissions || {};
    const permBadges = `
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        <span class="badge ${perms.can_allocate_rooms ? 'badge-success' : 'badge-danger'}" title="Room Allocation">
          ${perms.can_allocate_rooms ? '✓' : '✕'} Rooms
        </span>
        <span class="badge ${perms.can_manage_complaints ? 'badge-success' : 'badge-danger'}" title="Complaints Desk">
          ${perms.can_manage_complaints ? '✓' : '✕'} Complaints
        </span>
        <span class="badge ${perms.can_issue_gatepass ? 'badge-success' : 'badge-danger'}" title="Visitor Gate Pass">
          ${perms.can_issue_gatepass ? '✓' : '✕'} Visitors
        </span>
        <span class="badge ${perms.can_manage_fees ? 'badge-success' : 'badge-danger'}" title="Fee Collection">
          ${perms.can_manage_fees ? '✓' : '🔒'} Fees
        </span>
        <span class="badge ${perms.can_view_reports ? 'badge-success' : 'badge-danger'}" title="SQL Reports">
          ${perms.can_view_reports ? '✓' : '✕'} Reports
        </span>
      </div>
    `;

    const isActive = w.status === 'Active';

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #6366F1, #06B6D4); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #FFF; font-size: 0.85rem;">
              ${escapeHtml(w.name.charAt(0))}
            </div>
            <div>
              <div style="font-weight: 600; color: #FFF;">${escapeHtml(w.name)}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Joined: ${w.created_at ? w.created_at.split(' ')[0] : 'Active'}</div>
            </div>
          </div>
        </td>
        <td style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);">${escapeHtml(w.username)}</td>
        <td>
          <span class="badge badge-purple" style="font-weight: 700;">${escapeHtml(w.block_assigned || 'Block A')}</span>
        </td>
        <td>
          <div style="font-size: 0.82rem; color: #FFF;">${escapeHtml(w.email || 'N/A')}</div>
          <div style="font-size: 0.74rem; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(w.phone || 'N/A')}</div>
        </td>
        <td>${permBadges}</td>
        <td>
          <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">${w.status || 'Active'}</span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-secondary" onclick="openEditWardenModal(${w.id})">Edit Access</button>
            <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-cyan'}" onclick="toggleWardenStatus(${w.id}, '${w.status || 'Active'}', '${escapeHtml(w.name)}')">
              ${isActive ? 'Suspend' : 'Activate'}
            </button>
            <button class="btn btn-sm btn-danger btn-icon-only" title="Delete Warden" onclick="deleteWarden(${w.id}, '${escapeHtml(w.name)}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Populate Resident Students Supervised by Wardens (Warden Ke Under Ke Baache)
  renderWardenStudentsDistribution();
}

async function renderWardenStudentsDistribution() {
  const grid = document.getElementById('wardenStudentsDistributionGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const allStudents = json.data;
    const blockAStudents = allStudents.filter(s => s.block === 'Block A').slice(0, 5);
    const blockBStudents = allStudents.filter(s => s.block === 'Block B').slice(0, 5);
    const blockCStudents = allStudents.filter(s => s.block === 'Block C').slice(0, 4);

    grid.innerHTML = `
      <!-- Block A Boys Wing Supervised by Warden Raman -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
          <div>
            <div style="font-weight: 700; color: #FFF; font-size: 0.92rem;">Warden Raman Joshi</div>
            <div style="font-size: 0.72rem; color: var(--accent-cyan);">Supervising: Block A (Boys Wing)</div>
          </div>
          <span class="badge badge-success">Active Warden</span>
        </div>
        <div style="font-size: 0.74rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">Sample Resident Boys (${blockAStudents.length}):</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${blockAStudents.map(s => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.78rem;">
              <span style="font-weight: 600; color: #FFF;">${escapeHtml(s.full_name)}</span>
              <span style="font-family: var(--font-mono); color: var(--accent-cyan); font-size: 0.72rem;">${s.room_number || 'Room'} (${s.bed_number || 'Bed'})</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Block B Girls Wing Supervised by Warden Sunita -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
          <div>
            <div style="font-weight: 700; color: #FFF; font-size: 0.92rem;">Warden Sunita Deshmukh</div>
            <div style="font-size: 0.72rem; color: #F472B6;">Supervising: Block B (Girls Wing)</div>
          </div>
          <span class="badge badge-success">Active Warden</span>
        </div>
        <div style="font-size: 0.74rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">Sample Resident Girls (${blockBStudents.length}):</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${blockBStudents.map(s => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.78rem;">
              <span style="font-weight: 600; color: #FFF;">${escapeHtml(s.full_name)}</span>
              <span style="font-family: var(--font-mono); color: #F472B6; font-size: 0.72rem;">${s.room_number || 'Room'} (${s.bed_number || 'Bed'})</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Block C International / Scholar Wing Supervised by Chief Admin -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
          <div>
            <div style="font-weight: 700; color: #FFF; font-size: 0.92rem;">Admin Supervision (Nisha Kumari)</div>
            <div style="font-size: 0.72rem; color: #C084FC;">Supervising: Block C (International / Scholar Wing)</div>
          </div>
          <span class="badge badge-purple">Chief Admin</span>
        </div>
        <div style="font-size: 0.74rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">Sample International Scholars (${blockCStudents.length}):</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${blockCStudents.map(s => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.78rem;">
              <span style="font-weight: 600; color: #FFF;">${escapeHtml(s.full_name)}</span>
              <span style="font-family: var(--font-mono); color: #C084FC; font-size: 0.72rem;">${s.room_number || 'Room'} (${s.bed_number || 'Bed'})</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load warden students distribution:', err);
  }
}

function openAddWardenModal() {
  document.getElementById('formWarden').reset();
  document.getElementById('wardenIdInput').value = '';
  document.getElementById('modalWardenTitle').textContent = 'Grant Warden Access & Permissions';
  document.getElementById('wardenUsernameInput').disabled = false;
  document.getElementById('wardenPasswordInput').required = true;
  document.getElementById('perm_allocate').checked = true;
  document.getElementById('perm_complaints').checked = true;
  document.getElementById('perm_gatepass').checked = true;
  document.getElementById('perm_fees').checked = false;
  document.getElementById('perm_reports').checked = true;
  openModal('modalWarden');
}

function openEditWardenModal(wardenId) {
  const warden = STATE.wardens.find(w => w.id === wardenId);
  if (!warden) return;

  document.getElementById('wardenIdInput').value = warden.id;
  document.getElementById('wardenNameInput').value = warden.name;
  document.getElementById('wardenUsernameInput').value = warden.username;
  document.getElementById('wardenUsernameInput').disabled = true;
  document.getElementById('wardenPasswordInput').required = false;
  document.getElementById('wardenPasswordInput').value = '';
  document.getElementById('wardenBlockSelect').value = warden.block_assigned || 'Block A';
  document.getElementById('wardenEmailInput').value = warden.email || '';
  document.getElementById('wardenPhoneInput').value = warden.phone || '';
  document.getElementById('wardenStatusSelect').value = warden.status || 'Active';

  const p = warden.permissions || {};
  document.getElementById('perm_allocate').checked = !!p.can_allocate_rooms;
  document.getElementById('perm_complaints').checked = !!p.can_manage_complaints;
  document.getElementById('perm_gatepass').checked = !!p.can_issue_gatepass;
  document.getElementById('perm_fees').checked = !!p.can_manage_fees;
  document.getElementById('perm_reports').checked = !!p.can_view_reports;

  document.getElementById('modalWardenTitle').textContent = `Edit Permissions for ${warden.name}`;
  openModal('modalWarden');
}

async function handleSaveWarden(e) {
  e.preventDefault();
  const wardenId = document.getElementById('wardenIdInput').value;

  const permissions = {
    can_allocate_rooms: document.getElementById('perm_allocate').checked ? 1 : 0,
    can_manage_complaints: document.getElementById('perm_complaints').checked ? 1 : 0,
    can_issue_gatepass: document.getElementById('perm_gatepass').checked ? 1 : 0,
    can_manage_fees: document.getElementById('perm_fees').checked ? 1 : 0,
    can_view_reports: document.getElementById('perm_reports').checked ? 1 : 0
  };

  const payload = {
    name: document.getElementById('wardenNameInput').value,
    username: document.getElementById('wardenUsernameInput').value,
    password: document.getElementById('wardenPasswordInput').value || undefined,
    block_assigned: document.getElementById('wardenBlockSelect').value,
    email: document.getElementById('wardenEmailInput').value,
    phone: document.getElementById('wardenPhoneInput').value,
    status: document.getElementById('wardenStatusSelect').value,
    permissions
  };

  const isEdit = !!wardenId;
  const url = isEdit ? `/api/wardens/${wardenId}` : '/api/wardens';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      closeModal('modalWarden');
      loadWardens();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to save warden: ' + err.message, 'error');
  }
}

async function toggleWardenStatus(id, currentStatus, name) {
  const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
  const confirmMsg = newStatus === 'Suspended'
    ? `Revoke login access for ${name}? The warden will no longer be able to log in.`
    : `Restore active login access for ${name}?`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/wardens/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Warden ${name} access set to ${newStatus}`, 'info');
      loadWardens();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to toggle status: ' + err.message, 'error');
  }
}

async function deleteWarden(id, name) {
  if (!confirm(`Permanently delete account for Warden ${name}?`)) return;

  try {
    const res = await fetch(`/api/wardens/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'info');
      loadWardens();
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to delete warden: ' + err.message, 'error');
  }
}

// ==========================================
// 9. ADMIN PROFILE MANAGEMENT (USER PERSONA)
// ==========================================
function openAdminProfileModal() {
  const user = STATE.currentUser;
  if (!user) return;

  document.getElementById('adminNameInput').value = user.name || '';
  document.getElementById('adminEmailInput').value = user.email || '';
  document.getElementById('adminPhoneInput').value = user.phone || '';
  document.getElementById('adminPasswordInput').value = '';
  if (user.avatar) {
    document.getElementById('adminModalAvatarPreview').src = user.avatar;
  }
  openModal('modalAdminProfile');
}

async function handleSaveAdminProfile(e) {
  e.preventDefault();
  const name = document.getElementById('adminNameInput').value;
  const email = document.getElementById('adminEmailInput').value;
  const phone = document.getElementById('adminPhoneInput').value;
  const password = document.getElementById('adminPasswordInput').value;

  try {
    const res = await fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password: password || undefined })
    });
    const json = await res.json();
    if (json.success) {
      STATE.currentUser = json.user;
      renderCurrentUser();
      showToast(`Admin identity updated! Welcome, ${json.user.name}`, 'success');
      closeModal('modalAdminProfile');
      refreshDashboard();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Failed to update admin profile: ' + err.message, 'error');
  }
}
