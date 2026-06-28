import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'uebersicht', pathMatch: 'full' },
      { path: 'uebersicht', loadComponent: () => import('./features/uebersicht/uebersicht.component').then(m => m.UebersichtComponent) },
      { path: 'artikel', loadComponent: () => import('./features/artikel/artikel.component').then(m => m.ArtikelComponent) },
      { path: 'orte', loadComponent: () => import('./features/orte/orte.component').then(m => m.OrteComponent) },
      { path: 'kreuzauswertung', loadComponent: () => import('./features/kreuzauswertung/kreuzauswertung.component').then(m => m.KreuzauswertungComponent) },
      { path: 'prozesskontext', loadComponent: () => import('./features/prozesskontext/prozesskontext.component').then(m => m.ProzesskontextComponent) },
      { path: 'kosten', loadComponent: () => import('./features/kosten/kosten.component').then(m => m.KostenComponent) },
      { path: 'berichte', loadComponent: () => import('./features/berichte/berichte.component').then(m => m.BerichteComponent) },
      { path: 'import', loadComponent: () => import('./features/import/import.component').then(m => m.ImportComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
