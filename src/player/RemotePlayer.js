import * as THREE from 'three';
import { CharacterModel } from './CharacterModel.js';

export class RemotePlayer {
  constructor(scene, playerData) {
    this.scene = scene;
    this.id = playerData.id;
    this.name = playerData.name || 'Player';
    this.isBot = playerData.isBot || false;

    // Pick unique skin color for teammates/bots
    const colors = [
      { body: 0x3d5a80, shirt: 0xee6c4d, skin: 0xf5cba7 }, // Jonesy classic
      { body: 0x2b2d42, shirt: 0xd90429, skin: 0xedc4b3 }, // Red Strike
      { body: 0x14213d, shirt: 0xfca311, skin: 0xe0a96d }, // Gold Trooper
      { body: 0x38b000, shirt: 0x007200, skin: 0xd4a373 }  // Camo Special
    ];
    const picked = colors[Math.abs(this.hashCode(this.id)) % colors.length];

    this.model = new CharacterModel(picked);
    this.root = this.model.group;
    this.scene.add(this.root);

    // Target positions for interpolation
    this.targetPos = new THREE.Vector3(playerData.x || 0, playerData.y || 10, playerData.z || 0);
    this.targetRotY = playerData.rotY || 0;
    this.root.position.copy(this.targetPos);

    this.state = playerData.state || 'in_bus';
    this.gliderOpen = false;
    this.alive = playerData.alive !== undefined ? playerData.alive : true;
    this.health = playerData.health || 100;
    this.shield = playerData.shield || 0;

    this.initNameTag();
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  initNameTag() {
    // 3D Canvas Billboard for overhead name + health/shield bar
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    this.nameCtx = canvas.getContext('2d');
    this.nameTex = new THREE.CanvasTexture(canvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.nameTex, transparent: true });
    this.sprite = new THREE.Sprite(spriteMat);
    this.sprite.position.y = 2.4;
    this.sprite.scale.set(3, 0.75, 1);
    this.root.add(this.sprite);

    this.updateNameTag();
  }

  updateNameTag() {
    const ctx = this.nameCtx;
    ctx.clearRect(0, 0, 256, 64);

    if (!this.alive) return;

    // Draw Name and Voice Speaker icon
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.isBot ? '#ffd166' : '#ffffff';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    const displayName = (this.isSpeaking ? '🔊 ' : '') + this.name;
    ctx.fillText(displayName, 128, 24);

    // Draw Health / Shield Mini-Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(48, 34, 160, 10);

    // Shield (Blue)
    const sWidth = (this.shield / 100) * 80;
    ctx.fillStyle = '#00b4d8';
    ctx.fillRect(48, 34, sWidth, 10);

    // Health (Green)
    const hWidth = (this.health / 100) * 80;
    ctx.fillStyle = '#2ec4b6';
    ctx.fillRect(128, 34, hWidth, 10);

    this.nameTex.needsUpdate = true;
  }

  updateState(data) {
    this.targetPos.set(data.x, data.y, data.z);
    this.targetRotY = data.rotY || 0;
    this.state = data.state;
    this.gliderOpen = data.gliderOpen;
    this.alive = data.alive;
    this.health = data.health;
    this.shield = data.shield;
    this.model.setWeapon(data.activeWeapon || 'ar');
    this.model.isAiming = data.isAiming;

    this.root.visible = this.alive && (this.state !== 'in_bus');
    this.updateNameTag();
  }

  setSpeaking(isSpeaking) {
    if (this.isSpeaking !== isSpeaking) {
      this.isSpeaking = isSpeaking;
      this.updateNameTag();
    }
  }

  update(dt) {
    if (!this.alive || this.state === 'in_bus') {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;

    // Smooth LERP position & rotation
    const prevPos = this.root.position.clone();
    this.root.position.lerp(this.targetPos, Math.min(1, dt * 14));

    // Rotation interpolation
    let diffRot = this.targetRotY - this.root.rotation.y;
    while (diffRot < -Math.PI) diffRot += Math.PI * 2;
    while (diffRot > Math.PI) diffRot -= Math.PI * 2;
    this.root.rotation.y += diffRot * Math.min(1, dt * 14);

    // Calculate move speed for walk/run animation
    const moveDist = this.root.position.distanceTo(prevPos);
    const speed = moveDist / (dt || 0.016);

    this.model.animate(this.state, speed, dt);
  }

  destroy() {
    this.scene.remove(this.root);
  }
}
