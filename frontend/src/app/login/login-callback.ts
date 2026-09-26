import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, HttpClientModule],
  template: `
    <main class="callback-page">
      <div class="ambient ambient-left" aria-hidden="true"></div>
      <div class="ambient ambient-right" aria-hidden="true"></div>

      <section class="callback-panel">
        @if (loading()) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Verifying your identity...</p>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <span class="error-icon">✕</span>
            <h2>Authentication Failed</h2>
            <p>{{ error() }}</p>
            <a class="back-btn" routerLink="/login">Back to Login</a>
          </div>
        } @else if (user()) {
          <div class="welcome-state">
            <div class="user-avatar">
              <img [src]="userAvatar()" alt="{{ user()?.username }}">
            </div>
            <h1>Welcome, {{ user()?.username }}!</h1>
            <p>You are now connected to the BoyAlone99 Community.</p>
            <a class="home-btn" routerLink="/">Enter Rewards Hub</a>
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
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.error.set('No authorization code received.');
      this.loading.set(false);
      return;
    }

    try {
      // Call the real backend API to exchange the code for a user profile
      const userData = await this.http.get<{ DiscordUser }>(
        `${environment.apiUrl}/auth/discord/callback?code=${code}`
      ).toPromise();
      
      const user = userData as DiscordUser;
      this.user.set(user);
      this.userAvatar.set(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`);
      
      // Save to local session for the profile page
      localStorage.setItem('user_profile', JSON.stringify(user));
    } catch (e) {
      this.error.set('Failed to authenticate with Discord.');
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
