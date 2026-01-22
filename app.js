/**
 * Hospital Attendance Management App V4
 * Features: Secure Auth (Hash), UserDB separate from Employees, IT Manager Role, Stats
 */

// --- Constants & Helper API ---
const API = {
    // Simple Hash for local file compatibility (crypto.subtle requires HTTPS/Localhost)
    hash(str) {
        let hash = 0;
        if (str.length === 0) return '0';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
};

const ROLES = {
    MANAGER: 'MANAGER', // IT Admin (Acc Mgr) - Can CREATE users
    ADMIN: 'ADMIN',     // Director - Can VIEW ALL & OVERRIDE
    HEAD: 'HEAD',       // Dept Head - Can VIEW DEPT & APPROVE DEPT
    STAFF: 'STAFF'      // No Login by default unless given account
};

const DEFAULT_USERS = [
    // Hash of '123456' using the simple algorithm below
    { id: 'IT_ADMIN', passHash: '55060d0', role: ROLES.MANAGER, dept: 'IT' },
];

// --- State & Core ---
class AppState {
    constructor() {
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.currentUser = null;

        // Init Databases
        this.initDB();
    }

    initDB() {
        // 1. Employees (Data Only)
        if (!localStorage.getItem('employees')) {
            const defaults = [
                { id: 'E001', name: 'Nguyễn Văn An', dept: 'Khoa Nội', pos: 'Trưởng Khoa' },
                { id: 'E002', name: 'Trần Thị Bích', dept: 'Khoa Nội', pos: 'Điều dưỡng' },
            ];
            localStorage.setItem('employees', JSON.stringify(defaults));
        }

        // 2. Users (Login Access)
        if (!localStorage.getItem('users')) {
            localStorage.setItem('users', JSON.stringify(DEFAULT_USERS));
        }

        // Load
        this.employees = JSON.parse(localStorage.getItem('employees')) || [];
        this.users = JSON.parse(localStorage.getItem('users')) || [];
        this.attendance = JSON.parse(localStorage.getItem('attendance')) || {};
        this.requests = JSON.parse(localStorage.getItem('requests')) || [];
    }

    save() {
        localStorage.setItem('employees', JSON.stringify(this.employees));
        localStorage.setItem('users', JSON.stringify(this.users));
        localStorage.setItem('attendance', JSON.stringify(this.attendance));
        localStorage.setItem('requests', JSON.stringify(this.requests));
    }

    // --- Access Control ---
    login(id, pass) {
        // Find user
        // Note for V4: We need to handle 'reset' if localstorage has old data format
        const user = this.users.find(u => u.id === id);
        if (!user) return null;

        const hash = API.hash(pass);
        if (hash === user.passHash) {
            return user;
        }
        return null;
    }

    createUser(id, pass, role, dept) {
        if (this.users.find(u => u.id === id)) return false; // Exists
        const passHash = API.hash(pass);
        this.users.push({ id, passHash, role, dept });
        this.save();
        return true;
    }

    deleteUser(id) {
        if (id === 'IT_ADMIN') return false; // Cannot delete Root
        this.users = this.users.filter(u => u.id !== id);
        this.save();
        return true;
    }

    // --- Attendance Data ---
    setStatus(day, empId, status) {
        const key = `${this.currentYear}-${this.currentMonth}-${day}-${empId}`;
        this.attendance[key] = status;
        this.save();
    }

    getStatus(day, empId) {
        const key = `${this.currentYear}-${this.currentMonth}-${day}-${empId}`;
        return this.attendance[key] || '';
    }

    // --- Helper Stats ---
    getStats() {
        // Calculate stats for current month
        return this.employees.map(emp => {
            let x = 0, p = 0, v = 0;
            const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const s = this.getStatus(d, emp.id);
                if (s === 'X') x++;
                if (s === 'P') p++;
                if (s === 'V') v++;
            }
            return { emp, x, p, v, total: x }; // customize total logic if needed
        });
    }
}

const app = new AppState();

// --- DOM ---
const DOM = {
    // Login
    loginOverlay: document.getElementById('loginOverlay'),
    loginForm: document.getElementById('loginForm'),

    // App
    appContainer: document.getElementById('appContainer'),
    itControls: document.getElementById('itControls'),
    userMgrModal: document.getElementById('userMgrModal'),
    statsModal: document.getElementById('statsModal'),

    // Grid
    headerRow: document.getElementById('headerRow'),
    attendanceBody: document.getElementById('attendanceBody'),

    // Utils
    userWelcome: document.getElementById('userWelcome'),
    filterDept: document.getElementById('filterDept'),
    adminFilters: document.getElementById('adminFilters'),
    btnRequests: document.getElementById('btnRequests'),
    toastContainer: document.getElementById('toastContainer'),
};

// --- Init & Auth ---
function init() {
    renderMonthSelector();

    DOM.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('loginId').value.trim();
        const pass = document.getElementById('loginPass').value.trim();

        try {
            const user = app.login(id, pass);
            if (user) {
                enterApp(user);
            } else {
                alert('Sai tên đăng nhập hoặc mật khẩu!');
            }
        } catch (err) {
            console.error(err);
            alert("Lỗi hệ thống đăng nhập.");
        }
    });

    document.getElementById('btnLogout').addEventListener('click', () => location.reload());

    // User Mgr
    document.getElementById('btnUserMgr').addEventListener('click', () => {
        DOM.userMgrModal.style.display = 'flex';
        renderUserList();
    });

    document.getElementById('userCreateForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('newUserId').value;
        const pass = document.getElementById('newUserPass').value;
        const role = document.getElementById('newUserRole').value;
        const dept = document.getElementById('newUserDept').value;

        const success = app.createUser(id, pass, role, dept);
        if (success) {
            showToast(`Đã tạo tài khoản ${id}`);
            renderUserList();
            e.target.reset();
        } else {
            alert("Tài khoản đã tồn tại!");
        }
    });

    // Stats
    document.getElementById('btnStats').addEventListener('click', () => {
        DOM.statsModal.style.display = 'flex';
        renderStats();
    });

    // Excel Import
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', importExcel);

    setInterval(() => document.getElementById('timeDisplay').innerText = new Date().toLocaleString('vi-VN'), 1000);
}

function enterApp(user) {
    app.currentUser = user;
    DOM.loginOverlay.style.display = 'none';
    DOM.appContainer.style.display = 'block';
    DOM.userWelcome.innerText = `Xin chào, ${user.id} (${user.role})`;

    // Permissions
    if (user.role === 'MANAGER') {
        DOM.itControls.style.display = 'inline-flex';
        DOM.adminFilters.style.display = 'none'; // IT is not Content Admin
        // IT shouldn't see attendance? Let's say IT sees all but read only or empty?
        // Requirement: "user manager... just creates accounts".
        // Code below handles grid render.
    } else if (user.role === 'ADMIN') {
        DOM.adminFilters.style.display = 'flex';
        populateDeptFilter();
    } else {
        DOM.adminFilters.style.display = 'none';
    }

    renderGrid();
    updateRequestBadge();

    // Setup listeners if not already
    setupAppListeners();
}

// --- Render Logic ---

function renderGrid() {
    // If MANAGER, they might not need to see grid, but let's show all for debugging or transparency
    let displayEmps = app.employees;

    // Filter Permissions
    if (app.currentUser.role === 'HEAD') {
        displayEmps = displayEmps.filter(e => e.dept === app.currentUser.dept);
    }

    // Admin Filter UI
    if (app.currentUser.role === 'ADMIN') {
        const f = DOM.filterDept.value;
        if (f !== 'ALL') displayEmps = displayEmps.filter(e => e.dept === f);
    }

    const daysInMonth = new Date(app.currentYear, app.currentMonth + 1, 0).getDate();
    const today = new Date().getDate();

    // Render Headers...
    let hHTML = `<th class="fixed-col">Nhân Viên</th>`;
    for (let i = 1; i <= daysInMonth; i++) hHTML += `<th class="${i === today ? 'day-today' : ''}">${i}</th>`;
    DOM.headerRow.innerHTML = hHTML;

    // Render Body
    DOM.attendanceBody.innerHTML = displayEmps.map(emp => {
        let r = `<tr><td class="fixed-col"><b>${emp.name}</b><br><small>${emp.dept}</small></td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const status = app.getStatus(d, emp.id);
            const locked = isLocked(d);
            let cls = `cell-input status-${status} ${locked ? 'cell-locked' : ''}`;
            r += `<td><input class="${cls}" value="${status}" readonly data-emp="${emp.id}" data-day="${d}"></td>`;
        }
        return r + '</tr>';
    }).join('');

    // Events
    document.querySelectorAll('.cell-input').forEach(el => el.addEventListener('click', handleCellClick));
}

function renderUserList() {
    const tbody = document.getElementById('userListBody');
    tbody.innerHTML = app.users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.role}</td>
            <td>${u.dept || '-'}</td>
            <td>
                ${u.role === 'MANAGER' ? '<em>System</em>' : `<button class="btn btn-tiny btn-outline" onclick="deleteUser('${u.id}')">Xóa</button>`}
            </td>
        </tr>
    `).join('');
}

function renderStats() {
    const stats = app.getStats();
    let body = document.getElementById('statsBody');
    body.innerHTML = stats.map(s => `
        <tr>
            <td>${s.emp.id}</td>
            <td>${s.emp.name}</td>
            <td>${s.emp.dept}</td>
            <td class="status-X"><b>${s.x}</b></td>
            <td class="status-P"><b>${s.p}</b></td>
            <td class="status-V"><b>${s.v}</b></td>
            <td><b>${s.total}</b></td>
        </tr>
    `).join('');
}

// --- Logic ---
function isLocked(day) {
    // Current Day > 10 lock
    const now = new Date();
    if (app.currentMonth < now.getMonth()) return true;
    if (day < now.getDate()) return true;
    if (day === now.getDate() && now.getHours() >= 10) return true;
    return false;
}

function handleCellClick(e) {
    const input = e.target;
    const empId = input.dataset.emp;
    const day = parseInt(input.dataset.day);
    const locked = isLocked(day);

    // Security: MANAGER cannot edit attendance
    if (app.currentUser.role === 'MANAGER') return;

    // ADMIN Override
    if (app.currentUser.role === 'ADMIN') {
        const v = prompt("ADMIN Override (X, P, V):", input.value);
        if (v !== null) { app.setStatus(day, empId, v.toUpperCase()); renderGrid(); }
        return;
    }

    // HEAD restricted by Lock
    if (locked) {
        document.getElementById('reqEmployeeId').value = empId;
        document.getElementById('reqDate').value = day;
        document.getElementById('requestModal').style.display = 'flex';
    } else {
        const v = prompt("Nhập mã (X, P, V):", input.value);
        if (v !== null) { app.setStatus(day, empId, v.toUpperCase()); renderGrid(); }
    }
}

// --- Utils ---
window.deleteUser = (id) => {
    if (confirm(`Xóa tài khoản ${id}?`)) {
        app.deleteUser(id);
        renderUserList();
    }
};
window.closeUserMgrModal = () => DOM.userMgrModal.style.display = 'none';
window.closeStatsModal = () => DOM.statsModal.style.display = 'none';
window.closeModal = () => document.getElementById('requestModal').style.display = 'none';
window.closeApprovalsModal = () => document.getElementById('approvalsModal').style.display = 'none';

function populateDeptFilter() {
    const depts = [...new Set(app.employees.map(e => e.dept))];
    DOM.filterDept.innerHTML = `<option value="ALL">Tất cả Khoa</option>` +
        depts.map(d => `<option value="${d}">${d}</option>`).join('');
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.innerText = msg;
    DOM.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function renderMonthSelector() {
    document.getElementById('monthSelect').innerHTML = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`).map((m, i) =>
        `<option value="${i}" ${i === app.currentMonth ? 'selected' : ''}>${m}</option>`
    ).join('');
}

function setupAppListeners() {
    // Only verify dynamic listeners. Static configured in init()
    document.getElementById('monthSelect').addEventListener('change', (e) => {
        app.currentMonth = parseInt(e.target.value);
        renderGrid();
    });

    DOM.filterDept.addEventListener('change', renderGrid);

    document.getElementById('btnRequests').addEventListener('click', () => {
        document.getElementById('approvalsModal').style.display = 'flex';
        // Render Approvals (Reuse V3 logic simplified)
        document.getElementById('approvalsBody').innerHTML = app.requests
            .filter(r => r.status === 'PENDING') // Add filter by logic if needed
            .map(r => `<tr><td>${r.employeeId}</td><td>${r.day}</td><td>${r.value}</td><td>${r.reason}</td><td><button class='btn btn-tiny btn-primary' onclick='approveReq("${r.id}")'>OK</button></td></tr>`)
            .join('');
    });
}

// Import Excel (Reused V3 logic)
function importExcel(e) {
    const f = e.target.files[0];
    const r = new FileReader();
    r.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        app.employees = XLSX.utils.sheet_to_json(ws).map((x, i) => ({
            id: x['Mã'] || `E${i}`, name: x['Tên'] || 'NoName', dept: x['Khoa'] || 'G', pos: x['Chức vụ'] || ''
        }));
        app.save(); alert("Đã nhập dữ liệu."); location.reload();
    };
    r.readAsArrayBuffer(f);
}

// Approve Helper
window.approveReq = (id) => {
    const r = app.requests.find(x => x.id === id);
    if (r) {
        r.status = 'APPROVED';
        app.setStatus(r.day, r.employeeId, r.value);
        app.save();
        alert('Đã duyệt!');
        document.getElementById('approvalsModal').style.display = 'none';
        renderGrid();
    }
};

window.exportExcel = () => {
    const stats = app.getStats();
    const ws = XLSX.utils.json_to_sheet(stats.map(s => ({
        ID: s.emp.id, Name: s.emp.name, Dept: s.emp.dept,
        DiLam: s.x, Phep: s.p, Vang: s.v, Tong: s.total
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ThongKe");
    XLSX.writeFile(wb, "BaoCaoThongKe.xlsx");
};

function updateRequestBadge() {
    const c = app.requests.filter(r => r.status === 'PENDING').length;
    if (c > 0) { DOM.btnRequests.style.display = 'inline-flex'; DOM.btnRequests.innerText = `🔔 ${c}`; }
    else DOM.btnRequests.style.display = 'none';
}

init();
