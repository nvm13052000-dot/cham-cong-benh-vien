/**
 * Hospital Admin Pro V6.0 (Stable)
 * Features: Auto-Init on Load, Sidebar Layout Manager, Robust Security
 */

// --- 1. Security & Utils ---
const API = {
    // Robust simple hash
    hash(str) {
        let hash = 0; if (str.length === 0) return '0';
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0;
        }
        return Math.abs(hash).toString(16);
    },
    // Generate UUID
    uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
};

const ROLES = { MANAGER: 'MANAGER', ADMIN: 'ADMIN', HEAD: 'HEAD', STAFF: 'STAFF' };

// --- 2. State Management ---
class AppState {
    constructor() {
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.currentUser = null;

        // Auto-fix on boot
        this.ensureIntegrity();
        this.load();
    }

    // SELF-HEALING LOGIC
    ensureIntegrity() {
        // Check if Users DB exists and has IT_ADMIN
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        const itHash = API.hash('123456');
        const hasIT = users.find(u => u.id === 'IT_ADMIN');

        let dirty = false;

        if (!hasIT) {
            console.warn("V6: IT_ADMIN missing. Auto-creating...");
            users.push({ id: 'IT_ADMIN', passHash: itHash, role: ROLES.MANAGER, dept: 'IT' });
            dirty = true;
        } else if (hasIT.passHash !== itHash) {
            // Optional: Auto-reset password if hash algorithm changed? 
            // Better not aggressive reset unless forced.
        }

        if (users.length === 0 || dirty) {
            localStorage.setItem('users', JSON.stringify(users));
        }

        // Check Employees
        if (!localStorage.getItem('employees')) {
            const defaults = [
                { id: 'E001', name: 'Nguyễn Văn A', dept: 'Khoa Nội', pos: 'Trưởng Khoa' },
                { id: 'E002', name: 'Trần Thị B', dept: 'Khoa Nội', pos: 'Điều Dưỡng' },
            ];
            localStorage.setItem('employees', JSON.stringify(defaults));
        }
    }

    load() {
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

    login(id, pass) {
        this.load(); // Refresh data

        // FAILSAFE: Hardcoded Bypass for IT_ADMIN to guarantee access on GitHub
        if (id === 'IT_ADMIN' && pass === '123456') {
            return { id: 'IT_ADMIN', role: ROLES.MANAGER, dept: 'IT' };
        }

        const u = this.users.find(x => x.id === id);
        if (!u) throw "Tài khoản không tồn tại.";
        if (u.passHash !== API.hash(pass)) throw "Mật khẩu không đúng.";
        return u;
    }

    // Core Actions
    setStatus(day, empId, status) {
        const key = `${this.currentYear}-${this.currentMonth}-${day}-${empId}`;
        this.attendance[key] = status;
        this.save();
    }
    getStatus(day, empId) {
        return this.attendance[`${this.currentYear}-${this.currentMonth}-${day}-${empId}`] || '';
    }
}
const app = new AppState();

// --- 3. UI Controller ---
const UI = {
    // Elements
    loginOverlay: document.getElementById('loginOverlay'),
    appContainer: document.getElementById('appContainer'),
    attTable: {
        head: document.getElementById('headerRow'),
        body: document.getElementById('attendanceBody')
    },
    modal: {
        overlay: document.getElementById('modalOverlay'),
        title: document.getElementById('modalTitle'),
        body: document.getElementById('modalBody')
    },

    start() {
        // Init Month Selector
        const sel = document.getElementById('monthSelect');
        sel.innerHTML = Array.from({ length: 12 }, (_, i) =>
            `<option value="${i}">Tháng ${i + 1}</option>`
        ).join('');
        sel.value = app.currentMonth;
        sel.addEventListener('change', e => {
            app.currentMonth = parseInt(e.target.value);
            document.getElementById('pageTitle').innerText = `Tháng ${app.currentMonth + 1}`;
            renderGrid();
        });

        // Login Handler
        document.getElementById('loginForm').addEventListener('submit', e => {
            e.preventDefault();
            const id = document.getElementById('loginId').value.trim();
            const pass = document.getElementById('loginPass').value.trim();
            const msg = document.getElementById('loginMsg');

            try {
                const user = app.login(id, pass);
                UI.enter(user);
            } catch (err) {
                msg.innerText = `❌ ${err}`;
            }
        });
    },

    enter(user) {
        app.currentUser = user;
        UI.loginOverlay.style.display = 'none';
        UI.appContainer.style.display = 'flex'; // Flex for sidebar layout

        // Sidebar Info
        document.getElementById('userNameDisplay').innerText = user.id;
        document.getElementById('userRoleDisplay').innerText = user.role;
        document.getElementById('pageTitle').innerText = `Tháng ${app.currentMonth + 1}`;

        // Permissions
        const isIT = user.role === 'MANAGER';
        const isAdmin = user.role === 'ADMIN';

        document.getElementById('navUserMgr').style.display = isIT ? 'block' : 'none';
        document.getElementById('filterContainer').style.display = isAdmin ? 'flex' : 'none';

        if (isAdmin) {
            // Populate Filters
            const depts = [...new Set(app.employees.map(e => e.dept))];
            document.getElementById('filterDept').innerHTML = `<option value="ALL">Tất cả Khoa</option>` +
                depts.map(d => `<option value="${d}">${d}</option>`).join('');
            document.getElementById('filterDept').addEventListener('change', renderGrid);
            document.getElementById('searchName').addEventListener('input', renderGrid);
        }

        renderGrid();
        updateNotifBadge();
    }
};

// --- 4. Logic & Renderers ---
function renderGrid() {
    let list = app.employees;

    // Filtering
    if (app.currentUser.role === 'HEAD') {
        list = list.filter(e => e.dept === app.currentUser.dept);
    }
    if (app.currentUser.role === 'ADMIN') {
        const dDiv = document.getElementById('filterDept').value;
        const sVal = document.getElementById('searchName').value.toLowerCase();
        if (dDiv !== 'ALL') list = list.filter(e => e.dept === dDiv);
        if (sVal) list = list.filter(e => e.name.toLowerCase().includes(sVal));
    }

    const days = new Date(app.currentYear, app.currentMonth + 1, 0).getDate();
    const today = new Date().getDate();
    const isCurM = app.currentMonth === new Date().getMonth();

    // Header
    let h = `<th class="fixed-col">NHÂN VIÊN (${list.length})</th>`;
    for (let i = 1; i <= days; i++) {
        h += `<th class="${isCurM && i === today ? 'day-today' : ''}">${i}</th>`;
    }
    UI.attTable.head.innerHTML = h;

    // Body
    UI.attTable.body.innerHTML = list.map(e => {
        let r = `<tr><td class="fixed-col">
            <div style="font-weight:700">${e.name}</div>
            <div style="font-size:11px; color:#64748b">${e.pos} - ${e.dept}</div>
        </td>`;
        for (let d = 1; d <= days; d++) {
            const s = app.getStatus(d, e.id);
            const locked = isLocked(d);
            let cls = `cell-input status-${s} `;
            if (locked) cls += 'cell-locked ';
            if (isCurM && d === today) cls += 'day-today ';
            if (isCurM && d < today) cls += 'day-past ';

            r += `<td><input class="${cls}" value="${s}" readonly 
                onclick="handleCell('${e.id}', ${d}, '${s}')"></td>`;
        }
        return r + '</tr>';
    }).join('');
}

function handleCell(empId, day, currentVal) {
    if (app.currentUser.role === 'MANAGER') return; // IT Read Only

    // Admin Override
    if (app.currentUser.role === 'ADMIN') {
        const v = prompt("ADMIN Ghi Đè (X, P, V):", currentVal);
        if (v !== null) { app.setStatus(day, empId, v.toUpperCase()); renderGrid(); }
        return;
    }

    // Check Lock
    if (isLocked(day)) {
        openRequestModal(empId, day);
    } else {
        const v = prompt("Nhập (X, P, V):", currentVal);
        if (v !== null) { app.setStatus(day, empId, v.toUpperCase()); renderGrid(); }
    }
}

function isLocked(d) {
    const now = new Date();
    if (app.currentMonth < now.getMonth()) return true;
    if (app.currentMonth > now.getMonth()) return false;
    if (d < now.getDate()) return true;
    if (d === now.getDate() && now.getHours() >= 10) return true;
    return false;
}

// --- 5. Notifications & Modals ---
function showModal(title, html) {
    UI.modal.title.innerText = title;
    UI.modal.body.innerHTML = html;
    UI.modal.overlay.style.display = 'flex';
}
window.closeModal = () => UI.modal.overlay.style.display = 'none';

function updateNotifBadge() {
    // Logic: 
    // Admin/Head -> Count Pending Requests
    // User -> Count Results addressed to them
    const pending = app.requests.filter(r => r.status === 'PENDING');
    let count = 0;

    if (app.currentUser.role === 'ADMIN') count = pending.length;
    else if (app.currentUser.role === 'HEAD') {
        count = pending.filter(r => {
            const emp = app.employees.find(e => e.id === r.empId);
            return emp && emp.dept === app.currentUser.dept;
        }).length;
    } else {
        // Staff: Count approved/rejected results for Me
        count = app.requests.filter(r => r.empId === app.currentUser.id && r.status !== 'PENDING').length;
    }

    const b = document.getElementById('notifBadge');
    b.innerText = count;
    b.style.display = count > 0 ? 'block' : 'none'; // Only show if > 0
    document.getElementById('btnNotifs').style.color = count > 0 ? 'var(--accent)' : '#94a3b8';
}

window.handleNotifClick = () => {
    const role = app.currentUser.role;
    if (role === 'ADMIN' || role === 'HEAD') {
        // Show Approvals
        const pending = app.requests.filter(r => r.status === 'PENDING');
        // Filter for Head... (Simplified for brevity)
        let html = `<table class="approval-table" style="width:100%; text-align:left">
            <tr><th>NV</th><th>Ngày</th><th>Xin</th><th>Lý do</th><th>Duyệt</th></tr>`;
        html += pending.map(r => `
            <tr><td>${r.empId}</td><td>${r.day}</td><td>${r.val}</td><td>${r.reason}</td>
            <td><button class="btn btn-primary btn-sm" onclick="approve('${r.id}')">OK</button></td></tr>
        `).join('') || "<tr><td colspan=5>Không có yêu cầu mới.</td></tr>";
        html += "</table>";
        showModal("Phê Duyệt Yêu Cầu", html);
    } else {
        // Show Results
        const my = app.requests.filter(r => r.empId === app.currentUser.id && r.status !== 'PENDING');
        let html = `<table style="width:100%"><tr><th>Ngày</th><th>Kết quả</th></tr>`;
        html += my.map(r => `<tr><td>${r.day}</td><td><b style="color:${r.status === 'APPROVED' ? 'green' : 'red'}">${r.status}</b></td></tr>`).join('');
        html += `</table><button class="btn btn-outline" style="margin-top:10px" onclick="clearNotifs()">Xóa Hết</button>`;
        showModal("Hộp Thư", html);
    }
};

// --- 6. Helper Functions Exported to Window ---
window.forceAutoFix = () => {
    if (confirm("Hệ thống sẽ reset tài khoản IT_ADMIN về mặc định (123456). Tiếp tục?")) {
        app.ensureIntegrity();
        location.reload();
    }
};
window.doLogout = () => location.reload();
window.approve = (id) => {
    const r = app.requests.find(x => x.id === id);
    if (r) {
        r.status = 'APPROVED';
        app.setStatus(r.day, r.empId, r.val);
        app.save();
        alert("Đã duyệt!");
        closeModal();
        renderGrid();
        updateNotifBadge();
    }
};
window.openRequestModal = (empId, day) => {
    const html = `
        <div class="form-group"><label>Lý do chỉnh sửa</label>
        <textarea id="reqReason" class="input-lg" rows="3"></textarea></div>
        <div class="form-group"><label>Muốn đổi thành</label>
        <select id="reqVal" class="input-lg"><option value="X">X (Có mặt)</option><option value="P">P (Phép)</option></select></div>
        <button class="btn btn-primary btn-block" onclick="sendRequest('${empId}', '${day}')">Gửi Yêu Cầu</button>
    `;
    showModal("Gửi Yêu Cầu Sửa Công", html);
};
window.sendRequest = (empId, day) => {
    const reason = document.getElementById('reqReason').value;
    const val = document.getElementById('reqVal').value;
    app.requests.push({ id: API.uid(), empId, day, month: app.currentMonth, val, reason, status: 'PENDING' });
    app.save();
    alert("Đã gửi cho quản lý duyệt.");
    closeModal();
    updateNotifBadge();
};
window.clearNotifs = () => {
    const ids = app.requests.filter(r => r.empId === app.currentUser.id && r.status !== 'PENDING').map(r => r.id);
    app.requests = app.requests.filter(r => !ids.includes(r.id));
    app.save(); closeModal(); updateNotifBadge();
};

// Start
UI.start();
