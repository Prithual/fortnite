import * as THREE from 'three';
import { soundManager } from '../audio/SoundSynthesizer.js';

export const WEAPON_TYPES = {
  pickaxe: {
    name: 'Harvesting Tool',
    rarity: 'common',
    damage: 20,
    structureDamage: 50,
    headshotMultiplier: 1.0,
    fireRate: 0.45,
    range: 3.5,
    ammo: Infinity,
    maxAmmo: Infinity
  },
  ar: {
    name: 'Assault Rifle (Scar)',
    rarity: 'legendary',
    damage: 34,
    structureDamage: 33,
    headshotMultiplier: 1.5,
    fireRate: 0.18,
    range: 220,
    bloom: 0.022,
    ammo: 30,
    maxAmmo: 30
  },
  shotgun: {
    name: 'Pump Shotgun',
    rarity: 'epic',
    damage: 95,
    pellets: 10,
    structureDamage: 75,
    headshotMultiplier: 2.0,
    fireRate: 0.85,
    range: 35,
    bloom: 0.065,
    ammo: 5,
    maxAmmo: 5
  },
  sniper: {
    name: 'Bolt-Action Sniper',
    rarity: 'legendary',
    damage: 116,
    structureDamage: 105,
    headshotMultiplier: 2.5,
    fireRate: 1.8,
    range: 400,
    bloom: 0.002,
    ammo: 1,
    maxAmmo: 1
  },
  mini_shield: {
    name: 'Small Shield Potion',
    rarity: 'uncommon',
    isConsumable: true,
    consumeTime: 2.0,
    amount: 25,
    maxCap: 50,
    count: 3
  },
  medkit: {
    name: 'Medkit',
    rarity: 'rare',
    isConsumable: true,
    consumeTime: 4.0,
    amount: 100,
    maxCap: 100,
    count: 1
  }
};

export class WeaponSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();

    this.inventory = ['pickaxe', 'ar', 'shotgun', 'sniper', 'mini_shield'];
    this.activeSlot = 0;
    this.lastFireTime = 0;
    this.isReloading = false;
    this.activeWeakpoint = null;
    this.ammoCounts = {
      ar: 30,
      shotgun: 5,
      sniper: 1
    };

    this.initWeakpointMesh();
  }

  initWeakpointMesh() {
    const geo = new THREE.RingGeometry(0.2, 0.35, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.weakpointMesh = new THREE.Mesh(geo, mat);
    this.weakpointMesh.visible = false;
    this.scene.add(this.weakpointMesh);
  }

  reload() {
    const w = this.getActiveWeapon();
    if (w.key === 'pickaxe' || w.isConsumable || this.isReloading) return;
    if (this.ammoCounts[w.key] >= w.maxAmmo) return;

    this.isReloading = true;
    soundManager.playReload();

    setTimeout(() => {
      this.ammoCounts[w.key] = w.maxAmmo;
      this.isReloading = false;
      const ammoEl = document.getElementById(`ammo-${w.key}`);
      if (ammoEl) ammoEl.innerText = `${w.maxAmmo}`;
    }, 1200);
  }

  getActiveWeapon() {
    const key = this.inventory[this.activeSlot];
    const base = WEAPON_TYPES[key];
    const currentAmmo = this.ammoCounts && this.ammoCounts[key] !== undefined ? this.ammoCounts[key] : base.ammo;
    return { key, ...base, currentAmmo };
  }

  selectSlot(index) {
    if (index >= 0 && index < this.inventory.length) {
      this.activeSlot = index;
    }
  }

  canShoot() {
    const now = performance.now() / 1000;
    const w = this.getActiveWeapon();
    if (w.isConsumable || this.isReloading) return false;
    if (w.key !== 'pickaxe' && this.ammoCounts[w.key] <= 0) {
      this.reload();
      return false;
    }
    return (now - this.lastFireTime >= w.fireRate);
  }

  fire(playerPos, isAiming, targetables) {
    const w = this.getActiveWeapon();
    if (!this.canShoot()) return null;

    this.lastFireTime = performance.now() / 1000;

    // Deduct ammo
    if (w.key !== 'pickaxe') {
      this.ammoCounts[w.key] = Math.max(0, this.ammoCounts[w.key] - 1);
      const ammoEl = document.getElementById(`ammo-${w.key}`);
      if (ammoEl) ammoEl.innerText = `${this.ammoCounts[w.key]}`;
      if (this.ammoCounts[w.key] <= 0) {
        this.reload();
      }
    }

    // Play appropriate procedural sound
    if (w.key === 'pickaxe') {
      soundManager.playPickaxeSwing();
    } else if (w.key === 'ar') {
      soundManager.playAssaultRifle();
    } else if (w.key === 'shotgun') {
      soundManager.playPumpShotgun();
    } else if (w.key === 'sniper') {
      soundManager.playSniperShot();
    }

    // Camera center raycast with bloom
    const spread = (w.bloom || 0) * (isAiming ? 0.4 : 1.0);
    const screenCenter = new THREE.Vector2(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    );

    this.raycaster.setFromCamera(screenCenter, this.camera);
    const hits = this.raycaster.intersectObjects(targetables.collidables, true);

    const muzzleOrigin = new THREE.Vector3().copy(playerPos).add(new THREE.Vector3(0.3, 1.3, 0));
    let hitTarget = null;
    let hitPoint = this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(w.range));

    if (hits.length > 0) {
      const firstHit = hits[0];
      if (firstHit.distance <= w.range) {
        hitPoint = firstHit.point;
        hitTarget = this.resolveHitObject(firstHit, targetables);
      }
    }

    // Spawn bullet tracer
    if (w.key !== 'pickaxe') {
      this.spawnTracer(muzzleOrigin, hitPoint, w.key);
    }

    return {
      weaponKey: w.key,
      weaponName: w.name,
      from: muzzleOrigin,
      to: hitPoint,
      hitTarget
    };
  }

  resolveHitObject(hit, targetables) {
    const obj = hit.object;

    // 1. Check if hit the Weakpoint reticle
    if (this.weakpointMesh.visible && hit.object === this.weakpointMesh) {
      return {
        type: 'weakpoint',
        harvestable: this.activeWeakpoint?.harvestable
      };
    }

    // 2. Check if hit a Remote Player or Bot
    for (const player of targetables.remotePlayers) {
      if (!player.alive) continue;
      if (this.isDescendantOf(obj, player.root)) {
        const isHeadshot = (hit.point.y - player.root.position.y) > 1.4;
        return {
          type: 'player',
          id: player.id,
          player,
          isHeadshot,
          point: hit.point
        };
      }
    }

    // 3. Check Placed Structures
    for (const [id, s] of targetables.structures.entries()) {
      if (this.isDescendantOf(obj, s.mesh)) {
        return {
          type: 'structure',
          id,
          structure: s,
          point: hit.point
        };
      }
    }

    // 4. Check Harvestable Environment Trees / Rocks / Containers
    for (const h of targetables.harvestables) {
      if (this.isDescendantOf(obj, h.mesh)) {
        return {
          type: 'harvestable',
          harvestable: h,
          point: hit.point,
          normal: hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0)
        };
      }
    }

    return { type: 'ground', point: hit.point };
  }

  isDescendantOf(child, root) {
    let curr = child;
    while (curr) {
      if (curr === root) return true;
      curr = curr.parent;
    }
    return false;
  }

  showWeakpointOn(harvestable, hitPoint, normal) {
    this.activeWeakpoint = { harvestable, hitPoint };
    this.weakpointMesh.position.copy(hitPoint).add(normal.clone().multiplyScalar(0.05));
    this.weakpointMesh.lookAt(hitPoint.clone().add(normal));
    this.weakpointMesh.visible = true;
  }

  hideWeakpoint() {
    this.weakpointMesh.visible = false;
    this.activeWeakpoint = null;
  }

  spawnTracer(from, to, weaponType) {
    const points = [from, to];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const color = weaponType === 'sniper' ? 0xffffff : 0xffea00;
    const mat = new THREE.LineBasicMaterial({
      color,
      linewidth: 3,
      transparent: true,
      opacity: 0.9
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    // Fade tracer over 80ms
    setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 80);
  }
}
