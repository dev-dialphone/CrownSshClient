/**
 * Service Worker for VM Health Push Notifications
 * This file must be at the root of the public directory to receive push events.
 */

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: 'SSH Manager Alert', body: event.data.text() };
    }

    const options = {
        body: payload.body || 'A VM status change was detected.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `vm-alert-${payload.data?.vmId || 'general'}`,
        renotify: true,
        data: payload.data || {},
    };

    event.waitUntil(
        self.registration.showNotification(payload.title || 'SSH Manager', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
