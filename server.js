import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from 'dist' if built, or project root
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(__dirname));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Map of roomId -> Room
const rooms = new Map();

// Island dimensions
const MAP_SIZE = 600; // -300 to 300
const MAX_BOTS = 9;

class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map(); // id -> playerData
    this.clients = new Map(); // id -> ws
    this.structures = new Map(); // id -> structureData
    this.chests = [];
    this.lootDrops = [];
    this.eliminations = [];

    // Battle Bus trajectory
    const angle = Math.random() * Math.PI * 2;
    const busDist = 320;
    this.bus = {
      active: true,
      progress: 0,
      startX: Math.cos(angle) * busDist,
      startZ: Math.sin(angle) * busDist,
      endX: Math.cos(angle + Math.PI) * busDist,
      endZ: Math.sin(angle + Math.PI) * busDist,
      height: 180,
      duration: 25 // 25 seconds flight
    };

    // Storm setup
    this.storm = {
      phase: 1,
      maxPhases: 5,
      timer: 45, // 45s countdown before shrink
      isShrinking: false,
      shrinkDuration: 40,
      currentRadius: 280,
      currentX: 0,
      currentZ: 0,
      targetRadius: 180,
      targetX: (Math.random() - 0.5) * 80,
      targetZ: (Math.random() - 0.5) * 80,
      damagePerTick: 1
    };

    this.initChests();
    this.initBots();

    this.tickInterval = setInterval(() => this.tick(), 1000 / 25); // 25 Hz
  }

  initChests() {
    // Generate pre-placed golden chests around landmarks
    const chestLocations = [
      { x: 0, y: 12, z: 0 },
      { x: 35, y: 8, z: -40 },
      { x: -50, y: 15, z: 25 },
      { x: 80, y: 6, z: 60 },
      { x: -90, y: 10, z: -80 },
      { x: 120, y: 18, z: -30 },
      { x: -130, y: 5, z: 110 },
      { x: 40, y: 22, z: 130 },
      { x: -40, y: 8, z: -140 },
      { x: 150, y: 7, z: 80 },
      { x: -160, y: 12, z: -60 },
      { x: 70, y: 14, z: -120 },
      { x: -70, y: 20, z: 70 },
      { x: 0, y: 25, z: 100 }
    ];

    chestLocations.forEach((loc, index) => {
      this.chests.push({
        id: `chest_${index}`,
        x: loc.x,
        y: loc.y,
        z: loc.z,
        opened: false
      });
    });
  }

  initBots() {
    const botNames = [
      'NoobMaster69', 'Ninja_Fan42', 'BushCamper', 'LootGoblin',
      'SweatyBuilder', 'DefaultJonesy', 'RustLord', 'PeelyBoy', 'SniperKing'
    ];

    for (let i = 0; i < MAX_BOTS; i++) {
      const botId = `bot_${i + 1}`;
      const dropTime = 3 + Math.random() * 18; // Drop during bus flight
      const targetX = (Math.random() - 0.5) * 350;
      const targetZ = (Math.random() - 0.5) * 350;

      const bot = {
        id: botId,
        name: botNames[i % botNames.length],
        isBot: true,
        x: 0,
        y: 200,
        z: 0,
        rotY: 0,
        pitch: 0,
        health: 100,
        shield: 50,
        alive: true,
        state: 'in_bus', // in_bus -> skydive -> gliding -> landed -> combat
        dropTimer: dropTime,
        targetX,
        targetZ,
        vy: 0,
        activeWeapon: 'ar',
        materials: { wood: 120, stone: 60, metal: 30 },
        shootCooldown: 0,
        buildCooldown: 0,
        thinkTimer: 0,
        gliderOpen: false
      };
      this.players.set(botId, bot);
    }
  }

  tick() {
    const dt = 1 / 25;

    // 1. Update Battle Bus
    if (this.bus.active) {
      this.bus.progress += dt / this.bus.duration;
      if (this.bus.progress >= 1) {
        this.bus.active = false;
        this.bus.progress = 1;
        // Force drop any remaining players in bus
        for (const [id, p] of this.players.entries()) {
          if (p.state === 'in_bus') {
            this.dropPlayer(id);
          }
        }
      }
    }

    // 2. Update Storm
    this.updateStorm(dt);

    // 3. Update Bots
    this.updateBots(dt);

    // 4. Storm damage tick to all players & bots
    this.applyStormDamage(dt);

    // 5. Broadcast tick state to all connected clients
    this.broadcastState();
  }

  updateStorm(dt) {
    const s = this.storm;
    s.timer -= dt;

    if (!s.isShrinking) {
      if (s.timer <= 0) {
        s.isShrinking = true;
        s.timer = s.shrinkDuration;
        this.broadcast({
          type: 'storm_phase',
          message: `Storm Phase ${s.phase} shrinking!`
        });
      }
    } else {
      // Interpolate radius and center towards target
      const progress = 1 - (s.timer / s.shrinkDuration);
      if (progress >= 1) {
        // Phase complete
        s.isShrinking = false;
        s.currentRadius = s.targetRadius;
        s.currentX = s.targetX;
        s.currentZ = s.targetZ;
        s.phase++;
        s.damagePerTick = Math.min(10, s.phase * 2);

        if (s.phase <= s.maxPhases) {
          s.timer = Math.max(25, 45 - s.phase * 5);
          s.targetRadius = Math.max(15, s.currentRadius * 0.55);
          // Pick new center within current safe zone
          const angle = Math.random() * Math.PI * 2;
          const shift = Math.random() * (s.currentRadius - s.targetRadius) * 0.7;
          s.targetX = s.currentX + Math.cos(angle) * shift;
          s.targetZ = s.currentZ + Math.sin(angle) * shift;
        } else {
          // Final storm fully closed
          s.targetRadius = 0;
          s.timer = 30;
        }
      } else {
        const t = Math.min(1, Math.max(0, progress));
        // Radius shrinkage
        s.currentRadius = s.currentRadius + (s.targetRadius - s.currentRadius) * (dt / (s.timer + dt));
      }
    }
  }

  updateBots(dt) {
    for (const [id, bot] of this.players.entries()) {
      if (!bot.isBot || !bot.alive) continue;

      if (bot.state === 'in_bus') {
        bot.dropTimer -= dt;
        if (bot.dropTimer <= 0) {
          this.dropPlayer(id);
        }
        continue;
      }

      if (bot.state === 'skydive' || bot.state === 'gliding') {
        // Move towards target landing zone
        const dx = bot.targetX - bot.x;
        const dz = bot.targetZ - bot.z;
        const dist = Math.hypot(dx, dz);

        if (bot.y > 50 && dist > 20) {
          bot.x += (dx / dist) * 35 * dt;
          bot.z += (dz / dist) * 35 * dt;
          bot.rotY = Math.atan2(dx, dz);
        }

        if (bot.y < 70) {
          bot.state = 'gliding';
          bot.gliderOpen = true;
          bot.y -= 12 * dt; // slow glide
        } else {
          bot.y -= 38 * dt; // fast skydive
        }

        if (bot.y <= 10) {
          bot.y = 10;
          bot.state = 'landed';
          bot.gliderOpen = false;
        }
        continue;
      }

      // Landed Bot AI
      bot.thinkTimer -= dt;
      bot.shootCooldown -= dt;
      bot.buildCooldown -= dt;

      // Find nearest alive human or other bot to target
      let nearestTarget = null;
      let minDist = 90; // sight range

      for (const [otherId, target] of this.players.entries()) {
        if (otherId === bot.id || !target.alive || target.state === 'in_bus') continue;
        const dist = Math.hypot(target.x - bot.x, target.z - bot.z);
        if (dist < minDist) {
          minDist = dist;
          nearestTarget = target;
        }
      }

      // Storm avoidance check
      const distFromStormCenter = Math.hypot(bot.x - this.storm.currentX, bot.z - this.storm.currentZ);
      const isOutsideStorm = distFromStormCenter > this.storm.currentRadius - 15;

      if (isOutsideStorm) {
        // Head straight to safe zone center
        const sDx = this.storm.currentX - bot.x;
        const sDz = this.storm.currentZ - bot.z;
        const sDist = Math.hypot(sDx, sDz) || 1;
        bot.rotY = Math.atan2(sDx, sDz);
        bot.x += (sDx / sDist) * 9 * dt;
        bot.z += (sDz / sDist) * 9 * dt;
      } else if (nearestTarget) {
        const dx = nearestTarget.x - bot.x;
        const dz = nearestTarget.z - bot.z;
        bot.rotY = Math.atan2(dx, dz);

        // Keep distance around 15-25 units
        if (minDist > 20) {
          bot.x += Math.sin(bot.rotY) * 7 * dt;
          bot.z += Math.cos(bot.rotY) * 7 * dt;
        } else if (minDist < 8) {
          bot.x -= Math.sin(bot.rotY) * 6 * dt;
          bot.z -= Math.cos(bot.rotY) * 6 * dt;
        }

        // Shoot at target
        if (bot.shootCooldown <= 0) {
          bot.shootCooldown = 0.6 + Math.random() * 0.8;
          this.botFireWeapon(bot, nearestTarget);
        }

        // Panic building wall when under fire
        if (bot.health < 60 && bot.materials.wood >= 10 && bot.buildCooldown <= 0) {
          bot.buildCooldown = 3.0;
          bot.materials.wood -= 10;
          this.placeStructure({
            id: `build_${Date.now()}_${Math.random()}`,
            type: 'wall',
            x: Math.round(bot.x / 4) * 4,
            y: Math.round(bot.y / 3) * 3,
            z: Math.round(bot.z / 4) * 4,
            rotY: bot.rotY,
            material: 'wood',
            hp: 150,
            maxHp: 150,
            ownerId: bot.id
          });
        }
      } else {
        // Roam around
        if (bot.thinkTimer <= 0) {
          bot.thinkTimer = 3 + Math.random() * 4;
          bot.rotY += (Math.random() - 0.5) * 2;
        }
        bot.x += Math.sin(bot.rotY) * 5 * dt;
        bot.z += Math.cos(bot.rotY) * 5 * dt;
      }

      // Constrain within map bounds
      bot.x = Math.max(-280, Math.min(280, bot.x));
      bot.z = Math.max(-280, Math.min(280, bot.z));
    }
  }

  botFireWeapon(bot, target) {
    // Simulated accuracy bloom
    const accuracy = 0.65;
    const isHit = Math.random() < accuracy;

    // Bullet tracer broadcast
    this.broadcast({
      type: 'bullet_tracer',
      shooterId: bot.id,
      from: { x: bot.x, y: bot.y + 1.4, z: bot.z },
      to: {
        x: target.x + (Math.random() - 0.5) * 2,
        y: target.y + 1.2 + (Math.random() - 0.5) * 1.5,
        z: target.z + (Math.random() - 0.5) * 2
      },
      weapon: 'ar'
    });

    if (isHit) {
      const isHeadshot = Math.random() < 0.2;
      const baseDamage = 28 + Math.floor(Math.random() * 8);
      const damage = isHeadshot ? baseDamage * 1.5 : baseDamage;

      this.applyDamage(target.id, damage, bot.id, 'Assault Rifle', isHeadshot);
    }
  }

  applyStormDamage(dt) {
    if (!this.stormDamageAcc) this.stormDamageAcc = 0;
    this.stormDamageAcc += dt;

    if (this.stormDamageAcc >= 1.0) {
      this.stormDamageAcc = 0;
      const s = this.storm;

      for (const [id, p] of this.players.entries()) {
        if (!p.alive || p.state === 'in_bus') continue;
        const dist = Math.hypot(p.x - s.currentX, p.z - s.currentZ);
        if (dist > s.currentRadius) {
          this.applyDamage(id, s.damagePerTick, 'storm', 'The Storm', false);
        }
      }
    }
  }

  dropPlayer(id) {
    const p = this.players.get(id);
    if (!p || p.state !== 'in_bus') return;

    // Current position of the bus
    const busX = this.bus.startX + (this.bus.endX - this.bus.startX) * this.bus.progress;
    const busZ = this.bus.startZ + (this.bus.endZ - this.bus.startX) * this.bus.progress;

    p.x = busX + (Math.random() - 0.5) * 10;
    p.y = this.bus.height;
    p.z = busZ + (Math.random() - 0.5) * 10;
    p.state = 'skydive';
    p.gliderOpen = false;

    this.broadcast({
      type: 'player_dropped',
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z
    });
  }

  applyDamage(victimId, amount, attackerId, weaponName, isHeadshot) {
    const victim = this.players.get(victimId);
    if (!victim || !victim.alive) return;

    let remainingDmg = amount;
    let shieldDmg = 0;
    let healthDmg = 0;

    if (victim.shield > 0) {
      shieldDmg = Math.min(victim.shield, remainingDmg);
      victim.shield -= shieldDmg;
      remainingDmg -= shieldDmg;
    }

    if (remainingDmg > 0) {
      healthDmg = remainingDmg;
      victim.health = Math.max(0, victim.health - healthDmg);
    }

    // Broadcast damage event to render floating numbers & play audio
    this.broadcast({
      type: 'damage_dealt',
      victimId,
      attackerId,
      damage: amount,
      shieldHit: shieldDmg > 0,
      headshot: isHeadshot,
      x: victim.x,
      y: victim.y + 1.8,
      z: victim.z,
      victimHealth: victim.health,
      victimShield: victim.shield
    });

    if (victim.health <= 0) {
      this.eliminatePlayer(victimId, attackerId, weaponName);
    }
  }

  eliminatePlayer(victimId, killerId, weaponName) {
    const victim = this.players.get(victimId);
    if (!victim || !victim.alive) return;

    victim.alive = false;
    victim.state = 'eliminated';

    let killerName = 'The Storm';
    if (killerId && killerId !== 'storm') {
      const killer = this.players.get(killerId);
      if (killer) {
        killer.kills = (killer.kills || 0) + 1;
        killerName = killer.name;
      }
    }

    const killFeedEntry = {
      victimName: victim.name,
      killerName: killerName,
      weapon: weaponName || 'Pickaxe',
      timestamp: Date.now()
    };
    this.eliminations.push(killFeedEntry);

    // Drop loot on death
    this.spawnLootDrop({
      x: victim.x,
      y: victim.y + 0.5,
      z: victim.z,
      type: 'mini_shield',
      rarity: 'rare',
      amount: 2
    });

    // Check remaining alive players
    const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);

    this.broadcast({
      type: 'player_eliminated',
      victimId,
      killerId,
      killFeed: killFeedEntry,
      aliveCount: alivePlayers.length
    });

    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      this.broadcast({
        type: 'victory_royale',
        winnerId: winner.id,
        winnerName: winner.name
      });
    }
  }

  spawnLootDrop(loot) {
    const lootItem = {
      id: `loot_${Date.now()}_${Math.random()}`,
      x: loot.x,
      y: loot.y,
      z: loot.z,
      type: loot.type,
      rarity: loot.rarity || 'uncommon',
      amount: loot.amount || 1
    };
    this.lootDrops.push(lootItem);
    this.broadcast({
      type: 'loot_spawned',
      loot: lootItem
    });
  }

  placeStructure(buildData) {
    this.structures.set(buildData.id, buildData);
    this.broadcast({
      type: 'structure_placed',
      structure: buildData
    });
  }

  damageStructure(structureId, amount, attackerId) {
    const s = this.structures.get(structureId);
    if (!s) return;

    s.hp -= amount;
    if (s.hp <= 0) {
      this.structures.delete(structureId);
      this.broadcast({
        type: 'structure_destroyed',
        structureId,
        attackerId
      });
    } else {
      this.broadcast({
        type: 'structure_damaged',
        structureId,
        hp: s.hp,
        maxHp: s.maxHp
      });
    }
  }

  broadcast(message) {
    const str = JSON.stringify(message);
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(str);
      }
    }
  }

  broadcastState() {
    const playersArr = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      pitch: p.pitch,
      health: p.health,
      shield: p.shield,
      alive: p.alive,
      state: p.state,
      gliderOpen: p.gliderOpen,
      isAiming: p.isAiming,
      isShooting: p.isShooting,
      activeWeapon: p.activeWeapon,
      kills: p.kills || 0
    }));

    const busPos = {
      active: this.bus.active,
      x: this.bus.startX + (this.bus.endX - this.bus.startX) * this.bus.progress,
      y: this.bus.height,
      z: this.bus.startZ + (this.bus.endZ - this.bus.startZ) * this.bus.progress,
      progress: this.bus.progress
    };

    const aliveCount = playersArr.filter(p => p.alive).length;

    this.broadcast({
      type: 'tick',
      players: playersArr,
      bus: busPos,
      storm: this.storm,
      aliveCount
    });
  }

  addPlayer(ws, playerData) {
    this.clients.set(playerData.id, ws);
    this.players.set(playerData.id, {
      ...playerData,
      isBot: false,
      health: 100,
      shield: 100,
      alive: true,
      state: 'in_bus',
      gliderOpen: false,
      kills: 0,
      materials: { wood: 100, stone: 50, metal: 20 }
    });

    // Send initial world state snapshot
    ws.send(JSON.stringify({
      type: 'init_state',
      playerId: playerData.id,
      structures: Array.from(this.structures.values()),
      chests: this.chests,
      lootDrops: this.lootDrops,
      storm: this.storm,
      bus: this.bus
    }));

    this.broadcast({
      type: 'player_joined',
      player: this.players.get(playerData.id)
    });
  }

  removePlayer(playerId) {
    this.clients.delete(playerId);
    this.players.delete(playerId);
    this.broadcast({
      type: 'player_left',
      id: playerId
    });

    if (this.clients.size === 0) {
      clearInterval(this.tickInterval);
      rooms.delete(this.id);
    }
  }
}

function getOrCreateRoom(roomId = 'main') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Room(roomId));
  }
  return rooms.get(roomId);
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw);

      switch (data.type) {
        case 'join': {
          const roomId = data.roomId || 'main';
          playerId = data.id || `player_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          currentRoom = getOrCreateRoom(roomId);
          currentRoom.addPlayer(ws, {
            id: playerId,
            name: data.name || 'Jonesy',
            skin: data.skin || 'default'
          });
          break;
        }

        case 'drop_bus': {
          if (currentRoom) {
            currentRoom.dropPlayer(playerId);
          }
          break;
        }

        case 'move': {
          if (currentRoom) {
            const p = currentRoom.players.get(playerId);
            if (p && p.alive) {
              p.x = data.x;
              p.y = data.y;
              p.z = data.z;
              p.rotY = data.rotY;
              p.pitch = data.pitch;
              p.state = data.state;
              p.gliderOpen = data.gliderOpen;
              p.isAiming = data.isAiming;
              p.isShooting = data.isShooting;
              p.activeWeapon = data.activeWeapon;
            }
          }
          break;
        }

        case 'build': {
          if (currentRoom) {
            const p = currentRoom.players.get(playerId);
            if (p && p.alive) {
              currentRoom.placeStructure(data.structure);
            }
          }
          break;
        }

        case 'damage_structure': {
          if (currentRoom) {
            currentRoom.damageStructure(data.structureId, data.damage, playerId);
          }
          break;
        }

        case 'shoot': {
          if (currentRoom) {
            // Broadcast bullet tracer to all players
            currentRoom.broadcast({
              type: 'bullet_tracer',
              shooterId: playerId,
              from: data.from,
              to: data.to,
              weapon: data.weapon
            });

            if (data.hitPlayerId) {
              currentRoom.applyDamage(
                data.hitPlayerId,
                data.damage,
                playerId,
                data.weaponName,
                data.isHeadshot
              );
            } else if (data.hitStructureId) {
              currentRoom.damageStructure(data.hitStructureId, data.damage, playerId);
            }
          }
          break;
        }

        case 'open_chest': {
          if (currentRoom) {
            const chest = currentRoom.chests.find(c => c.id === data.chestId);
            if (chest && !chest.opened) {
              chest.opened = true;
              currentRoom.broadcast({
                type: 'chest_opened',
                chestId: chest.id
              });

              // Pop loot
              const lootPool = ['ar', 'shotgun', 'sniper', 'mini_shield', 'medkit'];
              const chosen = lootPool[Math.floor(Math.random() * lootPool.length)];
              currentRoom.spawnLootDrop({
                x: chest.x + (Math.random() - 0.5) * 1.5,
                y: chest.y + 0.8,
                z: chest.z + (Math.random() - 0.5) * 1.5,
                type: chosen,
                rarity: chosen === 'sniper' ? 'legendary' : (chosen === 'shotgun' ? 'epic' : 'rare'),
                amount: chosen.includes('shield') ? 2 : 1
              });
            }
          }
          break;
        }

        case 'pickup_loot': {
          if (currentRoom) {
            const idx = currentRoom.lootDrops.findIndex(l => l.id === data.lootId);
            if (idx !== -1) {
              const item = currentRoom.lootDrops.splice(idx, 1)[0];
              currentRoom.broadcast({
                type: 'loot_collected',
                lootId: item.id,
                collectorId: playerId,
                item
              });
            }
          }
          break;
        }

        case 'chat_message': {
          if (currentRoom) {
            const p = currentRoom.players.get(playerId);
            currentRoom.broadcast({
              type: 'chat_message',
              senderId: playerId,
              senderName: p ? p.name : 'Soldier',
              text: data.text
            });
          }
          break;
        }

        case 'webrtc_signal': {
          if (currentRoom && data.targetId) {
            const targetWs = currentRoom.clients.get(data.targetId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'webrtc_signal',
                senderId: playerId,
                signal: data.signal
              }));
            }
          }
          break;
        }

        case 'voice_speaking': {
          if (currentRoom) {
            currentRoom.broadcast({
              type: 'voice_speaking',
              speakerId: playerId,
              isSpeaking: data.isSpeaking
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error('WS Error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoom && playerId) {
      currentRoom.removePlayer(playerId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`⚡ Fortnite 3D Battle Royale Server listening on http://localhost:${PORT}`);
});
