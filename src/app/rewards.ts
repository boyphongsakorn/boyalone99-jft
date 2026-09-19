import { DecimalPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Reward {
  readonly title: string;
  readonly description: string;
  readonly cost: number;
  readonly accent: string;
  readonly icon: string;
}

@Component({
  imports: [DecimalPipe, RouterLink],
  selector: 'app-rewards',
  styleUrl: './rewards.css',
  templateUrl: './rewards.html',
})
export class Rewards {
  protected readonly balance = signal(1250);
  protected readonly notice = signal<string | null>(null);

  protected readonly rewards: readonly Reward[] = [
    {
      title: 'Alone Sticker Pack',
      description: 'A set of tiny stickers for your digital corner.',
      cost: 250,
      accent: 'peach',
      icon: '✦',
    },
    {
      title: 'Community Shout-out',
      description: 'Get your name on the next community thank-you wall.',
      cost: 500,
      accent: 'mint',
      icon: '♡',
    },
    {
      title: 'Behind-the-scenes Note',
      description: 'A personal note from BoyAlone99, just for you.',
      cost: 750,
      accent: 'lilac',
      icon: '✎',
    },
    {
      title: 'Alone Limited Badge',
      description: 'A special badge for early members of the community.',
      cost: 1000,
      accent: 'gold',
      icon: '◇',
    },
  ];

  protected canRedeem(cost: number): boolean {
    return this.balance() >= cost;
  }

  protected redeem(reward: Reward): void {
    if (!this.canRedeem(reward.cost)) {
      this.notice.set('Alone Coin ยังไม่พอสำหรับรางวัลนี้');
      return;
    }

    this.balance.update((current) => current - reward.cost);
    this.notice.set(`แลกรางวัล ${reward.title} สำเร็จแล้ว`);
  }
}
