import { Routes } from '@angular/router';
import { Admin } from './admin/admin';

export const routes: Routes = [
  { path: '', component: Admin },
  { path: '**', redirectTo: '' },
];
