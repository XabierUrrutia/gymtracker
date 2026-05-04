// ============================================
// GymTracker - PWA con Supabase
// Modo híbrido: funciona offline + sincroniza
// ============================================

// ----- Definición de actividades -----
const ACTIVITIES = {
    pecho:      { name: 'Pecho',           cat: 'gimnasio', icon: '💪', color: '#FF3B30' },
    espalda:    { name: 'Espalda',         cat: 'gimnasio', icon: '🏋️', color: '#007AFF' },
    piernas:    { name: 'Piernas',         cat: 'gimnasio', icon: '🦵', color: '#AF52DE' },
    hombros:    { name: 'Hombros',         cat: 'gimnasio', icon: '🤸', color: '#FF9500' },
    brazos:     { name: 'Brazos',          cat: 'gimnasio', icon: '💪', color: '#FF2D55' },
    core:       { name: 'Core/Abdominales',cat: 'gimnasio', icon: '🧘', color: '#FFCC00' },
    fullbody:   { name: 'Full Body',       cat: 'gimnasio', icon: '🏋️‍♂️', color: '#5856D6' },
    cardio:     { name: 'Cardio',          cat: 'gimnasio', icon: '❤️', color: '#00C7BE' },
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

// ----- Almacenamiento local (offline) -----
const Storage = {
    KEY_WORKOUTS: 'gt_workouts',
    KEY_PLANNED: 'gt_planned',
    KEY_USER: 'gt_user_code',
    KEY_PENDING: 'gt_pending_sync',  // Cambios pendientes de subir
    KEY_LAST_SYNC: 'gt_last_sync',
    
    getUserCode() { return localStorage.getItem(this.KEY_USER) || null; },
    setUserCode(code) { localStorage.setItem(this.KEY_USER, code); },
    clearUserCode() {
        localStorage.removeItem(this.KEY_USER);
        localStorage.removeItem(this.KEY_WORKOUTS);
        localStorage.removeItem(this.KEY_PLANNED);
        localStorage.removeItem(this.KEY_PENDING);
        localStorage.removeItem(this.KEY_LAST_SYNC);
    },
    
    getWorkouts() {
        try { return JSON.parse(localStorage.getItem(this.KEY_WORKOUTS) || '[]'); }
        catch { return []; }
    },
    saveWorkouts(arr) { localStorage.setItem(this.KEY_WORKOUTS, JSON.stringify(arr)); },
    
    getPlanned() {
        try { return JSON.parse(localStorage.getItem(this.KEY_PLANNED) || '[]'); }
        catch { return []; }
    },
    savePlanned(arr) { localStorage.setItem(this.KEY_PLANNED, JSON.stringify(arr)); },
    
    // Cola de operaciones pendientes (para modo offline)
    getPending() {
        try { return JSON.parse(localStorage.getItem(this.KEY_PENDING) || '[]'); }
        catch { return []; }
    },
    addPending(operation) {
        const pending = this.getPending();
        pending.push({ ...operation, queuedAt: Date.now() });
        localStorage.setItem(this.KEY_PENDING, JSON.stringify(pending));
    },
    setPending(arr) { localStorage.setItem(this.KEY_PENDING, JSON.stringify(arr)); },
    
    setLastSync(ts) { localStorage.setItem(this.KEY_LAST_SYNC, String(ts)); },
    getLastSync() { return parseInt(localStorage.getItem(this.KEY_LAST_SYNC) || '0', 10); }
};

// ----- Cliente Supabase (peticiones HTTP simples) -----
const Supa = {
    get url() {
        return SUPABASE_CONFIG.url.replace(/\/$/, '');
    },
    get key() {
        return SUPABASE_CONFIG.anonKey;
    },
    get userCode() {
        return Storage.getUserCode();
    },
    
    headers() {
        return {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'x-user-code': this.userCode || '',
            'Prefer': 'return=representation'
        };
    },
    
    async fetchAll(table) {
        const res = await fetch(`${this.url}/rest/v1/${table}?select=*&order=date.desc`, {
            headers: this.headers()
        });
        if (!res.ok) throw new Error(`Error ${res.status} en GET ${table}`);
        return await res.json();
    },
    
    async insert(table, row) {
        const res = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(row)
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Error ${res.status} en INSERT ${table}: ${text}`);
        }
        return await res.json();
    },
    
    async deleteById(table, id) {
        const res = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
            method: 'DELETE',
            headers: this.headers()
        });
        if (!res.ok) throw new Error(`Error ${res.status} en DELETE ${table}`);
        return true;
    },
    
    // Test de conexión: intenta leer 0 filas para ver si la auth y RLS funcionan
    async testConnection() {
        const res = await fetch(`${this.url}/rest/v1/workouts?select=id&limit=1`, {
            headers: this.headers()
        });
        return res.ok;
    }
};

// ----- Estado global -----
const state = {
    displayedMonth: new Date(),
    selectedDate: null,
    modalMode: null,
    modalDate: null,
    modalCategory: 'gimnasio',
    modalActivity: 'pecho',
    modalDuration: 60,
    online: navigator.onLine
};

// ============================================
// Utilidades
// ============================================
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
    // Formato YYYY-MM-DD para Supabase (tipo DATE)
    const d = startOfDay(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ============================================
// Indicador de sincronización
// ============================================
function setSyncStatus(status, text) {
    const el = document.getElementById('sync-indicator');
    if (!el) return;
    el.className = 'sync-indicator ' + status;
    el.textContent = text;
}

// ============================================
// Mantenimiento (limpieza local de >6 meses)
// ============================================
function runLocalMaintenance() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const workouts = Storage.getWorkouts();
    const filtered = workouts.filter(w => new Date(w.date) >= sixMonthsAgo);
    if (filtered.length !== workouts.length) {
        Storage.saveWorkouts(filtered);
    }
    
    const today = startOfDay(new Date());
    const planned = Storage.getPlanned();
    const futurePlanned = planned.filter(p => new Date(p.date) >= today);
    if (futurePlanned.length !== planned.length) {
        const removed = planned.filter(p => new Date(p.date) < today);
        for (const p of removed) cancelNotification(p.notificationId);
        Storage.savePlanned(futurePlanned);
    }
}

// ============================================
// Notificaciones (igual que antes, vía Service Worker)
// ============================================
async function setupNotifications() {
    if (!('serviceWorker' in navigator)) return;
    
    try {
        await navigator.serviceWorker.register('/sw.js');
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    } catch (err) {
        console.error('Error SW:', err);
    }
}

async function scheduleNotification(planned) {
    if (!('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;
    try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
            type: 'schedule',
            id: planned.notificationId,
            date: planned.date,
            activity: ACTIVITIES[planned.activity]?.name || planned.activity,
            time: planned.hasTime ? planned.time : null
        });
    } catch (err) { console.error(err); }
}

async function cancelNotification(id) {
    if (!('serviceWorker' in navigator) || !id) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'cancel', id });
    } catch {}
}

// ============================================
// SINCRONIZACIÓN con Supabase
// ============================================

/**
 * Sube todas las operaciones pendientes a Supabase.
 * Si algo falla (sin conexión), las deja en la cola para reintentar.
 */
async function processPendingQueue() {
    const pending = Storage.getPending();
    if (pending.length === 0) return { success: true, processed: 0 };
    
    const remaining = [];
    let processed = 0;
    
    for (const op of pending) {
        try {
            if (op.action === 'insert') {
                await Supa.insert(op.table, op.data);
            } else if (op.action === 'delete') {
                await Supa.deleteById(op.table, op.id);
            }
            processed++;
        } catch (err) {
            console.error('Operación pendiente falló:', op, err);
            remaining.push(op);
        }
    }
    
    Storage.setPending(remaining);
    return { success: remaining.length === 0, processed };
}

/**
 * Descarga todos los datos del usuario desde Supabase.
 * Reemplaza el almacenamiento local con lo que hay en la nube.
 */
async function pullFromCloud() {
    const [workoutsRemote, plannedRemote] = await Promise.all([
        Supa.fetchAll('workouts'),
        Supa.fetchAll('planned_activities')
    ]);
    
    // Convertimos del formato Supabase al formato local
    const workouts = workoutsRemote.map(w => ({
        id: w.id,
        date: w.date,
        activity: w.activity,
        duration: w.duration,
        createdAt: w.created_at
    }));
    
    const planned = plannedRemote.map(p => ({
        id: p.id,
        date: p.date,
        activity: p.activity,
        duration: p.duration,
        hasTime: p.has_time,
        time: p.time,
        notificationId: p.notification_id,
        createdAt: p.created_at
    }));
    
    Storage.saveWorkouts(workouts);
    Storage.savePlanned(planned);
    Storage.setLastSync(Date.now());
    
    // Reprogramar notificaciones para las planificaciones traídas
    for (const p of planned) {
        if (new Date(p.date) >= startOfDay(new Date())) {
            scheduleNotification(p);
        }
    }
}

/**
 * Sincronización completa:
 * 1. Sube pendientes
 * 2. Descarga datos de la nube
 */
async function fullSync() {
    if (!state.online) {
        setSyncStatus('offline', '📵 Sin conexión');
        return;
    }
    
    setSyncStatus('syncing', '🔄 Sincronizando...');
    try {
        // 1. Subir cambios locales pendientes
        const pendingResult = await processPendingQueue();
        
        // 2. Descargar todo lo de la nube
        await pullFromCloud();
        
        setSyncStatus('synced', '✓ Sincronizado');
        
        // Re-renderizar
        renderCalendar();
        renderDayDetail();
        renderStats();
    } catch (err) {
        console.error('Error sincronización:', err);
        setSyncStatus('error', '⚠ Error sync');
    }
}

// ============================================
// Operaciones CRUD (con cola offline)
// ============================================
async function addWorkout(workout) {
    // Guardar en local inmediatamente
    const workouts = Storage.getWorkouts();
    workouts.push(workout);
    Storage.saveWorkouts(workouts);
    
    // Preparar para subir
    const remoteData = {
        id: workout.id,
        user_code: Storage.getUserCode(),
        date: workout.date,
        activity: workout.activity,
        duration: workout.duration
    };
    
    if (state.online) {
        try {
            await Supa.insert('workouts', remoteData);
            setSyncStatus('synced', '✓ Sincronizado');
        } catch (err) {
            console.error(err);
            Storage.addPending({ action: 'insert', table: 'workouts', data: remoteData });
            setSyncStatus('error', '⚠ Pendiente');
        }
    } else {
        Storage.addPending({ action: 'insert', table: 'workouts', data: remoteData });
        setSyncStatus('offline', '📵 Pendiente');
    }
}

async function deleteWorkout(id) {
    const workouts = Storage.getWorkouts().filter(w => w.id !== id);
    Storage.saveWorkouts(workouts);
    
    if (state.online) {
        try {
            await Supa.deleteById('workouts', id);
        } catch (err) {
            Storage.addPending({ action: 'delete', table: 'workouts', id });
        }
    } else {
        Storage.addPending({ action: 'delete', table: 'workouts', id });
    }
}

async function addPlanned(planned) {
    const all = Storage.getPlanned();
    all.push(planned);
    Storage.savePlanned(all);
    
    const remoteData = {
        id: planned.id,
        user_code: Storage.getUserCode(),
        date: planned.date,
        activity: planned.activity,
        duration: planned.duration,
        has_time: planned.hasTime,
        time: planned.time || null,
        notification_id: planned.notificationId
    };
    
    if (state.online) {
        try {
            await Supa.insert('planned_activities', remoteData);
            setSyncStatus('synced', '✓ Sincronizado');
        } catch (err) {
            console.error(err);
            Storage.addPending({ action: 'insert', table: 'planned_activities', data: remoteData });
        }
    } else {
        Storage.addPending({ action: 'insert', table: 'planned_activities', data: remoteData });
    }
    
    scheduleNotification(planned);
}

async function deletePlanned(id, notificationId) {
    const all = Storage.getPlanned().filter(p => p.id !== id);
    Storage.savePlanned(all);
    cancelNotification(notificationId);
    
    if (state.online) {
        try { await Supa.deleteById('planned_activities', id); }
        catch { Storage.addPending({ action: 'delete', table: 'planned_activities', id }); }
    } else {
        Storage.addPending({ action: 'delete', table: 'planned_activities', id });
    }
}

async function markPlannedAsDone(id) {
    const planned = Storage.getPlanned();
    const item = planned.find(p => p.id === id);
    if (!item) return;
    
    const workout = {
        id: uuid(),
        date: item.date,
        activity: item.activity,
        duration: item.duration,
        createdAt: new Date().toISOString()
    };
    
    await addWorkout(workout);
    await deletePlanned(item.id, item.notificationId);
    
    renderCalendar();
    renderDayDetail();
    renderStats();
}

// ============================================
// LOGIN
// ============================================
async function tryLogin(code) {
    const cleaned = (code || '').trim().toLowerCase();
    if (cleaned.length < 3) {
        showLoginError('El código debe tener al menos 3 caracteres');
        return;
    }
    if (!/^[a-z0-9_-]+$/.test(cleaned)) {
        showLoginError('Solo letras (sin tildes), números, guiones y guiones bajos');
        return;
    }
    
    Storage.setUserCode(cleaned);
    
    // Probar conexión
    setSyncStatus('syncing', '🔄 Conectando...');
    try {
        const ok = await Supa.testConnection();
        if (!ok) throw new Error('Conexión falló');
        
        // Descargar datos existentes (si los hay)
        await pullFromCloud();
        
        showApp();
        renderAll();
        setSyncStatus('synced', '✓ Sincronizado');
    } catch (err) {
        console.error(err);
        // Aunque falle la conexión, dejamos entrar (modo offline)
        showApp();
        renderAll();
        setSyncStatus('offline', '📵 Sin conexión');
    }
}

function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function showLogin() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-login').classList.add('active');
    document.getElementById('tab-bar').classList.add('hidden');
    document.body.classList.add('no-tabbar');
}

function showApp() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-calendar').classList.add('active');
    document.getElementById('tab-bar').classList.remove('hidden');
    document.body.classList.remove('no-tabbar');
}

function logout() {
    if (!confirm('¿Cerrar sesión? Tus datos seguirán en la nube. Podrás recuperarlos metiendo el mismo código en cualquier dispositivo.')) return;
    Storage.clearUserCode();
    showLogin();
    document.getElementById('user-code-input').value = '';
}

// ============================================
// Renderizado
// ============================================
function renderAll() {
    renderCalendar();
    renderDayDetail();
    renderStats();
}

function renderCalendar() {
    document.getElementById('month-title').textContent = formatMonthYear(state.displayedMonth);
    
    const grid = document.getElementById('days-grid');
    grid.innerHTML = '';
    
    const year = state.displayedMonth.getFullYear();
    const month = state.displayedMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let firstWeekday = firstOfMonth.getDay() - 1;
    if (firstWeekday < 0) firstWeekday = 6;
    
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
        
        const dotsEl = document.createElement('span');
        dotsEl.className = 'day-dots';
        
        const seenW = new Set();
        for (const w of dayWorkouts) {
            if (seenW.has(w.activity)) continue;
            seenW.add(w.activity);
            if (seenW.size > 3) break;
            const dot = document.createElement('span');
            dot.className = 'day-dot';
            dot.style.background = ACTIVITIES[w.activity]?.color || '#888';
            dotsEl.appendChild(dot);
        }
        const seenP = new Set();
        for (const p of dayPlanned) {
            if (seenP.has(p.activity)) continue;
            seenP.add(p.activity);
            if (seenP.size > 2) break;
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
        btnPlan.style.margin = '0';
        btnPlan.addEventListener('click', () => openModal('planned', state.selectedDate));
        actionsEl.appendChild(btnPlan);
    }
    
    const contentEl = document.getElementById('day-content');
    contentEl.innerHTML = '';
    
    const workouts = Storage.getWorkouts().filter(w => isSameDay(w.date, state.selectedDate));
    const planned = Storage.getPlanned().filter(p => isSameDay(p.date, state.selectedDate));
    
    if (workouts.length > 0) {
        const t = document.createElement('p');
        t.className = 'section-title';
        t.textContent = 'Realizados';
        contentEl.appendChild(t);
        for (const w of workouts) contentEl.appendChild(buildActivityRow(w, false));
    }
    
    if (planned.length > 0) {
        const t = document.createElement('p');
        t.className = 'section-title';
        t.textContent = 'Planificados';
        contentEl.appendChild(t);
        for (const p of planned) contentEl.appendChild(buildActivityRow(p, true));
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
    btnDel.addEventListener('click', async () => {
        if (isPlanned) {
            await deletePlanned(item.id, item.notificationId);
        } else {
            await deleteWorkout(item.id);
        }
        renderCalendar();
        renderDayDetail();
        renderStats();
    });
    actions.appendChild(btnDel);
    row.appendChild(actions);
    
    return row;
}

// ============================================
// Modal
// ============================================
function openModal(mode, date) {
    state.modalMode = mode;
    state.modalDate = date;
    state.modalCategory = mode === 'planned' ? 'deporte' : 'gimnasio';
    state.modalActivity = mode === 'planned' ? 'padel' : 'pecho';
    state.modalDuration = 60;
    
    document.getElementById('modal-title').textContent =
        mode === 'workout' ? 'Registrar entrenamiento' : 'Planificar actividad';
    document.getElementById('modal-date-label').textContent = formatDateLong(date);
    document.getElementById('time-section').classList.toggle('hidden', mode !== 'planned');
    document.getElementById('notification-info').classList.toggle('hidden', mode !== 'planned');
    document.getElementById('duration-value').textContent = '60';
    
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

async function saveModal() {
    if (state.modalMode === 'workout') {
        const workout = {
            id: uuid(),
            date: dateToISO(state.modalDate),
            activity: state.modalActivity,
            duration: state.modalDuration,
            createdAt: new Date().toISOString()
        };
        await addWorkout(workout);
    } else {
        const hasTime = document.getElementById('has-time').checked;
        const time = document.getElementById('time-input').value;
        
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
        await addPlanned(newPlan);
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
    
    const streak = computeStreak(workouts);
    document.getElementById('streak-number').textContent = streak;
    document.getElementById('streak-text').textContent =
        streak === 0 ? '¡Empieza tu racha hoy!' :
        streak === 1 ? 'Racha actual' :
        'Racha actual de entrenamientos';
    
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthW = workouts.filter(w => {
        const d = new Date(w.date);
        return d >= startMonth && d < endMonth;
    });
    
    document.getElementById('month-workouts').textContent = monthW.length;
    document.getElementById('month-days').textContent = new Set(monthW.map(w => startOfDay(w.date).getTime())).size;
    document.getElementById('month-time').textContent = formatTime(monthW.reduce((s, w) => s + (w.duration || 0), 0));
    
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
    
    const breakdownEl = document.getElementById('breakdown-list');
    breakdownEl.innerHTML = '';
    const counts = {};
    for (const w of monthW) counts[w.activity] = (counts[w.activity] || 0) + 1;
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
    
    // Estado sincronización
    const userEl = document.getElementById('current-user-code');
    if (userEl) userEl.textContent = Storage.getUserCode() || '';
    
    const statusEl = document.getElementById('sync-status-text');
    if (statusEl) {
        const lastSync = Storage.getLastSync();
        const pending = Storage.getPending().length;
        if (pending > 0) {
            statusEl.textContent = `${pending} cambios pendientes de subir`;
        } else if (lastSync > 0) {
            const date = new Date(lastSync).toLocaleString('es-ES');
            statusEl.textContent = `Última sincronización: ${date}`;
        } else {
            statusEl.textContent = 'Sin sincronizar todavía';
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
    const h = Math.floor(min / 60), m = min % 60;
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
// Backup local (export/import)
// ============================================
function exportData() {
    const data = {
        userCode: Storage.getUserCode(),
        workouts: Storage.getWorkouts(),
        planned: Storage.getPlanned(),
        exportedAt: new Date().toISOString(),
        version: 2
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
            if (!confirm('¿Reemplazar los datos LOCALES con los del archivo? Los datos en la nube no cambian hasta la próxima sincronización.')) return;
            if (Array.isArray(data.workouts)) Storage.saveWorkouts(data.workouts);
            if (Array.isArray(data.planned)) Storage.savePlanned(data.planned);
            renderAll();
            alert('Datos importados localmente');
        } catch { alert('Archivo no válido'); }
    };
    reader.readAsText(file);
}

// ============================================
// Detección online/offline
// ============================================
function setupConnectivityListeners() {
    window.addEventListener('online', () => {
        state.online = true;
        setSyncStatus('syncing', '🔄 Conectado, sincronizando...');
        fullSync();
    });
    window.addEventListener('offline', () => {
        state.online = false;
        setSyncStatus('offline', '📵 Sin conexión');
    });
}

// ============================================
// Inicialización
// ============================================
function init() {
    runLocalMaintenance();
    setupNotifications();
    setupConnectivityListeners();
    
    // Comprobar config
    if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.anonKey === 'PEGA_AQUI_TU_CLAVE_ANON') {
        alert('⚠ Falta configurar Supabase en config.js. Edita el archivo y pega tu clave anon.');
        return;
    }
    
    // Eventos del login
    document.getElementById('btn-login').addEventListener('click', () => {
        const code = document.getElementById('user-code-input').value;
        tryLogin(code);
    });
    document.getElementById('user-code-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            tryLogin(e.target.value);
        }
    });
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#view-calendar, #view-stats').forEach(v => v.classList.remove('active'));
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
            const validKeys = Object.keys(ACTIVITIES).filter(k => ACTIVITIES[k].cat === state.modalCategory);
            if (!validKeys.includes(state.modalActivity)) state.modalActivity = validKeys[0];
            document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderActivityList();
        });
    });
    
    document.getElementById('duration-minus').addEventListener('click', () => {
        state.modalDuration = Math.max(5, state.modalDuration - 5);
        document.getElementById('duration-value').textContent = state.modalDuration;
    });
    document.getElementById('duration-plus').addEventListener('click', () => {
        state.modalDuration = Math.min(300, state.modalDuration + 5);
        document.getElementById('duration-value').textContent = state.modalDuration;
    });
    
    // Sincronización manual
    document.getElementById('btn-force-sync').addEventListener('click', () => {
        fullSync();
    });
    
    // Logout
    document.getElementById('btn-logout').addEventListener('click', logout);
    
    // Export/import
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', e => {
        if (e.target.files[0]) importData(e.target.files[0]);
    });
    
    // Decidir vista inicial
    if (Storage.getUserCode()) {
        // Ya tiene sesión: cargar app y sincronizar
        showApp();
        state.selectedDate = new Date();
        renderAll();
        if (state.online) {
            fullSync();
        } else {
            setSyncStatus('offline', '📵 Sin conexión');
        }
    } else {
        showLogin();
    }
}

document.addEventListener('DOMContentLoaded', init);
