import { Routes } from '@angular/router';
import { AloneCoin } from './alone-coin/alone-coin';
import { Login } from './login/login';
import { LoginCallback } from './login/login-callback';
import { Profile } from './profile/profile';
import { Rewards } from './rewards/rewards';

export const routes: Routes = [
  { path: '', component: Rewards },
  { path: 'profile', component: Profile },
  { path: 'alone-coin', component: AloneCoin },
  { path: 'login', component: Login },
  { path: 'login/callback', component: LoginCallback },
  { path: '**', redirectTo: '' },
];
