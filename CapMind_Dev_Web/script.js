/**
 * CapMinds Appointment Scheduler
 * Production-level JavaScript
 * Architecture: Config → State → Storage → Utils → Validation →
 * State Ops → Toast → Confirm → Layout → Calendar → Dashboard → Modal → App
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const CONFIG = {
    STORAGE_KEY:       'capminds_appointments',
    MAX_EVENTS_SHOWN:  2,
    DEBOUNCE_DELAY:    220,
    TOAST_DURATION:    3000,
    MONTH_NAMES: [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ],
    DAY_NAMES: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
};

/* ═══════════════════════════════════════════════════════════════
   STATE — single source of truth
═══════════════════════════════════════════════════════════════ */
const State = (() => {
    let _appointments = [];
    let _currentMonth  = new Date();   // view month (day is irrelevant)
    let _filters       = { patient: '', doctor: '', startDate: '', endDate: '' };

    return {
        get appointments()  { return _appointments; },
        get currentMonth()  { return new Date(_currentMonth); },
        get filters()       { return { ..._filters }; },

        setAppointments(arr)   { _appointments = arr; },
        setCurrentMonth(date)  { _currentMonth = new Date(date.getFullYear(), date.getMonth(), 1); },
        setFilters(f)          { _filters = { ..._filters, ...f }; },
        resetFilters()         { _filters = { patient: '', doctor: '', startDate: '', endDate: '' }; },

        getFiltered() {
            const { patient, doctor, startDate, endDate } = _filters;
            return _appointments.filter(a => {
                const matchP = a.patient.toLowerCase().includes(patient.toLowerCase());
                const matchD = a.doctor.toLowerCase().includes(doctor.toLowerCase());
                let   matchDate = true;
                if (startDate && endDate) matchDate = a.date >= startDate && a.date <= endDate;
                else if (startDate)       matchDate = a.date >= startDate;
                else if (endDate)         matchDate = a.date <= endDate;
                return matchP && matchD && matchDate;
            });
        },
    };
})();

/* ═══════════════════════════════════════════════════════════════
   STORAGE (Pre-populates data if empty!)
═══════════════════════════════════════════════════════════════ */
const Storage = {
    load() {
        try {
            const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            
            // Return existing data if present
            if (parsed && parsed.length > 0) return parsed;
            
            // If completely empty, inject the default data from the screenshot
            return [
                { id: Utils.uid(), patient: 'Henry James', doctor: 'James Marry', hospital: 'Salus Center (General Hospital)', specialty: 'Dermatology', date: '2025-12-18', time: '00:00', reason: '' },
                { id: Utils.uid() + '1', patient: 'Henry James', doctor: 'James Marry', hospital: 'Ultracare (General Hospital)', specialty: 'Dermatology', date: '2025-12-18', time: '00:00', reason: '' }
            ];
        } catch { return []; }
    },
    save(appointments) {
        try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(appointments)); }
        catch { /* storage unavailable */ }
    },
};

/* ═══════════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════════ */
const Utils = {
    uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; },

    esc(str) {
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },

    debounce(fn, delay) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    },

    to12Hour(time24) {
        if (!time24) return '';
        if (time24.includes('AM') || time24.includes('PM')) return time24;
        
        const [hStr, m] = time24.split(':');
        let h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2,'0')}:${m} ${ampm}`;
    },

    to24Hour(time12) {
        if (!time12) return '';
        const parts = time12.trim().split(' ');
        if (parts.length < 2) return time12;
        const [time, mod] = parts;
        let [h, m] = time.split(':');
        h = parseInt(h, 10);
        if (mod === 'AM' && h === 12) h = 0;
        if (mod === 'PM' && h !== 12) h += 12;
        return `${String(h).padStart(2,'0')}:${m}`;
    },

    add15Mins(time12) {
        if (!time12) return '';
        const t24 = Utils.to24Hour(time12);
        const [h, m] = t24.split(':').map(Number);
        const d = new Date(0, 0, 0, h, m + 15);
        return Utils.to12Hour(
            `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        );
    },

    formatDate(isoDate) {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-');
        return `${d}/${m}/${y}`;
    },

    todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    toDateStr(y, m, d) {
        return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    },

    svgEdit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    svgDelete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

/* ═══════════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════════ */
const Validator = {
    validate(data, editId = null) {
        const errors = {};

        // Strict Patient Name Validation
        const patientName = data.patient.trim();
        if (!patientName) {
            errors['err-patient'] = 'Patient name is required.';
        } else if (/\d/.test(patientName)) {
            errors['err-patient'] = 'Patient name cannot contain numbers.';
        } else if (patientName.length < 2) {
            errors['err-patient'] = 'Patient name must be at least 2 characters.';
        }

        if (!data.doctor)           errors['err-doctor']   = 'Please select a doctor.';
        if (!data.hospital)         errors['err-hospital'] = 'Please select a hospital.';
        if (!data.specialty)        errors['err-specialty']= 'Please select a specialty.';
        
        if (!data.date) {
            errors['err-date'] = 'Please select a date.';
        } else if (!editId && data.date < Utils.todayStr()) {
            errors['err-date'] = 'Appointment date cannot be in the past.';
        }

        if (!data.time)             errors['err-time']     = 'Please select a time.';

        // Overlap check
        if (data.doctor && data.date && data.time) {
            const time12 = Utils.to12Hour(data.time);
            const conflict = State.appointments.find(a =>
                a.id !== editId &&
                a.doctor === data.doctor &&
                a.date   === data.date   &&
                Utils.to12Hour(Utils.to24Hour(a.time)) === time12
            );
            if (conflict) {
                errors['err-time'] = `${data.doctor} already has an appointment at this time.`;
            }
        }

        return { valid: Object.keys(errors).length === 0, errors };
    },

    showErrors(errors) {
        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        document.querySelectorAll('.input-group input, .input-group select').forEach(el => {
            el.classList.remove('error');
        });

        Object.entries(errors).forEach(([id, msg]) => {
            const errEl = document.getElementById(id);
            if (errEl) errEl.textContent = msg;
            const fieldId = id.replace('err-', 'appt-');
            const input   = document.getElementById(fieldId);
            if (input) {
                const group = input.closest('.input-group');
                if (group) input.classList.add('error');
            }
        });
    },

    clearErrors() {
        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        document.querySelectorAll('.input-group .error').forEach(el => el.classList.remove('error'));
    },
};

/* ═══════════════════════════════════════════════════════════════
   STATE OPERATIONS
═══════════════════════════════════════════════════════════════ */
const AppointmentOps = {
    add(data) {
        const appt = { ...data, id: Utils.uid() };
        State.setAppointments([...State.appointments, appt]);
        Storage.save(State.appointments);
        return appt;
    },
    update(id, data) {
        const updated = State.appointments.map(a => a.id === id ? { ...a, ...data } : a);
        State.setAppointments(updated);
        Storage.save(State.appointments);
    },
    delete(id) {
        State.setAppointments(State.appointments.filter(a => a.id !== id));
        Storage.save(State.appointments);
    },
    getById(id) { return State.appointments.find(a => a.id === id) || null; },
};

/* ═══════════════════════════════════════════════════════════════
   TOAST & CONFIRM DIALOG
═══════════════════════════════════════════════════════════════ */
const Toast = (() => {
    const el = document.getElementById('toast');
    let timer;
    const ICONS = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    };
    return {
        show(msg, type = 'success') {
            clearTimeout(timer);
            el.className = `toast ${type}`;
            el.innerHTML = `${ICONS[type] || ''}<span>${Utils.esc(msg)}</span>`;
            el.classList.add('show');
            timer = setTimeout(() => el.classList.remove('show'), CONFIG.TOAST_DURATION);
        },
    };
})();

const Confirm = (() => {
    const overlay = document.getElementById('confirm-overlay');
    const btnOk   = document.getElementById('confirm-ok');
    const btnCancel = document.getElementById('confirm-cancel');
    let _resolve;

    function close() {
        overlay.hidden = true;
        if (_resolve) _resolve(false);
    }

    btnOk.addEventListener('click',     () => { overlay.hidden = true; if (_resolve) _resolve(true);  });
    btnCancel.addEventListener('click', () => close());
    overlay.addEventListener('click',   e  => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) close(); });

    return {
        ask(msg = 'Are you sure?') {
            document.getElementById('confirm-message').textContent = msg;
            overlay.hidden = false;
            return new Promise(res => { _resolve = res; });
        },
    };
})();

/* ═══════════════════════════════════════════════════════════════
   LAYOUT
═══════════════════════════════════════════════════════════════ */
const Layout = (() => {
    const sidebar       = document.getElementById('sidebar');
    const brandContainer= document.getElementById('brand-container');
    const headerRight   = document.getElementById('header-right');
    const toggleBtn     = document.getElementById('btn-toggle-sidebar');
    const overlay       = document.getElementById('sidebar-overlay');
    const navItems      = document.querySelectorAll('.nav-item');
    const views         = document.querySelectorAll('.view-section');

    let isMobile = () => window.innerWidth <= 768;

    function closeMobileDrawer() {
        sidebar.classList.remove('mobile-open');
        overlay.style.display   = 'none';
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleSidebar() {
        if (isMobile()) {
            const open = sidebar.classList.toggle('mobile-open');
            overlay.style.display = open ? 'block' : 'none';
            toggleBtn.setAttribute('aria-expanded', String(open));
        } else {
            const collapsed = sidebar.classList.toggle('collapsed');
            brandContainer.classList.toggle('collapsed', collapsed);
            if (headerRight) headerRight.classList.toggle('collapsed', collapsed);
            toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        }
    }

    function switchView(viewId) {
        views.forEach(v => {
            v.classList.toggle('active', v.id === viewId);
        });
        navItems.forEach(n => {
            const isActive = n.getAttribute('data-view') === viewId;
            n.classList.toggle('active', isActive);
            n.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
        if (isMobile()) closeMobileDrawer();
    }

    function init() {
        toggleBtn.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click',   closeMobileDrawer);

        navItems.forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const target = item.getAttribute('data-view');
                switchView(target);
                if (target === 'dashboard-view') Dashboard.render();
            });
        });

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (!isMobile()) closeMobileDrawer();
            }, 150);
        });
    }

    return { init };
})();

/* ═══════════════════════════════════════════════════════════════
   CALENDAR MODULE
═══════════════════════════════════════════════════════════════ */
const Calendar = (() => {
    const grid         = document.getElementById('calendar-grid');
    const monthDisplay = document.getElementById('current-month-year');
    const monthSelect  = document.getElementById('cal-month-select');
    const monthPicker  = document.getElementById('cal-native-month-picker');
    const today        = Utils.todayStr();

    function buildEvents(appts, dateStr) {
        const frag = document.createDocumentFragment();
        const shown = appts.slice(0, CONFIG.MAX_EVENTS_SHOWN);
        const extra = appts.length - shown.length;

        shown.forEach(appt => {
            const ev = document.createElement('div');
            ev.className = 'cal-event';
            ev.setAttribute('role', 'button');
            ev.setAttribute('tabindex', '0');
            ev.setAttribute('aria-label', `${appt.patient} at ${Utils.to12Hour(Utils.to24Hour(appt.time))}. Click to edit.`);
            ev.innerHTML = `
                <div class="event-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span class="event-text">${Utils.esc(appt.patient)}</span>
                </div>
                <div class="event-actions" aria-hidden="true">
                    <svg class="evt-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Edit">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <svg class="evt-delete" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Delete">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </div>`;

            ev.addEventListener('click',  e => { e.stopPropagation(); Modal.open(appt.id); });
            ev.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); Modal.open(appt.id); }
            });
            ev.querySelector('.evt-edit').addEventListener('click', e => { e.stopPropagation(); Modal.open(appt.id); });
            ev.querySelector('.evt-delete').addEventListener('click', async e => {
                e.stopPropagation();
                const ok = await Confirm.ask(`Delete ${appt.patient}'s appointment on ${Utils.formatDate(appt.date)}?`);
                if (ok) {
                    AppointmentOps.delete(appt.id);
                    Calendar.render();
                    Dashboard.render();
                    Toast.show('Appointment deleted.', 'success');
                }
            });

            frag.appendChild(ev);
        });

        if (extra > 0) {
            const more = document.createElement('button');
            more.className   = 'cal-more';
            more.textContent = `+${extra} more`;
            more.setAttribute('aria-label', `${extra} more appointments on this day`);
            more.addEventListener('click', e => {
                e.stopPropagation();
                State.setFilters({ startDate: dateStr, endDate: dateStr });
                document.querySelector('[data-view="dashboard-view"]').click();
            });
            frag.appendChild(more);
        }

        return frag;
    }

    function render() {
        const cm    = State.currentMonth;
        const year  = cm.getFullYear();
        const month = cm.getMonth();

        monthDisplay.textContent = `${CONFIG.MONTH_NAMES[month]} ${year}`;
        if (monthSelect) monthSelect.value = month;
        if (monthPicker) monthPicker.value = `${year}-${String(month + 1).padStart(2, '0')}`;

        const firstDay    = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const frag = document.createDocumentFragment();

        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell other-month';
            cell.setAttribute('aria-hidden', 'true');
            frag.appendChild(cell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = Utils.toDateStr(year, month, day);
            const appts   = State.appointments.filter(a => a.date === dateStr);
            const isToday = dateStr === today;
            const dayOfWeek = CONFIG.DAY_NAMES[new Date(year, month, day).getDay()];
            const hasEvents = appts.length > 0;

            const cell = document.createElement('div');
            cell.className = `cal-cell${isToday ? ' today' : ''}${hasEvents ? ' has-events' : ' empty-day'}`;
            cell.setAttribute('role', 'gridcell');

            const dateDiv = document.createElement('div');
            dateDiv.className = 'cal-date';
            
            const dayLabel = document.createElement('span');
            dayLabel.className = 'cal-date-label mobile-only';
            dayLabel.textContent = dayOfWeek;
            
            const numSpan = document.createElement('span');
            numSpan.className = 'cal-date-num';
            numSpan.textContent = day;
            
            dateDiv.appendChild(dayLabel);
            dateDiv.appendChild(numSpan);

            if (day === 1) {
                const label = document.createElement('span');
                label.className   = 'cal-date-label desktop-only';
                label.textContent = CONFIG.MONTH_NAMES[month].slice(0, 3);
                dateDiv.appendChild(label);
            }

            cell.appendChild(dateDiv);
            if (hasEvents) cell.appendChild(buildEvents(appts, dateStr));

            cell.addEventListener('click', e => {
                if (e.target.closest('.cal-event') || e.target.closest('.cal-more')) return;
                Modal.open(null, dateStr);
            });

            frag.appendChild(cell);
        }

        const totalCells = firstDay + daysInMonth;
        const trailing   = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 0; i < trailing; i++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell other-month';
            cell.setAttribute('aria-hidden', 'true');
            frag.appendChild(cell);
        }

        grid.innerHTML = '';
        grid.appendChild(frag);
    }

    function changeMonth(delta) {
        const cm = State.currentMonth;
        State.setCurrentMonth(new Date(cm.getFullYear(), cm.getMonth() + delta, 1));
        render();
    }

    function init() {
        document.getElementById('cal-prev').addEventListener('click', () => changeMonth(-1));
        document.getElementById('cal-next').addEventListener('click', () => changeMonth(1));

        document.getElementById('cal-today')?.addEventListener('click', () => {
            State.setCurrentMonth(new Date());
            render();
        });

        monthSelect?.addEventListener('change', e => {
            const cm = State.currentMonth;
            State.setCurrentMonth(new Date(cm.getFullYear(), parseInt(e.target.value), 1));
            render();
        });

        monthPicker?.addEventListener('change', e => {
            if (!e.target.value) return; 
            const [y, m] = e.target.value.split('-');
            State.setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
            render();
        });

        const dateDisplayBtn = document.getElementById('date-display-btn');
        dateDisplayBtn?.addEventListener('click', () => {
            try {
                if (monthPicker) monthPicker.showPicker();
            } catch (e) {
                if (monthPicker) monthPicker.focus();
            }
        });
    }

    return { init, render };
})();

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD MODULE
═══════════════════════════════════════════════════════════════ */
const Dashboard = (() => {
    const tbody      = document.getElementById('dashboard-tbody');
    const mobileList = document.getElementById('mobile-cards');
    const emptyState = document.getElementById('dashboard-empty');
    const resultCount= document.getElementById('result-count');
    const apptBadge  = document.getElementById('appt-badge');

    function buildTableRow(appt) {
        const tr = document.createElement('tr');
        const displayDate = Utils.formatDate(appt.date);
        const displayTime = Utils.to12Hour(Utils.to24Hour(appt.time));
        const timeEnd     = Utils.add15Mins(displayTime);

        tr.innerHTML = `
            <td><a href="#" class="link-edit" data-id="${appt.id}">${Utils.esc(appt.patient)}</a></td>
            <td><span class="text-blue" style="font-weight:500">${Utils.esc(appt.doctor)}</span></td>
            <td>${Utils.esc(appt.hospital)}</td>
            <td>${Utils.esc(appt.specialty)}</td>
            <td>${displayDate}</td>
            <td class="text-blue">${Utils.esc(displayTime)} - ${Utils.esc(timeEnd)}</td>
            <td class="actions-cell">
                <button class="tbl-action edit"   data-id="${appt.id}" title="Edit appointment">
                    ${Utils.svgEdit}
                </button>
                <button class="tbl-action delete" data-id="${appt.id}" title="Delete appointment">
                    ${Utils.svgDelete}
                </button>
            </td>`;
        return tr;
    }

    function buildCard(appt) {
        const card = document.createElement('div');
        card.className = 'appt-card';
        const displayDate = Utils.formatDate(appt.date);
        const displayTime = Utils.to12Hour(Utils.to24Hour(appt.time));
        const timeEnd     = Utils.add15Mins(displayTime);

        card.innerHTML = `
            <div class="appt-card-header">
                <span class="appt-card-patient">${Utils.esc(appt.patient)}</span>
                <div class="event-actions">
                    <button class="tbl-action evt-edit edit" data-id="${appt.id}">
                        ${Utils.svgEdit}
                    </button>
                    <button class="tbl-action evt-delete delete" data-id="${appt.id}">
                        ${Utils.svgDelete}
                    </button>
                </div>
            </div>
            <div class="appt-card-body">
                <div class="appt-card-field">
                    <div class="appt-card-label">Doctor</div>
                    <div class="appt-card-value text-blue">${Utils.esc(appt.doctor)}</div>
                </div>
                <div class="appt-card-field">
                    <div class="appt-card-label">Specialty</div>
                    <div class="appt-card-value">${Utils.esc(appt.specialty)}</div>
                </div>
                <div class="appt-card-field">
                    <div class="appt-card-label">Date</div>
                    <div class="appt-card-value">${displayDate}</div>
                </div>
                <div class="appt-card-field">
                    <div class="appt-card-label">Time</div>
                    <div class="appt-card-value text-blue">${Utils.esc(displayTime)} - ${Utils.esc(timeEnd)}</div>
                </div>
                <div class="appt-card-field" style="grid-column:1/-1">
                    <div class="appt-card-label">Hospital</div>
                    <div class="appt-card-value">${Utils.esc(appt.hospital)}</div>
                </div>
            </div>`;
        return card;
    }

    async function handleAction(e) {
        const editBtn   = e.target.closest('.tbl-action.edit');
        const deleteBtn = e.target.closest('.tbl-action.delete');
        const linkEdit  = e.target.closest('.link-edit');

        if (editBtn || linkEdit) {
            e.preventDefault();
            const id = (editBtn || linkEdit).getAttribute('data-id');
            Modal.open(id);
            return;
        }

        if (deleteBtn) {
            const id   = deleteBtn.getAttribute('data-id');
            const appt = AppointmentOps.getById(id);
            if (!appt) return;

            const ok = await Confirm.ask(
                `Delete ${appt.patient}'s appointment on ${Utils.formatDate(appt.date)}?`
            );
            if (ok) {
                AppointmentOps.delete(id);
                render();
                Calendar.render();
                Toast.show('Appointment deleted.', 'success');
            }
        }
    }

    function render() {
        const filtered = State.getFiltered();
        const total    = State.appointments.length;

        if (apptBadge) {
            apptBadge.textContent = `${total} Total`;
            apptBadge.style.display = total ? '' : 'none';
        }

        resultCount.textContent = filtered.length === total
            ? `${total} appointment${total !== 1 ? 's' : ''}`
            : `${filtered.length} of ${total}`;

        const hasResults = filtered.length > 0;
        emptyState.hidden     = hasResults;
        tbody.parentElement.parentElement.style.display = hasResults ? '' : 'none'; 
        mobileList.style.display = hasResults ? '' : 'none';

        const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

        const tbodyFrag = document.createDocumentFragment();
        sorted.forEach(appt => tbodyFrag.appendChild(buildTableRow(appt)));
        tbody.innerHTML = '';
        tbody.appendChild(tbodyFrag);

        const cardFrag = document.createDocumentFragment();
        sorted.forEach(appt => cardFrag.appendChild(buildCard(appt)));
        mobileList.innerHTML = '';
        mobileList.appendChild(cardFrag);
    }

    function syncFiltersFromUI() {
        State.setFilters({
            patient:   document.getElementById('search-patient').value,
            doctor:    document.getElementById('search-doctor').value,
            startDate: document.getElementById('filter-start').value,
            endDate:   document.getElementById('filter-end').value,
        });
    }

    function init() {
        document.getElementById('dashboard-tbody').addEventListener('click', handleAction);
        document.getElementById('mobile-cards').addEventListener('click',    handleAction);

        // Update button triggers filtering
        document.getElementById('btn-update-filters')?.addEventListener('click', () => {
            syncFiltersFromUI();
            render();
        });

        document.getElementById('empty-book-btn')?.addEventListener('click', () => Modal.open());
    }

    return { init, render };
})();

/* ═══════════════════════════════════════════════════════════════
   MODAL MODULE
═══════════════════════════════════════════════════════════════ */
const Modal = (() => {
    const overlay    = document.getElementById('appointment-modal');
    const form       = document.getElementById('appointment-form');
    const titleEl    = document.getElementById('modal-title');
    const btnSave    = document.getElementById('btn-save-appt');
    const btnClose   = document.getElementById('btn-close-modal');
    const btnCancel  = document.getElementById('btn-cancel-modal');

    let _editId = null;

    const FIELD_IDS = ['appt-patient','appt-doctor','appt-hospital','appt-specialty','appt-date','appt-time','appt-reason'];

    function getFormData() {
        return {
            patient:   document.getElementById('appt-patient').value.trim(),
            doctor:    document.getElementById('appt-doctor').value,
            hospital:  document.getElementById('appt-hospital').value,
            specialty: document.getElementById('appt-specialty').value,
            date:      document.getElementById('appt-date').value,
            time:      document.getElementById('appt-time').value,
            reason:    document.getElementById('appt-reason').value.trim(),
        };
    }

    function resetForm() {
        form.reset();
        FIELD_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('error'); el.value = ''; }
        });
        Validator.clearErrors();
        _editId = null;
    }

    function open(editId = null, prefillDate = null) {
        resetForm();

        if (editId) {
            _editId  = editId;
            const appt = AppointmentOps.getById(editId);
            if (appt) {
                titleEl.textContent = 'Edit Appointment';
                btnSave.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Update Appointment`;
                document.getElementById('appt-patient').value   = appt.patient;
                document.getElementById('appt-doctor').value    = appt.doctor;
                document.getElementById('appt-hospital').value  = appt.hospital;
                document.getElementById('appt-specialty').value = appt.specialty;
                document.getElementById('appt-date').value      = appt.date;
                document.getElementById('appt-time').value      = Utils.to24Hour(appt.time);
                document.getElementById('appt-reason').value    = appt.reason || '';
            }
        } else {
            titleEl.textContent = 'Schedule Appointment';
            btnSave.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Appointment`;
            if (prefillDate) document.getElementById('appt-date').value = prefillDate;
        }

        overlay.classList.add('open');
        setTimeout(() => document.getElementById('appt-patient').focus(), 120);
    }

    function close() {
        overlay.classList.remove('open');
        resetForm();
    }

    async function handleSave() {
        const raw  = getFormData();
        const data = {
            ...raw,
            time: Utils.to12Hour(raw.time),
        };

        const { valid, errors } = Validator.validate(raw, _editId);
        if (!valid) {
            Validator.showErrors(errors);
            const firstErr = Object.keys(errors)[0].replace('err-', 'appt-');
            document.getElementById(firstErr)?.focus();
            return;
        }

        if (_editId) {
            AppointmentOps.update(_editId, data);
            Toast.show('Appointment updated successfully.', 'success');
        } else {
            AppointmentOps.add(data);
            Toast.show('Appointment booked successfully.', 'success');
        }

        close();
        Calendar.render();
        Dashboard.render();
    }

    function init() {
        document.getElementById('btn-open-modal').addEventListener('click', () => open());
        btnClose.addEventListener('click',  close);
        btnCancel.addEventListener('click', close);
        btnSave.addEventListener('click',   handleSave);

        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
        });

        form.addEventListener('input', e => {
            const id  = e.target.id;
            const err = document.getElementById(`err-${id.replace('appt-', '')}`);
            if (err) err.textContent = '';
            e.target.classList.remove('error');
        });
    }

    return { init, open, close };
})();

/* ═══════════════════════════════════════════════════════════════
   APP — BOOTSTRAP
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    State.setAppointments(Storage.load());
    State.setCurrentMonth(new Date());

    Layout.init();
    Calendar.init();
    Dashboard.init();
    Modal.init();

    Calendar.render();
    Dashboard.render();
});