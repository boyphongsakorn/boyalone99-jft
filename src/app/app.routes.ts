import { Routes } from '@angular/router';
import { Rewards } from './rewards';

export const routes: Routes = [
	{ path: '', component: Rewards },
	{ path: '**', redirectTo: '' },
];
