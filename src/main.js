import * as THREE from 'three';
import { MapGenerator } from './world/MapGenerator.js';
import { Skybox } from './world/Skybox.js';
import { BattleBus } from './world/BattleBus.js';
import { PlayerController } from './player/PlayerController.js';
import { RemotePlayer } from './player/RemotePlayer.js';
import { BuildingSystem } from './building/BuildingSystem.js';
import { WeaponSystem } from './weapons/WeaponSystem.js';
import { StormSystem } from './storm/StormSystem.js';
import { NetworkClient } from './network/NetworkClient.js';
import { UIManager } from './ui/UIManager.js';
import { soundManager } from './audio/SoundSynthesizer.js';
import { LootManager } from './world/LootManager.js';
import { ChatManager } from './ui/ChatManager.js';
import { VoiceChatManager } from './voice/VoiceChatManager.js';

class FortniteGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.remotePlayers = new Map(); // id -> RemotePlayer
    this.otherPlayersData = [];

    this.initThree();
    this.initWorld();
    this.initPlayer();
    this.initNetwork();
    this.initSystems();
    this.initInputBinds();
    this.initLobbyUI();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x58b0f8);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0018);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initWorld() {
    this.skybox = new Skybox(this.scene);
    this.mapGen = new MapGenerator(this.scene);
    this.battleBus = new BattleBus(this.scene);
  }

  initPlayer() {
    this.player = new PlayerController(this.scene, this.camera, this.renderer.domElement);
  }

  initSystems() {
    this.building = new BuildingSystem(this.scene, this.camera);
    this.weapons = new WeaponSystem(this.scene, this.camera);
    this.storm = new StormSystem(this.scene);
    this.ui = new UIManager(this.camera);
    this.loot = new LootManager(this.scene);
    this.chat = new ChatManager(this.net, this.renderer.domElement);
    this.voice = new VoiceChatManager(this.net);
    this.isMouseDown = false;
    this.turboBuildTimer = 0;
  }

  initNetwork() {
    this.net = new NetworkClient();

    // Check URL parameters for custom room
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room') || 'main';
    document.getElementById('room-id-input').value = urlRoom;

    this.net.on('init_state', (data) => {
      this.player.id = data.playerId;

      // Spawn initial world structures
      if (data.structures) {
        data.structures.forEach(s => this.building.spawnStructureMesh(s));
      }
      // Spawn initial ground loot
      if (data.lootDrops) {
        data.lootDrops.forEach(l => this.loot.spawnLoot(l));
      }
      // Update storm state
      if (data.storm) {
        this.storm.updateFromNetwork(data.storm);
      }
    });

    this.net.on('tick', (data) => {
      this.otherPlayersData = data.players || [];

      // Update Remote Players & Bots
      if (data.players) {
        const currentIds = new Set();
        data.players.forEach(pData => {
          if (pData.id === this.player.id) {
            // Update local stats from authoritative server
            this.player.health = pData.health;
            this.player.shield = pData.shield;
            this.player.alive = pData.alive;
            this.player.kills = pData.kills;
            return;
          }

          currentIds.add(pData.id);
          if (!this.remotePlayers.has(pData.id)) {
            const rp = new RemotePlayer(this.scene, pData);
            this.remotePlayers.set(pData.id, rp);
          } else {
            this.remotePlayers.get(pData.id).updateState(pData);
          }
        });

        // Clean up disconnected players
        for (const [id, rp] of this.remotePlayers.entries()) {
          if (!currentIds.has(id)) {
            rp.destroy();
            this.remotePlayers.delete(id);
          }
        }
      }

      // Update Battle Bus
      if (data.bus) {
        this.battleBus.updateFromNetwork(data.bus);
        if (this.player.state === 'in_bus') {
          // Keep player camera locked on Battle Bus while riding
          this.player.pos.set(data.bus.x, data.bus.y, data.bus.z);
          this.camera.position.set(data.bus.x - 12, data.bus.y + 6, data.bus.z - 16);
          this.camera.lookAt(data.bus.x, data.bus.y, data.bus.z);
        }
      }

      // Update Storm
      if (data.storm) {
        this.storm.updateFromNetwork(data.storm);
      }

      // Update UI Alive Counter
      this.ui.updateStats(data.aliveCount || 1, this.player.kills);
    });

    this.net.on('bullet_tracer', (data) => {
      if (data.shooterId !== this.player.id) {
        this.weapons.spawnTracer(
          new THREE.Vector3(data.from.x, data.from.y, data.from.z),
          new THREE.Vector3(data.to.x, data.to.y, data.to.z),
          data.weapon
        );
        if (data.weapon === 'ar') soundManager.playAssaultRifle();
        else if (data.weapon === 'shotgun') soundManager.playPumpShotgun();
        else if (data.weapon === 'sniper') soundManager.playSniperShot();
      }
    });

    this.net.on('damage_dealt', (data) => {
      // Floating damage numbers
      this.ui.showDamageNumber(
        data.x, data.y, data.z,
        data.damage,
        data.shieldHit,
        data.headshot
      );

      if (data.attackerId === this.player.id) {
        this.ui.showHitmarker();
        soundManager.playHitMarker(data.headshot);
      }

      if (data.victimId === this.player.id) {
        if (data.shieldHit && data.victimShield <= 0) {
          soundManager.playShieldBreak();
        }
      }
    });

    this.net.on('structure_placed', (data) => {
      if (data.structure.ownerId !== this.player.id) {
        this.building.spawnStructureMesh(data.structure);
        soundManager.playBuildPlacement();
      }
    });

    this.net.on('structure_damaged', (data) => {
      this.building.damageStructure(data.structureId, 1);
    });

    this.net.on('structure_destroyed', (data) => {
      this.building.destroyStructure(data.structureId);
    });

    this.net.on('chest_opened', (data) => {
      this.mapGen.openChest(data.chestId);
      soundManager.playChestOpen();
    });

    this.net.on('loot_spawned', (data) => {
      this.loot.spawnLoot(data.loot);
    });

    this.net.on('loot_collected', (data) => {
      this.loot.removeLoot(data.lootId);
      if (data.collectorId === this.player.id) {
        soundManager.playWeakpointHit();
        const item = data.item;
        if (item) {
          if (item.type === 'mini_shield') {
            this.player.shield = Math.min(100, this.player.shield + 25);
          } else if (item.type === 'medkit') {
            this.player.health = 100;
          } else if (this.weapons.ammoCounts[item.type] !== undefined) {
            this.weapons.ammoCounts[item.type] = 30;
          }
          this.building.addMaterials(30, 20, 10);
          this.ui.updateMaterials(this.building.materials);
          this.ui.updateHealthAndShield(this.player.health, this.player.shield);
        }
      }
    });

    this.net.on('player_eliminated', (data) => {
      this.ui.addKillFeed(data.killFeed.killerName, data.killFeed.victimName, data.killFeed.weapon);
    });

    this.net.on('victory_royale', (data) => {
      if (data.winnerId === this.player.id) {
        this.ui.showVictoryRoyale();
        soundManager.playVictoryRoyale();
      }
    });

    this.net.on('voice_speaking', (data) => {
      const rp = this.remotePlayers.get(data.speakerId);
      if (rp) {
        rp.setSpeaking(data.isSpeaking);
      }
    });
  }

  initInputBinds() {
    window.addEventListener('keydown', (e) => {
      if (!this.player.alive) return;
      soundManager.resume();

      // Weapon Slots 1 - 5
      if (e.code === 'Digit1') this.selectWeaponSlot(0);
      if (e.code === 'Digit2') this.selectWeaponSlot(1);
      if (e.code === 'Digit3') this.selectWeaponSlot(2);
      if (e.code === 'Digit4') this.selectWeaponSlot(3);
      if (e.code === 'Digit5') this.selectWeaponSlot(4);

      // Building Slots & Combat
      if (e.code === 'KeyQ') this.selectBuildMode('wall');
      if (e.code === 'KeyE' && this.player.state !== 'in_bus') {
        const nearestLoot = this.loot.getNearestLoot();
        if (nearestLoot) {
          this.net.send({ type: 'pickup_loot', lootId: nearestLoot.id });
        } else if (!this.checkNearbyChestInteract()) {
          this.selectBuildMode('ramp');
        }
      }
      if (e.code === 'KeyF') this.selectBuildMode('floor');
      if (e.code === 'KeyR') {
        if (this.building.isBuildMode) {
          this.selectBuildMode('roof');
        } else {
          this.weapons.reload();
        }
      }
    });

    // Left Click Actions: Shoot / Swing Pickaxe / Build Placement & Turbo Building
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.player.alive) return;
      if (document.pointerLockElement !== this.renderer.domElement) return;
      this.isMouseDown = true;

      if (this.building.isBuildMode) {
        this.placeCurrentBuildPiece();
      } else {
        this.performWeaponAttack();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });
  }

  placeCurrentBuildPiece() {
    const built = this.building.tryBuild(this.player.pos, this.player.rotY, this.player.id);
    if (built) {
      this.net.send({ type: 'build', structure: built });
      this.ui.updateMaterials(this.building.materials);
    }
  }

  checkNearbyChestInteract() {
    // Check if player is near a golden chest to open
    for (const chest of this.mapGen.chests) {
      if (chest.opened) continue;
      const dist = Math.hypot(this.player.pos.x - chest.x, this.player.pos.z - chest.z);
      if (dist < 4.0) {
        this.net.send({ type: 'open_chest', chestId: chest.id });
        return true;
      }
    }
    return false;
  }

  selectWeaponSlot(index) {
    this.building.isBuildMode = false;
    this.weapons.selectSlot(index);
    const active = this.weapons.getActiveWeapon();
    this.player.model.setWeapon(active.key);
    this.ui.setActiveWeaponSlot(index);

    // Consume potion if consumable
    if (active.isConsumable) {
      this.consumeItem(active);
    }
  }

  consumeItem(item) {
    if (item.key === 'mini_shield' && this.player.shield < 50) {
      soundManager.playPotionDrink();
      this.player.shield = Math.min(50, this.player.shield + item.amount);
      this.ui.updateHealthAndShield(this.player.health, this.player.shield);
    } else if (item.key === 'medkit' && this.player.health < 100) {
      soundManager.playPotionDrink();
      this.player.health = 100;
      this.ui.updateHealthAndShield(this.player.health, this.player.shield);
    }
  }

  selectBuildMode(type) {
    this.building.setBuildType(type);
    this.player.model.setWeapon('pickaxe');
    this.ui.setActiveBuildSlot(type);
  }

  performWeaponAttack() {
    const activeW = this.weapons.getActiveWeapon();

    const targetables = {
      collidables: [
        this.mapGen.terrain,
        ...this.mapGen.harvestables.map(h => h.mesh),
        ...Array.from(this.building.structures.values()).map(s => s.mesh),
        ...Array.from(this.remotePlayers.values()).map(r => r.root)
      ],
      remotePlayers: Array.from(this.remotePlayers.values()),
      structures: this.building.structures,
      harvestables: this.mapGen.harvestables
    };

    const shot = this.weapons.fire(this.player.pos, this.player.isAiming, targetables);
    if (!shot) return;

    if (activeW.key === 'pickaxe') {
      this.player.model.playPickaxeSwingAnim();
    }

    let hitPlayerId = null;
    let hitStructureId = null;
    let damage = activeW.damage;
    let isHeadshot = false;

    if (shot.hitTarget) {
      if (shot.hitTarget.type === 'player') {
        hitPlayerId = shot.hitTarget.id;
        isHeadshot = shot.hitTarget.isHeadshot;
        damage = isHeadshot ? damage * activeW.headshotMultiplier : damage;
      } else if (shot.hitTarget.type === 'structure') {
        hitStructureId = shot.hitTarget.id;
        damage = activeW.structureDamage;
      } else if (shot.hitTarget.type === 'harvestable') {
        const h = shot.hitTarget.harvestable;
        soundManager.playHarvestHit(h.material);
        this.weapons.showWeakpointOn(h, shot.hitTarget.point, shot.hitTarget.normal);

        // Grant harvest materials
        if (h.material === 'wood') this.building.addMaterials(15, 0, 0);
        else if (h.material === 'stone') this.building.addMaterials(0, 15, 0);
        else if (h.material === 'metal') this.building.addMaterials(0, 0, 15);
        this.ui.updateMaterials(this.building.materials);

        h.hp -= activeW.structureDamage;
        if (h.hp <= 0) {
          this.mapGen.removeHarvestable(h.id);
          this.weapons.hideWeakpoint();
        }
      } else if (shot.hitTarget.type === 'weakpoint') {
        // Critical hit on harvesting weakpoint!
        soundManager.playWeakpointHit();
        const h = shot.hitTarget.harvestable;
        if (h) {
          if (h.material === 'wood') this.building.addMaterials(30, 0, 0);
          else if (h.material === 'stone') this.building.addMaterials(0, 30, 0);
          else if (h.material === 'metal') this.building.addMaterials(0, 0, 30);
          this.ui.updateMaterials(this.building.materials);

          h.hp -= activeW.structureDamage * 2;
          if (h.hp <= 0) {
            this.mapGen.removeHarvestable(h.id);
            this.weapons.hideWeakpoint();
          }
        }
      }
    }

    // Broadcast shoot event to multiplayer server
    this.net.send({
      type: 'shoot',
      weapon: activeW.key,
      weaponName: activeW.name,
      from: { x: shot.from.x, y: shot.from.y, z: shot.from.z },
      to: { x: shot.to.x, y: shot.to.y, z: shot.to.z },
      hitPlayerId,
      hitStructureId,
      damage,
      isHeadshot
    });
  }

  initLobbyUI() {
    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('start-game-btn');
    const nameInput = document.getElementById('player-name-input');
    const roomInput = document.getElementById('room-id-input');
    const shareBtn = document.getElementById('share-room-btn');

    shareBtn.addEventListener('click', () => {
      const room = roomInput.value.trim() || 'main';
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        shareBtn.innerText = 'Copied Link!';
        setTimeout(() => { shareBtn.innerText = 'Share Link'; }, 2000);
      });
    });

    startBtn.addEventListener('click', () => {
      soundManager.resume();
      soundManager.playBusHorn();

      const name = nameInput.value.trim() || 'Jonesy';
      const room = roomInput.value.trim() || 'main';
      this.player.name = name;

      startScreen.style.display = 'none';
      this.renderer.domElement.requestPointerLock();

      // Connect to WebSocket server
      this.net.connect(room, name);

      // Enable WebRTC Voice Chat
      this.voice.enableVoice();
    });
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.1, this.clock.getDelta());

    // Update World & Sky
    this.skybox.update(dt);

    // Update Player Controller
    this.player.update(dt, this.mapGen, this.building.structures);

    // Update Remote Players & Bots
    for (const rp of this.remotePlayers.values()) {
      rp.update(dt);
    }

    // Update Building Preview & Turbo Building
    this.building.update(this.player.pos, this.player.rotY);
    if (this.isMouseDown && this.building.isBuildMode) {
      this.turboBuildTimer += dt;
      if (this.turboBuildTimer >= 0.15) {
        this.turboBuildTimer = 0;
        this.placeCurrentBuildPiece();
      }
    } else {
      this.turboBuildTimer = 0;
    }

    // Update Ground 3D Loot Items & Pickup Prompt
    this.loot.update(this.player.pos, dt);

    // Sniper Scope Overlay Toggle
    const isSniperScope = this.player.isAiming && this.weapons.getActiveWeapon().key === 'sniper';
    this.ui.setSniperScope(isSniperScope);

    // Send player transform to server (tick at ~30Hz)
    if (this.net.connected && this.player.alive) {
      this.net.send({
        type: 'move',
        x: this.player.pos.x,
        y: this.player.pos.y,
        z: this.player.pos.z,
        rotY: this.player.rotY,
        pitch: this.player.pitch,
        state: this.player.state,
        gliderOpen: this.player.gliderOpen,
        isAiming: this.player.isAiming,
        activeWeapon: this.weapons.getActiveWeapon().key
      });
    }

    // Update HUD
    this.ui.updateHealthAndShield(this.player.health, this.player.shield);
    this.ui.setBusPrompt(this.player.state === 'in_bus');

    // Storm status check & vignette
    const inSafe = this.storm.isPositionInsideSafeZone(this.player.pos.x, this.player.pos.z);
    this.ui.setStormVignette(!inSafe && this.player.state !== 'in_bus');
    this.ui.updateStorm(this.storm);

    // Minimap radar render
    this.ui.drawMinimap(
      this.player.pos,
      this.player.rotY,
      this.storm,
      this.otherPlayersData
    );

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new FortniteGame();
});
