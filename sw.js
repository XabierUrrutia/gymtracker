// Service Worker de GymTracker
// - Permite que la app funcione offline
// - Gestiona las notificaciones programadas

const CACHE_NAME = 'gymtracker-v2';
const FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/config.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Instalación: cachear archivos para uso offline
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
            .then(() => self.skipWaiting())
    );
});

// Activación: limpiar caches antiguas
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names => Promise.all(
            names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
        )).then(() => self.clients.claim())
    );
});

// Fetch: servir desde cache si está disponible
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});

// ----- Gestión de notificaciones programadas -----
// Las almacenamos en el SW para poder programarlas con setTimeout

const scheduledNotifications = new Map();

self.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;
    
    if (data.type === 'schedule') {
        scheduleNotification(data);
    } else if (data.type === 'cancel') {
        cancelScheduledNotification(data.id);
    }
});

function scheduleNotification({ id, date, activity, time }) {
    // Calcular fecha de disparo: 8:00 AM del día indicado
    const targetDate = new Date(date);
    targetDate.setHours(8, 0, 0, 0);
    
    const now = Date.now();
    const delay = targetDate.getTime() - now;
    
    // Si ya pasó la hora, no programar
    if (delay <= 0) return;
    
    // Cancelar si ya había una programada con ese ID
    if (scheduledNotifications.has(id)) {
        clearTimeout(scheduledNotifications.get(id));
    }
    
    // Programar (límite práctico: setTimeout funciona hasta ~24 días)
    const timeoutId = setTimeout(() => {
        const body = time
            ? `A las ${time}, prepara las cosas 💪`
            : 'No olvides preparar las cosas 💪';
        
        self.registration.showNotification(`Hoy tienes ${activity}`, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: id,
            requireInteraction: false
        });
        scheduledNotifications.delete(id);
    }, delay);
    
    scheduledNotifications.set(id, timeoutId);
    console.log(`Notificación programada para ${targetDate.toLocaleString()}`);
}

function cancelScheduledNotification(id) {
    if (scheduledNotifications.has(id)) {
        clearTimeout(scheduledNotifications.get(id));
        scheduledNotifications.delete(id);
    }
}

// Al hacer click en una notificación, abrir/enfocar la app
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
