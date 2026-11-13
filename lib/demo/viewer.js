import * as THREE from 'three';
import { config, url, isSmallScreen } from './config.js';

const DEG = Math.PI / 180;
const FOV_MIN = 35;
// Portrait phones need a wider vertical FOV or the room feels cramped.
const portrait = () => window.innerHeight > window.innerWidth;
const fovMax = () => (portrait() ? 105 : 90);
const fovDefault = () => (portrait() ? 92 : 75);

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';

// yaw 0 is the centre of the equirectangular image, positive to the right; pitch positive is up.
function dirFromYawPitch(yaw, pitch, out = new THREE.Vector3()) {
  const phi = Math.PI + yaw * DEG;
  const p = pitch * DEG;
  return out.set(Math.cos(phi) * Math.cos(p), Math.sin(p), Math.sin(phi) * Math.cos(p));
}

function yawPitchFromDir(v) {
  let yaw = (Math.atan2(v.z, v.x) - Math.PI) / DEG;
  while (yaw <= -180) yaw += 360;
  while (yaw > 180) yaw -= 360;
  return { yaw, pitch: Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)) / DEG };
}

export class PanoViewer {
  constructor(root, { onRoomChange, onClose, canEnterRoom, onTourLink } = {}) {
    this.root = root;
    this.onRoomChange = onRoomChange;
    this.onClose = onClose;
    this.onTourLink = onTourLink;
    this.canEnterRoom = canEnterRoom || (() => true);
    this.canvas = root.querySelector('#viewer-canvas');
    this.hotspotLayer = root.querySelector('#viewer-hotspots');
    this.fadeEl = root.querySelector('#viewer-fade');
    this.loaderEl = root.querySelector('#viewer-loader');
    this.hintEl = root.querySelector('#viewer-hint');
    this.roomsEl = root.querySelector('#viewer-rooms');
    this.gyroBtn = root.querySelector('#btn-gyro');
    this.devEl = root.querySelector('#dev-readout');
    this.errorEl = document.createElement('div');
    this.errorEl.className = 'viewer-error';
    this.errorEl.hidden = true;
    this.errorEl.setAttribute('role', 'alert');
    this.errorEl.innerHTML = '<p>This view could not load. Your place in the visit is saved.</p><button class="btn btn-gold" type="button" data-retry>Try view again</button><button class="btn btn-ghost" type="button" data-back>Return to residences</button>';
    root.appendChild(this.errorEl);
    this.errorEl.querySelector('[data-retry]').addEventListener('click', () => this.go(this.failedRoom, { initial: !this.room }));
    this.errorEl.querySelector('[data-back]').addEventListener('click', () => this.close());

    this.yaw = 0;
    this.pitch = 0;
    this.fov = fovDefault();
    this.vel = { yaw: 0, pitch: 0 };
    this.open = false;
    this.cache = new Map(); // file -> texture (kept small)
    this.gyro = { on: false, offset: 0, quat: new THREE.Quaternion(), data: null };

    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
    this.maxTex = renderer.capabilities.maxTextureSize;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    const geo = new THREE.SphereGeometry(50, 64, 32);
    geo.scale(-1, 1, 1);
    this.spheres = [0, 1].map((i) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: i === 0 ? 1 : 0, depthWrite: false }));
      m.renderOrder = i;
      m.visible = false;
      this.scene.add(m);
      return m;
    });
    this.front = 0;

    this.bindInput();
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', () => this.open && this.resize());
    root.querySelector('#btn-viewer-close').addEventListener('click', () => this.close());

    if (config.dev) this.devEl.hidden = false;
  }

  /* ---------- Tours ---------- */

  // Also used to jump between tours while open (for example lobby to apartment).
  start(tour, roomId) {
    const wasOpen = this.open;
    this.tour = tour;
    this.tourId = tour.id;
    this.root.hidden = false;
    this.open = true;
    this.root.querySelector('#viewer-tour').textContent = tour.title;
    this.renderRooms();
    if (!wasOpen) {
      this.hintEl.classList.remove('is-hidden');
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => this.hintEl.classList.add('is-hidden'), 3500);
      this.resize();
      this.setupGyroButton();
      requestAnimationFrame(this.frame);
    }
    this.go(roomId || tour.rooms[0].id, { initial: !wasOpen });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.loadVersion = (this.loadVersion || 0) + 1;
    this.textureGeneration = (this.textureGeneration || 0) + 1;
    this.loading = false;
    this.fadeEl.classList.remove('is-on');
    this.loaderEl.hidden = true;
    this.errorEl.hidden = true;
    this.root.hidden = true;
    this.disableGyro();
    this.hotspotLayer.innerHTML = '';
    this.room = null;
    for (const s of this.spheres) s.visible = false;
    // Free GPU memory; the browser keeps the files in its HTTP cache.
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
    this.onClose?.();
  }

  renderRooms() {
    this.roomsEl.innerHTML = this.tour.rooms
      .map(
        (r) => `<button class="room-thumb" role="tab" type="button" data-room="${r.id}" aria-selected="false">
          <img src="${url(`assets/thumbs/${r.file}`)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
          <span>${r.label}</span>
        </button>`
      )
      .join('');
    this.roomsEl.querySelectorAll('.room-thumb').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.room)));
  }

  panoUrl(file) {
    const mobile = isSmallScreen() || this.maxTex < 4096;
    return url(`assets/${mobile ? 'panos-mobile' : 'panos'}/${file}`);
  }

  loadTexture(file) {
    if (this.cache.has(file)) return Promise.resolve(this.cache.get(file));
    const generation = this.textureGeneration || 0;
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        this.panoUrl(file),
        (tex) => {
          if (generation !== (this.textureGeneration || 0) || !this.open) { tex.dispose(); reject(new Error('View closed')); return; }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
          // Keep at most three textures alive to stay light on phones.
          if (this.cache.size >= 3) {
            const oldest = [...this.cache.keys()].find(key => key !== this.room?.file);
            if (oldest) {
              this.cache.get(oldest).dispose();
              this.cache.delete(oldest);
            }
          }
          this.cache.set(file, tex);
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  async go(roomId, { initial = false } = {}) {
    const room = this.tour.rooms.find((r) => r.id === roomId);
    if (!room || room === this.room) return;
    if (!initial && !this.canEnterRoom(room)) return;
    this.errorEl.hidden = true;
    const version = this.loadVersion = (this.loadVersion || 0) + 1;
    this.loading = true;
    const loaderTimer = setTimeout(() => {if(version===this.loadVersion&&this.open)this.loaderEl.hidden = false;}, 120);
    let tex;
    try {
      tex = await this.loadTexture(room.file);
    } catch (e) {
      clearTimeout(loaderTimer);
      if(version!==this.loadVersion)return;
      console.error('Could not load pano', room.file, e);
      this.loaderEl.hidden = true;
      this.loading = false;
      this.fadeEl.classList.remove('is-on');
      this.failedRoom = roomId;
      this.errorEl.hidden = false;
      this.onRoomChange?.(room, { error: true });
      return;
    }
    clearTimeout(loaderTimer);
    if(version!==this.loadVersion)return;
    this.loaderEl.hidden = true;
    if (!this.open) {
      this.loading = false;
      return;
    }

    const prev = this.room;
    if (prev) {
      this.fadeEl.classList.add('is-on');
      await new Promise(resolve => setTimeout(resolve, 220));
      if (version !== this.loadVersion || !this.open) return;
    }
    this.room = room;
    this.hotspotLayer.innerHTML = '';
    this.roomsEl.querySelectorAll('.room-thumb').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.room === room.id)));
    this.roomsEl.querySelector(`[data-room="${room.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    this.root.querySelector('#viewer-room').textContent = room.label;

    const back = this.spheres[1 - this.front];
    back.material.map = tex;
    back.material.opacity = 0;
    back.material.needsUpdate = true;
    back.visible = true;
    back.renderOrder = 2;
    this.spheres[this.front].renderOrder = 1;

    // Reset the view to the room's preferred starting direction.
    const setView = () => {
      this.yaw = room.initialYaw ?? 0;
      this.pitch = room.initialPitch ?? 0;
      this.fov = fovDefault();
      this.vel.yaw = this.vel.pitch = 0;
      if (this.gyro.on) this.gyro.recalibrate = true;
    };

    setView();
    this.fadeEl.classList.remove('is-on');
    back.material.opacity = 1;
    this.finishSwap(back);
    this.buildHotspots();
    this.loading = false;
    this.onRoomChange?.(room, { initial });
  }

  finishSwap(back) {
    const old = this.spheres[this.front];
    old.visible = false;
    this.front = 1 - this.front;
    back.renderOrder = 0;
  }

  buildHotspots() {
    this.hotspots = (this.room.hotspots || []).map((h) => {
      // A hotspot without "to" is an information label (for example a landmark in the aerial view).
      const el = document.createElement(h.to ? 'button' : 'div');
      el.className = h.to ? 'pano-hotspot' : 'pano-hotspot is-info';
      el.innerHTML = h.to ? `<span class="ring">${ARROW}</span><span class="lbl">${h.label}</span>` : `<span class="pin"></span><span class="lbl">${h.label}</span>`;
      if (h.to) {
        el.type = 'button';
        el.setAttribute('aria-label', `Go to ${h.label}`);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          // "tour" links into another tour, for example from the lobby into an apartment.
          if (h.tour && h.tour !== this.tourId) this.onTourLink?.(h.tour, h.to);
          else this.go(h.to);
        });
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
      }
      this.hotspotLayer.appendChild(el);
      return { el, dir: dirFromYawPitch(h.yaw, h.pitch) };
    });
  }

  /* ---------- Input ---------- */

  bindInput() {
    const c = this.canvas;
    const pointers = new Map();
    let last = null;
    let pinch = null;
    let downAt = null;

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        last = { x: e.clientX, y: e.clientY, t: performance.now() };
        downAt = { x: e.clientX, y: e.clientY };
        this.vel.yaw = this.vel.pitch = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: this.fov };
      }
      this.hintEl.classList.add('is-hidden');
    });

    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) {
        if (config.dev) this.updateDevReadout(e);
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.fov = THREE.MathUtils.clamp(pinch.fov * (pinch.d / d), FOV_MIN, fovMax());
        return;
      }
      if (pointers.size !== 1 || !last) return;
      const now = performance.now();
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      // Degrees per pixel scale with zoom so dragging feels the same at every FOV.
      const k = this.fov / c.clientHeight;
      this.yaw -= dx * k;
      this.pitch += dy * k;
      const dt = Math.max(1, now - last.t);
      this.vel.yaw = (-dx * k) / dt * 16;
      this.vel.pitch = (dy * k) / dt * 16;
      last = { x: e.clientX, y: e.clientY, t: now };
      if (config.dev) this.updateDevReadout(e);
    });

    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        if (last && performance.now() - last.t > 80) this.vel.yaw = this.vel.pitch = 0;
        last = null;
        if (config.dev && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5) this.devPick(e);
        downAt = null;
      } else {
        const [p] = [...pointers.values()];
        last = { x: p.x, y: p.y, t: performance.now() };
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.fov = THREE.MathUtils.clamp(this.fov + e.deltaY * 0.04, FOV_MIN, fovMax());
      },
      { passive: false }
    );

    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if(e.target.closest('input,textarea,[role="dialog"],.voice-panel'))return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.yaw -= 6;
      if (e.key === 'ArrowRight') this.yaw += 6;
      if (e.key === 'ArrowUp') this.pitch += 4;
      if (e.key === 'ArrowDown') this.pitch -= 4;
    });
  }

  pointerDir(e) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, 0.5);
    return v.unproject(this.camera).normalize();
  }

  updateDevReadout(e) {
    const { yaw, pitch } = yawPitchFromDir(this.pointerDir(e));
    this.devEl.textContent = `dev  room: ${this.room?.id || ''}  pointer yaw ${yaw.toFixed(1)}  pitch ${pitch.toFixed(1)}  |  view yaw ${this.yaw.toFixed(1)}  pitch ${this.pitch.toFixed(1)}`;
  }

  devPick(e) {
    const { yaw, pitch } = yawPitchFromDir(this.pointerDir(e));
    const snippet = `{ "to": "ROOM_ID", "label": "Label", "yaw": ${yaw.toFixed(1)}, "pitch": ${pitch.toFixed(1)} }`;
    console.log(`[dev] ${this.room?.id}  yaw ${yaw.toFixed(1)}  pitch ${pitch.toFixed(1)}\n${snippet}`);
    navigator.clipboard?.writeText(snippet).then(
      () => window.dispatchEvent(new CustomEvent('toast', { detail: `Copied yaw ${yaw.toFixed(1)}, pitch ${pitch.toFixed(1)}` })),
      () => window.dispatchEvent(new CustomEvent('toast', { detail: `yaw ${yaw.toFixed(1)}, pitch ${pitch.toFixed(1)} (see console)` }))
    );
  }

  /* ---------- Gyroscope ---------- */

  setupGyroButton() {
    const touch = matchMedia('(pointer: coarse)').matches;
    const supported = 'DeviceOrientationEvent' in window && touch;
    this.gyroBtn.hidden = !supported;
    if (this.gyroBound) return;
    this.gyroBound = true;
    this.onOrient = (e) => {
      if (e.alpha == null) return;
      this.gyro.data = e;
    };
    this.gyroBtn.addEventListener('click', async () => {
      if (this.gyro.on) return this.disableGyro();
      try {
        const D = window.DeviceOrientationEvent;
        if (typeof D.requestPermission === 'function') {
          const res = await D.requestPermission();
          if (res !== 'granted') throw new Error('denied');
        }
        window.addEventListener('deviceorientation', this.onOrient);
        this.gyro.on = true;
        this.gyro.recalibrate = true;
        this.gyroBtn.setAttribute('aria-pressed', 'true');
        // If no events arrive (desktop, iframe without permission), turn it back off.
        setTimeout(() => {
          if (this.gyro.on && !this.gyro.data) {
            this.disableGyro();
            window.dispatchEvent(new CustomEvent('toast', { detail: 'Motion is not available here. Drag to look around.' }));
          }
        }, 1500);
      } catch {
        window.dispatchEvent(new CustomEvent('toast', { detail: 'Motion access was not allowed. Drag to look around.' }));
      }
    });
  }

  disableGyro() {
    window.removeEventListener('deviceorientation', this.onOrient);
    this.gyro.on = false;
    this.gyro.data = null;
    this.gyroBtn.setAttribute('aria-pressed', 'false');
  }

  // Converts device orientation into a look direction (same maths as three's old DeviceOrientationControls).
  gyroDirection() {
    const { alpha, beta, gamma } = this.gyro.data;
    const orient = (screen.orientation?.angle ?? window.orientation ?? 0) * DEG;
    const euler = new THREE.Euler(beta * DEG, alpha * DEG, -gamma * DEG, 'YXZ');
    const q = this.gyro.quat.setFromEuler(euler);
    q.multiply(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient));
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  }

  /* ---------- Loop ---------- */

  resize() {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame() {
    if (!this.open) return;
    requestAnimationFrame(this.frame);

    if (this.gyro.on && this.gyro.data) {
      const d = this.gyroDirection();
      const g = yawPitchFromDir(d);
      if (this.gyro.recalibrate) {
        this.gyro.offset = this.yaw - g.yaw;
        this.gyro.recalibrate = false;
      }
      this.yaw = g.yaw + this.gyro.offset;
      this.pitch = g.pitch;
    } else if (Math.abs(this.vel.yaw) + Math.abs(this.vel.pitch) > 0.001) {
      this.yaw += this.vel.yaw;
      this.pitch += this.vel.pitch;
      this.vel.yaw *= 0.92;
      this.vel.pitch *= 0.92;
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch, -85, 85);
    if (this.camera.fov !== this.fov) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    const dir = dirFromYawPitch(this.yaw, this.pitch);
    this.camera.lookAt(dir);
    this.renderer.render(this.scene, this.camera);
    this.placeHotspots();
  }

  placeHotspots() {
    if (!this.hotspots) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    const p = new THREE.Vector3();
    for (const hs of this.hotspots) {
      if (hs.dir.dot(fwd) < 0.1) {
        hs.el.style.visibility = 'hidden';
        continue;
      }
      p.copy(hs.dir).project(this.camera);
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (-p.y * 0.5 + 0.5) * h;
      hs.el.style.visibility = 'visible';
      hs.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -22px)`;
    }
  }
}
