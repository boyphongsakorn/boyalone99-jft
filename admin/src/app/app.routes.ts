import { Routes } from '@angular/router';
import { Admin } from './admin/admin';
import { AdminAuth } from './admin/admin-auth';
import { adminAuthGuard } from './admin/admin-guard';

export const routes: Routes = [
  { path: 'auth', component: AdminAuth },
  { path: '', component: Admin, canActivate: [adminAuthGuard] },
  { path: '**', redirectTo: 'auth' },
];
