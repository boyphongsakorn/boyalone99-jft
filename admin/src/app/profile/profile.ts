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
      } catch (e) {
        console.error('Failed to parse saved profile', e);
      }
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
