/**
 * Hospital Attendance Management App V5.0 (Final)
 * Features: Auth Reset, Change Pass, Filtered Stats, User Notifications
 */

// --- Constants & Helper API ---
const API = {
    // Simple Hash for local file compatibility
    hash(str) {
        let hash = 0;
        if (str.length === 0) return '0';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
};

const ROLES = {
    MANAGER: 'MANAGER', // IT Admin
    ADMIN: 'ADMIN',     // Director
    HEAD: 'HEAD',       // Dept Head
    STAFF: 'STAFF'      // No Login
};

// --- State & Core ---
class AppState {
    constructor() {
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.currentUser = null;
        this.initDB();
    }

    initDB() {
        // V5 Reset: If we detect no users, we auto-init default IT_ADMIN
        if (!localStorage.getItem('users')) {
            this.hardReset();
        }

        // Load Data
        this.employees = JSON.parse(localStorage.getItem('employees')) || [];
        this.users = JSON.parse(localStorage.getItem('users')) || [];
        this.attendance = JSON.parse(localStorage.getItem('attendance')) || {};
        this.requests = JSON.parse(localStorage.getItem('requests')) || [];
    }

    // Explicit Factory Reset
    hardReset() {
        console.log("Factory Reset Triggered.");
        const itPassHash = API.hash('123456');
        const defaultUsers = [
            { id: 'IT_ADMIN', passHash: itPassHash, role: ROLES.MANAGER, dept: 'IT' }
        ];
        // Mock Employees
        const defaultEmps = [
            { id: 'E001', name: 'Nguyễn Văn A', dept: 'Khoa Nội', pos: 'Trưởng Khoa' },
            { id: 'E002', name: 'Trần Thị B', dept: 'Khoa Nội', pos: 'Điều Dưỡng' },
            { id: 'E003', name: 'Lê Văn C', dept: 'Khoa Ngoại', pos: 'Trưởng Khoa' },
        ];

        localStorage.setItem('users', JSON.stringify(defaultUsers));
        localStorage.setItem('employees', JSON.stringify(defaultEmps));
        localStorage.setItem('attendance', JSON.stringify({}));
        localStorage.setItem('requests', JSON.stringify([]));

        this.initDB(); // Reload
    }

    save() {
        localStorage.setItem('employees', JSON.stringify(this.employees));
        localStorage.setItem('users', JSON.stringify(this.users));
        localStorage.setItem('attendance', JSON.stringify(this.attendance));
        localStorage.setItem('requests', JSON.stringify(this.requests));
    }

    // --- Access Control ---
    login(id, pass) {
        const user = this.users.find(u => u.id === id);
        if (!user) return null;
        if (API.hash(pass) === user.passHash) return user;
        return null;
    }

    createUser(id, pass, role, dept) {
        // If ID exists, we act as 'Reset Password' for that user if IT calls this
        const idx = this.users.findIndex(u => u.id === id);
        const passHash = API.hash(pass);

        if (idx !== -1) {
            // Update existing
            this.users[idx].passHash = passHash;
            this.users[idx].role = role;
            this.users[idx].dept = dept;
        } else {
            // Create new
            this.users.push({ id, passHash, role, dept });
        }
        this.save();
        return true;
    }

    changePassword(id, newPass) {
        const u = this.users.find(user => user.id === id);
        if (u) {
            u.passHash = API.hash(newPass);
            this.save();
            return true;
        }
        return false;
    }

    deleteUser(id) {
        if (id === 'IT_ADMIN') return false;
        this.users = this.users.filter(u => u.id !== id);
        this.save();
        return true;
    }

    // --- Business Logic ---
    setStatus(day, empId, status) {
        const key = `${this.currentYear}-${this.currentMonth}-${day}-${empId}`;
        this.attendance[key] = status;
        this.save();
    }

    getStatus(day, empId) {
        const key = `${this.currentYear}-${this.currentMonth}-${day}-${empId}`;
        return this.attendance[key] || '';
    }
}

const app = new AppState();

// --- DOM & View ---
const DOM = {
    loginOverlay: document.getElementById('loginOverlay'),
    loginForm: document.getElementById('loginForm'),
    appContainer: document.getElementById('appContainer'),
    itControls: document.getElementById('itControls'),

    // Modals
    userMgrModal: document.getElementById('userMgrModal'),
    statsModal: document.getElementById('statsModal'),
    changePassModal: document.getElementById('changePassModal'),
    myNotifModal: document.getElementById('myNotifModal'),

    // Grid
    headerRow: document.getElementById('headerRow'),
    attendanceBody: document.getElementById('attendanceBody'),

    // Header Info
    userWelcome: document.getElementById('userWelcome'),
    currentPeriodDisplay: document.getElementById('currentPeriodDisplay'),
    filterDept: document.getElementById('filterDept'),
    adminFilters: document.getElementById('adminFilters'),

    // Notifications
    btnRequests: document.getElementById('btnRequests'),
    btnMyNotifs: document.getElementById('btnMyNotifs'),
    toastContainer: document.getElementById('toastContainer'),
};

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

    // Reset Data Listener
    window.resetSystem = () => {
        if (confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu để cài đặt gốc? (Dữ liệu cũ sẽ mất)")) {
            app.hardReset();
            alert("Đã reset. Tài khoản mặc định: IT_ADMIN / 123456");
            location.reload();
        }
    };

    document.getElementById('btnLogout').addEventListener('click', () => location.reload());

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

        app.createUser(id, pass, role, dept);
        showToast(`Đã lưu tài khoản ${id}`);
        renderUserList();
        e.target.reset();
    });

    // Change Pass
    window.openChangePassModal = () => DOM.changePassModal.style.display = 'flex';
    window.closeChangePassModal = () => DOM.changePassModal.style.display = 'none';
    document.getElementById('changePassForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const p1 = document.getElementById('newSelfPass').value;
        const p2 = document.getElementById('confirmSelfPass').value;
        if (p1 !== p2) { alert('Mật khẩu không khớp!'); return; }

        app.changePassword(app.currentUser.id, p1);
        alert('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
        location.reload();
    });

    // Stats
    document.getElementById('btnStats').addEventListener('click', () => {
        DOM.statsModal.style.display = 'flex';
        renderStats();
    });

    // My Notifs
    document.getElementById('btnMyNotifs').addEventListener('click', () => {
        DOM.myNotifModal.style.display = 'flex';
        renderMyNotifs();
    });

    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', importExcel);

    setInterval(() => document.getElementById('timeDisplay').innerText = new Date().toLocaleString('vi-VN'), 1000);
}

function enterApp(user) {
    app.currentUser = user;
    DOM.loginOverlay.style.display = 'none';
    DOM.appContainer.style.display = 'block';
    DOM.userWelcome.innerText = `User: ${user.id} (${user.role})`;

    if (user.role === 'MANAGER') {
        DOM.itControls.style.display = 'inline-flex';
        DOM.adminFilters.style.display = 'none';
    } else if (user.role === 'ADMIN') {
        DOM.adminFilters.style.display = 'flex';
        populateDeptFilter();
    } else {
        DOM.adminFilters.style.display = 'none';
    }

    renderHeaderInfo();
    renderGrid();
    updateBadges();
    setupAppListeners();
}

function renderHeaderInfo() {
    const m = app.currentMonth + 1;
    const y = app.currentYear;
    DOM.currentPeriodDisplay.innerText = `Tháng ${m} / ${y}`;
}

function renderGrid() {
    let displayEmps = app.employees;

    // Filter Logic
    if (app.currentUser.role === 'HEAD') {
        displayEmps = displayEmps.filter(e => e.dept === app.currentUser.dept);
    }

    let filterLabel = "Tất cả";
    if (app.currentUser.role === 'ADMIN') {
        const f = DOM.filterDept.value;
        if (f !== 'ALL') {
            displayEmps = displayEmps.filter(e => e.dept === f);
            filterLabel = f;
        }
        const s = document.getElementById('searchName').value.toLowerCase();
        if (s) displayEmps = displayEmps.filter(e => e.name.toLowerCase().includes(s));
    }

    // Pass current filter to state (for Stats to read if needed, though simpler to read DOM)
    app.currentFilterDept = (app.currentUser.role === 'ADMIN' && DOM.filterDept.value !== 'ALL') ? DOM.filterDept.value :
        (app.currentUser.role === 'HEAD' ? app.currentUser.dept : 'ALL');

    const daysInMonth = new Date(app.currentYear, app.currentMonth + 1, 0).getDate();
    const today = new Date().getDate();
    const isCurrent = app.currentMonth === new Date().getMonth();

    let hHTML = `<th class="fixed-col">Nhân Viên</th>`;
    for (let i = 1; i <= daysInMonth; i++) {
        const cls = isCurrent && i === today ? 'day-today' : (isCurrent && i < today ? 'day-past' : '');
        hHTML += `<th class="${cls}">${i}</th>`;
    }
    DOM.headerRow.innerHTML = hHTML;

    DOM.attendanceBody.innerHTML = displayEmps.map(emp => {
        let r = `<tr><td class="fixed-col"><b>${emp.name}</b><br><small>${emp.dept}</small></td>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const status = app.getStatus(d, emp.id);
            const locked = isLocked(d);
            let cellCls = `cell-input status-${status}`;
            if (isCurrent && d === today) cellCls += ' day-today';
            if (isCurrent && d < today) cellCls += ' day-past';
            if (locked) cellCls += ' cell-locked';

            r += `<td class="${isCurrent && d === today ? 'day-today' : ''} ${isCurrent && d < today ? 'day-past' : ''}">
                <input class="${cellCls}" value="${status}" readonly data-emp="${emp.id}" data-day="${d}">
            </td>`;
        }
        return r + '</tr>';
    }).join('');

    document.querySelectorAll('.cell-input').forEach(el => el.addEventListener('click', handleCellClick));

    renderHeaderInfo(); // update month label
}

function renderStats() {
    // V5: Stats respect filters
    let targetEmps = app.employees;

    // Apply same filter logic as Grid
    if (app.currentUser.role === 'HEAD') targetEmps = targetEmps.filter(e => e.dept === app.currentUser.dept);
    if (app.currentUser.role === 'ADMIN') {
        const f = DOM.filterDept.value;
        if (f !== 'ALL') targetEmps = targetEmps.filter(e => e.dept === f);
    }

    const stats = targetEmps.map(emp => {
        let x = 0, p = 0, v = 0;
        const daysInMonth = new Date(app.currentYear, app.currentMonth + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const s = app.getStatus(d, emp.id);
            if (s === 'X') x++; if (s === 'P') p++; if (s === 'V') v++;
        }
        return { emp, x, p, v, total: x };
    });

    document.getElementById('statsBody').innerHTML = stats.map(s => `
        <tr><td>${s.emp.id}</td><td>${s.emp.name}</td><td>${s.emp.dept}</td>
        <td class="status-X"><b>${s.x}</b></td><td class="status-P"><b>${s.p}</b></td><td class="status-V"><b>${s.v}</b></td><td><b>${s.total}</b></td></tr>
    `).join('');
}

function isLocked(day) {
    const now = new Date();
    if (app.currentMonth < now.getMonth()) return true;
    if (app.currentMonth > now.getMonth()) return false;
    if (day < now.getDate()) return true;
    if (day === now.getDate() && now.getHours() >= 10) return true;
    return false;
}

function handleCellClick(e) {
    const input = e.target;
    if (app.currentUser.role === 'MANAGER') return;
    if (app.currentUser.role === 'ADMIN') {
        const v = prompt("ADMIN Override (X, P, V):", input.value);
        if (v !== null) { app.setStatus(parseInt(input.dataset.day), input.dataset.emp, v.toUpperCase()); renderGrid(); }
        return;
    }

    if (isLocked(parseInt(input.dataset.day))) {
        document.getElementById('reqEmployeeId').value = input.dataset.emp;
        document.getElementById('reqDate').value = input.dataset.day;
        document.getElementById('requestModal').style.display = 'flex';
    } else {
        const v = prompt("Nhập trạng thái (X, P, V):", input.value);
        if (v !== null) { app.setStatus(parseInt(input.dataset.day), input.dataset.emp, v.toUpperCase()); renderGrid(); }
    }
}

// Notifications
function updateBadges() {
    // 1. Admin/Head Badge (Pending requests to approve)
    const pending = app.requests.filter(r => r.status === 'PENDING');
    let myActionable = [];
    if (app.currentUser.role === 'ADMIN') myActionable = pending;
    if (app.currentUser.role === 'HEAD') {
        myActionable = pending.filter(r => {
            const e = app.employees.find(em => em.id === r.employeeId);
            return e && e.dept === app.currentUser.dept;
        });
    }

    if (myActionable.length > 0) {
        DOM.btnRequests.style.display = 'inline-flex';
        DOM.btnRequests.innerText = `🔔 ${myActionable.length}`;
    } else {
        DOM.btnRequests.style.display = 'none';
    }

    // 2. User Badge (My requests result)
    // We check requests initiated by ME (requester) that are NOT pending anymore
    // Since V4 didn't store requester, we assume Head creates requests for their dept? 
    // Wait, in handleCellClick, if Head requests, it stores req. 
    // Let's filter by employeeId. If I am the employee E001, and I have a request that is APPROVED/REJECTED.
    // Ideally we need 'seen' flag. For now just show count.

    // V5 Logic: Show notifications if I am the employee mentioned in the request
    // (Simulating that I am checking my own attendance request)
    const myNotifs = app.requests.filter(r =>
        r.employeeId === app.currentUser.id &&
        r.status !== 'PENDING'
    );

    if (myNotifs.length > 0) {
        DOM.btnMyNotifs.style.display = 'inline-flex';
        DOM.btnMyNotifs.innerText = `📩 ${myNotifs.length}`;
    } else {
        DOM.btnMyNotifs.style.display = 'none';
    }
}

function renderMyNotifs() {
    const myNotifs = app.requests.filter(r => r.employeeId === app.currentUser.id && r.status !== 'PENDING');
    document.getElementById('myNotifBody').innerHTML = myNotifs.map(r => `
        <tr>
            <td>Ngày ${r.day}/${r.month + 1}</td>
            <td>Xin sửa thành <b>${r.value}</b> (${r.reason})</td>
            <td style="color:${r.status === 'APPROVED' ? 'green' : 'red'}"><b>${r.status}</b></td>
        </tr>
     `).join('');
}
window.clearMyNotifs = () => {
    // Determine IDs
    const ids = app.requests.filter(r => r.employeeId === app.currentUser.id && r.status !== 'PENDING').map(r => r.id);
    // Remove them from DB
    app.requests = app.requests.filter(r => !ids.includes(r.id));
    app.save();
    updateBadges();
    DOM.myNotifModal.style.display = 'none';
};

// Utils & Listeners
window.deleteUser = (id) => { if (confirm('Xóa?')) { app.deleteUser(id); renderUserList(); } };
window.closeUserMgrModal = () => DOM.userMgrModal.style.display = 'none';
window.closeStatsModal = () => DOM.statsModal.style.display = 'none';
window.closeModal = () => document.getElementById('requestModal').style.display = 'none';
window.closeApprovalsModal = () => document.getElementById('approvalsModal').style.display = 'none';
window.closeMyNotifModal = () => DOM.myNotifModal.style.display = 'none';
window.renderUserList = () => {
    document.getElementById('userListBody').innerHTML = app.users.map(u => `
        <tr><td>${u.id}</td><td>${u.role}</td><td>${u.dept || '-'}</td>
        <td>${u.role === 'MANAGER' ? '<em>System</em>' : `<button class="btn btn-tiny btn-outline" onclick="deleteUser('${u.id}')">Xóa</button>`}</td></tr>
    `).join('');
};

function populateDeptFilter() {
    const depts = [...new Set(app.employees.map(e => e.dept))];
    DOM.filterDept.innerHTML = `<option value="ALL">Tất cả Khoa</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join('');
}
function showToast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    DOM.toastContainer.appendChild(t); setTimeout(() => t.remove(), 3000);
}
function renderMonthSelector() {
    document.getElementById('monthSelect').innerHTML = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`).map((m, i) => `<option value="${i}" ${i === app.currentMonth ? 'selected' : ''}>${m}</option>`).join('');
}
function setupAppListeners() {
    document.getElementById('monthSelect').addEventListener('change', (e) => { app.currentMonth = parseInt(e.target.value); renderGrid(); });
    if (DOM.filterDept) DOM.filterDept.addEventListener('change', renderGrid);
    if (document.getElementById('searchName')) document.getElementById('searchName').addEventListener('input', renderGrid);
    document.getElementById('btnRequests').addEventListener('click', () => {
        document.getElementById('approvalsModal').style.display = 'flex';
        // Admin Approval Logic
        const pending = app.requests.filter(r => r.status === 'PENDING');
        let view = pending;
        if (app.currentUser.role === 'HEAD') {
            view = pending.filter(r => {
                const e = app.employees.find(em => em.id === r.employeeId);
                return e && e.dept === app.currentUser.dept;
            });
        }

        document.getElementById('approvalsBody').innerHTML = view.map(r =>
            `<tr><td>${r.employeeId}</td><td>${r.day}</td><td>${r.value}</td><td>${r.reason}</td>
            <td><button class="btn btn-tiny btn-primary" onclick="approveReq('${r.id}')">OK</button></td></tr>`
        ).join('') || '<tr><td colspan="5">Không có yêu cầu.</td></tr>';
    });
    document.getElementById('requestForm').addEventListener('submit', (e) => {
        e.preventDefault();
        app.requests.push({
            id: Date.now().toString(), status: 'PENDING', month: app.currentMonth,
            employeeId: document.getElementById('reqEmployeeId').value,
            day: document.getElementById('reqDate').value,
            value: document.getElementById('reqValue').value,
            reason: document.getElementById('reqReason').value
        });
        closeModal(); showToast('Đã gửi yêu cầu.'); updateBadges();
    });
}
window.approveReq = (id) => {
    const r = app.requests.find(x => x.id === id); if (r) { r.status = 'APPROVED'; app.setStatus(r.day, r.employeeId, r.value); app.save(); alert('Duyệt!'); renderGrid(); updateBadges(); document.getElementById('approvalsModal').style.display = 'none'; }
};
window.exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(app.getStats(true).map(s => ({ ID: s.emp.id, Name: s.emp.name, X: s.x, P: s.p, V: s.v, Total: s.total }))); // Fake pass true to getStats just to trigger recalc if needed
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Stats"); XLSX.writeFile(wb, "ThongKe.xlsx");
};
function importExcel(e) {
    const r = new FileReader(); r.onload = (evt) => {
        const ws = XLSX.read(evt.target.result, { type: 'array' }).Sheets[XLSX.read(evt.target.result, { type: 'array' }).SheetNames[0]];
        app.employees = XLSX.utils.sheet_to_json(ws).map((x, i) => ({ id: x['Mã'] || `E${i}`, name: x['Tên'] || 'NV', dept: x['Khoa'] || 'Chung', pos: x['Chức vụ'] || '' }));
        app.save(); alert('Import OK!'); location.reload();
    }; r.readAsArrayBuffer(e.target.files[0]);
}

init();
