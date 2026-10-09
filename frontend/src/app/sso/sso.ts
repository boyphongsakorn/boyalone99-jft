import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface SsoUser {
  username: string;
  avatar?: string;
  avatarUrl?: string;
  id: string;
  email?: string;
  provider?: string;
  twitch_username?: string;
}

@Component({
  selector: 'app-sso',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  template: `
    <main class="sso-page">
      <div class="ambient ambient-left" aria-hidden="true"></div>
      <div class="ambient ambient-right" aria-hidden="true"></div>

      <section class="sso-panel" aria-labelledby="sso-title">
        @if (loading()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>กำลังยืนยันตัวตน SSO...</p>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <span class="error-icon">✕</span>
            <h2>SSO ไม่สำเร็จ</h2>
            <p>{{ error() }}</p>
          </div>
        } @else if (user()) {
          <div class="welcome-state">
            <div class="user-avatar">
              <img [src]="userAvatar()" alt="{{ user()?.username }}">
            </div>
            <h1 id="sso-title">ยินดีต้อนรับ, {{ user()?.username }}!</h1>
            <p>SSO สำหรับ <b>{{ appName() }}</b> สำเร็จ<br><small>กำลังส่งกลับ...</small></p>
            <div class="spinner small"></div>
          </div>
        } @else if (siteBlocked()) {
          <div class="error-state">
            <span class="error-icon">⛔</span>
            <h2>Site not authorized</h2>
            <p>This site is not allowed to use Alone Coin SSO. Contact the admin to approve your redirect_uri.</p>
          </div>
        } @else {
          <div class="start-state">
            <div class="brand-lockup">
              <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="brand-name">BoyAlone99<small>SSO Login</small></span>
            </div>
            <h1 id="sso-title">เข้าสู่ระบบสำหรับ<br><em>{{ appName() }}</em></h1>
            <p class="intro-copy">เลือกบัญชีเพื่อเข้าสู่ระบบ {{ appName() }}</p>
            <div class="provider-list" aria-label="Sign in options">
              <button class="provider-button discord" type="button" (click)="handleLogin('Discord')">
                <span class="provider-icon" aria-hidden="true">D</span>
                <span>เข้าสู่ระบบด้วย Discord</span>
                <span class="arrow" aria-hidden="true">&#8594;</span>
              </button>
              <button class="provider-button twitch" type="button" (click)="handleLogin('Twitch')">
                <span class="provider-icon" aria-hidden="true">T</span>
                <span>เข้าสู่ระบบด้วย Twitch</span>
                <span class="arrow" aria-hidden="true">&#8594;</span>
              </button>
              <button class="provider-button youtube" type="button" (click)="handleLogin('YouTube')">
                <span class="provider-icon" aria-hidden="true">&#9654;</span>
                <span>เข้าสู่ระบบด้วย YouTube</span>
                <span class="arrow" aria-hidden="true">&#8594;</span>
              </button>
            </div>
            <p class="terms">By continuing, you agree to our <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>
          </div>
        }
      </section>
    </main>
  `,
  styles: [`
    .sso-page {
      background: #f8f5ec; color: #252525; font-family: 'Playpen Sans Thai', cursive;
      min-height: 100dvh; display: grid; place-items: center; position: relative; overflow: hidden; padding: 24px;
    }
    .ambient { border: 2px solid rgba(30, 39, 48, .1); border-radius: 50%; height: 44vw; position: absolute; width: 44vw; }
    .ambient-left { left: -20vw; top: 10%; } .ambient-right { right: -20vw; bottom: -10%; }
    .sso-panel {
      background: rgba(255,255,255,0.5); border: 2px solid #252525;
      border-radius: 12px; padding: 40px; text-align: center; z-index: 1;
      box-shadow: 8px 8px 0 #252525; max-width: 420px; width: 100%;
    }
    .loading-state, .welcome-state, .start-state { display: flex; flex-direction: column; align-items: center; gap: 16px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e0b44f; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
    .spinner.small { width: 24px; height: 24px; border-width: 3px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-state { color: #c05d46; }
    .error-icon { font-size: 3rem; display: block; margin-bottom: 10px; }
    .user-avatar img { width: 100px; height: 100px; border-radius: 50%; border: 4px solid #252525; background: white; }
    .welcome-state h1, .start-state h1 { font-size: 1.8rem; margin: 0; }
    .welcome-state h1 em, .start-state h1 em { color: #c05d46; font-style: normal; }
    .brand-lockup { display: flex; align-items: center; gap: 10px; font-weight: 700; }
    .brand-name small { color: #5d8278; display: block; font-size: .65rem; letter-spacing: .12em; }
    .brand-mark { display: flex; gap: 3px; height: 23px; transform: skew(-18deg); width: 26px; }
    .brand-mark i { background: #e16b50; display: block; width: 6px; }
    .brand-mark i:nth-child(2) { background: #e0b44f; height: 78%; margin-top: auto; }
    .brand-mark i:nth-child(3) { background: #5d8278; height: 54%; margin-top: auto; }
    .intro-copy { color: #77746d; font-size: .9rem; margin: 0; }
    .provider-list { display: grid; gap: 12px; width: 100%; margin-top: 8px; }
    .provider-button {
      display: flex; align-items: center; gap: 12px; width: 100%;
      background: #fff; border: 2px solid #252525; border-radius: 8px;
      box-shadow: 3px 3px 0 #252525; padding: 12px 16px; cursor: pointer;
      font-family: inherit; font-size: .95rem; font-weight: 700; color: #252525;
      transition: transform .1s;
    }
    .provider-button:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #252525; }
    .provider-icon {
      width: 32px; height: 32px; display: grid; place-items: center;
      border-radius: 6px; background: #252525; color: #f8f5ec; font-weight: 700;
    }
    .provider-button.discord .provider-icon { background: #5865F2; }
    .provider-button.twitch .provider-icon { background: #9146FF; }
    .provider-button.youtube .provider-icon { background: #FF0000; }
    .provider-button .arrow { margin-left: auto; }
    .terms { font-size: .75rem; color: #77746d; }
    .terms a { color: #252525; }
  `],
})
export class Sso implements OnInit {
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected user = signal<SsoUser | null>(null);
  protected userAvatar = signal('');
  protected siteBlocked = signal(false);
  protected appName = signal('External App');
  private redirectUri: string | null = null;
  private state: string | null = null;

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router) {}

  async ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.redirectUri = params.get('redirect_uri');
    this.state = params.get('state');
    const app = params.get('app') || params.get('client') || 'External App';
    this.appName.set(app);

    // Allowlist guard: verify redirect_uri against sso_clients (admin-approved)
    if (this.redirectUri) {
      try {
        await this.http.get(`${environment.apiUrl}/sso/verify?redirect_uri=${encodeURIComponent(this.redirectUri)}`).toPromise();
      } catch {
        this.siteBlocked.set(true);
        return;
      }
    }

    const code = params.get('code');
    // If backend redirected here with ?code= after OAuth, exchange it
    if (code) {
      await this.exchangeCode(code);
    }
    // Otherwise show provider buttons (user picks login)
  }

  protected handleLogin(provider: string): void {
    if (typeof window === 'undefined') return;
    if (this.siteBlocked()) return;
    // Carry SSO context inside OAuth state so /login/callback can hand back to /sso
    const ssoCtx = {
      sso: true,
      provider: provider.toLowerCase(),
      redirect_uri: this.redirectUri,
      ssoState: this.state,
      app: this.appName(),
    };
    const state = btoa(JSON.stringify(ssoCtx));
    // Reuse the same OAuth entry points as the main Login page
    const root = window.location.origin;
    const redirectUri = `${root}/login/callback`;
    const providerSettings = {
      discord: {
        clientId: environment.discordClientId,
        endpoint: 'https://discord.com/api/oauth2/authorize',
        scope: 'identify guilds',
      },
      twitch: {
        clientId: environment.twitchClientId,
        endpoint: 'https://id.twitch.tv/oauth2/authorize',
        scope: 'user:read:email',
      },
      youtube: {
        clientId: environment.youtubeClientId,
        endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        scope: 'openid email profile https://www.googleapis.com/auth/youtube.readonly',
      },
    } as const;
    const key = provider.toLowerCase() as keyof typeof providerSettings;
    const settings = providerSettings[key];
    if (!settings || (settings.clientId || '').startsWith('YOUR_')) return;
    const qp = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: settings.scope,
      state,
    });
    window.location.href = `${settings.endpoint}?${qp.toString()}`;
  }

  private async exchangeCode(code: string): Promise<void> {
    this.loading.set(true);
    try {
      // Exchange via backend google/discord/twitch endpoints based on stored provider
      // The /login/callback flow already handles this and redirects to /sso?code=...
      // Here we fetch the profile directly: try google, then discord
      let profile: any = null;
      const provider = (this.route.snapshot.queryParamMap.get('provider') || '').toLowerCase();
      if (provider === 'google' || provider === 'youtube') {
        profile = await this.http.get(`${environment.apiUrl}/auth/google/callback?code=${encodeURIComponent(code)}`).toPromise();
        profile = { ...(profile as object), provider: 'google' };
      } else if (provider === 'twitch') {
        const redirectUri = `${window.location.origin}/login/callback`;
        profile = await this.http.get(
          `${environment.apiUrl}/auth/twitch/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`
        ).toPromise();
      } else {
        profile = await this.http.get(`${environment.apiUrl}/auth/discord/callback?code=${encodeURIComponent(code)}`).toPromise();
        profile = { ...(profile as object), provider: 'discord' };
      }
      const u = profile as SsoUser;
      this.user.set(u);
      this.userAvatar.set(
        (u as any).avatarUrl || u.avatar?.startsWith('http') ? (u as any).avatarUrl || (u.avatar as string) :
        u.id && u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` :
        'https://cdn.discordapp.com/embed/avatars/0.png'
      );
      if (typeof window !== 'undefined' && (profile as any)?.accessToken) {
        try { localStorage.setItem('google_access_token', String((profile as any).accessToken)); } catch { /* ignore */ }
      }
      try { localStorage.setItem('user_profile', JSON.stringify({ ...u, provider: (u.provider || provider || 'sso') })); } catch { /* ignore */ }
      // Hand back to the external site: redirect_uri + ?token payload + state
      this.returnToClient(u);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'SSO exchange failed — code may have expired');
    } finally {
      this.loading.set(false);
    }
  }

  private returnToClient(u: SsoUser): void {
    if (typeof window === 'undefined') return;
    if (!this.redirectUri) return; // no external client — stay on success screen
    if (this.siteBlocked()) return; // unapproved site — never redirect profile out
    try {
      const payload = btoa(JSON.stringify({
        id: u.id,
        username: u.username,
        email: (u as any).email || null,
        avatar: (u as any).avatar || null,
        avatarUrl: (u as any).avatarUrl || null,
        provider: u.provider || null,
      }));
      const sep = this.redirectUri.includes('?') ? '&' : '?';
      let url = `${this.redirectUri}${sep}profile=${encodeURIComponent(payload)}`;
      if (this.state) url += `&state=${encodeURIComponent(this.state)}`;
      // Small delay so user sees success state
      setTimeout(() => { window.location.href = url; }, 1200);
    } catch { /* stay on page */ }
  }
}
