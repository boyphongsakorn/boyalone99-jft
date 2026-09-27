import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-admin-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './admin-auth.html',
  styleUrl: './admin-auth.css',
})
export class AdminAuth implements OnInit {
  protected otp = signal('------');
  protected qrCode = signal<string | null>(null);
  protected error = signal<string | null>(null);
  protected loading = signal(false);

  constructor(private http: HttpClient, private router: Router) {}

  async ngOnInit() {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_token')) {
      this.router.navigateByUrl('/');
      return;
    }
    try {
      const statusRes: any = await this.http.get(`${environment.apiUrl}/admin/auth/status`).toPromise();
      if (statusRes && statusRes.hasSecret) {
        this.qrCode.set(null);
        return;
      }
      const res: any = await this.http.get(`${environment.apiUrl}/admin/auth/qr`).toPromise();
      if (res && res.qrCode) {
        this.qrCode.set(res.qrCode);
      }
    } catch (e) {
      this.error.set('Failed to initialize auth');
    }
  }

  async verify() {
    if (this.otp().length !== 6) {
      this.error.set('OTP must be 6 digits');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const res: any = await this.http
        .post(`${environment.apiUrl}/admin/auth/verify`, { token: this.otp() })
        .toPromise();
      if (res && res.success) {
        localStorage.setItem('admin_token', res.adminToken);
        this.router.navigateByUrl('/');
      }
    } catch (e: any) {
      this.error.set(e.error?.error || 'Invalid OTP token');
    } finally {
      this.loading.set(false);
    }
  }
}
