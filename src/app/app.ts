import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('boyalone99-jft');

  protected readonly selectedProvider = signal<string | null>(null);

  protected selectProvider(provider: string): void {
    this.selectedProvider.set(provider);
  }
}
