import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Massing dimensions in scene units (roughly metres).
const FLOORS = 24;
const VILLA_FROM = 21;
const FLOOR_H = 3.3;
const PODIUM = { w: 54, h: 10, d: 40 };
const TOWER = { w: 28, d: 18, z: -4 };
const VILLA = { w: 25, d: 15.5 };
const TOP_Y = PODIUM.h + FLOORS * FLOOR_H;

const DAY = {
  skyTop: new THREE.Color('#8fa7bb'),
  skyBottom: new THREE.Color('#e7e0d4'),
  hemiSky: new THREE.Color('#e6eef5'),
  hemiGround: new THREE.Color('#a59a88'),
  hemi: 0.9,
  sun: 2.4,
  sunColor: new THREE.Color('#fff3e2'),
  env: 0.75,
  glass: new THREE.Color('#5d7182'),
  window: 0,
  podiumGlow: 0,
  ground: new THREE.Color('#bdb5a7'),
  exposure: 0.9,
};

const NIGHT = {
  skyTop: new THREE.Color('#03050b'),
  skyBottom: new THREE.Color('#1b2436'),
  hemiSky: new THREE.Color('#2a3a5c'),
  hemiGround: new THREE.Color('#0d0d10'),
  hemi: 0.5,
  sun: 0.35,
  sunColor: new THREE.Color('#9fb4ff'),
  env: 0.16,
  glass: new THREE.Color('#1c2430'),
  window: 1.6,
  podiumGlow: 1.4,
  ground: new THREE.Color('#2a2a2e'),
  exposure: 1.05,
};

const GOLD = new THREE.Color('#c9a45c');

export function floorCenterY(floor) {
  return PODIUM.h + (floor - 0.5) * FLOOR_H;
}

function radialTexture(inner, outer, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function contactShadowTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// One canvas holds a band of windows per floor; each floor samples its own row.
function windowTexture() {
  const cols = 24;
  const rowH = 8;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = FLOORS * rowH;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cw = c.width / cols;
  for (let r = 0; r < FLOORS; r++) {
    for (let k = 0; k < cols; k++) {
      const lit = rnd() < 0.62;
      if (!lit) continue;
      const warm = 0.75 + rnd() * 0.25;
      const hue = rnd() < 0.15 ? [255, 236, 205] : [255, Math.round(190 * warm + 20), Math.round(110 * warm)];
      g.fillStyle = `rgb(${hue[0]},${hue[1]},${hue[2]})`;
      g.globalAlpha = 0.55 + rnd() * 0.45;
      g.fillRect(k * cw + 1, (FLOORS - 1 - r) * rowH + 1.5, cw - 2, rowH - 3);
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export class Tower {
  constructor(canvas, { onFloorClick, onFloorHover, onAmenityPosition } = {}) {
    this.canvas = canvas;
    this.onFloorClick = onFloorClick;
    this.onFloorHover = onFloorHover;
    this.onAmenityPosition = onAmenityPosition;
    this.night = 0; // 0 day, 1 night, animated
    this.nightTarget = 0;
    this.floorHighlights = new Map(); // floor -> 'match' | 'dim'
    this.selectedFloor = null;
    this.hoverFloor = null;
    this.dirty = true;
    this.running = true;
    this.inset = { right: 0, bottom: 0 };
    this.insetTarget = { right: 0, bottom: 0 };
    this.targetY = null;

    this.isMobile = Math.min(screen.width, screen.height) < 768;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.pixelRatio < 1.5,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(this.pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // the model is static, so shadows only render on change
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 2000);
    this.buildLights();
    this.buildGround();
    this.buildPodium();
    this.buildTower();
    this.buildControls();
    this.bindPointer();

    this.applyMood();
    this.resize();
    this.renderer.shadowMap.needsUpdate = true;

    this.clock = new THREE.Clock();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  /* ---------------- Scene ---------------- */

  buildLights() {
    this.hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(DAY.sunColor, DAY.sun);
    sun.position.set(70, 120, 60);
    sun.castShadow = true;
    const size = this.isMobile ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    const s = sun.shadow.camera;
    s.left = -70;
    s.right = 70;
    s.top = 110;
    s.bottom = -50;
    s.near = 20;
    s.far = 320;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 4;
    sun.target.position.set(0, 30, 0);
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  buildGround() {
    const tex = radialTexture('#ffffff', '#000000', 256);
    const mat = new THREE.MeshStandardMaterial({
      color: DAY.ground,
      roughness: 0.95,
      alphaMap: tex,
      transparent: true,
      depthWrite: false,
    });
    // alphaMap reads the green channel; the gradient goes from opaque centre to clear edge.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 64), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMat = mat;

    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(PODIUM.w * 1.7, PODIUM.d * 1.9),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.05;
    this.scene.add(contact);

    // A few paved paths and a drive court to give the model scale.
    const paveMat = new THREE.MeshStandardMaterial({ color: '#cbc2b3', roughness: 0.9 });
    const drive = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 34), paveMat);
    drive.position.set(0, 0.1, PODIUM.d / 2 + 17);
    drive.receiveShadow = true;
    this.scene.add(drive);
    this.paveMat = paveMat;
  }

  buildPodium() {
    const stone = new THREE.MeshStandardMaterial({ color: '#e9e3d8', roughness: 0.82, metalness: 0 });
    const dark = new THREE.MeshStandardMaterial({
      color: '#2a3138',
      roughness: 0.2,
      metalness: 0.6,
      emissive: new THREE.Color('#ffc983'),
      emissiveIntensity: 0,
    });
    this.stoneMat = stone;
    this.podiumGlassMat = dark;

    const g = new THREE.Group();
    // Stone base with two recessed glass bands (retail and amenity levels).
    const base = new THREE.Mesh(new THREE.BoxGeometry(PODIUM.w, PODIUM.h, PODIUM.d), stone);
    base.position.y = PODIUM.h / 2;
    const bands = [];
    for (const y of [2.6, 7.2]) {
      const band = new THREE.BoxGeometry(PODIUM.w + 0.25, 2.4, PODIUM.d + 0.25);
      band.translate(0, y, 0);
      bands.push(band);
    }
    const bandMesh = new THREE.Mesh(mergeGeometries(bands), dark);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(PODIUM.w + 1, 0.6, PODIUM.d + 1), stone);
    cap.position.y = PODIUM.h + 0.3;
    // Entrance canopy.
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 6), stone);
    canopy.position.set(0, 4.6, PODIUM.d / 2 + 3);
    for (const m of [base, bandMesh, cap, canopy]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    // Landscaped podium roof: lawn beds, a pool and trees.
    const lawnMat = new THREE.MeshStandardMaterial({ color: '#7d9a6a', roughness: 1 });
    const waterMat = new THREE.MeshStandardMaterial({ color: '#6fa3b5', roughness: 0.08, metalness: 0.3 });
    this.lawnMat = lawnMat;
    const top = PODIUM.h + 0.6;
    const beds = [
      [PODIUM.w - 6, 5.5, 0, PODIUM.d / 2 - 4.6],
      [9, 14, -PODIUM.w / 2 + 6.5, 2],
      [9, 14, PODIUM.w / 2 - 6.5, 2],
    ];
    const bedGeos = beds.map(([w, d, x, z]) => {
      const geo = new THREE.BoxGeometry(w, 0.7, d);
      geo.translate(x, top + 0.35, z);
      return geo;
    });
    const lawn = new THREE.Mesh(mergeGeometries(bedGeos), lawnMat);
    lawn.receiveShadow = true;
    lawn.castShadow = true;
    g.add(lawn);

    const pool = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 5), waterMat);
    pool.position.set(-8, top + 0.15, PODIUM.d / 2 - 11.5);
    g.add(pool);

    const trees = [
      [-22, 14], [-14, 15.5], [-6, 14.5], [4, 15.5], [12, 14.4], [21, 15.2],
      [-22.5, -2], [-22, 6], [22.5, -2], [22, 6], [-22, -12], [22, -12],
    ];
    const crownGeo = new THREE.IcosahedronGeometry(1.7, 1);
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6);
    const crownMat = new THREE.MeshStandardMaterial({ color: '#5f7d52', roughness: 0.95, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 1 });
    this.crownMat = crownMat;
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, trees.length);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const m = new THREE.Matrix4();
    trees.forEach(([x, z], i) => {
      const s = 0.8 + ((i * 37) % 10) / 22;
      m.compose(new THREE.Vector3(x, top + 2.6 * s + 0.8, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 1.1, s));
      crowns.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, top + 1.5, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      trunks.setMatrixAt(i, m);
    });
    crowns.castShadow = trunks.castShadow = true;
    crowns.receiveShadow = true;
    g.add(crowns, trunks);

    // Ground level trees along the drive.
    const gTrees = [[-14, 30], [14, 30], [-14, 42], [14, 42], [-30, 26], [30, 26]];
    const gCrowns = new THREE.InstancedMesh(crownGeo, crownMat, gTrees.length);
    const gTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, gTrees.length);
    gTrees.forEach(([x, z], i) => {
      m.compose(new THREE.Vector3(x, 3.6, z), new THREE.Quaternion(), new THREE.Vector3(1.3, 1.5, 1.3));
      gCrowns.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 1.2, z), new THREE.Quaternion(), new THREE.Vector3(1.4, 1.5, 1.4));
      gTrunks.setMatrixAt(i, m);
    });
    gCrowns.castShadow = gTrunks.castShadow = true;
    g.add(gCrowns, gTrunks);

    this.scene.add(g);
    this.amenityAnchor = new THREE.Vector3(-8, top + 3, PODIUM.d / 2 - 9);
  }

  buildTower() {
    this.windowTex = windowTexture();
    this.floorMeshes = [];
    this.floorGlassMats = [];
    this.overlays = [];
    const slabGeos = [];
    const finGeos = [];
    const railGeos = [];

    const glassBase = new THREE.MeshPhysicalMaterial({
      color: DAY.glass,
      metalness: 0.35,
      roughness: 0.08,
      envMapIntensity: 1.1,
      clearcoat: 0.4,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0,
    });

    const overlayGeo = new THREE.BoxGeometry(TOWER.w + 1.2, FLOOR_H - 0.05, TOWER.d + 1.2);

    for (let f = 1; f <= FLOORS; f++) {
      const villa = f >= VILLA_FROM;
      const w = villa ? VILLA.w : TOWER.w;
      const d = villa ? VILLA.d : TOWER.d;
      const y0 = PODIUM.h + (f - 1) * FLOOR_H;

      const mat = glassBase.clone();
      const em = this.windowTex.clone();
      em.repeat.set(1, 1 / FLOORS);
      em.offset.set(f * 0.137, (f - 1) / FLOORS);
      em.needsUpdate = true;
      mat.emissiveMap = em;
      this.floorGlassMats.push(mat);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, FLOOR_H - 0.42, d - 0.6), mat);
      glass.position.set(0, y0 + FLOOR_H / 2 + 0.05, TOWER.z);
      glass.castShadow = true;
      glass.receiveShadow = true;
      glass.userData.floor = f;
      glass.name = `floor-${f}`;
      this.scene.add(glass);
      this.floorMeshes.push(glass);

      // Slab edge (light stone) at the top of each floor. Sky villas get deep terraces.
      const slabW = villa ? TOWER.w + 0.6 : w + 0.5;
      const slabD = villa ? TOWER.d + 0.6 : d + 0.5;
      const slab = new THREE.BoxGeometry(slabW, 0.42, slabD);
      slab.translate(0, y0 + FLOOR_H - 0.21 + 0.05, TOWER.z);
      slabGeos.push(slab);
      if (villa) {
        // Glass balustrade around the terrace.
        const r = new THREE.BoxGeometry(TOWER.w + 0.4, 1.0, TOWER.d + 0.4);
        r.translate(0, y0 + 0.55, TOWER.z);
        railGeos.push(r);
      }

      const overlay = new THREE.Mesh(
        overlayGeo,
        new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false })
      );
      overlay.position.set(0, y0 + FLOOR_H / 2 + 0.05, TOWER.z);
      overlay.visible = false;
      overlay.userData.floor = f;
      overlay.renderOrder = 2;
      this.scene.add(overlay);
      this.overlays.push(overlay);
    }

    // Base slab at podium level.
    const baseSlab = new THREE.BoxGeometry(TOWER.w + 0.5, 0.5, TOWER.d + 0.5);
    baseSlab.translate(0, PODIUM.h + 0.25, TOWER.z);
    slabGeos.push(baseSlab);

    // Vertical stone fins on the long faces (Type A floors) for an architectural rhythm.
    const finH = (VILLA_FROM - 1) * FLOOR_H;
    const finY = PODIUM.h + finH / 2;
    const step = 3.5;
    for (let x = -TOWER.w / 2 + 0.1; x <= TOWER.w / 2 - 0.05; x += step) {
      for (const z of [TOWER.d / 2 + 0.2, -TOWER.d / 2 - 0.2]) {
        const fin = new THREE.BoxGeometry(0.32, finH, 0.7);
        fin.translate(x, finY, TOWER.z + z);
        finGeos.push(fin);
      }
    }
    for (let z = -TOWER.d / 2 + 0.1; z <= TOWER.d / 2; z += step) {
      for (const x of [TOWER.w / 2 + 0.2, -TOWER.w / 2 - 0.2]) {
        const fin = new THREE.BoxGeometry(0.7, finH, 0.32);
        fin.translate(x, finY, TOWER.z + z);
        finGeos.push(fin);
      }
    }
    // Corner piers run the full height.
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const pier = new THREE.BoxGeometry(1.4, FLOORS * FLOOR_H + 4, 1.4);
      pier.translate((x * (TOWER.w + 0.6)) / 2, PODIUM.h + (FLOORS * FLOOR_H + 4) / 2, TOWER.z + (z * (TOWER.d + 0.6)) / 2);
      finGeos.push(pier);
    }

    // Crown: a stone frame with a pergola over the rooftop.
    const crownY = TOP_Y + 0.05;
    const crownParts = [];
    const frameW = TOWER.w + 0.6;
    const frameD = TOWER.d + 0.6;
    const beam = (w, h, d, x, y, z) => {
      const b = new THREE.BoxGeometry(w, h, d);
      b.translate(x, y, z);
      crownParts.push(b);
    };
    beam(frameW, 1.0, 1.4, 0, crownY + 4, TOWER.z + frameD / 2 - 0.7);
    beam(frameW, 1.0, 1.4, 0, crownY + 4, TOWER.z - frameD / 2 + 0.7);
    beam(1.4, 1.0, frameD, frameW / 2 - 0.7, crownY + 4, TOWER.z);
    beam(1.4, 1.0, frameD, -frameW / 2 + 0.7, crownY + 4, TOWER.z);
    for (let x = -frameW / 2 + 3; x < frameW / 2 - 2; x += 2.4) beam(0.3, 0.5, frameD - 1.4, x, crownY + 4.1, TOWER.z);
    beam(10, 3.4, 7, 4, crownY + 1.7, TOWER.z - 2); // services core

    const stone = this.stoneMat;
    const slabs = new THREE.Mesh(mergeGeometries(slabGeos), stone);
    const fins = new THREE.Mesh(mergeGeometries(finGeos), stone);
    const crown = new THREE.Mesh(mergeGeometries(crownParts), stone);
    for (const mesh of [slabs, fins, crown]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    const railMat = new THREE.MeshPhysicalMaterial({
      color: '#bcd0d8',
      transparent: true,
      opacity: 0.32,
      roughness: 0.05,
      metalness: 0.2,
      depthWrite: false,
    });
    const rails = new THREE.Mesh(mergeGeometries(railGeos), railMat);
    rails.renderOrder = 1;
    this.scene.add(rails);
  }

  buildControls() {
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.autoRotate = true;
    c.autoRotateSpeed = 0.55;
    c.rotateSpeed = 0.7;
    c.zoomSpeed = 0.8;
    c.minPolarAngle = 0.12 * Math.PI;
    c.maxPolarAngle = 0.5 * Math.PI - 0.04;
    c.target.set(0, TOP_Y * 0.5, TOWER.z * 0.5);
    c.addEventListener('change', () => (this.dirty = true));
    c.addEventListener('start', () => {
      c.autoRotate = false;
      clearTimeout(this.idleTimer);
    });
    c.addEventListener('end', () => this.scheduleAutoRotate());
    this.controls = c;
    this.camera.position.set(110, 70, 160);
  }

  scheduleAutoRotate() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.selectedFloor) this.controls.autoRotate = true;
    }, 9000);
  }

  /* ---------------- Interaction ---------------- */

  bindPointer() {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;

    const pick = (e) => {
      const r = this.canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, this.camera);
      // Overlays are slightly larger than the glass so slabs and fins count as the floor too.
      const hit = ray.intersectObjects(this.overlays, false)[0];
      return hit ? hit.object.userData.floor : null;
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.onFloorHover?.(null);
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 600;
      down = null;
      if (moved > 8 || !quick) return;
      const floor = pick(e);
      if (floor) this.onFloorClick?.(floor);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const floor = pick(e);
      if (floor !== this.hoverFloor) {
        this.hoverFloor = floor;
        this.canvas.style.cursor = floor ? 'pointer' : 'grab';
        this.updateHighlights();
      }
      this.onFloorHover?.(floor, e.clientX, e.clientY);
    });
    this.canvas.addEventListener('pointerleave', () => {
      if (this.hoverFloor) {
        this.hoverFloor = null;
        this.updateHighlights();
      }
      this.onFloorHover?.(null);
    });
  }

  /* ---------------- Public API ---------------- */

  setNight(on) {
    this.nightTarget = on ? 1 : 0;
    this.updateHighlights();
    this.dirty = true;
  }

  // states: Map floor -> true when it matches the active filters. Null clears filtering.
  setFilterMatches(states) {
    this.filterMatches = states;
    this.updateHighlights();
  }

  selectFloor(floor) {
    this.selectedFloor = floor;
    if (floor) {
      this.controls.autoRotate = false;
      this.targetY = THREE.MathUtils.clamp(floorCenterY(floor), TOP_Y * 0.3, TOP_Y * 0.75);
    } else {
      this.targetY = TOP_Y * 0.5;
      this.scheduleAutoRotate();
    }
    this.updateHighlights();
  }

  // Keeps the tower centred in the area not covered by the side panel or bottom sheet.
  setInset(right, bottom) {
    this.insetTarget = { right, bottom };
    this.dirty = true;
  }

  setActive(active) {
    this.running = active;
    if (active) {
      this.dirty = true;
      requestAnimationFrame(this.frame);
    }
  }

  updateHighlights() {
    const filtering = this.filterMatches instanceof Map;
    this.overlays.forEach((o) => {
      const f = o.userData.floor;
      let opacity = 0;
      if (filtering && this.filterMatches.get(f)) opacity = 0.32 + 0.2 * this.nightTarget;
      if (f === this.hoverFloor) opacity = Math.max(opacity, 0.26);
      if (f === this.selectedFloor) opacity = 0.58;
      o.userData.base = opacity;
      o.material.opacity = opacity;
      o.visible = opacity > 0;
    });
    this.dirty = true;
  }

  /* ---------------- Loop ---------------- */

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Fit the full tower: distance driven by height on wide screens and by width on tall ones.
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const byHeight = (TOP_Y * 0.62) / Math.tan(vFov / 2);
    const byWidth = (PODIUM.w * 0.85) / Math.tan(hFov / 2);
    const fit = Math.max(byHeight, byWidth);
    this.controls.minDistance = fit * 0.45;
    this.controls.maxDistance = fit * 1.35;
    if (!this.fitted) {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this.camera.position.copy(this.controls.target).addScaledVector(dir, fit * 1.02);
      this.fitted = true;
    }
    this.applyViewOffset();
    this.dirty = true;
  }

  applyViewOffset() {
    const { w, h } = this.size;
    const { right, bottom } = this.inset;
    if (right < 0.5 && bottom < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, right / 2, bottom / 2, w, h);
    this.camera.updateProjectionMatrix();
  }

  applyMood() {
    const t = this.night;
    const L = (a, b) => a + (b - a) * t;
    const C = (a, b, out) => out.copy(a).lerp(b, t);
    this.hemi.intensity = L(DAY.hemi, NIGHT.hemi);
    C(DAY.hemiSky, NIGHT.hemiSky, this.hemi.color);
    C(DAY.hemiGround, NIGHT.hemiGround, this.hemi.groundColor);
    this.sun.intensity = L(DAY.sun, NIGHT.sun);
    C(DAY.sunColor, NIGHT.sunColor, this.sun.color);
    this.scene.environmentIntensity = L(DAY.env, NIGHT.env);
    this.renderer.toneMappingExposure = L(DAY.exposure, NIGHT.exposure);
    const glass = new THREE.Color();
    C(DAY.glass, NIGHT.glass, glass);
    for (const m of this.floorGlassMats) {
      m.color.copy(glass);
      m.emissiveIntensity = L(DAY.window, NIGHT.window);
    }
    this.podiumGlassMat.emissiveIntensity = L(DAY.podiumGlow, NIGHT.podiumGlow);
    C(DAY.ground, NIGHT.ground, this.groundMat.color);
    const top = new THREE.Color();
    const bottom = new THREE.Color();
    C(DAY.skyTop, NIGHT.skyTop, top);
    C(DAY.skyBottom, NIGHT.skyBottom, bottom);
    document.documentElement.style.setProperty('--sky-top', `#${top.getHexString()}`);
    document.documentElement.style.setProperty('--sky-bottom', `#${bottom.getHexString()}`);
    this.canvas.style.background = `linear-gradient(to bottom, #${top.getHexString()} 0%, #${bottom.getHexString()} 78%)`;
  }

  frame() {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const now = this.clock.elapsedTime;

    if (Math.abs(this.night - this.nightTarget) > 0.001) {
      this.night += (this.nightTarget - this.night) * Math.min(1, dt * 3.2);
      if (Math.abs(this.night - this.nightTarget) < 0.002) this.night = this.nightTarget;
      this.applyMood();
      this.dirty = true;
    }

    const ins = this.inset;
    const tgt = this.insetTarget;
    if (Math.abs(ins.right - tgt.right) > 0.5 || Math.abs(ins.bottom - tgt.bottom) > 0.5) {
      const k = Math.min(1, dt * 6);
      ins.right += (tgt.right - ins.right) * k;
      ins.bottom += (tgt.bottom - ins.bottom) * k;
      this.applyViewOffset();
      this.dirty = true;
    } else if (ins.right !== tgt.right || ins.bottom !== tgt.bottom) {
      this.inset = { ...tgt };
      this.applyViewOffset();
      this.dirty = true;
    }

    if (this.targetY !== null) {
      const ty = this.controls.target.y;
      const d = this.targetY - ty;
      if (Math.abs(d) > 0.05) {
        const step = d * Math.min(1, dt * 3);
        this.controls.target.y += step;
        this.camera.position.y += step;
        this.dirty = true;
      } else this.targetY = null;
    }

    // Gentle pulse on floors that match the filters.
    if (this.filterMatches instanceof Map) {
      const pulse = 0.75 + 0.25 * Math.sin(now * 2.6);
      for (const o of this.overlays) {
        if (o.visible && o.userData.floor !== this.selectedFloor && this.filterMatches.get(o.userData.floor)) {
          o.material.opacity = o.userData.base * pulse;
        }
      }
      this.dirty = true;
    }

    if (this.controls.update(dt)) this.dirty = true;
    if (this.controls.autoRotate) this.dirty = true;

    if (this.dirty) {
      // Never let the camera dip below the ground plane.
      if (this.camera.position.y < 3) this.camera.position.y = 3;
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      this.emitAmenityPosition();
    }
  }

  emitAmenityPosition() {
    if (!this.onAmenityPosition) return;
    const p = this.amenityAnchor.clone().project(this.camera);
    const { w, h } = this.size;
    const x = (p.x * 0.5 + 0.5) * w;
    const y = (-p.y * 0.5 + 0.5) * h;
    // Hide the marker when the tower sits between it and the camera.
    this._occl = (this._occl || 0) + 1;
    if (this._occl % 6 === 0 || this._hidden === undefined) {
      const ray = new THREE.Raycaster();
      const dir = this.amenityAnchor.clone().sub(this.camera.position);
      const dist = dir.length();
      ray.set(this.camera.position, dir.normalize());
      ray.far = dist - 1;
      this._hidden = ray.intersectObjects(this.floorMeshes, false).length > 0;
    }
    this.onAmenityPosition(x, y, p.z < 1 && !this._hidden);
  }
}
