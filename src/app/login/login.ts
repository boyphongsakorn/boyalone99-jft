import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  protected readonly selectedProvider = signal<string | null>(null);

  protected selectProvider(provider: string): void {
    this.selectedProvider.set(provider);
  }
}
