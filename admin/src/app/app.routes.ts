import { Routes } from '@angular/router';
import { Admin } from './admin/admin';
import { AdminAuth } from './admin/admin-auth';

export const routes: Routes = [
  { path: 'auth', component: AdminAuth },
  { path: '', component: Admin },
  { path: '**', redirectTo: 'auth' },
];
