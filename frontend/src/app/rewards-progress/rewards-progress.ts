import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface RedemptionProcess {
  id: number;
  reward_title: string;
  cost: number;
  redeemed_at: string;
  status: string;
}

@Component({
  selector: 'app-rewards-progress',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rewards-progress.html',
  styleUrl: './rewards-progress.css',
})
export class RewardsProgress implements OnInit {
  protected readonly processes = signal<readonly RedemptionProcess[]>([]);
  protected readonly loading = signal(true);
  protected readonly notice = signal<string | null>(null);

  protected readonly statusMap: Record<string, string> = {
    'processing': 'กำลังดำเนินการ',
    'shipped': 'จัดส่งแล้ว',
    'delivered': 'ได้รับแล้ว',
    'cancelled': 'ยกเลิกแล้ว',
    'failed': 'ล้มเหลว',
  };

  constructor(private http: HttpClient) {}

  protected getStatus(status: string | null | undefined): string {
    if (!status) return 'กำลังดำเนินการ';
    return this.statusMap[status.toLowerCase()] || status;
  }

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('user_profile');
    if (!saved) return;
    
    try {
      const userId = JSON.parse(saved).id;
      const bust = `t=${Date.now()}`;
      const data = await this.http.get<RedemptionProcess[]>(`${environment.apiUrl}/users/${encodeURIComponent(userId)}/redemptions?${bust}`).toPromise();
      this.processes.set(Array.isArray(data) ? data : []);
    } catch (e) {
      this.notice.set('โหลดความคืบหน้าไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      this.loading.set(false);
    }
  }
}
