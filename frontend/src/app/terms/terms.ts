import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="terms-page">
      <div class="paper-line" aria-hidden="true"></div>

      <header class="site-header">
        <a class="brand" routerLink="/" aria-label="Back to rewards">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>BoyAlone99 <small>Community</small></span>
        </a>
        <div class="header-right">
          <a class="back-link" routerLink="/">&#8592; Back to Home</a>
        </div>
      </header>

      <section class="terms-panel">
        <h1>ข้อกำหนดและเงื่อนไขการใช้งาน <br><span>(Terms & Conditions)</span></h1>
        <p class="subtitle">กรุณาอ่านข้อกำหนดด้านล่างนี้ก่อนใช้งานเว็บไซต์</p>

        <div class="terms-content">
          <div class="term-item">
            <h3>1. วัตถุประสงค์ของเว็บไซต์</h3>
            <p>เว็บไซต์นี้ถูกสร้างขึ้นเพื่อเป็นส่วนหนึ่งของโปรเจกต์ทดสอบระบบและให้ชุมชน BoyAlone99 ได้ร่วมสนุกกับการสะสม Alone Coin เพื่อแลกของรางวัล</p>
          </div>

          <div class="term-item">
            <h3>2. การสะสมและแลกเหรียญ (Alone Coin)</h3>
            <p>การได้รับเหรียญและการนำเหรียญไปแลกของรางวัลเป็นไปตามเงื่อนไขที่ผู้ดูแลระบบกำหนดไว้ในหน้า Rewards โดยผู้ดูแลระบบขอสงวนสิทธิ์ในการเปลี่ยนแปลงเงื่อนไขได้ตลอดเวลา</p>
          </div>

          <div class="term-item">
            <h3>3. ข้อมูลส่วนบุคคล</h3>
            <p>ข้อมูลที่ผู้ใช้ระบุ เช่น Email หรือ Epic Games ID จะถูกนำมาใช้เพื่อวัตถุประสงค์ในการจัดส่งของรางวัลเท่านั้น</p>
          </div>

          <div class="term-item highlight">
            <h3>4. ข้อจำกัดความรับผิดชอบด้านข้อมูล (โปรเจกต์ทดสอบ)</h3>
            <p>เนื่องจากโปรเจกต์นี้เป็น <strong>ระบบทดสอบ (Testing Project)</strong> ข้อมูลบางส่วนในระบบอาจมีความคลาดเคลื่อน ผิดพลาด หรือสูญหายได้ ผู้ใช้งานยอมรับว่าข้อมูลที่ปรากฏอาจไม่ถูกต้อง 100% และผู้พัฒนาจะไม่รับผิดชอบต่อความเสียหายที่เกิดจากความผิดพลาดของข้อมูลในระบบทดสอบนี้</p>
          </div>

          <div class="term-item">
            <h3>5. การระงับการใช้งาน</h3>
            <p>ผู้ดูแลระบบขอสงวนสิทธิ์ในการระงับการใช้งาน หรือยกเลิกการแลกรางวัล หากพบว่ามีการใช้งานที่ผิดวัตถุประสงค์ หรือมีการทุจริตเกิดขึ้น</p>
          </div>
        </div>

        <div class="terms-footer">
          <p>การใช้งานเว็บไซต์นี้ ถือว่าท่านยอมรับข้อกำหนดและเงื่อนไขทั้งหมดข้างต้น</p>
          <a class="home-btn" routerLink="/">I Understand & Accept</a>
        </div>
      </section>
    </main>
  `,
  styles: [`
    .terms-page {
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

    .terms-panel { 
      background: rgba(255,255,255,.3); border: 2px solid #252525; border-radius: 4px 12px 6px 10px; 
      box-shadow: 6px 6px 0 #252525; margin: 60px auto 0; max-width: 720px; padding: 40px; position: relative; z-index: 1; 
    }
    .terms-panel h1 { font-size: 1.8rem; margin: 0; transform: rotate(-1deg); line-height: 1.2; }
    .terms-panel h1 span { font-size: 1rem; color: #77746d; display: block; font-weight: normal; margin-top: 8px; }
    .subtitle { color: #77746d; font-size: .85rem; margin: 4px 0 32px; }
    
    .terms-content { display: grid; gap: 24px; }
    .term-item { background: #fff; border: 1px solid #252525; border-radius: 6px; padding: 16px; box-shadow: 3px 3px 0 #252525; }
    .term-item h3 { font-size: 1rem; margin: 0 0 8px; color: #252525; }
    .term-item p { font-size: .85rem; line-height: 1.6; margin: 0; color: #444; }
    .term-item.highlight { border: 2px solid #c05d46; background: #fffafa; }
    .term-item.highlight h3 { color: #c05d46; }

    .terms-footer { margin-top: 40px; text-align: center; display: grid; gap: 20px; }
    .terms-footer p { font-size: .8rem; color: #77746d; }
    .home-btn { 
      background: #252525; color: #f8f5ec; padding: 12px 24px; text-decoration: none; 
      border-radius: 6px; font-weight: 700; display: inline-block; width: fit-content; margin: 0 auto;
      font-family: 'Playpen Sans Thai', cursive; transition: background 0.2s;
    }
    .home-btn:hover { background: #c05d46; }
  `],
})
export class TermsComponent {}
