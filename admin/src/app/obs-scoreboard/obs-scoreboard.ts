import { Component, OnInit, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface BoardUser {
  username: string;
  alone_coin: number;
}

@Component({
  selector: 'app-obs-scoreboard',
  imports: [DecimalPipe],
  templateUrl: './obs-scoreboard.html',
  styleUrl: './obs-scoreboard.css',
})
export class ObsScoreboard implements OnInit {
  protected readonly users = signal<readonly BoardUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.load();
    setInterval(() => this.load(), 30000);
  }

  private async load() {
    try {
      const data = await this.http
        .get<BoardUser[]>(`${environment.apiUrl}/leaderboard`)
        .toPromise();
      if (data) {
        const sorted = [...data].sort((a, b) => b.alone_coin - a.alone_coin);
        this.users.set(sorted);
        this.error.set(null);
      }
    } catch {
      this.error.set('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      this.loading.set(false);
    }
  }
}
