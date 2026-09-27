import { Component, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface Reward {
  readonly title: string;
  readonly description: string;
  readonly cost: number;
  readonly accent: string;
  readonly icon: string;
  readonly stock: number;
}

@Component({
  imports: [DecimalPipe, RouterLink],
  selector: 'app-rewards',
  styleUrl: './rewards.css',
  templateUrl: './rewards.html',
})
export class Rewards implements OnInit {
  protected readonly isLoggedIn = signal(false);
  protected readonly balance = signal(0);
  protected readonly notice = signal<string | null>(null);
  protected readonly rewards = signal<readonly Reward[]>([]);
  protected readonly loading = signal(true);
  protected readonly claimEnabled = signal(false);

  constructor(private http: HttpClient, private router: Router) {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('user_profile');
      if (user) {
        this.isLoggedIn.set(true);
      }
    }
  }

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    this.loading.set(true);
    // Cache-bust so F5/refresh never serves a stale prerendered response
    const bust = `t=${Date.now()}`;
    // Fetch independently — one failing should not block the other (SSR/refresh safe)
    try {
      const data = await this.http.get<Reward[]>(`${environment.apiUrl}/rewards?${bust}`).toPromise();
      if (data) {
        this.rewards.set(data);
      }
    } catch (e) {
      console.error('Failed to fetch rewards', e);
      this.notice.set('โหลดของรางวัลไม่สำเร็จ ลองรีเฟรชอีกครั้ง');
    }
    try {
      const settings = await this.http.get<{ claim_enabled: boolean }>(`${environment.apiUrl}/settings?${bust}`).toPromise();
      this.claimEnabled.set(settings?.claim_enabled === true);
    } catch (e) {
      console.error('Failed to fetch settings', e);
      this.claimEnabled.set(false);
    } finally {
      this.loading.set(false);
    }

    if (this.isLoggedIn()) {
      await this.fetchBalance();
    }
  }

  async fetchBalance() {
    if (typeof window === 'undefined') return;
    const user = localStorage.getItem('user_profile');
    if (!user) return;

    try {
      const parsed = JSON.parse(user);
      const response: any = await this.http.get(`${environment.apiUrl}/balance/${parsed.id}`).toPromise();
      if (response && typeof response.balance === 'number') {
        this.balance.set(response.balance);
      }
    } catch (e) {
      console.error('Failed to fetch balance', e);
    }
  }

  protected canRedeem(cost: number): boolean {
    return this.claimEnabled() && this.isLoggedIn() && this.balance() >= cost;
  }

  protected redeem(reward: Reward): void {
    if (!this.claimEnabled()) {
      this.notice.set('ตอนนี้ปิดระบบแลกของรางวัลชั่วคราว');
      return;
    }
    if (!this.isLoggedIn()) {
      return;
    }

    if (!this.canRedeem(reward.cost)) {
      this.notice.set('Alone Coin ยังไม่พอสำหรับรางวัลนี้');
      return;
    }

    this.balance.update((current) => current - reward.cost);
    this.notice.set(`แลกรางวัล ${reward.title} สำเร็จแล้ว`);
  }

  protected logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_profile');
    }
    this.isLoggedIn.set(false);
    this.router.navigateByUrl('/login');
  }
}
