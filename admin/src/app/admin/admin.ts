import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
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
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  protected readonly tab = signal<'rewards' | 'users' | 'history'>('rewards');
  protected readonly rewards = signal<AdminReward[]>([]);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly redemptions = signal<any[]>([]);
  protected readonly coinHistory = signal<any[]>([]);
  protected readonly notice = signal<string | null>(null);
  protected readonly loading = signal(false);

  // reward form
  protected editingId = signal<number | null>(null);
  protected form: AdminReward = this.emptyForm();

  // coin form (per user)
  protected coinAmount: Record<string, number> = {};
  protected coinReason: Record<string, string> = {};

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.refreshAll();
  }

  private emptyForm(): AdminReward {
    return { title: '', description: '', cost: 100, accent: 'peach', icon: '✦', stock: 10 };
  }

  protected setTab(t: 'rewards' | 'users' | 'history') {
    this.tab.set(t);
  }

  async refreshAll() {
    this.loading.set(true);
    try {
      const [rewards, users, redemptions, coins] = await Promise.all([
        this.http.get<AdminReward[]>(`${environment.apiUrl}/rewards`).toPromise(),
        this.http.get<AdminUser[]>(`${environment.apiUrl}/admin/users`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/redemptions`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/coin-history`).toPromise(),
      ]);
      if (rewards) this.rewards.set(rewards);
      if (users) this.users.set(users);
      if (redemptions) this.redemptions.set(redemptions);
      if (coins) this.coinHistory.set(coins);
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
