import * as THREE from 'three';

export class CharacterModel {
  constructor(colorScheme = { body: 0x3d5a80, shirt: 0xee6c4d, skin: 0xf5cba7 }) {
    this.group = new THREE.Group();
    this.colorScheme = colorScheme;
    this.glider = null;
    this.pickaxe = null;
    this.weaponMesh = null;
    this.weaponType = 'pickaxe';

    this.initBody();
    this.initGlider();
    this.initWeapons();
  }

  initBody() {
    const skinMat = new THREE.MeshLambertMaterial({ color: this.colorScheme.skin });
    const shirtMat = new THREE.MeshLambertMaterial({ color: this.colorScheme.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: this.colorScheme.body });
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x293241 });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x1d2d44 });

    // 1. Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), shirtMat);
    this.torso.position.y = 1.3;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Tactical Vest
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.7, 0.49), vestMat);
    vest.position.y = 0.05;
    this.torso.add(vest);

    // Backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), vestMat);
    pack.position.set(0, 0, -0.32);
    this.torso.add(pack);

    // 2. Head & Hair/Helmet
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.42), skinMat);
    this.head.position.y = 0.75;
    this.head.castShadow = true;
    this.torso.add(this.head);

    // Headband / Cap (Jonesy classic style)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.46), shirtMat);
    cap.position.y = 0.2;
    this.head.add(cap);

    // 3. Left Arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.52, 0.4, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.24), skinMat);
    leftArmMesh.position.y = -0.4;
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);
    this.torso.add(this.leftArm);

    // 4. Right Arm
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.52, 0.4, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.24), skinMat);
    rightArmMesh.position.y = -0.4;
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightArmMesh);
    this.torso.add(this.rightArm);

    // Hand anchor for weapons
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.8, 0.1);
    this.rightArm.add(this.hand);

    // 5. Left Leg
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.25, 0.8, 0);
    const leftPants = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 0.3), pantsMat);
    leftPants.position.y = -0.32;
    leftPants.castShadow = true;
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.38), bootMat);
    leftBoot.position.set(0, -0.65, 0.04);
    leftBoot.castShadow = true;
    this.leftLeg.add(leftPants);
    this.leftLeg.add(leftBoot);
    this.group.add(this.leftLeg);

    // 6. Right Leg
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.25, 0.8, 0);
    const rightPants = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 0.3), pantsMat);
    rightPants.position.y = -0.32;
    rightPants.castShadow = true;
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.38), bootMat);
    rightBoot.position.set(0, -0.65, 0.04);
    rightBoot.castShadow = true;
    this.rightLeg.add(rightPants);
    this.rightLeg.add(rightBoot);
    this.group.add(this.rightLeg);
  }

  initGlider() {
    this.glider = new THREE.Group();
    this.glider.position.set(0, 2.7, 0);

    // Glider Canopy (stylized Delta Wing)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 1.4);
    wingShape.lineTo(2.4, -0.8);
    wingShape.lineTo(0.5, -0.4);
    wingShape.lineTo(-0.5, -0.4);
    wingShape.lineTo(-2.4, -0.8);
    wingShape.closePath();

    const extrudeSettings = { depth: 0.08, bevelEnabled: false };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    wingGeo.rotateX(Math.PI / 2);

    const canopyMat = new THREE.MeshLambertMaterial({
      color: 0x3a86ff,
      side: THREE.DoubleSide
    });
    const canopy = new THREE.Mesh(wingGeo, canopyMat);
    canopy.castShadow = true;
    this.glider.add(canopy);

    // Struts / handles
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4);
    const handleL = new THREE.Mesh(handleGeo, handleMat);
    handleL.position.set(-0.6, -0.65, 0);
    handleL.rotation.z = -0.3;
    const handleR = new THREE.Mesh(handleGeo, handleMat);
    handleR.position.set(0.6, -0.65, 0);
    handleR.rotation.z = 0.3;

    this.glider.add(handleL);
    this.glider.add(handleR);

    this.glider.visible = false;
    this.group.add(this.glider);
  }

  initWeapons() {
    // 1. Pickaxe
    this.pickaxe = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.3),
      new THREE.MeshLambertMaterial({ color: 0x5a3d28 })
    );
    handle.position.y = 0.4;
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.9, 4),
      new THREE.MeshLambertMaterial({ color: 0x90e0ef })
    );
    blade.position.set(0, 0.9, 0);
    blade.rotation.z = Math.PI / 2;
    this.pickaxe.add(handle);
    this.pickaxe.add(blade);
    this.pickaxe.rotation.x = Math.PI / 2;
    this.hand.add(this.pickaxe);

    // 2. Assault Rifle (Scar)
    this.ar = new THREE.Group();
    const arBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xd4a373 }) // Gold/tan Scar
    );
    const arBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    arBarrel.rotation.x = Math.PI / 2;
    arBarrel.position.set(0, 0.05, 0.65);
    this.ar.add(arBody);
    this.ar.add(arBarrel);
    this.ar.rotation.x = 0;
    this.ar.visible = false;
    this.hand.add(this.ar);

    // 3. Pump Shotgun
    this.shotgun = new THREE.Group();
    const sgBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.2, 0.95),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    this.shotgun.add(sgBody);
    this.shotgun.visible = false;
    this.hand.add(this.shotgun);

    // 4. Sniper Rifle
    this.sniper = new THREE.Group();
    const snBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 1.5),
      new THREE.MeshLambertMaterial({ color: 0x2b9348 })
    );
    const snScope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    snScope.rotation.x = Math.PI / 2;
    snScope.position.set(0, 0.18, 0);
    this.sniper.add(snBody);
    this.sniper.add(snScope);
    this.sniper.visible = false;
    this.hand.add(this.sniper);
  }

  setWeapon(type) {
    this.weaponType = type;
    this.pickaxe.visible = (type === 'pickaxe');
    this.ar.visible = (type === 'ar');
    this.shotgun.visible = (type === 'shotgun');
    this.sniper.visible = (type === 'sniper');
  }

  setGliderVisible(visible) {
    this.glider.visible = visible;
  }

  animate(state, speed, dt) {
    if (state === 'dancing') {
      const t = performance.now() * 0.008;
      this.leftArm.rotation.set(Math.sin(t) * 1.5, 0, Math.cos(t) * 0.8);
      this.rightArm.rotation.set(-Math.sin(t) * 1.5, 0, -Math.cos(t) * 0.8);
      this.leftLeg.rotation.set(-Math.cos(t) * 0.6, 0, 0);
      this.rightLeg.rotation.set(Math.cos(t) * 0.6, 0, 0);
      this.torso.rotation.y = Math.sin(t * 0.5) * 0.4;
      this.torso.position.y = 1.3 + Math.abs(Math.sin(t * 2)) * 0.15;
      return;
    }
    this.torso.rotation.y = 0;

    // Basic procedural animations (idle, run cycle, jump, glide, swing)
    if (state === 'gliding') {
      this.glider.visible = true;
      this.leftArm.rotation.set(-2.4, 0, -0.4);
      this.rightArm.rotation.set(-2.4, 0, 0.4);
      this.leftLeg.rotation.set(0.4, 0, 0);
      this.rightLeg.rotation.set(0.3, 0, 0);
      return;
    }

    this.glider.visible = false;

    if (state === 'skydive') {
      this.leftArm.rotation.set(0.8, 0, -1.2);
      this.rightArm.rotation.set(0.8, 0, 1.2);
      this.leftLeg.rotation.set(0.8, 0, -0.4);
      this.rightLeg.rotation.set(0.8, 0, 0.4);
      return;
    }

    if (speed > 0.1) {
      // Running arm/leg swing
      const t = performance.now() * 0.012 * (speed > 8 ? 1.4 : 1.0);
      this.leftLeg.rotation.x = Math.sin(t) * 0.7;
      this.rightLeg.rotation.x = -Math.sin(t) * 0.7;

      if (!this.isAiming) {
        this.leftArm.rotation.x = -Math.sin(t) * 0.6;
        if (this.weaponType === 'pickaxe') {
          this.rightArm.rotation.x = Math.sin(t) * 0.6;
        } else {
          this.rightArm.rotation.x = -1.1 + Math.sin(t * 0.5) * 0.1;
        }
      }
    } else {
      // Idle breathing
      const t = performance.now() * 0.003;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.torso.position.y = 1.3 + Math.sin(t) * 0.03;

      if (!this.isAiming) {
        this.leftArm.rotation.set(0.1, 0, -0.1);
        if (this.weaponType === 'pickaxe') {
          this.rightArm.rotation.set(0.1, 0, 0.1);
        } else {
          this.rightArm.rotation.set(-1.1, 0, 0.2);
        }
      }
    }

    if (this.isAiming) {
      this.rightArm.rotation.set(-1.45, 0.2, 0);
      this.leftArm.rotation.set(-1.3, -0.4, 0);
    }
  }

  playPickaxeSwingAnim() {
    this.rightArm.rotation.x = -2.2;
    setTimeout(() => {
      this.rightArm.rotation.x = -0.3;
    }, 100);
    setTimeout(() => {
      this.rightArm.rotation.x = 0.1;
    }, 240);
  }
}
