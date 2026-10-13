import * as THREE from 'three';
import { soundManager } from '../audio/SoundSynthesizer.js';

export const GRID_XZ = 4.0;
export const GRID_Y = 3.0;

export class BuildingSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isBuildMode = false;
    this.activeType = 'wall'; // 'wall', 'ramp', 'floor', 'roof'
    this.activeMaterial = 'wood'; // 'wood', 'stone', 'metal'

    this.materials = {
      wood: 150,
      stone: 80,
      metal: 40
    };

    this.structures = new Map(); // id -> { id, mesh, type, material, hp, maxHp, bounds, x, y, z, rotY }

    this.previewMesh = null;
    this.canBuild = true;

    this.initPreview();
  }

  initPreview() {
    this.previewGroup = new THREE.Group();

    // Semi-transparent blue holographic material
    this.previewMatValid = new THREE.MeshBasicMaterial({
      color: 0x00b4d8,
      transparent: true,
      opacity: 0.45,
      wireframe: false,
      side: THREE.DoubleSide
    });

    this.previewMatInvalid = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.45,
      wireframe: false,
      side: THREE.DoubleSide
    });

    this.updatePreviewGeometry();
    this.scene.add(this.previewGroup);
    this.previewGroup.visible = false;
  }

  setBuildType(type) {
    this.activeType = type;
    this.isBuildMode = true;
    this.updatePreviewGeometry();
  }

  updatePreviewGeometry() {
    // Clear preview group children
    while (this.previewGroup.children.length > 0) {
      this.previewGroup.remove(this.previewGroup.children[0]);
    }

    let geo = null;
    if (this.activeType === 'wall') {
      geo = new THREE.BoxGeometry(GRID_XZ, GRID_Y, 0.2);
      geo.translate(0, GRID_Y / 2, 0);
    } else if (this.activeType === 'ramp') {
      // Ramp at 45 degree angle
      geo = new THREE.PlaneGeometry(GRID_XZ, Math.hypot(GRID_XZ, GRID_Y));
      geo.rotateX(-Math.atan2(GRID_Y, GRID_XZ));
      geo.translate(0, GRID_Y / 2, 0);
    } else if (this.activeType === 'floor') {
      geo = new THREE.BoxGeometry(GRID_XZ, 0.15, GRID_XZ);
      geo.translate(0, 0, 0);
    } else if (this.activeType === 'roof') {
      geo = new THREE.ConeGeometry(GRID_XZ * 0.72, GRID_Y * 0.8, 4);
      geo.rotateY(Math.PI / 4);
      geo.translate(0, (GRID_Y * 0.8) / 2, 0);
    }

    this.previewMesh = new THREE.Mesh(geo, this.previewMatValid);
    this.previewGroup.add(this.previewMesh);
  }

  calculateSnapTransform(playerPos, playerRotY) {
    // Snap X and Z to nearest GRID_XZ, Y to nearest GRID_Y
    // Place structure 1 tile in front of the player
    const forwardX = Math.sin(playerRotY);
    const forwardZ = Math.cos(playerRotY);

    let targetX = playerPos.x + forwardX * (GRID_XZ * 0.75);
    let targetZ = playerPos.z + forwardZ * (GRID_XZ * 0.75);
    let targetY = Math.max(0, Math.round(playerPos.y / GRID_Y) * GRID_Y);

    // Cardinal rotation snapping (0, 90, 180, 270 degrees)
    const cardinalIdx = Math.round(playerRotY / (Math.PI / 2)) % 4;
    const snapRotY = cardinalIdx * (Math.PI / 2);

    const snapX = Math.round(targetX / GRID_XZ) * GRID_XZ;
    const snapZ = Math.round(targetZ / GRID_XZ) * GRID_XZ;

    return { x: snapX, y: targetY, z: snapZ, rotY: snapRotY };
  }

  update(playerPos, playerRotY) {
    if (!this.isBuildMode) {
      this.previewGroup.visible = false;
      return;
    }

    this.previewGroup.visible = true;
    const snap = this.calculateSnapTransform(playerPos, playerRotY);

    this.previewGroup.position.set(snap.x, snap.y, snap.z);
    this.previewGroup.rotation.y = snap.rotY;

    // Check material cost
    const matCost = 10;
    this.canBuild = (this.materials[this.activeMaterial] >= matCost);

    this.previewMesh.material = this.canBuild ? this.previewMatValid : this.previewMatInvalid;
  }

  tryBuild(playerPos, playerRotY, playerId) {
    if (!this.isBuildMode || !this.canBuild) return null;

    const snap = this.calculateSnapTransform(playerPos, playerRotY);
    const cost = 10;
    this.materials[this.activeMaterial] -= cost;

    const maxHp = this.activeMaterial === 'metal' ? 500 : (this.activeMaterial === 'stone' ? 300 : 150);

    const buildData = {
      id: `build_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      type: this.activeType,
      material: this.activeMaterial,
      x: snap.x,
      y: snap.y,
      z: snap.z,
      rotY: snap.rotY,
      hp: maxHp,
      maxHp,
      ownerId: playerId
    };

    this.spawnStructureMesh(buildData);
    soundManager.playBuildPlacement();

    return buildData;
  }

  spawnStructureMesh(data) {
    const group = new THREE.Group();
    const colors = {
      wood: 0xa87843,
      stone: 0x8a929a,
      metal: 0x4a5568
    };
    const mat = new THREE.MeshLambertMaterial({
      color: colors[data.material] || colors.wood,
      flatShading: true,
      side: THREE.DoubleSide
    });

    let mesh;
    if (data.type === 'wall') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(GRID_XZ, GRID_Y, 0.25), mat);
      mesh.position.y = GRID_Y / 2;
    } else if (data.type === 'ramp') {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(GRID_XZ, Math.hypot(GRID_XZ, GRID_Y)), mat);
      mesh.rotateX(-Math.atan2(GRID_Y, GRID_XZ));
      mesh.position.y = GRID_Y / 2;
    } else if (data.type === 'floor') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(GRID_XZ, 0.2, GRID_XZ), mat);
    } else if (data.type === 'roof') {
      const geo = new THREE.ConeGeometry(GRID_XZ * 0.72, GRID_Y * 0.8, 4);
      geo.rotateY(Math.PI / 4);
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = (GRID_Y * 0.8) / 2;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    group.position.set(data.x, data.y, data.z);
    group.rotation.y = data.rotY;
    this.scene.add(group);

    this.structures.set(data.id, {
      ...data,
      mesh: group
    });
  }

  damageStructure(id, damage) {
    const s = this.structures.get(id);
    if (!s) return null;

    s.hp -= damage;
    if (s.hp <= 0) {
      this.destroyStructure(id);
      return { destroyed: true };
    }

    // Flash white on hit
    const childMesh = s.mesh.children[0];
    if (childMesh && childMesh.material) {
      const origColor = childMesh.material.color.getHex();
      childMesh.material.color.setHex(0xffffff);
      setTimeout(() => {
        if (childMesh && childMesh.material) {
          childMesh.material.color.setHex(origColor);
        }
      }, 80);
    }

    return { destroyed: false, hp: s.hp, maxHp: s.maxHp };
  }

  destroyStructure(id) {
    const s = this.structures.get(id);
    if (s) {
      this.scene.remove(s.mesh);
      this.structures.delete(id);
      soundManager.playHarvestHit('wood');
    }
  }

  addMaterials(wood = 0, stone = 0, metal = 0) {
    this.materials.wood = Math.min(999, this.materials.wood + wood);
    this.materials.stone = Math.min(999, this.materials.stone + stone);
    this.materials.metal = Math.min(999, this.materials.metal + metal);
  }
}
