import { Routes } from '@angular/router';
import { AloneCoin } from './alone-coin/alone-coin';
import { Login } from './login/login';
import { LoginCallback } from './login/login-callback';
import { guestOnlyGuard } from './login/guest-guard';
import { authGuard } from './login/auth-guard';
import { Profile } from './profile/profile';
import { Rewards } from './rewards/rewards';
import { History } from './history/history';
import { RewardsProgress } from './rewards-progress/rewards-progress';

export const routes: Routes = [
  { path: '', component: Rewards },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  { path: 'history', component: History, canActivate: [authGuard] },
  { path: 'progress', component: RewardsProgress, canActivate: [authGuard] },
  { path: 'alone-coin', component: AloneCoin },
  { path: 'login', component: Login, canActivate: [guestOnlyGuard] },
  { path: 'login/callback', component: LoginCallback },
  { path: '**', redirectTo: '' },
];
