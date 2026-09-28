import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AlertBar } from './alert-bar/alert-bar';

@Component({
  imports: [RouterOutlet, AlertBar],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
}
