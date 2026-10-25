import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

const OFFLINE_MESSAGE = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — กรุณาลองใหม่อีกครั้งภายหลัง';
const THROTTLE_MS = 8000;

let lastShown = 0;

/**
 * Shows a sticky page-level banner when the API is unreachable
 * (network drop, DNS fail, backend down, CORS, 502/503/504).
 * Real API errors (4xx with a body) stay handled by each page as before.
 */
export const apiOfflineInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: unknown) => {
      if (typeof document !== 'undefined' && isConnectionFailure(err)) {
        showOfflineBanner();
      }
      return throwError(() => err);
    })
  );
};

function isConnectionFailure(err: unknown): boolean {
  if (err instanceof HttpErrorResponse) {
    // status 0 = network error / CORS / server unreachable (Angular reports 0 for these)
    if (err.status === 0) return true;
    if (err.status === 502 || err.status === 503 || err.status === 504) return true;
    return false;
  }
  // fetch() can surface a bare TypeError ("Failed to fetch") instead of HttpErrorResponse
  if (err instanceof Error) {
    const msg = (err.message || '').toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed');
  }
  return false;
}

function showOfflineBanner(): void {
  const now = Date.now();
  if (now - lastShown < THROTTLE_MS) return;
  lastShown = now;

  const id = 'api-offline-banner';
  if (document.getElementById(id)) return;

  const bar = document.createElement('div');
  bar.id = id;
  bar.setAttribute('role', 'alert');
  bar.textContent = OFFLINE_MESSAGE;
  bar.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:24px',
    'transform:translateX(-50%)',
    'z-index:9999',
    'background:#c05d46',
    'color:#fff6d9',
    'border:2px solid #252525',
    'border-radius:8px',
    'box-shadow:4px 4px 0 #252525',
    'padding:10px 16px',
    'font:700 .85rem "Playpen Sans Thai", cursive',
    'max-width:90vw',
    'text-align:center',
    'cursor:pointer',
  ].join(';');
  bar.title = 'Click to dismiss';
  bar.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);

  setTimeout(() => bar.remove(), 10000);
}
