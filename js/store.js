// Обирає, де живуть дані: на сервері (якщо в config.js вказано Supabase) або лише на цьому пристрої.
import { CONFIG } from './config.js';

export const api = CONFIG.SUPABASE_URL
  ? (await import('./remote.js')).remoteApi
  : (await import('./local.js')).localApi;
