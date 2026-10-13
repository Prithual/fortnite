import * as THREE from 'three';

export class Skybox {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.initSky();
    this.initLighting();
    this.initClouds();
  }

  initSky() {
    // Gradient cartoon dome
    const skyGeo = new THREE.SphereGeometry(450, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x58b0f8, // Vibrant Fortnite blue
      side: THREE.BackSide
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  initLighting() {
    // Sunlight
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.3);
    dirLight.position.set(120, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 400;
    const d = 150;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Warm ambient light for soft cartoon shadows
    const ambientLight = new THREE.AmbientLight(0x7397b8, 0.7);
    this.scene.add(ambientLight);

    // Hemisphere light (sky blue to ground grass green)
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x56a632, 0.4);
    this.scene.add(hemiLight);
  }

  initClouds() {
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
      transparent: true,
      opacity: 0.9
    });

    for (let i = 0; i < 20; i++) {
      const group = new THREE.Group();
      const numPuffs = 3 + Math.floor(Math.random() * 4);

      for (let p = 0; p < numPuffs; p++) {
        const puffGeo = new THREE.DodecahedronGeometry(8 + Math.random() * 6);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(p * 8 - 12, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
        group.add(puff);
      }

      group.position.set(
        (Math.random() - 0.5) * 500,
        110 + Math.random() * 40,
        (Math.random() - 0.5) * 500
      );
      this.clouds.push(group);
      this.scene.add(group);
    }
  }

  update(dt) {
    // Slowly drift clouds across the island
    for (const cloud of this.clouds) {
      cloud.position.x += 4 * dt;
      if (cloud.position.x > 300) {
        cloud.position.x = -300;
      }
    }
  }
}
