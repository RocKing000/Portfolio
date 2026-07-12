# Frontend Architecture
## Angular 17+ Modular No-Code Dashboard System

---

## Executive Summary

The frontend is a **config-driven, lazy-loaded Angular application** with Power BI Embedded visualization and a no-code dashboard customization engine. Every layout, widget, and behavior is driven by external configuration — nothing is hardcoded in components.

### Key Design Mandates

| Mandate | Implementation |
|---|---|
| No-Code Customization | Drag-and-drop interface; users configure without developer involvement |
| Dual View Modes | Design Mode (admin layout editing) vs Customization Mode (user personalization) |
| Multi-Layout Support | Up to 5 saved layouts per user |
| Protected Hero Section | Pinned top section — non-editable, always visible |
| Zero Hardcoding | All content from config JSON + database API |
| Power BI Embedded | Reports rendered inside Angular components via embed token |

---

## Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Framework | Angular | 17+ with standalone components |
| Reactivity | Angular Signals | Built-in; replaces RxJS for local state |
| Visualization | Power BI Embedded | Azure Power BI JavaScript SDK |
| Styling | SCSS + CSS Variables | Theme-aware, no inline styles |
| State Management | Angular Signals | `signal()`, `computed()`, `effect()` |
| HTTP | Angular `HttpClient` | With interceptors for JWT + correlation ID |
| Routing | Angular Router | Lazy-loaded feature routes |
| Build | Angular CLI + Webpack | AOT compilation; tree-shaking |
| Testing | Jasmine + Karma | Unit and component tests |

---

## Three Architectural Layers

### Layer 1: Core Module
**Singleton services — imported once in `AppModule` only.**

```
/src/app/core/
  ├── services/
  │   ├── auth.service.ts          ← JWT management, login/logout
  │   ├── config.service.ts        ← App config loader (APP_INITIALIZER)
  │   ├── user.service.ts          ← Current user state
  │   └── api.service.ts           ← Base HTTP wrapper
  ├── interceptors/
  │   ├── auth.interceptor.ts      ← Attach JWT to outbound requests
  │   ├── error.interceptor.ts     ← Global HTTP error handler
  │   └── correlation.interceptor.ts ← Inject X-Correlation-ID header
  ├── guards/
  │   ├── auth.guard.ts            ← Route protection
  │   └── role.guard.ts            ← Role-based route access
  └── core.module.ts
```

**Rule:** If a service is imported more than once, it does NOT belong in Core.

### Layer 2: Shared Module
**Reusable components, pipes, and directives — imported in any feature module.**

```
/src/app/shared/
  ├── components/
  │   ├── loading-spinner/
  │   ├── error-banner/
  │   ├── confirm-dialog/
  │   └── widget-wrapper/
  ├── pipes/
  │   ├── date-format.pipe.ts
  │   ├── truncate.pipe.ts
  │   └── severity-label.pipe.ts
  ├── directives/
  │   ├── drag-drop.directive.ts
  │   └── tooltip.directive.ts
  └── shared.module.ts
```

**Rule:** Shared components must be stateless (input/output only — no injected services with side effects).

### Layer 3: Feature Modules
**Lazy-loaded, self-contained modules with their own routes, services, and components.**

```
/src/app/features/
  ├── dashboard/           ← Dashboard layout management
  ├── analytics/           ← Signal analytics + charts
  ├── crm/                 ← Customer management
  ├── loan/                ← Loan processing
  └── admin/               ← Admin settings and user management
```

Each feature module follows the same internal structure:
```
/features/dashboard/
  ├── components/
  │   ├── dashboard-canvas/
  │   ├── widget-palette/
  │   └── layout-switcher/
  ├── services/
  │   ├── dashboard.service.ts
  │   └── widget-registry.service.ts
  ├── models/
  │   └── dashboard.models.ts
  ├── dashboard-routing.module.ts
  └── dashboard.module.ts
```

---

## Configuration System

All application behavior is driven by external config files. The `ConfigService` loads these at startup via `APP_INITIALIZER` — the app does not render until config is loaded.

### Config Files

| File | Purpose |
|---|---|
| `app-config.json` | API endpoints, feature flags, environment settings |
| `dashboard-layouts.json` | Default layout templates (grid definitions) |
| `powerbi-config.json` | Power BI workspace IDs, report IDs, embed settings |
| `widget-registry.json` | Available widget types and their default configs |
| `theme-config.json` | CSS variable overrides for theming |

### APP_INITIALIZER Pattern
```typescript
export function initializeApp(configService: ConfigService): () => Promise<void> {
    return () => configService.loadConfig();
}

// In AppModule providers:
{
    provide: APP_INITIALIZER,
    useFactory: initializeApp,
    deps: [ConfigService],
    multi: true
}
```

---

## State Management with Angular Signals

### Signal Primitives

```typescript
// Writable signal
const currentLayout = signal<DashboardLayout | null>(null);

// Derived/computed value (re-computed when dependencies change)
const activeWidgets = computed(() =>
    currentLayout()?.widgets.filter(w => w.isVisible) ?? []
);

// Side effect (runs when signals change)
effect(() => {
    const layout = currentLayout();
    if (layout) {
        persistenceService.save(layout);
    }
});

// Read-only exposure (prevent external mutation)
export class DashboardStore {
    private _layout = signal<DashboardLayout | null>(null);
    readonly layout = this._layout.asReadonly();

    setLayout(layout: DashboardLayout) {
        this._layout.set(layout);
    }
}
```

### When to Use Signals vs RxJS
| Use Case | Recommended |
|---|---|
| Component local state | Signals |
| Derived/computed UI state | Signals (`computed()`) |
| HTTP requests | RxJS (`HttpClient` observables) |
| Event streams (WebSocket, DOM events) | RxJS |
| Cross-component shared state | Signals (via service) |
| Complex async workflows | RxJS |

---

## Dashboard Customization Engine

### Design Mode vs Customization Mode

**Design Mode** (Admin only):
- Full grid editing — add, remove, resize, reorder any widget
- Can edit hero section
- Changes affect all users (template-level)
- Access: `DashboardAdmin` role only

**Customization Mode** (All users):
- User-specific personalization within template bounds
- Cannot remove hero section
- Can reorder non-locked widgets
- Max 5 saved personal layouts
- Changes stored per-user in `dashboard_layouts` table

### Widget Registry
Every widget type is registered in the `WidgetRegistryService`:
```typescript
interface WidgetDefinition {
    type: string;               // 'powerbi-report' | 'signal-chart' | 'kpi-card'
    displayName: string;
    defaultConfig: Record<string, unknown>;
    isLockable: boolean;
    minWidth: number;           // grid columns
    minHeight: number;          // grid rows
    component: Type<unknown>;   // lazy-loaded component class
}
```

### Grid System
- Grid: 12 columns × variable rows
- Widget position JSON: `{ "row": 0, "col": 4, "width": 4, "height": 3 }`
- Drag-and-drop via custom `DragDropDirective` (no third-party dependency)
- Collision detection: server-side validation + client-side preview

---

## Power BI Integration

### Authentication Flow
```
Angular App
  └── GET /api/v1/powerbi/token  (backend call)
        └── Backend calls Azure AD for service principal token
              └── Backend calls Power BI REST API for embed token
                    └── EmbedToken returned to Angular
                          └── PowerBIService.embed(config, token)
                                └── Power BI JavaScript SDK renders report
```

### Token Refresh
- Embed tokens expire in 60 minutes
- Angular `PowerBIService` checks token expiry 5 minutes before expiration
- Silent refresh via backend endpoint (no user re-authentication required)

### Embedding Pattern
```typescript
@Component({...})
export class PowerBIReportComponent implements OnInit, OnDestroy {
    @ViewChild('reportContainer', { static: true }) reportContainer!: ElementRef;
    private report?: Report;

    async ngOnInit() {
        const token = await this.powerBIService.getEmbedToken(this.reportId);
        const config: IEmbedConfiguration = {
            type: 'report',
            id: this.reportId,
            embedUrl: token.embedUrl,
            accessToken: token.token,
            settings: { navContentPaneEnabled: false }
        };
        this.report = powerbi.embed(this.reportContainer.nativeElement, config) as Report;
    }

    ngOnDestroy() {
        this.report?.off('loaded');
        powerbi.reset(this.reportContainer.nativeElement);
    }
}
```

---

## Routing Architecture

### Route Structure
```typescript
const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
        canActivate: [AuthGuard]
    },
    {
        path: 'analytics',
        loadChildren: () => import('./features/analytics/analytics.module').then(m => m.AnalyticsModule),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin', 'analyst'] }
    },
    {
        path: 'crm',
        loadChildren: () => import('./features/crm/crm.module').then(m => m.CrmModule),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin', 'crm_manager'] }
    },
    {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] }
    },
    { path: 'login', component: LoginComponent },
    { path: '**', component: NotFoundComponent }
];
```

---

## Performance Architecture

### Bundle Optimization
- **Lazy loading:** Every feature module is a separate chunk, loaded on first navigation
- **Tree shaking:** AOT compilation removes unused code
- **OnPush change detection:** All components use `ChangeDetectionStrategy.OnPush`
- **Signals:** Fine-grained reactivity — only components that depend on changed signals re-render

### Web Vitals Targets
| Metric | Target |
|---|---|
| First Contentful Paint (FCP) | < 1.5s |
| Largest Contentful Paint (LCP) | < 2.5s |
| Total Blocking Time (TBT) | < 200ms |
| Cumulative Layout Shift (CLS) | < 0.1 |
| Time to Interactive (TTI) | < 3.5s |

### Bundle Size Limits (angular.json)
```json
{
  "budgets": [
    { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
    { "type": "anyComponentStyle", "maximumWarning": "2kb", "maximumError": "4kb" }
  ]
}
```

---

## Security Implementation

### Auth Guard
```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
    canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
        if (!this.authService.isAuthenticated()) {
            return this.router.createUrlTree(['/login']);
        }
        return true;
    }
}
```

### JWT Handling
- Tokens stored in **HTTP-only cookies** (never `localStorage` or `sessionStorage`)
- CSRF protection via `X-XSRF-TOKEN` header on state-changing requests
- Token expiry check on every route navigation
- Silent refresh before expiry via backend `/api/v1/auth/refresh`

### Content Security Policy Headers (served by Nginx)
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' app.powerbi.com;
  frame-src app.powerbi.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
```

---

## Build & Deployment

### Build Configurations

| Configuration | Command | Optimizations |
|---|---|---|
| Development | `ng serve` | Source maps, no minification |
| Dev Build | `ng build` | Source maps, basic optimization |
| Staging | `ng build --configuration=staging` | AOT, minification, no source maps |
| Production | `ng build --configuration=production` | AOT, full minification, tree-shaking, budgets |

### Nginx Configuration (Production)
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|woff2|png|jpg|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

---

*Document classification: Internal — Architecture*  
*Layer: Frontend | Version: 1.0 | Framework: Angular 17+*
