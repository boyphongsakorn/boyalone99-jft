import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface AdminReward {
  id?: number;
  title: string;
  description: string;
  cost: number;
  accent: string;
  icon: string;
  stock: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  avatar: string | null;
  alone_coin: number;
  created_at?: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  protected readonly tab = signal<'rewards' | 'users' | 'history' | 'settings'>('rewards');
  protected readonly claimEnabled = signal(true);
  protected readonly alertEnabled = signal(false);
  protected alertMessage = '';
  protected readonly rewards = signal<AdminReward[]>([]);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly redemptions = signal<any[]>([]);
  protected readonly coinHistory = signal<any[]>([]);
  protected readonly notice = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly eventsubStatus = signal<any[] | null>(null);
  protected readonly channelRewards = signal<any[]>([]);
  protected channelTitle = 'แลก Alone Coin';
  protected channelCost = 1000;

  // reward form
  protected editingId = signal<number | null>(null);
  protected form: AdminReward = this.emptyForm();

  // coin form (per user)
  protected coinAmount: Record<string, number> = {};
  protected coinReason: Record<string, string> = {};

  constructor(private http: HttpClient, private router: Router) {}

  async ngOnInit() {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      return;
    }
    await this.refreshAll();
  }

  private emptyForm(): AdminReward {
    return { title: '', description: '', cost: 100, accent: 'peach', icon: '✦', stock: 10 };
  }

  protected setTab(t: 'rewards' | 'users' | 'history' | 'settings') {
    this.tab.set(t);
  }

  protected async toggleClaim(): Promise<void> {
    const next = !this.claimEnabled();
    try {
      await this.http.put(`${environment.apiUrl}/admin/settings/claim_enabled`, { value: next ? '1' : '0' }).toPromise();
      this.claimEnabled.set(next);
      this.notice.set(next ? 'Claim reward enabled' : 'Claim reward disabled');
    } catch (e) {
      console.error(e);
      this.notice.set('Failed to update setting');
    }
  }

  protected async toggleAlert(): Promise<void> {
    const next = !this.alertEnabled();
    try {
      await this.http.put(`${environment.apiUrl}/admin/settings/alert_enabled`, { value: next ? '1' : '0' }).toPromise();
      this.alertEnabled.set(next);
      this.notice.set(next ? 'Alert bar enabled' : 'Alert bar disabled');
    } catch {
      this.notice.set('Failed to update alert');
    }
  }

  protected async saveAlert(): Promise<void> {
    try {
      await this.http.put(`${environment.apiUrl}/admin/settings/alert_message`, { value: this.alertMessage }).toPromise();
      this.notice.set('Announcement saved');
    } catch {
      this.notice.set('Failed to save announcement');
    }
  }

  protected async checkEventsub(): Promise<void> {
    try {
      const res: any = await this.http.get(`${environment.apiUrl}/eventsub/subscriptions`).toPromise();
      this.eventsubStatus.set(res?.data ?? []);
      this.notice.set(`EventSub: ${(res?.data ?? []).length} active subscription(s)`);
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'EventSub check failed');
    }
  }

  protected async subscribeEventsub(): Promise<void> {
    try {
      await this.http.post(`${environment.apiUrl}/eventsub/subscribe`, {}).toPromise();
      this.notice.set('EventSub subscribed — Twitch will push redemptions');
      await this.checkEventsub();
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'EventSub subscribe failed');
    }
  }

  protected async authorizeEventsub(): Promise<void> {
    try {
      const res: any = await this.http.get(`${environment.apiUrl}/eventsub/authorize`).toPromise();
      if (res?.url && typeof window !== 'undefined') window.open(res.url, '_blank');
      this.notice.set('Opened Twitch authorize — login as broadcaster, then click Subscribe');
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Authorize failed');
    }
  }

  protected async loadChannelRewards(): Promise<void> {
    try {
      const res: any = await this.http.get(`${environment.apiUrl}/twitch/channel-rewards`).toPromise();
      this.channelRewards.set(res ?? []);
      this.notice.set(`Found ${(res ?? []).length} Twitch reward(s)`);
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Load Twitch rewards failed');
    }
  }

  protected async createChannelReward(): Promise<void> {
    if (!this.channelTitle.trim() || !(this.channelCost >= 1)) {
      this.notice.set('Enter reward title and cost >= 1');
      return;
    }
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/admin/twitch/channel-rewards`, { title: this.channelTitle.trim(), cost: Math.floor(this.channelCost) }).toPromise();
      this.notice.set(`Created Twitch reward "${res.title}" (${res.id}) — set TWITCH_CHANNEL_REWARD_ID=${res.id} in backend env`);
      await this.loadChannelRewards();
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Create Twitch reward failed');
    }
  }

  protected logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
    }
    this.router.navigateByUrl('/auth');
  }

  async refreshAll() {
    this.loading.set(true);
    try {
      const [rewards, users, redemptions, coins, settings] = await Promise.all([
        this.http.get<AdminReward[]>(`${environment.apiUrl}/rewards`).toPromise(),
        this.http.get<AdminUser[]>(`${environment.apiUrl}/admin/users`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/redemptions`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/coin-history`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/settings`).toPromise(),
      ]);
      if (rewards) this.rewards.set(rewards);
      if (users) this.users.set(users);
      if (redemptions) this.redemptions.set(redemptions);
      if (coins) this.coinHistory.set(coins);
      if (settings) {
        const row: any = (settings as any[]).find((s: any) => s.key === 'claim_enabled');
        this.claimEnabled.set(!row || row.value !== '0');
        const alertRow: any = (settings as any[]).find((s: any) => s.key === 'alert_enabled');
        this.alertEnabled.set(alertRow?.value === '1');
        const msgRow: any = (settings as any[]).find((s: any) => s.key === 'alert_message');
        this.alertMessage = msgRow?.value || '';
      }
    } catch (e) {
      console.error(e);
      this.notice.set('Failed to load admin data. Is backend running?');
    } finally {
      this.loading.set(false);
    }
  }

  protected startCreate() {
    this.editingId.set(null);
    this.form = this.emptyForm();
  }

  protected startEdit(r: AdminReward) {
    this.editingId.set(r.id ?? null);
    this.form = { ...r };
  }

  protected async saveReward() {
    if (!this.form.title || this.form.cost === undefined) {
      this.notice.set('Title and cost are required');
      return;
    }
    try {
      if (this.editingId() === null) {
        const created = await this.http
          .post<AdminReward>(`${environment.apiUrl}/admin/rewards`, this.form)
          .toPromise();
        if (created) this.rewards.update((v) => [...v, created]);
        this.notice.set(`Created "${this.form.title}"`);
      } else {
        const updated = await this.http
          .put<AdminReward>(`${environment.apiUrl}/admin/rewards/${this.editingId()}`, this.form)
          .toPromise();
        if (updated)
          this.rewards.update((v) => v.map((x) => (x.id === updated.id ? updated : x)));
        this.notice.set(`Updated "${this.form.title}"`);
      }
      this.startCreate();
    } catch (e) {
      console.error(e);
      this.notice.set('Save failed');
    }
  }

  protected async deleteReward(id?: number) {
    if (id === undefined) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this reward?')) return;
    try {
      await this.http.delete(`${environment.apiUrl}/admin/rewards/${id}`).toPromise();
      this.rewards.update((v) => v.filter((x) => x.id !== id));
      this.notice.set('Reward deleted');
    } catch (e) {
      console.error(e);
      this.notice.set('Delete failed');
    }
  }

  protected async addCoins(user: AdminUser) {
    const amount = Number(this.coinAmount[user.id] || 0);
    const reason = this.coinReason[user.id] || 'admin grant';
    if (!Number.isInteger(amount) || amount === 0) {
      this.notice.set('Enter a non-zero coin amount');
      return;
    }
    try {
      const res: any = await this.http
        .post(`${environment.apiUrl}/admin/users/${user.id}/coins`, { amount, reason })
        .toPromise();
      this.users.update((v) =>
        v.map((u) => (u.id === user.id ? { ...u, alone_coin: res.balance } : u))
      );
      this.notice.set(`Gave ${amount} AC to ${user.username}`);
      // refresh coin history
      const coins = await this.http
        .get<any[]>(`${environment.apiUrl}/admin/coin-history`)
        .toPromise();
      if (coins) this.coinHistory.set(coins);
    } catch (e) {
      console.error(e);
      this.notice.set('Add coin failed');
    }
  }
}
