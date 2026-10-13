import * as THREE from 'three';
import { soundManager } from '../audio/SoundSynthesizer.js';

export class StormSystem {
  constructor(scene) {
    this.scene = scene;
    this.currentRadius = 280;
    this.currentX = 0;
    this.currentZ = 0;
    this.targetRadius = 180;
    this.targetX = 0;
    this.targetZ = 0;
    this.phase = 1;
    this.isShrinking = false;
    this.timer = 45;

    this.initStormMesh();
  }

  initStormMesh() {
    // Large translucent purple cylinder representing the storm wall
    const stormGeo = new THREE.CylinderGeometry(this.currentRadius, this.currentRadius, 250, 48, 1, true);
    const stormMat = new THREE.MeshBasicMaterial({
      color: 0x9b5de5, // Iconic Fortnite purple storm
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.stormMesh = new THREE.Mesh(stormGeo, stormMat);
    this.stormMesh.position.set(0, 100, 0);
    this.scene.add(this.stormMesh);

    // Safe zone boundary ring on the ground (white ring)
    const ringGeo = new THREE.RingGeometry(this.targetRadius - 0.5, this.targetRadius + 0.5, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.safeZoneRing = new THREE.Mesh(ringGeo, ringMat);
    this.safeZoneRing.position.set(0, 1.0, 0);
    this.scene.add(this.safeZoneRing);
  }

  updateFromNetwork(stormData) {
    if (!stormData) return;

    if (this.phase !== stormData.phase) {
      soundManager.playStormWarning();
    }

    this.phase = stormData.phase;
    this.isShrinking = stormData.isShrinking;
    this.timer = Math.max(0, Math.round(stormData.timer));
    this.currentRadius = stormData.currentRadius;
    this.currentX = stormData.currentX;
    this.currentZ = stormData.currentZ;
    this.targetRadius = stormData.targetRadius;
    this.targetX = stormData.targetX;
    this.targetZ = stormData.targetZ;

    // Update 3D meshes
    this.stormMesh.position.set(this.currentX, 100, this.currentZ);
    this.stormMesh.scale.set(this.currentRadius / 280, 1, this.currentRadius / 280);

    this.safeZoneRing.position.set(this.targetX, 1.2, this.targetZ);
    this.safeZoneRing.scale.set(this.targetRadius / 180, 1, this.targetRadius / 180);
  }

  isPositionInsideSafeZone(x, z) {
    const dist = Math.hypot(x - this.currentX, z - this.currentZ);
    return dist <= this.currentRadius;
  }
}
