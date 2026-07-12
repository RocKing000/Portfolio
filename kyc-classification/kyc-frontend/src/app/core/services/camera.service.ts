import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';
export type CameraFacing = 'front' | 'rear';

@Injectable({ providedIn: 'root' })
export class CameraService implements OnDestroy {
  readonly stream$ = new BehaviorSubject<MediaStream | null>(null);
  readonly permissionStatus$ = new BehaviorSubject<PermissionStatus>('prompt');
  readonly activeCamera$ = new BehaviorSubject<CameraFacing>('rear');

  /** Offscreen canvas used for frame capture — never shown in DOM */
  private readonly _offscreen = document.createElement('canvas');
  private readonly _offCtx = this._offscreen.getContext('2d')!;

  // ── Permission ────────────────────────────────────────────────────────────

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(t => t.stop());
      this.permissionStatus$.next('granted');
      return true;
    } catch {
      this.permissionStatus$.next('denied');
      return false;
    }
  }

  // ── Camera start/stop ─────────────────────────────────────────────────────

  async startCamera(
    videoElement: HTMLVideoElement,
    facingMode: 'user' | 'environment' = 'environment'
  ): Promise<void> {
    this.stopCamera();

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream$.next(stream);
      this.activeCamera$.next(facingMode === 'user' ? 'front' : 'rear');

      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', '');
      videoElement.setAttribute('muted', '');

      await videoElement.play();
      this.permissionStatus$.next('granted');
    } catch (err) {
      if ((err as DOMException).name === 'NotAllowedError') {
        this.permissionStatus$.next('denied');
      }
      throw err;
    }
  }

  stopCamera(): void {
    const stream = this.stream$.value;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      this.stream$.next(null);
    }
  }

  async switchCamera(): Promise<void> {
    const current = this.activeCamera$.value;
    const nextFacing = current === 'rear' ? 'user' : 'environment';
    const stream = this.stream$.value;
    const videoEl = stream
      ? (document.querySelector('video[playsinline]') as HTMLVideoElement | null)
      : null;

    if (videoEl) {
      await this.startCamera(videoEl, nextFacing);
    }
  }

  // ── Frame capture ─────────────────────────────────────────────────────────

  captureFrame(videoElement: HTMLVideoElement): Blob | null {
    if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

    this._offscreen.width  = videoElement.videoWidth;
    this._offscreen.height = videoElement.videoHeight;
    this._offCtx.drawImage(videoElement, 0, 0);

    // Synchronous capture — caller converts to blob asynchronously
    return null; // use captureFrameAsBlob for async
  }

  captureFrameAsBlob(videoElement: HTMLVideoElement): Promise<Blob | null> {
    return new Promise(resolve => {
      if (!videoElement.videoWidth || !videoElement.videoHeight) {
        resolve(null);
        return;
      }
      this._offscreen.width  = videoElement.videoWidth;
      this._offscreen.height = videoElement.videoHeight;
      this._offCtx.drawImage(videoElement, 0, 0);
      this._offscreen.toBlob(resolve, 'image/jpeg', 0.92);
    });
  }

  captureFrameAsBase64(videoElement: HTMLVideoElement): string | null {
    if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

    this._offscreen.width  = videoElement.videoWidth;
    this._offscreen.height = videoElement.videoHeight;
    this._offCtx.drawImage(videoElement, 0, 0);
    // strip the "data:image/jpeg;base64," prefix
    return this._offscreen.toDataURL('image/jpeg', 0.92).split(',')[1];
  }

  // ── Device enumeration ────────────────────────────────────────────────────

  async getSupportedCameras(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
