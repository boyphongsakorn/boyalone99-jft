import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink, HttpClientModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  protected email = signal('');
  protected epicUsername = signal('');
  protected warframeIgn = signal('');
  protected userAvatar = signal('https://cdn.discordapp.com/embed/avatars/0.png');
  protected isEditing = signal(false);
  protected saveStatus = signal<'idle' | 'saving' | 'saved'>('idle');
  protected linkedDiscord = signal<string | null>(null);
  protected linkedTwitch = signal<string | null>(null);
  protected linkedYoutube = signal<string | null>(null);

  constructor(private http: HttpClient, private router: Router) {}

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('user_profile')) {
      this.router.navigateByUrl('/login');
      return;
    }

    // Try to load profile from local session first
    const savedUser = localStorage.getItem('user_profile');
    let userId: string | null = null;
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        userId = parsed.id || null;
        this.email.set(parsed.email || '');
        if (parsed.avatarUrl) {
          this.userAvatar.set(parsed.avatarUrl);
        } else if (parsed.avatar) {
          this.userAvatar.set(`https://cdn.discordapp.com/avatars/${parsed.id}/${parsed.avatar}.png`);
        }
        if (parsed.provider === 'discord') {
          this.linkedDiscord.set(parsed.username || 'Linked');
        } else if (parsed.provider === 'twitch') {
          this.linkedTwitch.set(parsed.twitch_username || parsed.username || 'Linked');
        } else if (parsed.provider === 'youtube') {
          this.linkedYoutube.set(parsed.username || 'Linked');
        }
        if (parsed.linkedDiscord) this.linkedDiscord.set(parsed.linkedDiscord);
        if (parsed.linkedTwitch) this.linkedTwitch.set(parsed.linkedTwitch);
        if (parsed.linkedYoutube) this.linkedYoutube.set(parsed.linkedYoutube);
        // Check separate linked socials
        const twitch = localStorage.getItem('linked_twitch');
        if (twitch) this.linkedTwitch.set(twitch);
        const youtube = localStorage.getItem('linked_youtube');
        if (youtube) this.linkedYoutube.set(youtube);
      } catch (e) {
        console.error('Failed to parse saved profile', e);
      }
    }
    // Then load real data from database
    if (userId) {
      try {
        const profile: any = await this.http.get(`${environment.apiUrl}/users/${encodeURIComponent(userId)}`).toPromise();
        if (profile) {
          this.email.set(profile.email || '');
          this.epicUsername.set(profile.epic_username || '');
          this.warframeIgn.set(profile.warframe_ign || '');
          // DB is source of truth for links — show linked even if localStorage missed it
          if (profile.twitch_id || profile.twitch_username) {
            this.linkedTwitch.set(profile.twitch_username || 'Linked');
            try { localStorage.setItem('linked_twitch', profile.twitch_username || 'Linked'); } catch { /* ignore */ }
          }
        }
      } catch (e) {
        console.error('Failed to fetch profile from database', e);
      }
    }
  }

  protected linkSocial(provider: 'Discord' | 'Twitch' | 'YouTube'): void {
    if (typeof window === 'undefined') return;
    const root = window.location.origin;
    // Link flow via state (redirect_uri stays static for Twitch)
    const saved = localStorage.getItem('user_profile');
    const mainId = saved ? (JSON.parse(saved).id || '') : '';
    const redirectUri = `${root}/login/callback`;
    const state = btoa(JSON.stringify({ provider: provider.toLowerCase(), link: true, linkUserId: mainId }));
    const providerSettings = {
      Discord: {
        clientId: environment.discordClientId,
        endpoint: 'https://discord.com/api/oauth2/authorize',
        scope: 'identify email',
      },
      Twitch: {
        clientId: environment.twitchClientId,
        endpoint: 'https://id.twitch.tv/oauth2/authorize',
        scope: 'user:read:email',
      },
      YouTube: {
        clientId: environment.youtubeClientId,
        endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        scope: 'openid email profile',
      },
    } as const;
    const settings = providerSettings[provider];
    if (!settings || settings.clientId.startsWith('YOUR_')) {
      return;
    }
    const params = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: settings.scope,
      state,
    });
    window.location.href = `${settings.endpoint}?${params.toString()}`;
  }

  protected async unlinkSocial(provider: 'twitch' | 'youtube'): Promise<void> {
    if (typeof window === 'undefined') return;
    if (provider === 'twitch') {
      const saved = localStorage.getItem('user_profile');
      const userId = saved ? (JSON.parse(saved).id || '') : '';
      try {
        if (userId) {
          await this.http.delete(`${environment.apiUrl}/auth/twitch/link?userId=${encodeURIComponent(userId)}`).toPromise();
        }
      } catch (e) {
        console.error('Failed to unlink Twitch', e);
      }
      localStorage.removeItem('linked_twitch');
      this.linkedTwitch.set(null);
    } else {
      localStorage.removeItem('linked_youtube');
      this.linkedYoutube.set(null);
    }
  }

  protected toggleEdit(): void {
    if (this.isEditing()) {
      this.saveProfile();
    } else {
      this.isEditing.set(true);
    }
  }

  protected async saveProfile(): Promise<void> {
    this.saveStatus.set('saving');
    try {
      const saved = localStorage.getItem('user_profile');
      const userId = saved ? (JSON.parse(saved).id || '') : '';
      if (!userId) throw new Error('Not logged in');
      const updated: any = await this.http.put(`${environment.apiUrl}/users/${encodeURIComponent(userId)}`, {
        email: this.email(),
        epic_username: this.epicUsername(),
        warframe_ign: this.warframeIgn(),
      }).toPromise();
      if (updated) {
        this.email.set(updated.email || '');
        this.epicUsername.set(updated.epic_username || '');
        this.warframeIgn.set(updated.warframe_ign || '');
      }
      this.saveStatus.set('saved');
      this.isEditing.set(false);
      setTimeout(() => this.saveStatus.set('idle'), 3000);
    } catch (e) {
      console.error('Failed to save profile', e);
      this.saveStatus.set('idle');
    }
  }

  protected logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_profile');
    }
    this.router.navigateByUrl('/');
  }
}
