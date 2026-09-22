import { DecimalPipe } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Reward {
  readonly title: string;
  readonly description: string;
  readonly cost: number;
  readonly accent: string;
  readonly icon: string;
  readonly stock: number;
}

@Component({
  imports: [DecimalPipe, RouterLink],
  selector: 'app-rewards',
  styleUrl: './rewards.css',
  templateUrl: './rewards.html',
})
export class Rewards {
  protected readonly isLoggedIn = signal(false);
  protected readonly balance = signal(1250);
  protected readonly notice = signal<string | null>(null);

  protected readonly rewards: readonly Reward[] = [
    {
      title: 'Alone Sticker Pack',
      description: 'A set of tiny stickers for your digital corner.',
      cost: 50,
      accent: 'peach',
      icon: '✦',
      stock: 100,
    },
    {
      title: 'Community Shout-out',
      description: 'Get your name on the next community thank-you wall.',
      cost: 100,
      accent: 'mint',
      icon: '♡',
      stock: 20,
    },
    {
      title: 'Behind-the-scenes Note',
      description: 'A personal note from BoyAlone99, just for you.',
      cost: 150,
      accent: 'lilac',
      icon: '✎',
      stock: 10,
    },
    {
      title: 'Alone Limited Badge',
      description: 'A special badge for early members of the community.',
      cost: 200,
      accent: 'gold',
      icon: '◇',
      stock: 5,
    },
    {
      title: 'Steam Gift: Papers, Please',
      description: 'A surprise game from the Steam store, chosen for you.',
      cost: 250,
      accent: 'peach',
      icon: '🎮',
      stock: 3,
    },
    {
      title: 'Fortnite Battle Pass',
      description: 'Unlock the current season pass for Fortnite.',
      cost: 275,
      accent: 'mint',
      icon: '🏆',
      stock: 15,
    },
    {
      title: 'Steam Gift: Warframe The Old Peace Uriel Bundle',
      description: 'A special game bundle for the dedicated community members.',
      cost: 300,
      accent: 'gold',
      icon: '💎',
      stock: 2,
    },
  ];

  protected canRedeem(cost: number): boolean {
    return this.isLoggedIn() && this.balance() >= cost;
  }

  protected redeem(reward: Reward): void {
    if (!this.isLoggedIn()) {
      return;
    }

    if (!this.canRedeem(reward.cost)) {
      this.notice.set('Alone Coin ยังไม่พอสำหรับรางวัลนี้');
      return;
    }

    this.balance.update((current) => current - reward.cost);
    this.notice.set(`แลกรางวัล ${reward.title} สำเร็จแล้ว`);
  }
}
