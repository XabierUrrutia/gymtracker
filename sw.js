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
    const baseDate = new Date(date);
    const now = Date.now();

    // Notificación fija a las 8:00 AM del día
    const target8 = new Date(baseDate);
    target8.setHours(8, 0, 0, 0);
    const delay8 = target8.getTime() - now;
    // Limpiar timers previos (si existían)
    if (scheduledNotifications.has(id)) {
        const prev = scheduledNotifications.get(id);
        for (const t of prev) clearTimeout(t);
    }

    const timeouts = [];

    if (delay8 > 0) {
        const t8 = setTimeout(() => {
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
            // Eliminar este timeout de la lista almacenada
            const arr = scheduledNotifications.get(id) || [];
            const idx = arr.indexOf(t8);
            if (idx !== -1) arr.splice(idx, 1);
            if (arr.length === 0) scheduledNotifications.delete(id);
        }, delay8);
        timeouts.push(t8);
    }

    // Si hay hora concreta del evento, programar recordatorio 1 hora antes
    if (time) {
        const parts = time.split(':');
        const hh = parseInt(parts[0], 10);
        const mm = parseInt(parts[1] || '0', 10);
        const eventDate = new Date(baseDate);
        eventDate.setHours(hh, mm, 0, 0);
        const preEvent = new Date(eventDate.getTime() - 60 * 60 * 1000);
        const delayPre = preEvent.getTime() - now;

        if (delayPre > 0) {
            const tPre = setTimeout(() => {
                const body = `En 1 hora (${time}) tienes ${activity} · prepara las cosas 💪`;
                self.registration.showNotification(`Recordatorio: ${activity} en 1 hora`, {
                    body,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-192.png',
                    tag: id + '-pre',
                    requireInteraction: false
                });

                const arr = scheduledNotifications.get(id) || [];
                const idx = arr.indexOf(tPre);
                if (idx !== -1) arr.splice(idx, 1);
                if (arr.length === 0) scheduledNotifications.delete(id);
            }, delayPre);
            timeouts.push(tPre);
        }
    }

    if (timeouts.length > 0) scheduledNotifications.set(id, timeouts);
}

function cancelScheduledNotification(id) {
    if (scheduledNotifications.has(id)) {
        const arr = scheduledNotifications.get(id);
        for (const t of arr) clearTimeout(t);
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

// Manejo de push entrante (Web Push)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : { title: 'GymTracker', body: 'Tienes un recordatorio' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: data.tag || undefined
        })
    );
});

// Re-suscribir si la suscripción caduca/expira
self.addEventListener('pushsubscriptionchange', event => {
    event.waitUntil(
        (async () => {
            try {
                // Intentar re-suscribir usando las opciones previas
                const options = event.oldSubscription && event.oldSubscription.options ? event.oldSubscription.options : { userVisibleOnly: true };
                const newSub = await self.registration.pushManager.subscribe(options);
                // Informar a la página cliente para que la guarde en el servidor
                const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
                for (const c of clientsList) {
                    c.postMessage({ type: 'new-subscription', subscription: newSub.toJSON() });
                }
            } catch (e) {
                // Silenciar errores de resuscripción
            }
        })()
    );
});
