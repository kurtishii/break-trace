import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-gray-100">
      <nav class="w-64 bg-gray-900 text-white flex flex-col">
        <div class="p-6 border-b border-gray-700">
          <h1 class="text-xl font-bold text-white">BreakTrace</h1>
          <p class="text-xs text-gray-400 mt-1">Dashboard</p>
        </div>
        <ul class="flex-1 p-4 space-y-1">
          @for (item of navItems; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-blue-600 text-white"
                class="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <span>{{ item.icon }}</span>
                <span class="text-sm font-medium">{{ item.label }}</span>
              </a>
            </li>
          }
        </ul>
        <div class="p-4 border-t border-gray-700">
          <button
            (click)="auth.signOut()"
            class="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Abmelden
          </button>
        </div>
      </nav>
      <main class="flex-1 overflow-auto">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent {
  readonly navItems = [
    { path: 'uebersicht', label: 'Übersicht', icon: '📊' },
    { path: 'artikel', label: 'Artikelauswertung', icon: '📦' },
    { path: 'orte', label: 'Ortsauswertung', icon: '📍' },
    { path: 'kreuzauswertung', label: 'Kreuzauswertung', icon: '🔀' },
    { path: 'prozesskontext', label: 'Prozesskontext', icon: '⚙️' },
    { path: 'kosten', label: 'Kosten', icon: '💰' },
    { path: 'berichte', label: 'Berichte & Export', icon: '📄' },
    { path: 'import', label: 'Witron-Import', icon: '📥' },
  ];

  constructor(readonly auth: AuthService) {}
}
