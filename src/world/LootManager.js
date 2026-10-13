import * as THREE from 'three';
import { soundManager } from '../audio/SoundSynthesizer.js';

export const RARITY_COLORS = {
  common: 0x94a3b8,
  uncommon: 0x22c55e,
  rare: 0x3b82f6,
  epic: 0xa855f7,
  legendary: 0xf59e0b
};

export class LootManager {
  constructor(scene) {
    this.scene = scene;
    this.lootItems = new Map(); // id -> { id, group, mesh, beam, type, rarity, x, y, z }
    this.promptEl = document.getElementById('loot-prompt');
    this.nearestLoot = null;
  }

  spawnLoot(lootData) {
    if (this.lootItems.has(lootData.id)) return;

    const group = new THREE.Group();
    const color = RARITY_COLORS[lootData.rarity] || RARITY_COLORS.rare;

    // 1. Rarity Light Pillar / Beacon Beam
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.2, 12, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 6;
    group.add(beam);

    // 2. 3D Floating Item Mesh
    let itemMesh;
    if (lootData.type === 'mini_shield') {
      const potGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8);
      const potMat = new THREE.MeshLambertMaterial({ color: 0x00f0ff });
      itemMesh = new THREE.Mesh(potGeo, potMat);
    } else if (lootData.type === 'medkit') {
      const medGeo = new THREE.BoxGeometry(0.5, 0.35, 0.25);
      const medMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
      itemMesh = new THREE.Mesh(medGeo, medMat);
    } else if (lootData.type === 'shotgun') {
      const gunGeo = new THREE.BoxGeometry(0.12, 0.18, 0.9);
      const gunMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      itemMesh = new THREE.Mesh(gunGeo, gunMat);
    } else if (lootData.type === 'sniper') {
      const gunGeo = new THREE.BoxGeometry(0.12, 0.2, 1.2);
      const gunMat = new THREE.MeshLambertMaterial({ color: 0x166534 });
      itemMesh = new THREE.Mesh(gunGeo, gunMat);
    } else {
      // Assault rifle
      const gunGeo = new THREE.BoxGeometry(0.12, 0.2, 1.0);
      const gunMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
      itemMesh = new THREE.Mesh(gunGeo, gunMat);
    }

    itemMesh.position.y = 0.5;
    itemMesh.castShadow = true;
    group.add(itemMesh);

    group.position.set(lootData.x, lootData.y, lootData.z);
    this.scene.add(group);

    this.lootItems.set(lootData.id, {
      ...lootData,
      group,
      itemMesh,
      beam,
      baseY: lootData.y
    });
  }

  removeLoot(id) {
    const item = this.lootItems.get(id);
    if (item) {
      this.scene.remove(item.group);
      this.lootItems.delete(id);
    }
  }

  update(playerPos, dt) {
    const t = performance.now() * 0.003;
    let closest = null;
    let closestDist = 3.5;

    for (const item of this.lootItems.values()) {
      // Bob and rotate
      item.itemMesh.rotation.y += 1.8 * dt;
      item.itemMesh.position.y = 0.5 + Math.sin(t + item.x) * 0.15;

      const dist = Math.hypot(playerPos.x - item.x, playerPos.z - item.z);
      if (dist < closestDist) {
        closestDist = dist;
        closest = item;
      }
    }

    this.nearestLoot = closest;
    if (this.promptEl) {
      if (this.nearestLoot) {
        this.promptEl.style.display = 'block';
        const nameMap = {
          ar: 'Assault Rifle (Scar)',
          shotgun: 'Pump Shotgun',
          sniper: 'Bolt Sniper',
          mini_shield: 'Mini Shield Potion',
          medkit: 'Medkit'
        };
        this.promptEl.innerHTML = `[E] PICK UP <b>${nameMap[this.nearestLoot.type] || this.nearestLoot.type}</b>`;
      } else {
        this.promptEl.style.display = 'none';
      }
    }
  }

  getNearestLoot() {
    return this.nearestLoot;
  }
}
