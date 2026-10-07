import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../environments/environment';

interface DiscordUser {
  username: string;
  avatar: string;
  id: string;
  email?: string;
}

@Component({
  selector: 'app-login-callback',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterLink],
  template: `
    <main class="callback-page">
      <div class="ambient ambient-left" aria-hidden="true"></div>
      <div class="ambient ambient-right" aria-hidden="true"></div>

      <section class="callback-panel">
        @if (loading()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>กำลังยืนยันตัวตน...</p>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <span class="error-icon">✕</span>
            <h2>ยืนยันตัวตนไม่สำเร็จ</h2>
            <p>{{ error() }}</p>
            <a class="back-btn" routerLink="/login">กลับไปหน้าเข้าสู่ระบบ</a>
          </div>
        } @else if (user()) {
          <div class="welcome-state">
            <div class="user-avatar">
              <img [src]="userAvatar()" alt="{{ user()?.username }}">
            </div>
            <h1>ยินดีต้อนรับ, {{ user()?.username }}!</h1>
            <p>คุณเชื่อมต่อกับชุมชน BoyAlone99 แล้ว</p>
            <a class="home-btn" routerLink="/">เข้าสู่หน้าของรางวัล</a>
          </div>
        }
      </section>
    </main>
  `,
  styles: [`
    .callback-page { 
      background: #f8f5ec; color: #252525; font-family: 'Playpen Sans Thai', cursive; 
      min-height: 100dvh; display: grid; place-items: center; position: relative; overflow: hidden;
    }
    .ambient { border: 2px solid rgba(30, 39, 48, .1); border-radius: 50%; height: 44vw; position: absolute; width: 44vw; }
    .ambient-left { left: -20vw; top: 10%; } .ambient-right { right: -20vw; bottom: -10%; }
    .callback-panel { 
      background: rgba(255,255,255,0.5); border: 2px solid #252525; 
      border-radius: 12px; padding: 40px; text-align: center; z-index: 1; 
      box-shadow: 8px 8px 0 #252525; max-width: 400px; width: 90%;
    }
    .loading-state { display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e0b44f; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-state { color: #c05d46; }
    .error-icon { font-size: 3rem; display: block; margin-bottom: 10px; }
    .welcome-state { display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .user-avatar img { width: 100px; height: 100px; border-radius: 50%; border: 4px solid #252525; background: white; }
    .welcome-state h1 { font-size: 2rem; margin: 0; }
    .home-btn, .back-btn { 
      background: #252525; color: #f8f5ec; padding: 10px 20px; 
      text-decoration: none; border-radius: 6px; font-weight: 700; 
      display: inline-block; margin-top: 20px; 
    }
    .home-btn:hover { background: #c05d46; }
  `]
})
export class LoginCallback implements OnInit {
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected user = signal<DiscordUser | null>(null);
  protected userAvatar = signal('');

  constructor(private route: ActivatedRoute, private http: HttpClient, private router: Router) {}

  async ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    // Twitch returns context in state (redirect_uri must stay static)
    let provider = (params.get('provider') || 'discord').toLowerCase();
    let isLink = params.get('link') === 'true';
    let linkUserId = params.get('linkUserId') || '';
    const stateRaw = params.get('state');
    if (stateRaw) {
      try {
        const state = JSON.parse(atob(stateRaw));
        if (state.provider) provider = String(state.provider).toLowerCase();
        if (state.link === true) isLink = true;
        if (state.linkUserId) linkUserId = String(state.linkUserId);
      } catch { /* ignore bad state */ }
    }
    if (!code) {
      this.error.set('ไม่พบรหัสยืนยัน');
      this.loading.set(false);
      return;
    }

    try {
      if (provider === 'twitch') {
        // Twitch login or link — redirect_uri must match console exactly
        const redirectUri = `${window.location.origin}/login/callback`;
        const twitchData: any = await this.http.get(
          `${environment.apiUrl}/auth/twitch/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}${isLink && linkUserId ? `&linkUserId=${encodeURIComponent(linkUserId)}` : ''}`
        ).toPromise();
        if (isLink) {
          // Link mode: save twitch name, go back to profile
          if (typeof window !== 'undefined' && twitchData?.twitch_username) {
            localStorage.setItem('linked_twitch', twitchData.twitch_username);
          }
          this.router.navigateByUrl('/profile');
          return;
        }
        // If twitch was already linked to another (discord) account, backend
        // returns that owner — log into it instead of creating twitch:xxx
        const user = twitchData.linked_account
          ? {
              username: twitchData.username,
              avatar: twitchData.avatar,
              avatarUrl: twitchData.avatarUrl,
              id: twitchData.id,
              email: twitchData.email,
              provider: 'discord',
              twitch_username: twitchData.twitch_username,
              linkedTwitch: twitchData.twitch_username,
            } as any
          : {
              username: twitchData.username,
              avatar: twitchData.avatar,
              avatarUrl: twitchData.avatarUrl,
              id: twitchData.id,
              email: twitchData.email,
              provider: 'twitch',
              twitch_username: twitchData.twitch_username,
            } as any;
        this.user.set(user);
        this.userAvatar.set(twitchData.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png');
        localStorage.setItem('user_profile', JSON.stringify(user));
      } else if (provider === 'youtube' || provider === 'google') {
        // Google/YouTube login
        const userData = await this.http.get<DiscordUser>(
          `${environment.apiUrl}/auth/google/callback?code=${code}`
        ).toPromise();

        const user = userData as DiscordUser;
        this.user.set(user);
        this.userAvatar.set(user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png');

        localStorage.setItem('user_profile', JSON.stringify({ ...user, provider: 'google' }));
      } else {
        // Call the real backend API to exchange the code for a user profile
        const userData = await this.http.get<DiscordUser>(
          `${environment.apiUrl}/auth/discord/callback?code=${code}`
        ).toPromise();

        const user = userData as DiscordUser;
        this.user.set(user);
        this.userAvatar.set(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`);

        // Save to local session for the profile page
        localStorage.setItem('user_profile', JSON.stringify({ ...user, provider: 'discord' }));
      }
    } catch (e) {
      this.error.set(`ยืนยันตัวตนด้วย ${provider === 'twitch' ? 'Twitch' : provider === 'google' || provider === 'youtube' ? 'Google' : 'Discord'} ไม่สำเร็จ`);
    } finally {
      this.loading.set(false);
    }
  }

  // Removed the mock fetchDiscordUser method

}

interface DiscordUser {
  username: string;
  avatar: string;
  id: string;
}
