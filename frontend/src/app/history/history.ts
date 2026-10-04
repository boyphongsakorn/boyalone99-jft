import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface CoinRow {
  readonly id: number;
  readonly amount: number;
  readonly reason: string | null;
  readonly created_at: string;
}

interface RedeemRow {
  readonly id: number;
  readonly redeemed_at: string;
  readonly reward_title: string | null;
  readonly cost: number | null;
  readonly status?: string | null;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [RouterLink, HttpClientModule],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History implements OnInit {
  protected readonly coins = signal<readonly CoinRow[]>([]);
  protected readonly redeems = signal<readonly RedeemRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly notice = signal<string | null>(null);

  protected readonly statusMap: Record<string, string> = {
    'processing': 'กำลังดำเนินการ',
    'shipped': 'จัดส่งแล้ว',
    'delivered': 'ได้รับแล้ว',
    'cancelled': 'ยกเลิกแล้ว',
    'failed': 'ล้มเหลว',
  };

  constructor(private http: HttpClient, private router: Router) {}

  protected getStatus(status: string | null | undefined): string {
    if (!status) return 'กำลังดำเนินการ';
    return this.statusMap[status.toLowerCase()] || status;
  }

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('user_profile');
    if (!saved) {
      this.router.navigateByUrl('/login');
      return;
    }
    let userId = '';
    try {
      userId = JSON.parse(saved).id || '';
    } catch { /* ignore */ }
    if (!userId) {
      this.router.navigateByUrl('/login');
      return;
    }
    const bust = `t=${Date.now()}`;
    try {
      const [c, r]: any[] = await Promise.all([
        this.http.get(`${environment.apiUrl}/users/${encodeURIComponent(userId)}/coin-history?${bust}`).toPromise().catch(() => []),
        this.http.get(`${environment.apiUrl}/users/${encodeURIComponent(userId)}/redemptions?${bust}`).toPromise().catch(() => []),
      ]);
      this.coins.set(Array.isArray(c) ? c : []);
      this.redeems.set(Array.isArray(r) ? r : []);
    } catch {
      this.notice.set('โหลดประวัติไม่สำเร็จ ลองรีเฟรชอีกครั้ง');
    } finally {
      this.loading.set(false);
    }
  }

  protected logout(): void {
    if (typeof window !== 'undefined') localStorage.removeItem('user_profile');
    this.router.navigateByUrl('/login');
  }
}
