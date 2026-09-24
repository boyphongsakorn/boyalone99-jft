import { Routes } from '@angular/router';
import { AloneCoin } from './alone-coin/alone-coin';
import { Login } from './login/login';
import { Profile } from './profile/profile';
import { Rewards } from './rewards/rewards';

export const routes: Routes = [
  { path: '', component: Rewards },
  { path: 'profile', component: Profile },
];
