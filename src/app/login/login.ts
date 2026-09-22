import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

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
    let authUrl = '';

    switch (provider) {
      case 'Discord':
        authUrl = `https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds`;
        break;
      case 'Twitch':
        authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=CLIENT_ID&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=user:read:email`;
        break;
      case 'YouTube':
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile`;
        break;
    }

    if (authUrl) {
      window.location.href = authUrl;
    }
  }
}
