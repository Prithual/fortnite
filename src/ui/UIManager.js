export class UIManager {
  constructor(camera) {
    this.camera = camera;

    // Elements
    this.aliveCountEl = document.getElementById('alive-count');
    this.killCountEl = document.getElementById('kill-count');
    this.stormTimerEl = document.getElementById('storm-timer');
    this.stormPhaseEl = document.getElementById('storm-phase-label');

    this.shieldBarEl = document.getElementById('shield-bar');
    this.shieldValEl = document.getElementById('shield-val');
    this.healthBarEl = document.getElementById('health-bar');
    this.healthValEl = document.getElementById('health-val');

    this.matWoodEl = document.getElementById('mat-wood');
    this.matStoneEl = document.getElementById('mat-stone');
    this.matMetalEl = document.getElementById('mat-metal');

    this.busPromptEl = document.getElementById('bus-drop-prompt');
    this.hitmarkerEl = document.getElementById('hitmarker');
    this.damageLayerEl = document.getElementById('damage-numbers-layer');
    this.killFeedEl = document.getElementById('kill-feed');
    this.victoryBannerEl = document.getElementById('victory-banner');
    this.stormVignetteEl = document.getElementById('storm-vignette');
    this.sniperScopeEl = document.getElementById('sniper-scope');
    this.lootPromptEl = document.getElementById('loot-prompt');

    // Minimap
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Weapon slots
    this.weaponSlots = [
      document.getElementById('slot-1'),
      document.getElementById('slot-2'),
      document.getElementById('slot-3'),
      document.getElementById('slot-4'),
      document.getElementById('slot-5')
    ];

    // Building slots
    this.buildSlots = {
      wall: document.getElementById('slot-wall'),
      ramp: document.getElementById('slot-ramp'),
      floor: document.getElementById('slot-floor'),
      roof: document.getElementById('slot-roof')
    };
  }

  updateHealthAndShield(health, shield) {
    const h = Math.max(0, Math.min(100, Math.round(health)));
    const s = Math.max(0, Math.min(100, Math.round(shield)));

    this.healthBarEl.style.width = `${h}%`;
    this.healthValEl.innerText = `${h}`;
    this.shieldBarEl.style.width = `${s}%`;
    this.shieldValEl.innerText = `${s}`;
  }

  updateMaterials(materials) {
    this.matWoodEl.innerText = `${materials.wood}`;
    this.matStoneEl.innerText = `${materials.stone}`;
    this.matMetalEl.innerText = `${materials.metal}`;
  }

  updateStats(alive, kills) {
    this.aliveCountEl.innerText = `${alive}`;
    this.killCountEl.innerText = `${kills}`;
  }

  updateStorm(storm) {
    const mins = Math.floor(storm.timer / 60);
    const secs = storm.timer % 60;
    this.stormTimerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    this.stormPhaseEl.innerText = `STORM PHASE ${storm.phase}`;
  }

  setStormVignette(active) {
    if (active) {
      this.stormVignetteEl.classList.add('active');
    } else {
      this.stormVignetteEl.classList.remove('active');
    }
  }

  setSniperScope(active) {
    if (this.sniperScopeEl) {
      this.sniperScopeEl.style.display = active ? 'block' : 'none';
    }
  }

  setBusPrompt(visible) {
    this.busPromptEl.style.display = visible ? 'block' : 'none';
  }

  setActiveWeaponSlot(slotIndex) {
    this.weaponSlots.forEach((el, idx) => {
      if (idx === slotIndex) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Deselect building slots when a weapon is picked
    Object.values(this.buildSlots).forEach(el => el.classList.remove('active'));
  }

  setActiveBuildSlot(type) {
    Object.entries(this.buildSlots).forEach(([key, el]) => {
      if (key === type) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Deselect weapon slots when building mode is active
    this.weaponSlots.forEach(el => el.classList.remove('active'));
  }

  showHitmarker() {
    this.hitmarkerEl.classList.add('show');
    setTimeout(() => {
      this.hitmarkerEl.classList.remove('show');
    }, 120);
  }

  showDamageNumber(x, y, z, damage, isShield, isHeadshot) {
    // Project 3D world coordinate to 2D screen coordinate
    const pos = { x, y, z };
    const tempVec = new (this.camera.constructor.Vector3 || (x.constructor && x.constructor.name === 'Vector3' ? x.constructor : Object.getPrototypeOf(this.camera.position).constructor))(x, y, z);
    tempVec.project(this.camera);

    // Behind camera check
    if (tempVec.z > 1) return;

    const screenX = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(tempVec.y * 0.5) + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = `dmg-popup ${isHeadshot ? 'dmg-crit' : (isShield ? 'dmg-shield' : 'dmg-health')}`;
    el.innerText = `${Math.round(damage)}`;
    el.style.left = `${screenX + (Math.random() - 0.5) * 20}px`;
    el.style.top = `${screenY + (Math.random() - 0.5) * 20}px`;

    this.damageLayerEl.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 800);
  }

  addKillFeed(killerName, victimName, weapon) {
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerHTML = `<span style="color: #ffd166;">${killerName}</span> eliminated <span style="color: #fff;">${victimName}</span> with <span>${weapon}</span>`;

    this.killFeedEl.appendChild(entry);
    setTimeout(() => {
      if (entry.parentNode) entry.parentNode.removeChild(entry);
    }, 5000);
  }

  showVictoryRoyale() {
    this.victoryBannerEl.classList.add('show');
  }

  drawMinimap(playerPos, playerRotY, storm, otherPlayers) {
    const ctx = this.minimapCtx;
    const w = 160;
    const h = 160;
    const center = w / 2;
    const scale = 0.24; // World units to minimap pixels

    ctx.clearRect(0, 0, w, h);

    // Island circular background
    ctx.fillStyle = '#56a632';
    ctx.beginPath();
    ctx.arc(center, center, 260 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Minimap camera translation offset based on player pos
    const offsetX = center - playerPos.x * scale;
    const offsetZ = center - playerPos.z * scale;

    // Draw Safe Zone (White circle)
    if (storm) {
      const safeX = center + (storm.targetX - playerPos.x) * scale;
      const safeZ = center + (storm.targetZ - playerPos.z) * scale;
      const safeR = storm.targetRadius * scale;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(safeX, safeZ, safeR, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Storm Wall (Purple circle)
      const stormX = center + (storm.currentX - playerPos.x) * scale;
      const stormZ = center + (storm.currentZ - playerPos.z) * scale;
      const stormR = storm.currentRadius * scale;

      ctx.strokeStyle = '#9b5de5';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(stormX, stormZ, stormR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw other alive players & bots
    if (otherPlayers) {
      for (const p of otherPlayers) {
        if (!p.alive || p.state === 'in_bus') continue;
        const px = center + (p.x - playerPos.x) * scale;
        const pz = center + (p.z - playerPos.z) * scale;

        ctx.fillStyle = p.isBot ? '#ffd166' : '#ef476f';
        ctx.beginPath();
        ctx.arc(px, pz, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Player Pointer at center
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-playerRotY); // Rotate arrow

    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
