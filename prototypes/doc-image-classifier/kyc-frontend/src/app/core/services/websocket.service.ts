import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {
  private socket: WebSocket | null = null;
  private readonly _messages$ = new Subject<unknown>();

  readonly messages$: Observable<unknown> = this._messages$.asObservable();

  connect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    this.socket = new WebSocket(`${environment.wsUrl}/ws/kyc/stream`);

    this.socket.onmessage = (event) => {
      try {
        this._messages$.next(JSON.parse(event.data as string));
      } catch {
        this._messages$.next(event.data);
      }
    };

    this.socket.onerror = (err) => {
      console.error('[WebSocket] error', err);
    };

    this.socket.onclose = () => {
      this.socket = null;
    };
  }

  sendFrame(base64Frame: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ frame: base64Frame, timestamp: Date.now() }));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
