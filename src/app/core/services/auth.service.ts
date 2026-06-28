import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);

  constructor() {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
    });

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
    });
  }

  async signIn(email: string, password: string) {
    return this.supabase.client.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.session() !== null;
  }
}
