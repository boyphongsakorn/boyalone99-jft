import { Component, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface Reward {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly cost: number;
  readonly accent: string;
  readonly icon: string;
  readonly stock: number;
  readonly enabled?: number | boolean;
  readonly contact_type?: 'email' | 'epic_id' | null;
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
  protected readonly profileEmail = signal<string | null>(null);
  protected readonly profileEpic = signal<string | null>(null);

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
        this.rewards.set(data.filter((r: any) => r.enabled === undefined || r.enabled === 1 || r.enabled === true));
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
      await this.fetchProfileContact();
    }
  }

  async fetchProfileContact() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('user_profile');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.id) return;
      const profile: any = await this.http.get(`${environment.apiUrl}/users/${encodeURIComponent(parsed.id)}`).toPromise();
      this.profileEmail.set(profile?.email || null);
      this.profileEpic.set(profile?.epic_username || null);
    } catch (e) {
      console.error('Failed to fetch profile contact', e);
    }
  }

  protected needsEmail(reward: Reward): boolean {
    return reward.contact_type === 'email';
  }

  protected needsEpic(reward: Reward): boolean {
    return reward.contact_type === 'epic_id';
  }

  protected missingEmail(reward: Reward): boolean {
    return this.needsEmail(reward) && this.isLoggedIn() && !this.profileEmail();
  }

  protected missingEpic(reward: Reward): boolean {
    return this.needsEpic(reward) && this.isLoggedIn() && !this.profileEpic();
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

  protected async redeem(reward: Reward): Promise<void> {
    if (reward.enabled === 0 || reward.enabled === false) {
      this.notice.set('รางวัลนี้ปิดให้แลกชั่วคราว');
      return;
    }
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

    if (reward.contact_type) {
      const raw = localStorage.getItem('user_profile') || '{}';
      let user: any = {};
      try { user = JSON.parse(raw); } catch { user = {}; }
      // Always verify against DB (localStorage email is stale / OAuth-cached)
      try {
        const profile: any = await this.http.get(`${environment.apiUrl}/users/${encodeURIComponent(user.id)}`).toPromise();
        this.profileEmail.set(profile?.email || null);
        this.profileEpic.set(profile?.epic_username || null);
        if (reward.contact_type === 'email' && !profile?.email) {
          this.notice.set('⚠ รางวัลนี้ต้องใช้ Email — กรุณาเพิ่ม Email ในหน้า My Profile ก่อนแลก');
          return;
        }
        if (reward.contact_type === 'epic_id' && !profile?.epic_username) {
          this.notice.set('⚠ รางวัลนี้ต้องใช้ Epic Games ID — กรุณาเพิ่ม Epic ID ในหน้า My Profile และแอด BoyAlone99 เป็นเพื่อนใน Epic Games');
          return;
        }
      } catch (e) {
        this.notice.set('ไม่สามารถตรวจสอบข้อมูลโปรไฟล์ได้ ลองใหม่อีกครั้ง');
        return;
      }
    }

    try {
      const user = JSON.parse(localStorage.getItem('user_profile') || '{}');
      const res: any = await this.http.post(`${environment.apiUrl}/redeem`, {
        userId: user.id,
        rewardId: reward.id
      }).toPromise();

      this.balance.set(res.balance);
      // Update local stock so the card shows the new count immediately
      this.rewards.set(this.rewards().map((r) =>
        r.id === reward.id ? { ...r, stock: Math.max(0, r.stock - 1) } : r
      ));
      this.notice.set(`แลกรางวัล ${reward.title} สำเร็จแล้ว! กำลังดำเนินการจัดส่ง`);
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'การแลกรางวัลล้มเหลว');
    }
  }

  protected logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_profile');
    }
    this.isLoggedIn.set(false);
    this.router.navigateByUrl('/login');
  }
}
