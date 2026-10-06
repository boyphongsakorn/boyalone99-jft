import { Routes } from '@angular/router';
import { Admin } from './admin/admin';
import { AdminAuth } from './admin/admin-auth';
import { adminAuthGuard } from './admin/admin-guard';
import { ObsScoreboard } from './obs-scoreboard/obs-scoreboard';

export const routes: Routes = [
  { path: 'auth', component: AdminAuth },
  { path: 'obs-scoreboard', component: ObsScoreboard },
  { path: '', component: Admin, canActivate: [adminAuthGuard] },
  { path: '**', redirectTo: 'auth' },
];
