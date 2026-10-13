import * as THREE from 'three';
import { soundManager } from '../audio/SoundSynthesizer.js';

export class BattleBus {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.active = true;
    this.progress = 0;

    this.initModel();
    this.scene.add(this.group);
  }

  initModel() {
    // 1. Blue School Bus Body
    const busMat = new THREE.MeshLambertMaterial({ color: 0x1d70b8 }); // Battle Bus Blue
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 11), busMat);
    body.position.y = 0;
    body.castShadow = true;
    this.group.add(body);

    // Yellow accents / stripes
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xf5b700 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.4, 10.8), stripeMat);
    stripe.position.y = 0.4;
    this.group.add(stripe);

    // Windows
    const winMat = new THREE.MeshBasicMaterial({ color: 0x223344 });
    const winL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 9), winMat);
    winL.position.set(-2.16, 0.6, 0);
    const winR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 9), winMat);
    winR.position.set(2.16, 0.6, 0);
    this.group.add(winL);
    this.group.add(winR);

    // 2. Giant Hot Air Balloon
    const balloonMat = new THREE.MeshLambertMaterial({ color: 0x3a86ff });
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 12), balloonMat);
    balloon.position.y = 11;
    balloon.scale.set(1.0, 1.3, 1.0);
    balloon.castShadow = true;
    this.group.add(balloon);

    // Balloon burner flame
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7b00 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 8), flameMat);
    flame.position.y = 4.2;
    this.group.add(flame);

    // Connecting cables
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 7.5), cableMat);
      cable.position.set(Math.cos(angle) * 2.2, 5.5, Math.sin(angle) * 3.5);
      this.group.add(cable);
    }
  }

  updateFromNetwork(busData) {
    if (!busData) return;
    this.active = busData.active;
    this.progress = busData.progress;
    this.group.position.set(busData.x, busData.y, busData.z);
    this.group.visible = this.active;

    if (this.active && Math.random() < 0.005) {
      soundManager.playBusHorn();
    }
  }
}
