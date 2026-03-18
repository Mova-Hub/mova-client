// src/api/echo.ts
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { apiService, API_BASE_URL } from './apiService';

// 1. Tell TypeScript that the global Window object has a Pusher property
declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

// Expose Pusher to the window object (Required by Laravel Echo)
window.Pusher = Pusher;

// 2. Add <any> to Echo to satisfy the generic type requirement
const initEcho = (): Echo<any> | null => {
  const token = apiService.getToken();

  if (!token) return null;

  return new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY || 'my-mova-app-key',
    wsHost: import.meta.env.VITE_REVERB_HOST || 'api.mova-mobility.com',
    wsPort: import.meta.env.VITE_REVERB_PORT || 8080,
    wssPort: import.meta.env.VITE_REVERB_PORT || 443,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    // This tells Echo where to verify that the Admin is allowed to listen
    authEndpoint: `${API_BASE_URL}/broadcasting/auth`, 
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  });
};

export default initEcho;