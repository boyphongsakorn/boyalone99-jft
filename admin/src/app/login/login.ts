import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  imports: [RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  protected handleLogin(provider: string): void {
    const root = window.location.origin;
    const redirectUri = `${root}/login/callback`;
    const providerSettings = {
      Discord: {
        clientId: environment.discordClientId,
        endpoint: 'https://discord.com/api/oauth2/authorize',
        scope: 'identify guilds',
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
    const settings = providerSettings[provider as keyof typeof providerSettings];

    if (!settings || settings.clientId.startsWith('YOUR_')) {
      return;
    }

    const params = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: settings.scope,
    });
    window.location.href = `${settings.endpoint}?${params.toString()}`;
  }
}
