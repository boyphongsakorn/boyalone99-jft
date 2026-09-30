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
  enabled: number | boolean;
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
  protected readonly subClaims = signal<any[]>([]);
  protected redemptionUserFilter = '';
  protected coinUserFilter = '';
  protected subUserFilter = '';
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

  // sub tenure seed (per user)
  protected seedMonths: Record<string, number> = {};

  constructor(private http: HttpClient, private router: Router) {}

  async ngOnInit() {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      this.router.navigateByUrl('/auth');
      return;
    }
    await this.refreshAll();
  }

  private emptyForm(): AdminReward {
    return { title: '', description: '', cost: 100, accent: 'peach', icon: '✦', stock: 10, enabled: 1 };
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
      const [rewards, users, redemptions, coins, settings, subs] = await Promise.all([
        this.http.get<AdminReward[]>(`${environment.apiUrl}/rewards`).toPromise(),
        this.http.get<AdminUser[]>(`${environment.apiUrl}/admin/users`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/redemptions`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/coin-history`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/settings`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/sub-claims`).toPromise().catch(() => null),
      ]);
      if (rewards) this.rewards.set(rewards);
      if (users) this.users.set(users);
      if (redemptions) this.redemptions.set(redemptions);
      if (coins) this.coinHistory.set(coins);
      if (subs) this.subClaims.set(subs);
      this.pruneHistoryFilters();
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

  protected async toggleReward(r: AdminReward) {
    if (r.id === undefined) return;
    const next = r.enabled ? 0 : 1;
    const prev = r.enabled;
    this.rewards.update((v) => v.map((x) => (x.id === r.id ? { ...x, enabled: next } : x)));
    try {
      const updated = await this.http
        .put<AdminReward>(`${environment.apiUrl}/admin/rewards/${r.id}`, { ...r, enabled: next })
        .toPromise();
      if (updated) this.rewards.update((v) => v.map((x) => (x.id === updated.id ? updated : x)));
      this.notice.set(next ? `"${r.title}" enabled` : `"${r.title}" disabled`);
    } catch (e) {
      this.rewards.update((v) => v.map((x) => (x.id === r.id ? { ...x, enabled: prev } : x)));
      this.notice.set('Toggle failed');
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

  protected async rollbackCoin(id: number) {
    if (typeof window !== 'undefined' && !window.confirm(`Rollback coin entry #${id}? Balance will be reversed.`)) return;
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/admin/coin-history/${id}/rollback`, {}).toPromise();
      this.notice.set(`Rolled back coin #${id} (${res.reverted} AC). New balance ${res.balance} AC${res.freedClaim ? ` — freed ${res.freedClaim}, user can re-claim` : ''}`);
      await this.refreshHistory();
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Rollback failed');
    }
  }

  protected async loadSubClaims(): Promise<void> {
    try {
      const res: any = await this.http.get(`${environment.apiUrl}/admin/sub-claims`).toPromise();
      this.subClaims.set(res ?? []);
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Load sub claims failed');
    }
  }

  private historyMatch(h: any, userId: string): boolean {
    if (!userId) return true;
    const id = h?.user_id ?? h?.userId;
    if (id === undefined || id === null) return false;
    return String(id) === String(userId);
  }

  protected filteredRedemptions(): any[] {
    return this.redemptions().filter((h) => this.historyMatch(h, this.redemptionUserFilter));
  }

  protected filteredCoinHistory(): any[] {
    return this.coinHistory().filter((h) => this.historyMatch(h, this.coinUserFilter));
  }

  protected filteredSubClaims(): any[] {
    return this.subClaims().filter((h) => this.historyMatch(h, this.subUserFilter));
  }

  private historyUsers(rows: any[]): { id: string; username: string; count: number }[] {
    // Only users that actually appear in this box's history rows.
    const nameById = new Map<string, string>();
    for (const u of this.users()) nameById.set(String(u.id), u.username);
    const map = new Map<string, { username: string; count: number }>();
    for (const h of rows) {
      const id = h?.user_id ?? h?.userId;
      if (id === undefined || id === null || id === '') continue;
      const key = String(id);
      const entry = map.get(key);
      const label = nameById.get(key) || h?.username || h?.twitch_username || key;
      if (entry) entry.count += 1;
      else map.set(key, { username: label, count: 1 });
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, username: v.username, count: v.count }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  protected redemptionUsers(): { id: string; username: string; count: number }[] {
    return this.historyUsers(this.redemptions());
  }

  protected coinUsers(): { id: string; username: string; count: number }[] {
    return this.historyUsers(this.coinHistory());
  }

  protected subClaimUsers(): { id: string; username: string; count: number }[] {
    return this.historyUsers(this.subClaims());
  }

  private pruneHistoryFilters(): void {
    // Drop a selected user if they no longer have history in that box
    // (e.g. after rollback/refresh) so the list never sits on 0 rows.
    const valid = (list: { id: string }[], current: string) =>
      !current || list.some((u) => u.id === current) ? current : '';
    this.redemptionUserFilter = valid(this.redemptionUsers(), this.redemptionUserFilter);
    this.coinUserFilter = valid(this.coinUsers(), this.coinUserFilter);
    this.subUserFilter = valid(this.subClaimUsers(), this.subUserFilter);
  }

  protected async revokeSubClaim(userId: string, platform: string) {
    const monthKey = (platform.split(':')[1] || '').trim();
    if (typeof window !== 'undefined' && !window.confirm(`Revoke sub claim ${platform} for ${userId}? Coins reversed, user CANNOT re-claim.`)) return;
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/admin/sub-claims/revoke`, { userId, monthKey: /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : undefined }).toPromise();
      this.notice.set(`Revoked sub ${res.monthKey} for ${userId} (${res.reverted} AC). No re-claim.`);
      await this.refreshHistory();
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Sub revoke failed');
    }
  }

  protected async resetSubClaim(userId: string, platform: string) {
    const monthKey = (platform.split(':')[1] || '').trim();
    if (typeof window !== 'undefined' && !window.confirm(`Reset sub claim ${platform} for ${userId}? User can re-claim that month.`)) return;
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/admin/sub-claims/reset`, { userId, monthKey: /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : undefined }).toPromise();
      this.notice.set(`Reset sub ${res.monthKey} for ${userId} (${res.reverted} AC). User can re-claim now.`);
      await this.refreshHistory();
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Sub reset failed');
    }
  }

  // Helix /subscriptions has no tenure field: a 3-month sub claiming first time
  // counts streak=0 and gets base x 1. Verify tenure in Twitch dashboard, enter
  // months here — seeds prior-month locks so the next live claim pays base x months.
  protected async seedSubTenure(user: { id: string; username: string }) {
    const months = Number(this.seedMonths[user.id] || 0);
    if (!Number.isInteger(months) || months < 1) {
      this.notice.set('Enter tenure months (>= 1) first');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(`Seed ${months}-month tenure for ${user.username}? Next claim pays 200 x ${months}.`)) return;
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/admin/sub-claims/seed`, { userId: user.id, months }).toPromise();
      this.notice.set(`Seeded tenure for ${user.username}: ${res.seeded} lock(s), next claim ${res.nextAmount} AC`);
      await this.refreshHistory();
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Seed failed');
    }
  }

  protected async rollbackRedemption(id: number) {
    if (typeof window !== 'undefined' && !window.confirm(`Rollback redemption #${id}? Cost will be refunded.`)) return;
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/admin/redemptions/${id}/rollback`, {}).toPromise();
      this.notice.set(`Rolled back redeem #${id} (refunded ${res.refunded} AC)`);
      await this.refreshHistory();
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'Rollback failed');
    }
  }

  private async refreshHistory(): Promise<void> {
    try {
      const [redemptions, coins, subs] = await Promise.all([
        this.http.get<any[]>(`${environment.apiUrl}/admin/redemptions`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/coin-history`).toPromise(),
        this.http.get<any[]>(`${environment.apiUrl}/admin/sub-claims`).toPromise().catch(() => null),
      ]);
      if (redemptions) this.redemptions.set(redemptions);
      if (coins) this.coinHistory.set(coins);
      if (subs) this.subClaims.set(subs);
      this.pruneHistoryFilters();
    } catch (e) {
      console.error(e);
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
