import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../environments/environment';

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

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    try {
      // In a real app, you would send a JWT token to authenticate
      const response: any = await this.http.get(`${environment.apiUrl}/profile`).toPromise();
      if (response) {
        this.email.set(response.email || 'user@example.com');
        this.epicUsername.set(response.username || 'EpicPlayer123');
        this.userAvatar.set(response.avatarUrl);
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
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
}
