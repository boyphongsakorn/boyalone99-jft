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
import { TermsComponent } from './terms/terms';
import { PrivacyComponent } from './privacy/privacy';
import { Sso } from './sso/sso';

export const routes: Routes = [
  { path: '', component: Rewards },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  { path: 'history', component: History, canActivate: [authGuard] },
  { path: 'progress', component: RewardsProgress, canActivate: [authGuard] },
  { path: 'terms', component: TermsComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'alone-coin', component: AloneCoin },
  { path: 'login', component: Login, canActivate: [guestOnlyGuard] },
  { path: 'login/callback', component: LoginCallback },
  { path: 'sso', component: Sso },
  { path: '**', redirectTo: '' },
];
