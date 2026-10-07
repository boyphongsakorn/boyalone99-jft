import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="privacy-page">
      <div class="paper-line" aria-hidden="true"></div>

      <header class="site-header">
        <a class="brand" routerLink="/" aria-label="Back to rewards">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>BoyAlone99 <small>Alone Coin</small></span>
        </a>
        <div class="header-right">
          <a class="back-link" routerLink="/">&#8592; Back to Home</a>
        </div>
      </header>

      <section class="privacy-panel">
        <h1>นโยบายความเป็นส่วนตัว <br><span>(Privacy Policy)</span></h1>
        <p class="subtitle">ข้อมูลของคุณถูกจัดการอย่างไรในระบบทดสอบนี้</p>

        <div class="privacy-content">
          <div class="policy-item">
            <h3>1. ข้อมูลที่เราเก็บรวบรวม</h3>
            <p>เราเก็บรวบรวมข้อมูลที่จำเป็นสำหรับการยืนยันตัวตนและการส่งของรางวัล เช่น:</p>
            <ul>
              <li>ข้อมูลจากผู้ให้บริการ OAuth (Discord, Twitch, Google) เช่น ID ผู้ใช้, ชื่อผู้ใช้, และอีเมล</li>
              <li>ข้อมูลที่คุณระบุเพื่อรับรางวัล เช่น อีเมล, Epic Games ID หรือ Warframe IGN</li>
            </ul>
          </div>

          <div class="policy-item">
            <h3>2. วัตถุประสงค์การใช้ข้อมูล</h3>
            <p>ข้อมูลของคุณจะถูกนำไปใช้เพื่อ:</p>
            <ul>
              <li>ตรวจสอบสิทธิ์ในการรับรางวัล (เช่น การตรวจสอบการติดตาม/สมัครสมาชิก)</li>
              <li>ใช้ในการติดต่อและจัดส่งของรางวัลที่คุณได้รับ</li>
              <li>ป้องกันการทุจริตและการรับรางวัลซ้ำ (One per user)</li>
            </ul>
          </div>

          <div class="policy-item">
            <h3>3. การรักษาความปลอดภัยและการจัดเก็บ</h3>
            <p>ข้อมูลจะถูกจัดเก็บในฐานข้อมูลที่ได้รับการป้องกัน อย่างไรก็ตาม เนื่องจากเป็น <strong>ระบบทดสอบ (Testing Project)</strong> เราขอแนะนำให้หลีกเลี่ยงการระบุข้อมูลส่วนบุคคลที่มีความอ่อนไหวสูง</p>
          </div>

          <div class="policy-item highlight">
            <h3>4. การแบ่งปันข้อมูล</h3>
            <p>เราจะไม่ขายหรือแบ่งปันข้อมูลส่วนบุคคลของคุณให้กับบุคคลภายนอก ยกเว้นในกรณีที่จำเป็นต้องใช้ในการจัดส่งของรางวัลผ่านผู้ให้บริการที่เกี่ยวข้อง</p>
          </div>

          <div class="policy-item">
            <h3>5. สิทธิ์ของคุณ</h3>
            <p>คุณสามารถขอให้ตรวจสอบหรือลบข้อมูลของคุณออกจากระบบได้โดยติดต่อผู้ดูแลระบบผ่านช่องทางที่ระบุในเว็บไซต์</p>
          </div>
        </div>

        <div class="privacy-footer">
          <p>ข้อมูลนี้มีผลบังคับใช้ตั้งแต่วันที่ประกาศบนเว็บไซต์</p>
          <a class="home-btn" routerLink="/">I Understand & Accept</a>
        </div>
      </section>
    </main>
  `,
  styles: [`
    .privacy-page {
      background: #f8f5ec; color: #252525; font-family: 'Playpen Sans Thai', 'Segoe Print', cursive;
      min-height: 100dvh; padding: 28px clamp(24px, 7vw, 110px) 24px; position: relative;
    }
    .paper-line { border: 2px solid rgba(37,37,37,.08); border-radius: 50%; height: 600px; position: absolute; left: -300px; top: 100px; width: 600px; }
    .site-header { align-items: center; display: flex; justify-content: space-between; margin-inline: auto; max-width: 1080px; position: relative; z-index: 1; }
    .brand { align-items: center; color: #252525; display: flex; font-size: 1rem; font-weight: 700; gap: 10px; text-decoration: none; transform: rotate(-2deg); }
    .brand small { color: #5d8278; display: block; font-size: .65rem; letter-spacing: .12em; margin-top: 6px; }
    .brand-mark { display: flex; gap: 3px; height: 23px; transform: skew(-18deg); width: 26px; }
    .brand-mark i { background: #e16b50; display: block; width: 6px; }
    .brand-mark i:nth-child(2) { background: #e0b44f; height: 78%; margin-top: auto; }
    .brand-mark i:nth-child(3) { background: #5d8278; height: 54%; margin-top: auto; }
    .header-right { align-items: center; display: flex; gap: 12px; }
    .back-link { color: #252525; font-size: .72rem; text-decoration-color: #e0b44f; text-underline-offset: 4px; }

    .privacy-panel { 
      background: rgba(255,255,255,.3); border: 2px solid #252525; border-radius: 4px 12px 6px 10px; 
      box-shadow: 6px 6px 0 #252525; margin: 60px auto 0; max-width: 720px; padding: 40px; position: relative; z-index: 1; 
    }
    .privacy-panel h1 { font-size: 1.8rem; margin: 0; transform: rotate(-1deg); line-height: 1.2; }
    .privacy-panel h1 span { font-size: 1rem; color: #77746d; display: block; font-weight: normal; margin-top: 8px; }
    .subtitle { color: #77746d; font-size: .85rem; margin: 4px 0 32px; }
    
    .privacy-content { display: grid; gap: 24px; }
    .policy-item { background: #fff; border: 1px solid #252525; border-radius: 6px; padding: 16px; box-shadow: 3px 3px 0 #252525; }
    .policy-item h3 { font-size: 1rem; margin: 0 0 8px; color: #252525; }
    .policy-item p, .policy-item ul { font-size: .85rem; line-height: 1.6; margin: 0; color: #444; }
    .policy-item ul { padding-inline-start: 20px; margin-top: 8px; }
    .policy-item.highlight { border: 2px solid #c05d46; background: #fffafa; }
    .policy-item.highlight h3 { color: #c05d46; }

    .privacy-footer { margin-top: 40px; text-align: center; display: grid; gap: 20px; }
    .privacy-footer p { font-size: .8rem; color: #77746d; }
    .home-btn { 
      background: #252525; color: #f8f5ec; padding: 12px 24px; text-decoration: none; 
      border-radius: 6px; font-weight: 700; display: inline-block; width: fit-content; margin: 0 auto;
      font-family: 'Playpen Sans Thai', cursive; transition: background 0.2s;
    }
    .home-btn:hover { background: #c05d46; }
  `],
})
export class PrivacyComponent {}
