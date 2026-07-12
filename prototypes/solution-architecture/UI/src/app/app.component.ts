import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { SidenavComponent } from './shared/components/sidenav/sidenav.component';
import { ChatbotComponent } from './shared/components/chatbot/chatbot.component';
import { IconNavComponent } from './shared/components/icon-nav/icon-nav.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatSidenavModule, NavbarComponent, SidenavComponent, ChatbotComponent, IconNavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly auth = inject(AuthService);

  readonly sidenavOpen  = signal(true);
  readonly iconNavOpen  = signal(true);
  readonly isAuthenticated = toSignal(
    this.auth.currentUser$.pipe(map(u => !!u)),
    { initialValue: this.auth.isAuthenticated() }
  );

  toggleSidenav(): void {
    this.sidenavOpen.update(v => !v);
  }

  toggleIconNav(): void {
    this.iconNavOpen.update(v => !v);
  }
}
