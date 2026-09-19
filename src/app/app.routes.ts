import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Rewards } from './rewards/rewards';

export const routes: Routes = [
	{ path: '', component: Rewards },
	{ path: 'login', component: Login },
	{ path: '**', redirectTo: '' },
];
