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
  protected readonly youtubeUrl = signal('https://youtube.com/@BoyAlone99Gaming?sub_confirmation=1');
  protected readonly twitchClaimed = signal(false);
  protected readonly youtubeClaimed = signal(false);
  protected readonly hasBooster = signal<boolean | null>(null);
  protected readonly hasLfg = signal<boolean | null>(null);
  protected readonly boosterClaimed = signal(false);
  protected readonly lfgClaimed = signal(false);
  protected readonly hasSub = signal<boolean | null>(null);
  protected readonly subClaimed = signal(false);
  protected readonly subUrl = signal('https://www.twitch.tv/subs/boyalone99');
  protected readonly subMonths = signal(0);
  protected readonly subNextAmount = signal(200);
  protected readonly subBase = signal(200);
  protected readonly subTenure = signal(1);
  protected readonly subTenureAuto = signal(false);
  protected readonly channelPending = signal(0);
  protected readonly channelRedeemable = signal(false);
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
      const [tw, yt, roles, cp, sub]: any[] = await Promise.all([
        this.http.get(`${environment.apiUrl}/follow/twitch?userId=${encodeURIComponent(id)}`).toPromise(),
        this.http.get(`${environment.apiUrl}/follow/youtube?userId=${encodeURIComponent(id)}`).toPromise(),
        this.http.get(`${environment.apiUrl}/discord/roles?userId=${encodeURIComponent(id)}`).toPromise().catch(() => null),
        this.http.get(`${environment.apiUrl}/twitch/channel-points?userId=${encodeURIComponent(id)}`).toPromise().catch(() => null),
        this.http.get(`${environment.apiUrl}/follow/twitchsub?userId=${encodeURIComponent(id)}`).toPromise().catch(() => null),
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
      if (roles) {
        this.hasBooster.set(roles.booster === true);
        this.hasLfg.set(roles.lfg === true);
        if (roles.claimedBooster) this.boosterClaimed.set(true);
        if (roles.claimedLfg) this.lfgClaimed.set(true);
      }
      if (cp) {
        this.channelRedeemable.set(cp.redeemable === true);
        this.channelPending.set(cp.pending ?? 0);
      }
      if (sub) {
        if (sub.subscribeUrl) this.subUrl.set(sub.subscribeUrl);
        if (sub.reason === 'twitch_not_linked') this.hasSub.set(false);
        else this.hasSub.set(sub.subscribed === true);
        if (sub.claimed) this.subClaimed.set(true);
        if (typeof sub.monthsClaimed === 'number') this.subMonths.set(sub.monthsClaimed);
        if (typeof sub.baseAmount === 'number') this.subBase.set(sub.baseAmount);
        this.subTenureAuto.set(sub.tenureAuto === true);
        if (typeof sub.effectiveTenure === 'number') this.subTenure.set(sub.effectiveTenure);
        if (typeof sub.nextAmount === 'number') this.subNextAmount.set(sub.nextAmount);
      }
    } catch {
      /* keep defaults, claim will surface error */
    } finally {
      this.checking.set(false);
    }
  }

  protected async claimChannelPoints(): Promise<void> {
    const id = this.userId();
    if (!id) {
      this.notice.set('กรุณาล็อกอินก่อนรับเหรียญ');
      return;
    }
    try {
      const res: any = await this.http.post(`${environment.apiUrl}/claim/channel-points`, { userId: id }).toPromise();
      this.notice.set(`รับ +${res.granted} AC สำเร็จ! ยอดคงเหลือ ${res.balance} AC`);
      this.channelRedeemable.set(false);
      this.channelPending.set(0);
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'รับเหรียญไม่สำเร็จ');
    }
  }

  protected async claim(platform: 'twitch' | 'youtube' | 'booster' | 'lfg' | 'twitchsub'): Promise<void> {
    const id = this.userId();
    if (!id) {
      this.notice.set('กรุณาล็อกอินก่อนรับเหรียญ');
      return;
    }
    try {
      const body: any = { userId: id, platform };
      const res: any = await this.http
        .post(`${environment.apiUrl}/claim/follow`, body)
        .toPromise();
      const amounts: Record<string, number> = { twitch: 100, youtube: 100, booster: 150, lfg: 100, twitchsub: res.granted ?? 200 };
      this.notice.set(`รับ +${res.granted ?? (platform === 'twitchsub' ? 200 : amounts[platform])} AC สำเร็จ! ยอดคงเหลือ ${res.balance} AC`);
      if (platform === 'twitch') this.twitchClaimed.set(true);
      else if (platform === 'youtube') this.youtubeClaimed.set(true);
      else if (platform === 'booster') this.boosterClaimed.set(true);
      else if (platform === 'twitchsub') this.subClaimed.set(true);
      else this.lfgClaimed.set(true);
    } catch (e: any) {
      this.notice.set(e?.error?.error || 'รับเหรียญไม่สำเร็จ');
    }
  }
}
