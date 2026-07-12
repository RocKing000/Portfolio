import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface WheelSection {
  label: string;
  icon: string;
  route: string;
  color: string;
  angle: number;
}

@Component({
  selector: 'app-spin-wheel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative" style="width:120px;height:120px">
      <!-- Outer ring glow -->
      <div class="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-blue-800
                  shadow-lg shadow-blue-500/30"></div>

      <svg viewBox="0 0 120 120" class="absolute inset-0 w-full h-full"
           style="transform: rotate({{rotationDeg}}deg); transition: transform 0.6s cubic-bezier(0.34,1.56,0.64,1)">
        <g *ngFor="let s of sections; let i = index">
          <path [attr.d]="sectorPath(i)"
                [attr.fill]="s.color"
                class="cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
                (click)="navigate(s)"
                style="stroke:#fff;stroke-width:1">
          </path>
          <text [attr.x]="iconPos(i).x" [attr.y]="iconPos(i).y"
                text-anchor="middle" dominant-baseline="central"
                style="font-size:12px;pointer-events:none;user-select:none">
            {{s.icon}}
          </text>
        </g>
        <!-- Centre button -->
        <circle cx="60" cy="60" r="18" fill="#1e3a5f" stroke="#fff" stroke-width="2"
                class="cursor-pointer" (click)="goHome()"/>
        <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
              style="font-size:18px;pointer-events:none">🏠</text>
      </svg>

      <!-- Active label bubble -->
      <div *ngIf="activeLabel"
           class="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap
                  bg-gray-800 text-white text-xs rounded px-2 py-0.5 shadow">
        {{activeLabel}}
      </div>
    </div>
  `,
})
export class SpinWheelComponent {
  rotationDeg = 0;
  activeLabel = '';

  sections: WheelSection[] = [
    { label: 'Dashboard',        icon: '📊', route: '/dashboard',    color: '#2563eb', angle: 0   },
    { label: 'Risk Prediction',  icon: '🤖', route: '/predictions',  color: '#7c3aed', angle: 45  },
    { label: 'Analytics',        icon: '📈', route: '/analytics',    color: '#0891b2', angle: 90  },
    { label: 'Flag Management',  icon: '🏷️', route: '/flags',        color: '#d97706', angle: 135 },
    { label: 'Alert Pools',      icon: '🎯', route: '/alert-pools',  color: '#dc2626', angle: 180 },
    { label: 'Hierarchy',        icon: '🌳', route: '/hierarchy',    color: '#059669', angle: 225 },
    { label: 'Reports',          icon: '📄', route: '/reports',      color: '#475569', angle: 270 },
    { label: 'Settings',         icon: '⚙️', route: '/settings',     color: '#64748b', angle: 315 },
  ];

  constructor(private router: Router) {}

  sectorPath(i: number): string {
    const n     = this.sections.length;
    const angle = (2 * Math.PI) / n;
    const start = i * angle - Math.PI / 2;
    const end   = start + angle;
    const r     = 58, cx = 60, cy = 60, ir = 20;
    const x1 = cx + r  * Math.cos(start), y1 = cy + r  * Math.sin(start);
    const x2 = cx + r  * Math.cos(end),   y2 = cy + r  * Math.sin(end);
    const x3 = cx + ir * Math.cos(end),   y3 = cy + ir * Math.sin(end);
    const x4 = cx + ir * Math.cos(start), y4 = cy + ir * Math.sin(start);
    return `M${x4},${y4} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} L${x3},${y3} A${ir},${ir} 0 0,0 ${x4},${y4} Z`;
  }

  iconPos(i: number): { x: number; y: number } {
    const n   = this.sections.length;
    const ang = ((2 * Math.PI) / n) * i + (Math.PI / n) - Math.PI / 2;
    const r   = 40;
    return { x: 60 + r * Math.cos(ang), y: 60 + r * Math.sin(ang) };
  }

  navigate(s: WheelSection) {
    this.rotationDeg += 360 / this.sections.length;
    this.activeLabel  = s.label;
    setTimeout(() => { this.activeLabel = ''; }, 1500);
    this.router.navigate([s.route]);
  }

  goHome() {
    this.rotationDeg = 0;
    this.router.navigate(['/dashboard']);
  }
}
