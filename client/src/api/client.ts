import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error?.message ?? err.message ?? 'Unknown error';
    return Promise.reject(new Error(message));
  }
);
