// ============================================
// GymTracker - PWA
// Datos almacenados en localStorage
// Notificaciones locales mediante Service Worker
// ============================================

// ----- Definición de actividades -----
const ACTIVITIES = {
    // Gimnasio
    pecho:      { name: 'Pecho',           cat: 'gimnasio', icon: '💪', color: '#FF3B30' },
    espalda:    { name: 'Espalda',         cat: 'gimnasio', icon: '🏋️', color: '#007AFF' },
    piernas:    { name: 'Piernas',         cat: 'gimnasio', icon: '🦵', color: '#AF52DE' },
    hombros:    { name: 'Hombros',         cat: 'gimnasio', icon: '🤸', color: '#FF9500' },
    brazos:     { name: 'Brazos',          cat: 'gimnasio', icon: '💪', color: '#FF2D55' },
    core:       { name: 'Core/Abdominales',cat: 'gimnasio', icon: '🧘', color: '#FFCC00' },
    fullbody:   { name: 'Full Body',       cat: 'gimnasio', icon: '🏋️‍♂️', color: '#5856D6' },
    cardio:     { name: 'Cardio',          cat: 'gimnasio', icon: '❤️', color: '#00C7BE' },
    // Deportes
    running:    { name: 'Running',         cat: 'deporte',  icon: '🏃', color: '#34C759' },
    ciclismo:   { name: 'Ciclismo',        cat: 'deporte',  icon: '🚴', color: '#30B0C7' },
    natacion:   { name: 'Natación',        cat: 'deporte',  icon: '🏊', color: '#32ADE6' },
    padel:      { name: 'Pádel',           cat: 'deporte',  icon: '🎾', color: '#A2845E' },
    tenis:      { name: 'Tenis',           cat: 'deporte',  icon: '🎾', color: '#FFCC00' },
    futbol:     { name: 'Fútbol',          cat: 'deporte',  icon: '⚽', color: '#34C759' },
    basket:     { name: 'Baloncesto',      cat: 'deporte',  icon: '🏀', color: '#FF9500' },
    escalada:   { name: 'Escalada',        cat: 'deporte',  icon: '🧗', color: '#FF3B30' },
    yoga:       { name: 'Yoga',            cat: 'deporte',  icon: '🧘‍♀️', color: '#AF52DE' },
    pilates:    { name: 'Pilates',         cat: 'deporte',  icon: '🤸‍♀️', color: '#FF2D55' },
    caminar:    { name: 'Caminar',         cat: 'deporte',  icon: '🚶', color: '#8E8E93' },
    otro:       { name: 'Otro',            cat: 'deporte',  icon: '⭐', color: '#8E8E93' }
};

// ----- Almacenamiento -----
const Storage = {
    KEY_WORKOUTS: 'gt_workouts',
    KEY_PLANNED: 'gt_planned',
    
    getWorkouts() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY_WORKOUTS) || '[]');
        } catch { return []; }
    },
    saveWorkouts(arr) {
        localStorage.setItem(this.KEY_WORKOUTS, JSON.stringify(arr));
    },
    getPlanned() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY_PLANNED) || '[]');
        } catch { return []; }
    },
    savePlanned(arr) {
        localStorage.setItem(this.KEY_PLANNED, JSON.stringify(arr));
    }
};

// ----- Utilidades de fechas -----
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function isSameDay(d1, d2) {
    if (!d1 || !d2) return false;
    const a = new Date(d1), b = new Date(d2);
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}
function dateToISO(date) {
    return startOfDay(date).toISOString();
}
function formatDateLong(date) {
    return new Date(date).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}
function formatMonthYear(date) {
    return new Date(date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
function uuid() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

// ----- Estado global -----
const state = {
    displayedMonth: new Date(),
    selectedDate: null,
    modalMode: null, // 'workout' o 'planned'
    modalDate: null,
    modalCategory: 'gimnasio',
    modalActivity: 'pecho',
    modalDuration: 60
};

// ============================================
// Mantenimiento: limpieza automática
// ============================================
function runMaintenance() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Borrar entrenamientos de hace +6 meses
    const workouts = Storage.getWorkouts();
    const filtered = workouts.filter(w => new Date(w.date) >= sixMonthsAgo);
    if (filtered.length !== workouts.length) {
        Storage.saveWorkouts(filtered);
        console.log(`Borrados ${workouts.length - filtered.length} entrenamientos antiguos`);
    }
    
    // Borrar planificaciones cuya fecha ya pasó
    const today = startOfDay(new Date());
    const planned = Storage.getPlanned();
    const futurePlanned = planned.filter(p => new Date(p.date) >= today);
    if (futurePlanned.length !== planned.length) {
        // Cancelar notificaciones de las que vamos a borrar
        const removed = planned.filter(p => new Date(p.date) < today);
        for (const p of removed) {
            cancelNotification(p.notificationId);
        }
        Storage.savePlanned(futurePlanned);
        console.log(`Borradas ${removed.length} planificaciones pasadas`);
    }
}

// ============================================
// Notificaciones (vía Service Worker)
// ============================================
async function setupNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Notificaciones no soportadas en este navegador');
        return;
    }
    
    try {
        // Registrar Service Worker
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registrado');
        
        // Pedir permiso si no se ha pedido
        if ('Notification' in window && Notification.permission === 'default') {
            const result = await Notification.requestPermission();
            console.log('Permiso notificaciones:', result);
        }
    } catch (err) {
        console.error('Error registrando SW:', err);
    }
}

async function scheduleNotification(planned) {
    if (!('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;
    
    try {
        const reg = await navigator.serviceWorker.ready;
        // Mandamos los datos al SW para que programe el aviso
        reg.active?.postMessage({
            type: 'schedule',
            id: planned.notificationId,
            date: planned.date,
            activity: ACTIVITIES[planned.activity].name,
            time: planned.hasTime ? planned.time : null
        });
    } catch (err) {
        console.error('Error programando notificación:', err);
    }
}

async function cancelNotification(id) {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'cancel', id });
    } catch {}
}

// ============================================
// Renderizado del calendario
// ============================================
function renderCalendar() {
    const monthTitle = document.getElementById('month-title');
    monthTitle.textContent = formatMonthYear(state.displayedMonth);
    
    const grid = document.getElementById('days-grid');
    grid.innerHTML = '';
    
    const year = state.displayedMonth.getFullYear();
    const month = state.displayedMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Día de la semana del primer día (lunes=0)
    let firstWeekday = firstOfMonth.getDay() - 1;
    if (firstWeekday < 0) firstWeekday = 6;
    
    // Celdas vacías iniciales
    for (let i = 0; i < firstWeekday; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        grid.appendChild(empty);
    }
    
    const workouts = Storage.getWorkouts();
    const planned = Storage.getPlanned();
    const today = new Date();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayWorkouts = workouts.filter(w => isSameDay(w.date, date));
        const dayPlanned = planned.filter(p => isSameDay(p.date, date));
        
        const cell = document.createElement('button');
        cell.className = 'day-cell';
        if (isSameDay(date, today)) cell.classList.add('today');
        if (isSameDay(date, state.selectedDate)) cell.classList.add('selected');
        
        const numberEl = document.createElement('span');
        numberEl.className = 'day-number';
        numberEl.textContent = day;
        cell.appendChild(numberEl);
        
        // Puntos de actividades
        const dotsEl = document.createElement('span');
        dotsEl.className = 'day-dots';
        
        const seenWorkout = new Set();
        for (const w of dayWorkouts) {
            if (seenWorkout.has(w.activity)) continue;
            seenWorkout.add(w.activity);
            if (seenWorkout.size > 3) break;
            const dot = document.createElement('span');
            dot.className = 'day-dot';
            dot.style.background = ACTIVITIES[w.activity]?.color || '#888';
            dotsEl.appendChild(dot);
        }
        const seenPlanned = new Set();
        for (const p of dayPlanned) {
            if (seenPlanned.has(p.activity)) continue;
            seenPlanned.add(p.activity);
            if (seenPlanned.size > 2) break;
            const dot = document.createElement('span');
            dot.className = 'day-dot planned';
            dot.style.borderColor = ACTIVITIES[p.activity]?.color || '#888';
            dotsEl.appendChild(dot);
        }
        cell.appendChild(dotsEl);
        
        cell.addEventListener('click', () => {
            state.selectedDate = date;
            renderCalendar();
            renderDayDetail();
        });
        
        grid.appendChild(cell);
    }
}

function renderDayDetail() {
    const detailEl = document.getElementById('day-detail');
    if (!state.selectedDate) {
        detailEl.classList.add('hidden');
        return;
    }
    detailEl.classList.remove('hidden');
    
    document.getElementById('day-detail-title').textContent = formatDateLong(state.selectedDate);
    
    const today = startOfDay(new Date());
    const target = startOfDay(state.selectedDate);
    const isFuture = target > today;
    const isPast = target < today;
    
    // Botones de acción
    const actionsEl = document.getElementById('day-actions');
    actionsEl.innerHTML = '';
    
    if (!isFuture) {
        const btnReg = document.createElement('button');
        btnReg.className = 'btn btn-primary';
        btnReg.innerHTML = '✓ Registrar';
        btnReg.addEventListener('click', () => openModal('workout', state.selectedDate));
        actionsEl.appendChild(btnReg);
    }
    if (!isPast) {
        const btnPlan = document.createElement('button');
        btnPlan.className = 'btn btn-secondary';
        btnPlan.innerHTML = '📅 Planificar';
        btnPlan.addEventListener('click', () => openModal('planned', state.selectedDate));
        actionsEl.appendChild(btnPlan);
    }
    
    // Contenido (entrenamientos + planificaciones)
    const contentEl = document.getElementById('day-content');
    contentEl.innerHTML = '';
    
    const workouts = Storage.getWorkouts().filter(w => isSameDay(w.date, state.selectedDate));
    const planned = Storage.getPlanned().filter(p => isSameDay(p.date, state.selectedDate));
    
    if (workouts.length > 0) {
        const title = document.createElement('p');
        title.className = 'section-title';
        title.textContent = 'Realizados';
        contentEl.appendChild(title);
        
        for (const w of workouts) {
            contentEl.appendChild(buildActivityRow(w, false));
        }
    }
    
    if (planned.length > 0) {
        const title = document.createElement('p');
        title.className = 'section-title';
        title.textContent = 'Planificados';
        contentEl.appendChild(title);
        
        for (const p of planned) {
            contentEl.appendChild(buildActivityRow(p, true));
        }
    }
    
    if (workouts.length === 0 && planned.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Sin actividades este día';
        contentEl.appendChild(empty);
    }
}

function buildActivityRow(item, isPlanned) {
    const row = document.createElement('div');
    row.className = 'activity-row' + (isPlanned ? ' planned' : '');
    
    const act = ACTIVITIES[item.activity];
    
    const icon = document.createElement('span');
    icon.className = 'activity-icon';
    icon.textContent = act?.icon || '⭐';
    icon.style.color = act?.color || '#888';
    row.appendChild(icon);
    
    const info = document.createElement('div');
    info.className = 'activity-info';
    const name = document.createElement('div');
    name.className = 'activity-name';
    name.textContent = act?.name || item.activity;
    info.appendChild(name);
    
    const meta = document.createElement('div');
    meta.className = 'activity-meta';
    if (isPlanned && item.hasTime) {
        meta.textContent = `🕐 ${item.time} · ${item.duration} min planeados`;
    } else if (isPlanned) {
        meta.textContent = `${item.duration} min planeados`;
    } else {
        meta.textContent = `${item.duration} min`;
    }
    info.appendChild(meta);
    row.appendChild(info);
    
    const actions = document.createElement('div');
    actions.className = 'activity-actions';
    
    if (isPlanned) {
        const btnDone = document.createElement('button');
        btnDone.innerHTML = '✅';
        btnDone.title = 'Marcar como hecho';
        btnDone.addEventListener('click', () => markPlannedAsDone(item.id));
        actions.appendChild(btnDone);
    }
    
    const btnDel = document.createElement('button');
    btnDel.innerHTML = '🗑';
    btnDel.title = 'Borrar';
    btnDel.addEventListener('click', () => {
        if (isPlanned) {
            const all = Storage.getPlanned().filter(x => x.id !== item.id);
            Storage.savePlanned(all);
            cancelNotification(item.notificationId);
        } else {
            const all = Storage.getWorkouts().filter(x => x.id !== item.id);
            Storage.saveWorkouts(all);
        }
        renderCalendar();
        renderDayDetail();
        renderStats();
    });
    actions.appendChild(btnDel);
    row.appendChild(actions);
    
    return row;
}

function markPlannedAsDone(id) {
    const planned = Storage.getPlanned();
    const item = planned.find(p => p.id === id);
    if (!item) return;
    
    // Crear entrenamiento real
    const workouts = Storage.getWorkouts();
    workouts.push({
        id: uuid(),
        date: item.date,
        activity: item.activity,
        duration: item.duration,
        createdAt: new Date().toISOString()
    });
    Storage.saveWorkouts(workouts);
    
    // Borrar planificación y cancelar notificación
    Storage.savePlanned(planned.filter(p => p.id !== id));
    cancelNotification(item.notificationId);
    
    renderCalendar();
    renderDayDetail();
    renderStats();
}

// ============================================
// Modal de añadir/planificar
// ============================================
function openModal(mode, date) {
    state.modalMode = mode;
    state.modalDate = date;
    state.modalCategory = 'gimnasio';
    state.modalActivity = 'pecho';
    state.modalDuration = 60;
    
    document.getElementById('modal-title').textContent =
        mode === 'workout' ? 'Registrar entrenamiento' : 'Planificar actividad';
    document.getElementById('modal-date-label').textContent = formatDateLong(date);
    
    // Si es planificación, mostrar campos de hora y aviso
    document.getElementById('time-section').classList.toggle('hidden', mode !== 'planned');
    document.getElementById('notification-info').classList.toggle('hidden', mode !== 'planned');
    
    // Por defecto en planificación, deporte
    if (mode === 'planned') {
        state.modalCategory = 'deporte';
        state.modalActivity = 'padel';
    }
    
    // Reset duración
    document.getElementById('duration-value').textContent = '60';
    
    // Render botones de categoría
    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === state.modalCategory);
    });
    
    renderActivityList();
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function renderActivityList() {
    const listEl = document.getElementById('activity-list');
    listEl.innerHTML = '';
    
    const filtered = Object.entries(ACTIVITIES).filter(([, v]) => v.cat === state.modalCategory);
    
    for (const [key, val] of filtered) {
        const opt = document.createElement('div');
        opt.className = 'activity-option';
        if (key === state.modalActivity) opt.classList.add('selected');
        
        const icon = document.createElement('span');
        icon.className = 'activity-icon';
        icon.textContent = val.icon;
        icon.style.color = val.color;
        opt.appendChild(icon);
        
        const name = document.createElement('span');
        name.textContent = val.name;
        opt.appendChild(name);
        
        const check = document.createElement('span');
        check.className = 'check';
        check.textContent = '✓';
        opt.appendChild(check);
        
        opt.addEventListener('click', () => {
            state.modalActivity = key;
            renderActivityList();
        });
        
        listEl.appendChild(opt);
    }
}

function saveModal() {
    if (state.modalMode === 'workout') {
        const workouts = Storage.getWorkouts();
        workouts.push({
            id: uuid(),
            date: dateToISO(state.modalDate),
            activity: state.modalActivity,
            duration: state.modalDuration,
            createdAt: new Date().toISOString()
        });
        Storage.saveWorkouts(workouts);
    } else {
        const hasTime = document.getElementById('has-time').checked;
        const time = document.getElementById('time-input').value;
        
        const planned = Storage.getPlanned();
        const newPlan = {
            id: uuid(),
            notificationId: uuid(),
            date: dateToISO(state.modalDate),
            activity: state.modalActivity,
            duration: state.modalDuration,
            hasTime,
            time,
            createdAt: new Date().toISOString()
        };
        planned.push(newPlan);
        Storage.savePlanned(planned);
        
        // Programar notificación
        scheduleNotification(newPlan);
    }
    
    closeModal();
    renderCalendar();
    renderDayDetail();
    renderStats();
}

// ============================================
// Estadísticas
// ============================================
function renderStats() {
    const workouts = Storage.getWorkouts();
    const planned = Storage.getPlanned();
    
    // Racha
    const streak = computeStreak(workouts);
    document.getElementById('streak-number').textContent = streak;
    document.getElementById('streak-text').textContent =
        streak === 0 ? '¡Empieza tu racha hoy!' :
        streak === 1 ? 'Racha actual' :
        'Racha actual de entrenamientos';
    
    // Mes actual
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthW = workouts.filter(w => {
        const d = new Date(w.date);
        return d >= startMonth && d < endMonth;
    });
    
    document.getElementById('month-workouts').textContent = monthW.length;
    
    const uniqueDays = new Set(monthW.map(w => startOfDay(w.date).getTime())).size;
    document.getElementById('month-days').textContent = uniqueDays;
    
    const totalMin = monthW.reduce((s, w) => s + (w.duration || 0), 0);
    document.getElementById('month-time').textContent = formatTime(totalMin);
    
    // Próximas planificaciones
    const today = startOfDay(new Date());
    const upcoming = planned
        .filter(p => new Date(p.date) >= today)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
    
    const upcomingEl = document.getElementById('upcoming-list');
    upcomingEl.innerHTML = '';
    if (upcoming.length === 0) {
        upcomingEl.innerHTML = '<p class="empty-state">No tienes nada planificado</p>';
    } else {
        for (const p of upcoming) {
            const act = ACTIVITIES[p.activity];
            const row = document.createElement('div');
            row.className = 'upcoming-row';
            row.innerHTML = `
                <span class="activity-icon" style="color:${act?.color || '#888'};">${act?.icon || '⭐'}</span>
                <div class="activity-info">
                    <div class="activity-name">${act?.name || p.activity}</div>
                    <div class="activity-meta">${formatPlannedDate(p)}</div>
                </div>
            `;
            upcomingEl.appendChild(row);
        }
    }
    
    // Desglose por tipo
    const breakdownEl = document.getElementById('breakdown-list');
    breakdownEl.innerHTML = '';
    const counts = {};
    for (const w of monthW) {
        counts[w.activity] = (counts[w.activity] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    if (sorted.length === 0) {
        breakdownEl.innerHTML = '<p class="empty-state">Aún no hay entrenamientos este mes</p>';
    } else {
        for (const [key, count] of sorted) {
            const act = ACTIVITIES[key];
            const row = document.createElement('div');
            row.className = 'breakdown-row';
            row.innerHTML = `
                <span class="activity-icon" style="color:${act?.color || '#888'};">${act?.icon || '⭐'}</span>
                <span style="flex:1;">${act?.name || key}</span>
                <span class="breakdown-count">${count}</span>
            `;
            breakdownEl.appendChild(row);
        }
    }
}

function computeStreak(workouts) {
    if (!workouts.length) return 0;
    const days = new Set(workouts.map(w => startOfDay(w.date).getTime()));
    
    let streak = 0;
    let check = startOfDay(new Date());
    
    if (!days.has(check.getTime())) {
        check = new Date(check);
        check.setDate(check.getDate() - 1);
    }
    
    while (days.has(check.getTime())) {
        streak++;
        check = new Date(check);
        check.setDate(check.getDate() - 1);
    }
    return streak;
}

function formatTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function formatPlannedDate(p) {
    const d = new Date(p.date);
    let str = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    str = str.charAt(0).toUpperCase() + str.slice(1);
    if (p.hasTime) str += ` · ${p.time}`;
    return str;
}

// ============================================
// Exportar / Importar
// ============================================
function exportData() {
    const data = {
        workouts: Storage.getWorkouts(),
        planned: Storage.getPlanned(),
        exportedAt: new Date().toISOString(),
        version: 1
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymtracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm('¿Reemplazar todos los datos actuales con los importados?')) return;
            if (Array.isArray(data.workouts)) Storage.saveWorkouts(data.workouts);
            if (Array.isArray(data.planned)) Storage.savePlanned(data.planned);
            renderCalendar();
            renderDayDetail();
            renderStats();
            alert('Datos importados correctamente');
        } catch (err) {
            alert('Archivo no válido');
        }
    };
    reader.readAsText(file);
}

// ============================================
// Inicialización
// ============================================
function init() {
    runMaintenance();
    setupNotifications();
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.view).classList.add('active');
            if (btn.dataset.view === 'view-stats') renderStats();
        });
    });
    
    // Navegación de meses
    document.getElementById('btn-prev-month').addEventListener('click', () => {
        state.displayedMonth.setMonth(state.displayedMonth.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('btn-next-month').addEventListener('click', () => {
        state.displayedMonth.setMonth(state.displayedMonth.getMonth() + 1);
        renderCalendar();
    });
    
    // Modal
    document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-modal-save').addEventListener('click', saveModal);
    
    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.modalCategory = btn.dataset.category;
            // Cambiar a primera actividad de esa categoría si la actual no encaja
            const validKeys = Object.keys(ACTIVITIES).filter(k => ACTIVITIES[k].cat === state.modalCategory);
            if (!validKeys.includes(state.modalActivity)) {
                state.modalActivity = validKeys[0];
            }
            document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActivityList();
        });
    });
    
    // Stepper de duración
    document.getElementById('duration-minus').addEventListener('click', () => {
        state.modalDuration = Math.max(5, state.modalDuration - 5);
        document.getElementById('duration-value').textContent = state.modalDuration;
    });
    document.getElementById('duration-plus').addEventListener('click', () => {
        state.modalDuration = Math.min(300, state.modalDuration + 5);
        document.getElementById('duration-value').textContent = state.modalDuration;
    });
    
    // Exportar / importar
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', e => {
        if (e.target.files[0]) importData(e.target.files[0]);
    });
    
    // Render inicial
    state.selectedDate = new Date();
    renderCalendar();
    renderDayDetail();
    renderStats();
}

document.addEventListener('DOMContentLoaded', init);
