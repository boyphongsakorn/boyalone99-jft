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
  protected email = signal('user@example.com');
  protected epicUsername = signal('EpicPlayer123');
  protected userAvatar = signal('https://cdn.discordapp.com/embed/avatars/0.png');
  protected isEditing = signal(false);
  protected saveStatus = signal<'idle' | 'saving' | 'saved'>('idle');
  protected linkedDiscord = signal<string | null>(null);
  protected linkedTwitch = signal<string | null>(null);
  protected linkedYoutube = signal<string | null>(null);

  constructor(private http: HttpClient, private router: Router) {}

  async ngOnInit() {
    if (typeof window === 'undefined') return;

    // Try to load profile from local session first
    const savedUser = localStorage.getItem('user_profile');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        this.email.set(parsed.email || 'user@example.com');
        this.epicUsername.set(parsed.username || 'EpicPlayer123');
        if (parsed.avatar) {
          this.userAvatar.set(`https://cdn.discordapp.com/avatars/${parsed.id}/${parsed.avatar}.png`);
        }
        if (parsed.provider === 'discord' || parsed.id) {
          this.linkedDiscord.set(parsed.username || 'Linked');
        }
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

  protected saveProfile(): void {
    this.saveStatus.set('saving');
    // Mock API call
    setTimeout(() => {
      this.saveStatus.set('saved');
      this.isEditing.set(false);
      setTimeout(() => this.saveStatus.set('idle'), 3000);
    }, 1000);
  }

  protected logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_profile');
    }
    this.router.navigateByUrl('/');
  }
}
