// Central API base URL — reads from Vite env variable at build time.
// In development: set VITE_API_BASE_URL in .env.local
// In production:  set VITE_API_BASE_URL in .env.production (points to Worker URL)

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_URL = `${API_BASE_URL}/api`;
