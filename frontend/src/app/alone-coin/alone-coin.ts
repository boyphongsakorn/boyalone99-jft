import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  imports: [RouterLink],
  selector: 'app-alone-coin',
  styleUrl: './alone-coin.css',
  templateUrl: './alone-coin.html',
})
export class AloneCoin implements OnInit {
  protected readonly isLoggedIn = signal(false);
  protected readonly userId = signal<string | null>(null);
  protected readonly twitchFollowing = signal<boolean | null>(null);
  protected readonly twitchLinked = signal(true);
  protected readonly twitchUrl = signal('https://www.twitch.tv/boyalone99');
  protected readonly youtubeUrl = signal('https://www.youtube.com/@boyalone99?sub_confirmation=1');
  protected readonly twitchClaimed = signal(false);
  protected readonly youtubeClaimed = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly checking = signal(false);

  constructor(private http: HttpClient) {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user_profile');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.id) {
            this.isLoggedIn.set(true);
            this.userId.set(parsed.id);
          }
        } catch { /* ignore */ }
      }
    }
  }

  async ngOnInit() {
    if (typeof window === 'undefined' || !this.userId()) return;
    await this.refreshStatus();
  }

  protected checkTwitch(): Promise<void> {
    return this.refreshStatus();
  }

  private async refreshStatus(): Promise<void> {
    const id = this.userId();
    if (!id) return;
    this.checking.set(true);
    try {
      const [tw, yt]: any[] = await Promise.all([
        this.http.get(`${environment.apiUrl}/follow/twitch?userId=${encodeURIComponent(id)}`).toPromise(),
        this.http.get(`${environment.apiUrl}/follow/youtube?userId=${encodeURIComponent(id)}`).toPromise(),
      ]);
      if (tw?.followUrl) this.twitchUrl.set(tw.followUrl);
      if (yt?.channelUrl) this.youtubeUrl.set(yt.channelUrl);
      if (tw?.reason === 'twitch_not_linked') {
        this.twitchLinked.set(false);
        this.twitchFollowing.set(false);
      } else {
        this.twitchLinked.set(true);
        this.twitchFollowing.set(tw?.following ?? null);
      }
      if (tw?.claimed) this.twitchClaimed.set(true);
      if (yt?.claimed) this.youtubeClaimed.set(true);
    } catch {
      /* keep defaults, claim will surface error */
    } finally {
      this.checking.set(false);
    }
  }

  protected async claim(platform: 'twitch' | 'youtube'): Promise<void> {
    const id = this.userId();
    if (!id) {
      this.notice.set('กรุณาล็อกอินก่อนรับเหรียญ');
      return;
    }
    try {
      const res: any = await this.http
        .post(`${environment.apiUrl}/claim/follow`, { userId: id, platform })
        .toPromise();
      this.notice.set(`รับ +100 AC สำเร็จ! ยอดคงเหลือ ${res.balance} AC`);
      if (platform === 'twitch') this.twitchClaimed.set(true);
      else this.youtubeClaimed.set(true);
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'รับเหรียญไม่สำเร็จ');
    }
  }
}
