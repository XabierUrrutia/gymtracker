// Service Worker de GymTracker
// - Permite que la app funcione offline
// - Gestiona las notificaciones programadas

const CACHE_NAME = 'gymtracker-v3';
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

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names => Promise.all(
            names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});

// ----- Gestión de notificaciones programadas -----
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
    const targetDate = new Date(date);
    targetDate.setHours(8, 0, 0, 0);
    
    const now = Date.now();
    const delay = targetDate.getTime() - now;
    
    if (delay <= 0) return;
    
    if (scheduledNotifications.has(id)) {
        clearTimeout(scheduledNotifications.get(id));
    }
    
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
}

function cancelScheduledNotification(id) {
    if (scheduledNotifications.has(id)) {
        clearTimeout(scheduledNotifications.get(id));
        scheduledNotifications.delete(id);
    }
}

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
