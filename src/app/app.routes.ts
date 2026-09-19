import { Routes } from '@angular/router';
import { AloneCoin } from './alone-coin/alone-coin';
import { Login } from './login/login';
import { Rewards } from './rewards/rewards';

export const routes: Routes = [
	{ path: '', component: Rewards },
	{ path: 'alone-coin', component: AloneCoin },
	{ path: 'login', component: Login },
	{ path: '**', redirectTo: '' },
];
