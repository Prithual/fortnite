import * as THREE from 'three';
import { CharacterModel } from './CharacterModel.js';
import { soundManager } from '../audio/SoundSynthesizer.js';

export class PlayerController {
  constructor(scene, camera, domElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;

    // Player state
    this.id = `player_${Date.now()}`;
    this.name = 'You';
    this.health = 100;
    this.shield = 100;
    this.alive = true;
    this.state = 'in_bus'; // 'in_bus', 'skydive', 'gliding', 'landed'
    this.kills = 0;

    // Movement & physics
    this.pos = new THREE.Vector3(0, 180, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.rotY = 0;
    this.pitch = 0;
    this.isGrounded = false;
    this.isAiming = false;
    this.gliderOpen = false;

    // Input keys
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      crouch: false,
      interact: false
    };

    // 3D Player Character Model
    this.model = new CharacterModel({ body: 0x3d5a80, shirt: 0xee6c4d, skin: 0xf5cba7 });
    this.characterRoot = this.model.group;
    this.scene.add(this.characterRoot);
    this.characterRoot.visible = false; // Hidden while in bus

    this.initMouseLook();
    this.initKeyboard();
  }

  initMouseLook() {
    this.domElement.addEventListener('click', () => {
      if (document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.domElement && this.alive) {
        const sens = this.isAiming ? 0.0014 : 0.0024;
        this.rotY -= e.movementX * sens;
        this.pitch -= e.movementY * sens;

        // Clamp vertical look
        this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));
      }
    });

    // Right Click ADS Aim
    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this.isAiming = true;
        this.model.isAiming = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.isAiming = false;
        this.model.isAiming = false;
      }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!this.alive) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      const key = e.code;

      if (key === 'KeyW') this.keys.forward = true;
      if (key === 'KeyS') this.keys.backward = true;
      if (key === 'KeyA') this.keys.left = true;
      if (key === 'KeyD') this.keys.right = true;
      if (key === 'ShiftLeft' || key === 'ShiftRight') this.keys.sprint = true;
      if (key === 'KeyC') this.keys.crouch = true;
      if (key === 'KeyE') this.keys.interact = true;
      if (key === 'KeyB') this.toggleDance();

      if (key === 'Space') {
        this.keys.jump = true;
        this.handleSpaceAction();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      const key = e.code;
      if (key === 'KeyW') this.keys.forward = false;
      if (key === 'KeyS') this.keys.backward = false;
      if (key === 'KeyA') this.keys.left = false;
      if (key === 'KeyD') this.keys.right = false;
      if (key === 'ShiftLeft' || key === 'ShiftRight') this.keys.sprint = false;
      if (key === 'KeyC') this.keys.crouch = false;
      if (key === 'KeyE') this.keys.interact = false;
      if (key === 'Space') this.keys.jump = false;
    });
  }

  toggleDance() {
    if (this.state === 'landed') {
      this.state = 'dancing';
      soundManager.playEmoteMusic();
    } else if (this.state === 'dancing') {
      this.state = 'landed';
    }
  }

  handleSpaceAction() {
    if (this.state === 'in_bus') {
      // Trigger bus drop
      this.dropFromBus();
    } else if (this.state === 'skydive') {
      // Deploy Glider
      this.state = 'gliding';
      this.gliderOpen = true;
      soundManager.playGliderDeploy();
    } else if (this.state === 'gliding') {
      // Close Glider into fast skydive
      this.state = 'skydive';
      this.gliderOpen = false;
    } else if (this.state === 'landed' && this.isGrounded) {
      // Normal jump
      this.vel.y = 8.5;
      this.isGrounded = false;
    }
  }

  dropFromBus() {
    if (this.state !== 'in_bus') return;
    this.state = 'skydive';
    this.characterRoot.visible = true;
    soundManager.playGliderDeploy();
  }

  update(dt, mapGen, structures) {
    if (!this.alive) return;

    if (this.state === 'in_bus') {
      this.characterRoot.visible = false;
      return;
    }

    this.characterRoot.visible = true;

    // 1. Air Movement (Skydiving / Gliding)
    if (this.state === 'skydive' || this.state === 'gliding') {
      this.updateAirFlight(dt, mapGen);
    } else {
      // 2. Ground Movement
      this.updateGroundMovement(dt, mapGen, structures);
    }

    // Update Model position & orientation
    this.characterRoot.position.copy(this.pos);
    this.characterRoot.rotation.y = this.rotY;

    // Update Camera position (Over the shoulder)
    this.updateCamera(dt);
  }

  updateAirFlight(dt, mapGen) {
    const forwardX = Math.sin(this.rotY);
    const forwardZ = Math.cos(this.rotY);

    const horizontalSpeed = this.state === 'gliding' ? 16 : 28;
    const fallSpeed = this.state === 'gliding' ? 10 : 38;

    // Glide forward based on forward input or default
    this.pos.x += forwardX * horizontalSpeed * dt;
    this.pos.z += forwardZ * horizontalSpeed * dt;
    this.pos.y -= fallSpeed * dt;

    // Check terrain landing
    const groundY = mapGen.getElevation(this.pos.x, this.pos.z);
    if (this.pos.y <= groundY + 0.1) {
      this.pos.y = groundY;
      this.state = 'landed';
      this.gliderOpen = false;
      this.isGrounded = true;
      this.vel.y = 0;
    }

    this.model.animate(this.state, horizontalSpeed, dt);
  }

  updateGroundMovement(dt, mapGen, structures) {
    // Determine movement direction from input
    let moveX = 0;
    let moveZ = 0;
    if (this.keys.forward) moveZ += 1;
    if (this.keys.backward) moveZ -= 1;
    if (this.keys.left) moveX += 1;
    if (this.keys.right) moveX -= 1;

    let speed = 6.0; // Walk
    if (this.keys.sprint && !this.isAiming && this.keys.forward) speed = 9.8; // Sprint
    if (this.keys.crouch) speed = 3.2; // Crouch
    if (this.isAiming) speed = 3.8; // Aiming walk

    const forwardX = Math.sin(this.rotY);
    const forwardZ = Math.cos(this.rotY);
    const rightX = Math.cos(this.rotY);
    const rightZ = -Math.sin(this.rotY);

    const dir = new THREE.Vector3();
    dir.x = forwardX * moveZ + rightX * moveX;
    dir.z = forwardZ * moveZ + rightZ * moveX;

    if (dir.lengthSq() > 0) {
      if (this.state === 'dancing') this.state = 'landed';
      dir.normalize();
      this.pos.x += dir.x * speed * dt;
      this.pos.z += dir.z * speed * dt;

      // Footstep sound trigger
      if (!this.footstepTimer) this.footstepTimer = 0;
      this.footstepTimer += dt;
      const stepInterval = speed > 8 ? 0.28 : 0.42;
      if (this.isGrounded && this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        soundManager.playFootstep();
      }
    }

    // Gravity
    this.vel.y -= 22 * dt;
    this.pos.y += this.vel.y * dt;

    // Collision with terrain
    const groundY = mapGen.getElevation(this.pos.x, this.pos.z);
    let highestFloor = groundY;

    // Check collision on top of placed building floors and ramps
    for (const [id, s] of structures.entries()) {
      const dx = Math.abs(this.pos.x - s.x);
      const dz = Math.abs(this.pos.z - s.z);
      if (dx < 2.0 && dz < 2.0) {
        if (s.type === 'floor' && this.pos.y >= s.y - 0.2 && this.pos.y <= s.y + 1.5) {
          highestFloor = Math.max(highestFloor, s.y);
        } else if (s.type === 'ramp') {
          // Ramp slope check
          const relDist = (this.pos.z - s.z);
          const rampH = s.y + Math.max(0, Math.min(3.0, (relDist + 2.0) * 0.75));
          if (this.pos.y >= rampH - 0.5) {
            highestFloor = Math.max(highestFloor, rampH);
          }
        }
      }
    }

    if (this.pos.y <= highestFloor) {
      this.pos.y = highestFloor;
      this.vel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    const currentSpeed = dir.lengthSq() > 0 ? speed : 0;
    this.model.animate(this.state, currentSpeed, dt);
  }

  updateCamera(dt) {
    // Third-person camera positioning
    const shoulderOffset = this.isAiming
      ? new THREE.Vector3(0.5, 1.4, -1.8) // ADS zoom
      : new THREE.Vector3(0.8, 1.7, -3.2); // Standard over-the-shoulder

    // Rotate offset by player yaw
    const camOffsetRotated = shoulderOffset.clone();
    camOffsetRotated.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotY);

    // Apply pitch elevation
    camOffsetRotated.y += Math.sin(this.pitch) * 2.0;

    const targetCamPos = this.pos.clone().add(camOffsetRotated);
    this.camera.position.lerp(targetCamPos, 0.4);

    // Camera look target slightly ahead of player
    const lookTarget = this.pos.clone().add(new THREE.Vector3(
      Math.sin(this.rotY) * 10,
      1.5 + Math.sin(this.pitch) * 10,
      Math.cos(this.rotY) * 10
    ));
    this.camera.lookAt(lookTarget);

    // Dynamic FOV when aiming
    const targetFov = this.isAiming ? 50 : 75;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * dt * 15;
      this.camera.updateProjectionMatrix();
    }
  }

  applyDamage(amount) {
    let remaining = amount;
    if (this.shield > 0) {
      const sDmg = Math.min(this.shield, remaining);
      this.shield -= sDmg;
      remaining -= sDmg;
      if (this.shield <= 0) soundManager.playShieldBreak();
    }

    if (remaining > 0) {
      this.health = Math.max(0, this.health - remaining);
    }

    if (this.health <= 0) {
      this.alive = false;
    }
  }
}
