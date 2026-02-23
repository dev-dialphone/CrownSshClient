import { useEffect, useRef } from 'react';

/**
 * Registers the browser for Web Push notifications.
 * Must be called from an Admin component after the user ensures they're authenticated.
 */
export function usePushNotifications() {
    const subscribed = useRef(false);

    useEffect(() => {
        if (subscribed.current || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const setup = async () => {
            try {
                // Fetch VAPID public key from backend
                const keyRes = await fetch('/api/push/vapid-public-key');
                if (!keyRes.ok) return; // Not configured — silently skip

                const { key } = await keyRes.json();

                // Register service worker if not already registered
                const registration = await navigator.serviceWorker.ready;

                // Request notification permission
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;

                // Convert the VAPID key to the format the browser expects
                const applicationServerKey = urlBase64ToUint8Array(key);

                // Subscribe to push notifications
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });

                // Send subscription to the backend
                await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription }),
                });

                subscribed.current = true;
                console.log('[Push] Browser registered for VM health notifications.');
            } catch (err) {
                console.warn('[Push] Push notification setup failed:', err);
            }
        };

        setup();
    }, []);
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; i++) {
        view[i] = rawData.charCodeAt(i);
    }
    return buffer;
}
