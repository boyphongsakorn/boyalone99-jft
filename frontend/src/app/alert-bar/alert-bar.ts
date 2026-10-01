import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-alert-bar',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="alert-bar" role="status">
        <span aria-hidden="true">✦</span>
        <p>{{ message() }}</p>
        <button type="button" (click)="dismiss()" aria-label="Dismiss announcement">✕</button>
      </div>
    }
  `,
  styles: [`
    .alert-bar { align-items: center; background: #252525; color: #fff6d9; display: flex; font-family: 'Playpen Sans Thai', 'Segoe Print', cursive; font-size: .78rem; gap: 10px; justify-content: center; padding: 8px 14px; position: relative; z-index: 50; }
    .alert-bar p { margin: 0; }
    .alert-bar button { background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; opacity: .7; }
    .alert-bar button:hover { opacity: 1; }
  `],
})
export class AlertBar implements OnInit {
  protected readonly visible = signal(false);
  protected readonly message = signal('');

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    try {
      const s = await this.http.get<{ alert_enabled: boolean; alert_message: string }>(`${environment.apiUrl}/settings?t=${Date.now()}`).toPromise();
      if (s?.alert_enabled && s.alert_message) {
        // Only auto-show if this exact message hasn't been dismissed yet.
        // A changed message or a re-enabled alert gets a fresh key, so it shows again.
        const key = `alert_dismissed:${s.alert_message}`;
        if (!sessionStorage.getItem(key)) {
          this.message.set(s.alert_message);
          this.visible.set(true);
        }
      }
    } catch { /* no alert */ }
  }

  protected dismiss(): void {
    this.visible.set(false);
    // Remember the dismissed message text — new/changed messages use a new key and show again
    try { sessionStorage.setItem(`alert_dismissed:${this.message()}`, '1'); } catch { /* ignore */ }
  }
}
