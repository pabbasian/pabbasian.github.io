// Space Shooter - Game Engine (Extended)
// Lines-only procedural graphics. No fillRect, arc, drawImage.
// TDD: All exports tested in test/game.test.js
'use strict';

// ============================================================
// CONFIGURATION
// ============================================================

var MOBILE_DIFFICULTY_CONFIG = {
  baseSpawnInterval: 1800,
  spawnDecay: 1.015,
  minSpawnInterval: 500,
  trackingSensitivity: 0.02,
  difficultyMultiplier: 1.2,
  levelScoreThreshold: 1000
};

var BOSS_CONFIG = {
  triggerScore: 5000,
  bossInterval: 15000,
  baseHealth: 50,
  healthScaleLog: 10,
  defeatBonus: 2000,
  invincibilityTime: 3,
  phase2Threshold: 0.5,
  rageThreshold: 0.25,
  coreWidth: 0.08,
  coreHeight: 0.06,
  weakWidth: 0.05,
  weakHeight: 0.04,
  attackInterval1: 2.0,
  attackInterval2: 1.2,
  rageAttackInterval: 0.7,
  ringBullets: 12,
  homingSpeed: 0.3,
  victoryLapDuration: 3.0,
  victoryDropCount: 8,
  // Boss type definitions - index matches schedule
  types: [
    { name: 'SENTINEL', color1: '#ff2200', color2: '#ff0066', rageColor: '#ff0000',
      healthMult: 1.0, speedMult: 1.0, weakPoints: 2, phases: 2 },
    { name: 'HYDRA', color1: '#00ff88', color2: '#00ffcc', rageColor: '#00ff00',
      healthMult: 1.3, speedMult: 0.8, weakPoints: 3, phases: 2, splits: true },
    { name: 'FORTRESS', color1: '#ffaa00', color2: '#ffdd00', rageColor: '#ff8800',
      healthMult: 1.8, speedMult: 0.2, weakPoints: 4, phases: 1, hasTurrets: true },
    { name: 'PHANTOM', color1: '#aa00ff', color2: '#dd00ff', rageColor: '#ff00ff',
      healthMult: 1.0, speedMult: 1.5, weakPoints: 1, phases: 2, teleports: true },
    { name: 'DREADNOUGHT', color1: '#ff0044', color2: '#ff0088', rageColor: '#ff0000',
      healthMult: 2.5, speedMult: 0.5, weakPoints: 4, phases: 3, hasLaser: true }
  ]
};

// Score thresholds for boss spawns (cycles after last)
var BOSS_SCORE_TRIGGERS = [5000, 15000, 30000, 50000, 75000];

var ENERGY_CONFIG = {
  maxEnergy: 100,
  decayRate: 2,
  dropAmount: 15,
  dropChance: 20,
  spreadDuration: 4,
  spreadMaxShots: 20,
  spreadDrainTo: 60,
  doubleTapWindow: 300
};

var AI_CONFIG = {
  threatRadius: 0.06,
  evasionDuration: 0.3,
  evasionSpeed: 0.3,
  evasionCooldownBase: 1.0,
  evasionCooldownScoreScale: 2000,
  leadAccuracyBase: 0.5,
  leadAccuracyScoreScale: 5000,
  formationBias: 0.3
};

var GRAZE_CONFIG = {
  grazeRadius: 0.055,
  hitRadius: 0.035,
  points: 25,
  slowMoDuration: 0.15,
  slowMoFactor: 0.3
};

var WEAPON_TYPES = {
  normal: { fireRate: 0.14, duration: 0, color: '#00ffff' },
  rapid: { fireRate: 0.055, duration: 10, color: '#ffff00' },
  pierce: { fireRate: 0.18, duration: 10, color: '#ff00ff' },
  homing: { fireRate: 0.25, duration: 10, color: '#00ff00' }
};

// ============================================================
// PURE FUNCTIONS
// ============================================================

// TDD: PASS - computeSpawnInterval tested in config suite
function computeSpawnInterval(score) {
  var interval = MOBILE_DIFFICULTY_CONFIG.baseSpawnInterval *
    Math.pow(MOBILE_DIFFICULTY_CONFIG.spawnDecay, -Math.floor(score / 100));
  return Math.max(MOBILE_DIFFICULTY_CONFIG.minSpawnInterval, interval);
}

/** @returns {{ x: number, y: number, time: number }} */
// TDD: PASS - testPredictiveAiming validates lead calculation
function calculateLead(playerX, playerY, playerVX, playerVY, enemyX, enemyY, bulletSpeed) {
  var dx = playerX - enemyX;
  var dy = playerY - enemyY;
  var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
  var timeToTarget = dist / (bulletSpeed || 0.3);
  return {
    x: playerX + (playerVX || 0) * timeToTarget,
    y: playerY + (playerVY || 0) * timeToTarget,
    time: timeToTarget
  };
}

/** @returns {{ threatened: boolean, side: number }} */
// TDD: PASS - testEnemyEvasiveManeuvers validates threat detection
function checkEvasionThreat(bulletX, bulletY, bulletVX, bulletVY, enemyX, enemyY, threatRadius) {
  var dx = enemyX - bulletX;
  var dy = enemyY - bulletY;
  var distSq = dx * dx + dy * dy;
  if (distSq > threatRadius * threatRadius) {
    return { threatened: false, side: 0 };
  }
  var bulletDirLen = Math.sqrt(bulletVX * bulletVX + bulletVY * bulletVY) || 1;
  var ndx = bulletVX / bulletDirLen;
  var ndy = bulletVY / bulletDirLen;
  var dot = dx * ndx + dy * ndy;
  if (dot <= 0) {
    return { threatened: false, side: 0 };
  }
  var cross = ndx * dy - ndy * dx;
  return { threatened: true, side: cross > 0 ? 1 : -1 };
}

/** @returns {{ x: number, y: number }} */
// TDD: PASS - testFormationAdaptation validates coordinate math
function getFormationOffset(waveIndex, totalInWave, playerX, formationType) {
  var baseSpread = 0.6;
  var bias = (playerX - 0.5) * AI_CONFIG.formationBias;
  var center = 0.5 + bias;
  var x, y;

  if (formationType === 0) {
    var halfWave = (totalInWave - 1) / 2 || 1;
    var t = totalInWave > 1 ? (waveIndex - halfWave) / halfWave : 0;
    x = center + t * baseSpread * 0.5;
    y = -0.05 - Math.abs(t) * 0.15;
  } else if (formationType === 1) {
    var side = waveIndex % 2 === 0 ? -1 : 1;
    var rank = Math.floor(waveIndex / 2);
    x = center + side * (0.2 + rank * 0.1);
    y = -0.05 - rank * 0.08;
  } else {
    var col = waveIndex % 3;
    var row = Math.floor(waveIndex / 3);
    x = center + (col - 1) * 0.2;
    y = -0.05 - row * 0.1;
  }
  return {
    x: Math.max(0.05, Math.min(0.95, x)),
    y: Math.min(0, y)
  };
}

// TDD: PASS - testUILineGeneration validates line arrays
function generateEnergyLines(energy, maxEnergy, x, y, height) {
  var lines = [];
  lines.push({ x1: x, y1: y, x2: x + 0.02, y2: y });
  lines.push({ x1: x, y1: y + height, x2: x + 0.02, y2: y + height });
  lines.push({ x1: x, y1: y, x2: x, y2: y + height });
  lines.push({ x1: x + 0.02, y1: y, x2: x + 0.02, y2: y + height });
  var segments = 20;
  var filled = Math.floor((energy / maxEnergy) * segments);
  var segHeight = height / segments;
  for (var i = 0; i < filled; i++) {
    var sy = y + height - (i + 1) * segHeight;
    lines.push({ x1: x + 0.003, y1: sy + segHeight * 0.2, x2: x + 0.017, y2: sy + segHeight * 0.2 });
  }
  return lines;
}

// Generates segmented boss health bar with phase dividers
// Returns { segments, phaseMarkers, rageLine }
function generateBossHealthData(health, maxHealth, phases, x, y, width) {
  var segments = [];
  var phaseMarkers = [];
  var pct = Math.max(0, health / maxHealth);
  var fillW = width * pct;
  var segW = 0.01;
  var count = Math.floor(fillW / segW);
  for (var i = 0; i < count; i++) {
    var sx = x + i * segW + 0.001;
    segments.push({ x1: sx, y1: y + 0.002, x2: sx, y2: y + 0.01 });
  }
  // Phase divider lines
  for (var p = 1; p < (phases || 2); p++) {
    var px = x + width * (p / phases);
    phaseMarkers.push({ x1: px, y1: y - 0.003, x2: px, y2: y + 0.015 });
  }
  // Rage threshold marker
  var ragePx = x + width * BOSS_CONFIG.rageThreshold;
  return {
    segments: segments,
    phaseMarkers: phaseMarkers,
    rageMarker: { x1: ragePx, y1: y - 0.003, x2: ragePx, y2: y + 0.015 },
    borderLines: [
      { x1: x, y1: y, x2: x + width, y2: y },
      { x1: x, y1: y + 0.012, x2: x + width, y2: y + 0.012 },
      { x1: x, y1: y, x2: x, y2: y + 0.012 },
      { x1: x + width, y1: y, x2: x + width, y2: y + 0.012 }
    ]
  };
}

// Legacy compat
function generateBossHealthLines(health, maxHealth, x, y, width) {
  var data = generateBossHealthData(health, maxHealth, 2, x, y, width);
  return data.borderLines.concat(data.segments);
}

function checkGraze(bulletX, bulletY, playerX, playerY) {
  var dx = bulletX - playerX;
  var dy = bulletY - playerY;
  var distSq = dx * dx + dy * dy;
  var grazeR2 = GRAZE_CONFIG.grazeRadius * GRAZE_CONFIG.grazeRadius;
  var hitR2 = GRAZE_CONFIG.hitRadius * GRAZE_CONFIG.hitRadius;
  return distSq < grazeR2 && distSq >= hitR2;
}

// ============================================================
// ENTITIES
// ============================================================

function Ship(x) {
  this.x = (x !== undefined) ? x : 0.5;
  this.y = 0.8;
  this.vx = 0;
  this.vy = 0;
  this.tilt = 0;
  this.afterimages = [];
  this._afterTimer = 0;
}

Ship.prototype.update = function(dt, inputState) {
  if (inputState.touchActive) {
    this.vx = (inputState.touchX - this.x) * 0.15;
    this.vy = (inputState.touchY - this.y) * 0.15;
    this.x += this.vx;
    this.y += this.vy;
  } else {
    if (inputState.left) this.vx = -0.5;
    else if (inputState.right) this.vx = 0.5;
    else this.vx *= 0.85;

    if (inputState.up) this.vy = -0.5;
    else if (inputState.down) this.vy = 0.5;
    else this.vy *= 0.85;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  this.x = Math.max(0.05, Math.min(0.95, this.x));
  this.y = Math.max(0.1, Math.min(0.95, this.y));

  var targetTilt = Math.max(-0.35, Math.min(0.35, this.vx * 0.7));
  this.tilt += (targetTilt - this.tilt) * 0.12;

  this._afterTimer += dt;
  if (this._afterTimer > 0.03) {
    this._afterTimer = 0;
    this.afterimages.unshift({ x: this.x, y: this.y, t: this.tilt });
    if (this.afterimages.length > 4) this.afterimages.pop();
  }
};

Ship.prototype.render = function(ctx, w, h) {
  var s = Math.min(w, h) * 0.026;

  for (var ai = this.afterimages.length - 1; ai >= 0; ai--) {
    var ghost = this.afterimages[ai];
    var ga = 0.06 * (1 - ai / this.afterimages.length);
    var gcx = ghost.x * w;
    var gcy = ghost.y * h;
    ctx.strokeStyle = 'rgba(0,180,255,' + ga + ')';
    ctx.lineWidth = 1;
    ctx.save();
    ctx.translate(gcx, gcy);
    ctx.rotate(ghost.t);
    ctx.beginPath();
    ctx.moveTo(0, -s * 2);
    ctx.lineTo(-s * 0.5, s * 0.9);
    ctx.lineTo(s * 0.5, s * 0.9);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  var cx = this.x * w;
  var cy = this.y * h;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(this.tilt);

  ctx.lineWidth = 1.5;
  var thrustFlicker = 0.7 + Math.sin(Date.now() / 60) * 0.3;
  var thrustLen = s * (1.2 + Math.sin(Date.now() / 80) * 0.4);
  ctx.strokeStyle = 'rgba(255,120,20,' + thrustFlicker + ')';
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, s * 0.9);
  ctx.lineTo(0, s * 0.9 + thrustLen);
  ctx.lineTo(s * 0.3, s * 0.9);
  ctx.stroke();
  ctx.strokeStyle = '#00ddff';
  ctx.beginPath();
  ctx.moveTo(0, -s * 2);
  ctx.lineTo(-s * 0.35, -s * 0.6);
  ctx.lineTo(-s * 0.5, s * 0.9);
  ctx.lineTo(s * 0.5, s * 0.9);
  ctx.lineTo(s * 0.35, -s * 0.6);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.4);
  ctx.lineTo(-s * 1.4, s * 1.0);
  ctx.lineTo(-s * 0.5, s * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.4);
  ctx.lineTo(s * 1.4, s * 1.0);
  ctx.lineTo(s * 0.5, s * 0.9);
  ctx.stroke();
  ctx.strokeStyle = '#66ffff';
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.3);
  ctx.lineTo(-s * 0.2, -s * 0.5);
  ctx.lineTo(s * 0.2, -s * 0.5);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
};

// ============================================================
// ENEMY (with AI state machine)
// ============================================================

function Enemy(type) {
  this.x = 0;
  this.y = 0;
  this.vx = 0;
  this.vy = 0;
  this.speed = 0.15;
  this.active = true;
  this.type = (type !== undefined) ? type : Math.floor(Math.random() * 3);
  this.health = 1 + Math.floor(this.type / 2);
  this.aiState = 'SPAWN';
  this.aiTimer = 0;
  this.evasionCooldown = 0;
  this.evasionDir = 0;
  this.isAlpha = false;
  this.formationX = 0.5;
  this.formationY = 0.25;
}

// TDD: PASS - enemy spawn/speed tests validate scaling
Enemy.prototype.spawn = function(score, speedMultiplier, formationX, formationY) {
  this.x = (formationX !== undefined) ? formationX : (0.1 + Math.random() * 0.8);
  this.y = (formationY !== undefined) ? formationY : -0.05;
  this.formationX = (formationX !== undefined) ? formationX : this.x;
  this.formationY = 0.25;
  speedMultiplier = speedMultiplier || 1;
  var scoreBoost = 1 + (score || 0) / 5000 * 0.5;
  this.speed = 0.08 * speedMultiplier * scoreBoost;
  this.vx = 0;
  this.vy = this.speed;
  this.active = true;
  this.aiState = 'SPAWN';
  this.aiTimer = 0;
  this.evasionCooldown = 0;
};

// TDD: PASS - testAIStateTransitions validates all transitions
Enemy.prototype.update = function(dt, playerX, playerY, playerVX, playerVY, bullets, score) {
  if (!this.active) return;

  switch (this.aiState) {
    case 'SPAWN':
      this.y += this.speed * dt;
      if (this.y > 0) { this.aiState = 'POSITION'; this.aiTimer = 1.5; }
      break;
    case 'POSITION':
      var dxf = this.formationX - this.x;
      var dyf = this.formationY - this.y;
      this.x += dxf * 2.0 * dt;
      this.y += dyf * 2.0 * dt;
      this.aiTimer -= dt;
      if (this.aiTimer <= 0 || (Math.abs(dxf) < 0.02 && Math.abs(dyf) < 0.02)) {
        this.aiState = 'ENGAGE';
      }
      break;
    case 'ENGAGE':
      this._engageMovement(dt, playerX);
      if (this.evasionCooldown <= 0 && bullets && bullets.length > 0) {
        for (var i = 0; i < bullets.length; i++) {
          var b = bullets[i];
          if (!b.active || b.isEnemyBullet) continue;
          var threat = checkEvasionThreat(b.x, b.y, b.vx, b.vy, this.x, this.y, AI_CONFIG.threatRadius);
          if (threat.threatened) {
            this.aiState = 'EVADE';
            this.aiTimer = AI_CONFIG.evasionDuration;
            this.evasionDir = threat.side;
            break;
          }
        }
      }
      break;
    case 'EVADE':
      this.x += this.evasionDir * AI_CONFIG.evasionSpeed * dt;
      this.y += this.vy * 0.3 * dt;
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.aiState = 'ENGAGE';
        var scoreVal = score || 0;
        this.evasionCooldown = AI_CONFIG.evasionCooldownBase *
          Math.max(0.3, 1 - scoreVal / AI_CONFIG.evasionCooldownScoreScale);
      }
      break;
    case 'DESPAWN':
      this.y += this.speed * 1.5 * dt;
      break;
  }

  if (this.evasionCooldown > 0) this.evasionCooldown -= dt;
  if (this.x < 0.03) { this.x = 0.03; this.vx = Math.abs(this.vx); }
  if (this.x > 0.97) { this.x = 0.97; this.vx = -Math.abs(this.vx); }
  if (this.y > 1.1) { this.active = false; }
};

Enemy.prototype._engageMovement = function(dt, playerX) {
  if (this.type === 0) {
    var zigzag = Math.sin(Date.now() / 200 + this.x * 15) * 0.12;
    if (playerX !== undefined) this.vx += (playerX - this.x) * 0.3 * dt;
    this.vx *= 0.97;
    this.x += (this.vx + zigzag) * dt;
    this.y += this.vy * 1.15 * dt;
  } else if (this.type === 1) {
    if (playerX !== undefined) this.vx += (playerX - this.x) * 0.5 * dt;
    this.vx *= 0.95;
    var strafe = Math.sin(Date.now() / 600 + this.y * 8) * 0.03;
    this.x += (this.vx + strafe) * dt;
    this.y += this.vy * dt;
  } else {
    var targetY = 0.3 + Math.sin(this.x * 5) * 0.1;
    if (this.y < targetY) this.y += this.vy * dt;
    else this.y += (targetY - this.y) * 0.5 * dt;
    var drift = Math.sin(Date.now() / 800 + this.x * 3) * 0.06;
    if (playerX !== undefined) this.vx += (playerX - this.x) * 0.2 * dt;
    this.vx *= 0.96;
    this.x += (this.vx + drift) * dt;
  }
};

Enemy.prototype.render = function(ctx, w, h) {
  if (!this.active) return;
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.022;
  var pulse = Math.sin(Date.now() / 300) * s * 0.1;
  var jitter = this.aiState === 'EVADE' ? (Math.sin(Date.now() / 30) * s * 0.15) : 0;
  cx += jitter;
  ctx.lineWidth = 1.5;

  if (this.type === 0) {
    ctx.strokeStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.5);
    ctx.lineTo(cx - s * 0.6, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.3, cy - s * 0.8);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.8);
    ctx.lineTo(cx + s * 0.6, cy - s * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.6, cy - s * 0.3);
    ctx.lineTo(cx - s * 1.2, cy - s * 0.9 - pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.6, cy - s * 0.3);
    ctx.lineTo(cx + s * 1.2, cy - s * 0.9 - pulse);
    ctx.stroke();
  } else if (this.type === 1) {
    ctx.strokeStyle = '#ffaa22';
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.3);
    ctx.lineTo(cx - s * 0.8, cy);
    ctx.lineTo(cx - s * 1.0, cy - s * 0.6);
    ctx.lineTo(cx - s * 0.4, cy - s * 1.0);
    ctx.lineTo(cx + s * 0.4, cy - s * 1.0);
    ctx.lineTo(cx + s * 1.0, cy - s * 0.6);
    ctx.lineTo(cx + s * 0.8, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.3);
    ctx.lineTo(cx, cy - s * 1.0);
    ctx.stroke();
    ctx.strokeStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.6, cy - s * 1.0);
    ctx.lineTo(cx - s * 0.6, cy - s * 1.4 - pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.6, cy - s * 1.0);
    ctx.lineTo(cx + s * 0.6, cy - s * 1.4 - pulse);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#cc44ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.5);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.3);
    ctx.lineTo(cx - s * 1.3, cy - s * 0.2);
    ctx.lineTo(cx - s * 1.0, cy - s * 1.0);
    ctx.lineTo(cx - s * 0.3, cy - s * 1.2);
    ctx.lineTo(cx + s * 0.3, cy - s * 1.2);
    ctx.lineTo(cx + s * 1.0, cy - s * 1.0);
    ctx.lineTo(cx + s * 1.3, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.3);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 1.3, cy - s * 0.2);
    ctx.lineTo(cx - s * 1.6, cy + s * 0.2 + pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 1.3, cy - s * 0.2);
    ctx.lineTo(cx + s * 1.6, cy + s * 0.2 + pulse);
    ctx.stroke();
    ctx.strokeStyle = '#ff66ff';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy - s * 0.3);
    ctx.lineTo(cx, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.3);
    ctx.stroke();
  }
  if (this.health > 1) {
    ctx.strokeStyle = '#ffffff';
    for (var i = 0; i < this.health; i++) {
      var px = cx - (this.health - 1) * s * 0.35 + i * s * 0.7;
      var py = cy - s * 1.8;
      ctx.beginPath();
      ctx.moveTo(px - 2, py);
      ctx.lineTo(px + 2, py);
      ctx.stroke();
    }
  }
};

// ============================================================
// BULLET
// ============================================================

function Bullet() {
  this.x = 0;
  this.y = 0;
  this.vx = 0;
  this.vy = 0;
  this.speed = 0.8;
  this.active = true;
  this.isEnemyBullet = false;
  this.isSpread = false;
  this.isPiercing = false;
  this.isHoming = false;
  this.grazed = false;
}

Bullet.prototype.spawnPlayerBullet = function(shipX, shipY) {
  this.x = shipX;
  this.y = shipY - 0.03;
  this.vx = 0;
  this.vy = -this.speed;
  this.isEnemyBullet = false;
  this.isSpread = false;
  this.isPiercing = false;
  this.isHoming = false;
  this.grazed = false;
  this.active = true;
  return this;
};

Bullet.prototype.spawnEnemyBullet = function(ex, ey, targetX, targetY, score) {
  this.x = ex;
  this.y = ey;
  this.isEnemyBullet = true;
  this.isSpread = false;
  this.isPiercing = false;
  this.isHoming = false;
  this.grazed = false;
  this.active = true;
  var dx = targetX - ex;
  var dy = targetY - ey;
  var dist = Math.sqrt(dx * dx + dy * dy) || 1;
  var tracking = MOBILE_DIFFICULTY_CONFIG.trackingSensitivity * (1 + score / 2000);
  var spd = this.speed * 0.35 * (1 + tracking);
  this.vx = (dx / dist) * spd;
  this.vy = (dy / dist) * spd;
  return this;
};

Bullet.prototype.spawn = function(x, y) {
  this.x = x;
  this.y = y;
  this.vx = 0;
  this.vy = -this.speed;
  this.active = true;
  return this;
};

Bullet.prototype.update = function(dt) {
  if (!this.active) return;
  this.x += this.vx * dt;
  this.y += this.vy * dt;
  if (this.x < -0.1 || this.x > 1.1 || this.y < -0.1 || this.y > 1.1) {
    this.active = false;
  }
};

Bullet.prototype.render = function(ctx, w, h) {
  if (!this.active) return;
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.008;
  ctx.lineWidth = 1.5;

  if (this.isEnemyBullet) {
    ctx.strokeStyle = '#ff4422';
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx + s, cy - s);
    ctx.stroke();
  } else if (this.isSpread) {
    ctx.strokeStyle = '#00ffaa';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 2);
    ctx.lineTo(cx, cy + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy - s * 1.5);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.5, cy - s * 1.5);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.5);
    ctx.stroke();
  } else if (this.isPiercing) {
    ctx.strokeStyle = '#ff00ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 2.5);
    ctx.lineTo(cx, cy + s * 1.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,0,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.8, cy - s * 1.5);
    ctx.lineTo(cx - s * 0.8, cy + s * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.8, cy - s * 1.5);
    ctx.lineTo(cx + s * 0.8, cy + s * 2);
    ctx.stroke();
  } else if (this.isHoming) {
    ctx.strokeStyle = '#00ff00';
    var spin = Date.now() / 80;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 1.5);
    ctx.lineTo(cx, cy + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(spin) * s, cy + Math.sin(spin) * s);
    ctx.lineTo(cx - Math.cos(spin) * s, cy - Math.sin(spin) * s);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#00ffff';
    var tail = Math.sin(Date.now() / 100) * s * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 1.5);
    ctx.lineTo(cx, cy + s + tail);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy);
    ctx.lineTo(cx + s * 0.4, cy);
    ctx.stroke();
  }
};

// ============================================================
// STARFIELD
// ============================================================

function Starfield(count) {
  this.stars = [];
  this.count = count || 80;
  this.warpFactor = 0;
  this._init();
}

Starfield.prototype._init = function() {
  this.stars = [];
  for (var i = 0; i < this.count; i++) {
    this.stars.push({
      x: Math.random(), y: Math.random(),
      speed: 0.02 + Math.random() * 0.06,
      size: 0.5 + Math.random() * 1.5, wrapCount: 0
    });
  }
};

Starfield.prototype.generateStars = function(count) {
  var stars = [];
  for (var i = 0; i < count; i++) {
    stars.push({
      x: Math.random(), y: Math.random(),
      speed: 0.02 + Math.random() * 0.06,
      size: 0.5 + Math.random() * 1.5, wrapCount: 0
    });
  }
  return stars;
};

Starfield.prototype.update = function(dt) {
  var warp = 1 + this.warpFactor * 8;
  for (var i = 0; i < this.stars.length; i++) {
    var star = this.stars[i];
    star.y += star.speed * dt * warp;
    if (star.y > 1.05) {
      star.y = -0.05;
      star.x = Math.random();
      star.wrapCount++;
    }
  }
  if (this.warpFactor > 0) {
    this.warpFactor = Math.max(0, this.warpFactor - dt * 0.5);
  }
  return [];
};

Starfield.prototype.render = function(ctx, w, h) {
  for (var i = 0; i < this.stars.length; i++) {
    var star = this.stars[i];
    var sx = star.x * w;
    var sy = star.y * h;
    var depth = (star.speed - 0.02) / 0.06;
    var alpha = 0.15 + depth * 0.85;
    var sz = star.size * (0.3 + depth * 0.7);
    var stretch = 1 + this.warpFactor * depth * 25;
    var r = Math.floor(180 + depth * 75);
    var g = Math.floor(200 + depth * 55);
    var b = 255;
    ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    ctx.lineWidth = 0.3 + depth * 0.7;
    ctx.beginPath();
    ctx.moveTo(sx, sy - sz * stretch);
    ctx.lineTo(sx, sy + sz);
    ctx.stroke();
    if (stretch < 1.5) {
      ctx.beginPath();
      ctx.moveTo(sx - sz * 0.5, sy);
      ctx.lineTo(sx + sz * 0.5, sy);
      ctx.stroke();
    }
  }
};

// ============================================================
// BOSS ENTITY — 5 unique types
// ============================================================

function BossEntity(score, typeIndex) {
  var typeIdx = (typeIndex !== undefined) ? typeIndex % BOSS_CONFIG.types.length : 0;
  var typeDef = BOSS_CONFIG.types[typeIdx];

  this.active = false;
  this.typeIndex = typeIdx;
  this.typeDef = typeDef;
  this.x = 0.5;
  this.y = -0.2;
  this.targetY = (typeDef.hasTurrets) ? 0.2 : 0.15;

  var scoreScale = 1 + Math.log(Math.max(1, score)) / 10;
  this.maxHealth = Math.floor(BOSS_CONFIG.baseHealth * typeDef.healthMult * scoreScale);
  this.health = this.maxHealth;
  this.phase = 1;
  this.maxPhase = typeDef.phases || 2;
  this.attackTimer = BOSS_CONFIG.attackInterval1;
  this.rotationAngle = 0;
  this.moveTimer = 0;
  this.defeated = false;
  this.rageMode = false;

  // Weak points - each has { ox, oy, hw, hh, destroyed, attackDisabled }
  this.weakPoints = [];
  this._initWeakPoints();

  // Core hitbox
  this.coreRect = { ox: 0, oy: 0, hw: BOSS_CONFIG.coreWidth / 2, hh: BOSS_CONFIG.coreHeight / 2 };

  // Type-specific state
  this.teleportTimer = 0;
  this.teleportCooldown = 3.5;
  this.vulnerableTimer = 0;
  this.vulnerableCooldown = 4.0;
  this.laserAngle = 0;
  this.laserActive = false;
  this.laserTimer = 0;
  this.coreExposed = false;
  this.turrets = [];
  this.shouldSplit = false;
  this.splitDone = false;

  if (typeDef.hasTurrets) this._initTurrets();
}

BossEntity.prototype._initWeakPoints = function() {
  var typeDef = this.typeDef;
  var n = typeDef.weakPoints || 2;
  this.weakPoints = [];
  if (typeDef.hasTurrets) return; // Fortress uses turrets instead

  var hw = BOSS_CONFIG.weakWidth / 2;
  var hh = BOSS_CONFIG.weakHeight / 2;
  // Arrange weak points evenly
  var offsets = [
    { ox: -0.09, oy: -0.02 },
    { ox: 0.09, oy: -0.02 },
    { ox: 0, oy: -0.08 },
    { ox: 0, oy: 0.04 }
  ];
  for (var i = 0; i < n && i < offsets.length; i++) {
    this.weakPoints.push({
      ox: offsets[i].ox, oy: offsets[i].oy,
      hw: hw, hh: hh,
      destroyed: false,
      attackDisabled: false
    });
  }
};

BossEntity.prototype._initTurrets = function() {
  // Fortress: 4 turrets at cardinal positions
  var turretOffsets = [
    { ox: -0.12, oy: 0 },
    { ox: 0.12, oy: 0 },
    { ox: 0, oy: -0.1 },
    { ox: 0, oy: 0.1 }
  ];
  for (var i = 0; i < 4; i++) {
    this.turrets.push({
      ox: turretOffsets[i].ox,
      oy: turretOffsets[i].oy,
      health: 3,
      maxHealth: 3,
      active: true,
      attackTimer: 1.0 + i * 0.5,
      angle: 0
    });
  }
};

BossEntity.prototype.update = function(dt) {
  if (!this.active) return null;
  this.moveTimer += dt;

  // Enter screen
  if (this.y < this.targetY) {
    this.y += 0.08 * dt;
    if (this.y >= this.targetY) this.y = this.targetY;
    return null;
  }

  var healthPct = this.health / this.maxHealth;

  // Rage mode trigger
  if (!this.rageMode && healthPct <= BOSS_CONFIG.rageThreshold) {
    this.rageMode = true;
    return 'rage';
  }

  // Phase transitions
  var phaseThreshold = 1 - (this.phase / this.maxPhase);
  if (this.phase < this.maxPhase && healthPct <= phaseThreshold) {
    this.phase++;
    return 'phaseChange';
  }

  var rageSpeedBoost = this.rageMode ? 1.8 : 1.0;
  var attackInterval = this.rageMode ? BOSS_CONFIG.rageAttackInterval :
    (this.phase === 1 ? BOSS_CONFIG.attackInterval1 : BOSS_CONFIG.attackInterval2);

  this.rotationAngle += (0.5 + this.phase * 0.4) * dt * rageSpeedBoost;

  // Type-specific movement
  var typeDef = this.typeDef;
  if (typeDef.hasTurrets) {
    // Fortress: stationary, turrets rotate
    for (var ti = 0; ti < this.turrets.length; ti++) {
      if (this.turrets[ti].active) {
        this.turrets[ti].angle += 1.0 * dt * rageSpeedBoost;
        this.turrets[ti].attackTimer -= dt;
      }
    }
    // Expose core when all turrets destroyed
    var allDestroyed = true;
    for (var tj = 0; tj < this.turrets.length; tj++) {
      if (this.turrets[tj].active) { allDestroyed = false; break; }
    }
    this.coreExposed = allDestroyed;
  } else if (typeDef.teleports) {
    // Phantom: stationary most of time, blinks
    this.teleportCooldown -= dt;
    if (this.vulnerableTimer > 0) {
      this.vulnerableTimer -= dt;
    }
    if (this.teleportCooldown <= 0) {
      this.x = 0.2 + Math.random() * 0.6;
      this.y = 0.08 + Math.random() * 0.2;
      this.teleportCooldown = this.rageMode ? 1.5 : 3.0;
      this.vulnerableTimer = 1.0; // Brief window after teleport
      return 'teleport';
    }
  } else if (typeDef.hasLaser) {
    // Dreadnought: slow sweep, laser sweeps in phase 3
    this.x += Math.sin(this.moveTimer * typeDef.speedMult) * 0.06 * dt;
    this.x = Math.max(0.25, Math.min(0.75, this.x));
    if (this.phase >= 3) {
      this.laserTimer -= dt;
      if (this.laserTimer <= 0) {
        this.laserActive = !this.laserActive;
        this.laserTimer = this.laserActive ? 1.5 : 1.0;
        if (this.laserActive) return 'laser';
      }
      if (this.laserActive) {
        this.laserAngle += 1.2 * dt * rageSpeedBoost;
      }
    } else {
      this.x += Math.sin(this.moveTimer * 0.3) * 0.08 * dt;
    }
  } else {
    // Default lateral movement (Sentinel, Hydra)
    this.x += Math.sin(this.moveTimer * typeDef.speedMult) * 0.12 * dt * rageSpeedBoost;
    this.x = Math.max(0.15, Math.min(0.85, this.x));
  }

  // Hydra split at 50% HP
  if (typeDef.splits && !this.splitDone && healthPct <= 0.5) {
    this.shouldSplit = true;
    this.splitDone = true;
  }

  // Attack
  this.attackTimer -= dt * rageSpeedBoost;
  if (this.attackTimer <= 0) {
    this.attackTimer = attackInterval;
    return 'fire';
  }
  return null;
};

/** @returns {string} 'core'|'weak:#'|'turret:#'|'miss' */
BossEntity.prototype.checkBulletHit = function(bx, by) {
  var typeDef = this.typeDef;

  // Fortress: core only hittable when all turrets destroyed
  if (typeDef.hasTurrets) {
    // Check turrets first
    for (var ti = 0; ti < this.turrets.length; ti++) {
      var t = this.turrets[ti];
      if (!t.active) continue;
      var tx = this.x + t.ox;
      var ty = this.y + t.oy;
      if (bx >= tx - 0.025 && bx <= tx + 0.025 && by >= ty - 0.025 && by <= ty + 0.025) {
        return 'turret:' + ti;
      }
    }
    if (!this.coreExposed) return 'miss';
  }

  // Phantom: only vulnerable after teleport
  if (typeDef.teleports && this.vulnerableTimer <= 0) return 'miss';

  // Core check
  var cr = this.coreRect;
  if (bx >= this.x + cr.ox - cr.hw && bx <= this.x + cr.ox + cr.hw &&
      by >= this.y + cr.oy - cr.hh && by <= this.y + cr.oy + cr.hh) {
    return 'core';
  }

  // Weak points
  for (var i = 0; i < this.weakPoints.length; i++) {
    var wp = this.weakPoints[i];
    if (wp.destroyed) continue;
    if (bx >= this.x + wp.ox - wp.hw && bx <= this.x + wp.ox + wp.hw &&
        by >= this.y + wp.oy - wp.hh && by <= this.y + wp.oy + wp.hh) {
      return 'weak:' + i;
    }
  }
  return 'miss';
};

BossEntity.prototype.destroyWeakPoint = function(idx) {
  if (idx < 0 || idx >= this.weakPoints.length) return;
  this.weakPoints[idx].destroyed = true;
  // Hitting weak points deals bonus damage and disables attacks
  this.health = Math.max(0, this.health - 2);
  // Type-specific: destroying weak points disables specific attacks
  // Sentinel: wing weak points disable homing
  // Hydra: head weak points prevent full split
  // Phantom: does not apply (one wp = core)
  // Dreadnought: side weak points reduce laser sweeps
};

/** @returns {Array<{x,y,vx,vy}>} */
BossEntity.prototype.generateAttack = function(playerX, playerY) {
  var attacks = [];
  var typeDef = this.typeDef;
  var rageBoost = this.rageMode ? 1.5 : 1.0;
  var disabledCount = 0;
  for (var wi = 0; wi < this.weakPoints.length; wi++) {
    if (this.weakPoints[wi].destroyed) disabledCount++;
  }

  if (typeDef.hasTurrets) {
    // Fortress: each active turret fires toward player
    var dx0 = playerX - this.x;
    var dy0 = playerY - this.y;
    var d0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
    for (var ti = 0; ti < this.turrets.length; ti++) {
      var tur = this.turrets[ti];
      if (!tur.active) continue;
      if (tur.attackTimer <= 0) {
        tur.attackTimer = this.rageMode ? 0.6 : 1.2;
        var tx = this.x + tur.ox;
        var ty = this.y + tur.oy;
        var tdx = playerX - tx;
        var tdy = playerY - ty;
        var tdist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        var spd = 0.22 * rageBoost;
        attacks.push({ x: tx, y: ty, vx: (tdx / tdist) * spd, vy: (tdy / tdist) * spd });
        if (this.rageMode) {
          // Rage: extra spread shots
          for (var ri = 0; ri < 2; ri++) {
            var ang = Math.atan2(tdy, tdx) + (ri === 0 ? 0.3 : -0.3);
            attacks.push({ x: tx, y: ty, vx: Math.cos(ang) * spd * 0.8, vy: Math.sin(ang) * spd * 0.8 });
          }
        }
      }
    }
    return attacks;
  }

  var count = BOSS_CONFIG.ringBullets;
  var baseSpd = 0.2 * rageBoost;

  if (typeDef.name === 'SENTINEL') {
    // Phase 1: ring, Phase 2: ring + homing
    for (var i = 0; i < count; i++) {
      var a = this.rotationAngle + (i / count) * Math.PI * 2;
      attacks.push({ x: this.x, y: this.y + 0.05, vx: Math.sin(a) * baseSpd, vy: Math.cos(a) * baseSpd });
    }
    if (this.phase >= 2 && disabledCount < 2) {
      var hdx = playerX - this.x;
      var hdy = playerY - this.y;
      var hdist = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
      attacks.push({ x: this.x, y: this.y + 0.05,
        vx: (hdx / hdist) * BOSS_CONFIG.homingSpeed * rageBoost,
        vy: (hdy / hdist) * BOSS_CONFIG.homingSpeed * rageBoost });
    }
    if (this.rageMode) {
      // Dense ring
      for (var j = 0; j < count; j++) {
        var a2 = this.rotationAngle + Math.PI / count + (j / count) * Math.PI * 2;
        attacks.push({ x: this.x, y: this.y + 0.05, vx: Math.sin(a2) * baseSpd * 0.7, vy: Math.cos(a2) * baseSpd * 0.7 });
      }
    }
  } else if (typeDef.name === 'HYDRA') {
    // Tri-directional spread from 3 heads
    var headAngles = [-0.4, 0, 0.4];
    for (var h = 0; h < 3; h++) {
      if (this.weakPoints[h] && this.weakPoints[h].destroyed) continue;
      var baseA = Math.PI / 2; // downward
      var a3 = baseA + headAngles[h];
      for (var s2 = -1; s2 <= 1; s2++) {
        var fa = a3 + s2 * 0.2;
        attacks.push({ x: this.x, y: this.y + 0.06, vx: Math.cos(fa) * baseSpd, vy: Math.sin(fa) * baseSpd });
      }
    }
    if (this.rageMode) {
      for (var k = 0; k < 8; k++) {
        var rA = this.rotationAngle + (k / 8) * Math.PI * 2;
        attacks.push({ x: this.x, y: this.y, vx: Math.sin(rA) * baseSpd * 0.6, vy: Math.cos(rA) * baseSpd * 0.6 });
      }
    }
  } else if (typeDef.name === 'PHANTOM') {
    // Spiral patterns - 3 spiral arms
    for (var sp = 0; sp < 3; sp++) {
      for (var n = 0; n < 5; n++) {
        var spiralA = this.rotationAngle + (sp / 3) * Math.PI * 2 + n * 0.4;
        var r = 0.1 + n * 0.03;
        attacks.push({
          x: this.x + Math.sin(spiralA) * r,
          y: this.y + Math.cos(spiralA) * r,
          vx: Math.sin(spiralA + 0.5) * baseSpd * 0.8,
          vy: Math.cos(spiralA + 0.5) * baseSpd * 0.8
        });
      }
    }
    if (this.rageMode) {
      // Extra spiral arms
      for (var sp2 = 0; sp2 < 3; sp2++) {
        var spiralA2 = this.rotationAngle + Math.PI / 3 + (sp2 / 3) * Math.PI * 2;
        attacks.push({ x: this.x, y: this.y, vx: Math.sin(spiralA2) * baseSpd, vy: Math.cos(spiralA2) * baseSpd });
      }
    }
  } else if (typeDef.name === 'DREADNOUGHT') {
    // Multi-phase attacks
    if (this.phase === 1) {
      for (var dp = 0; dp < count; dp++) {
        var dA = this.rotationAngle + (dp / count) * Math.PI * 2;
        attacks.push({ x: this.x, y: this.y + 0.1, vx: Math.sin(dA) * baseSpd, vy: Math.cos(dA) * baseSpd });
      }
    } else if (this.phase === 2) {
      // Cross + ring
      for (var dp2 = 0; dp2 < 8; dp2++) {
        var dA2 = (dp2 / 8) * Math.PI * 2 + this.rotationAngle;
        attacks.push({ x: this.x, y: this.y, vx: Math.sin(dA2) * baseSpd * 1.2, vy: Math.cos(dA2) * baseSpd * 1.2 });
      }
      var ddx = playerX - this.x;
      var ddy = playerY - this.y;
      var ddist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      attacks.push({ x: this.x, y: this.y, vx: (ddx / ddist) * baseSpd * 1.4, vy: (ddy / ddist) * baseSpd * 1.4 });
    } else {
      // Phase 3: laser sweep bullets emitted along laser
      for (var dp3 = 0; dp3 < 3; dp3++) {
        var lA = this.laserAngle + dp3 * 0.5;
        attacks.push({ x: this.x, y: this.y, vx: Math.cos(lA) * baseSpd * 1.5, vy: Math.sin(lA) * baseSpd * 1.5 });
      }
      if (this.rageMode) {
        for (var dp4 = 0; dp4 < 6; dp4++) {
          var fA = this.rotationAngle + (dp4 / 6) * Math.PI * 2;
          attacks.push({ x: this.x, y: this.y, vx: Math.sin(fA) * baseSpd, vy: Math.cos(fA) * baseSpd });
        }
      }
    }
  }
  return attacks;
};

BossEntity.prototype.render = function(ctx, w, h) {
  if (!this.active) return;
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.06;
  var typeDef = this.typeDef;
  var pulse = Math.sin(this.moveTimer * 3) * s * 0.05;
  var rageFlicker = this.rageMode ? (0.7 + Math.sin(Date.now() / 50) * 0.3) : 1.0;
  var mainColor = this.rageMode ? typeDef.rageColor : (this.phase > 1 ? typeDef.color2 : typeDef.color1);
  ctx.lineWidth = 2;

  if (typeDef.name === 'SENTINEL') {
    this._renderSentinel(ctx, cx, cy, s, pulse, mainColor, rageFlicker, w, h);
  } else if (typeDef.name === 'HYDRA') {
    this._renderHydra(ctx, cx, cy, s, pulse, mainColor, rageFlicker, w, h);
  } else if (typeDef.name === 'FORTRESS') {
    this._renderFortress(ctx, cx, cy, s, pulse, mainColor, rageFlicker, w, h);
  } else if (typeDef.name === 'PHANTOM') {
    this._renderPhantom(ctx, cx, cy, s, pulse, mainColor, rageFlicker, w, h);
  } else if (typeDef.name === 'DREADNOUGHT') {
    this._renderDreadnought(ctx, cx, cy, s, pulse, mainColor, rageFlicker, w, h);
  }

  // Render weak points (glowing vulnerable spots)
  for (var wi = 0; wi < this.weakPoints.length; wi++) {
    var wp = this.weakPoints[wi];
    if (wp.destroyed) continue;
    var wpx = cx + wp.ox * w;
    var wpy = cy + wp.oy * h;
    var wpFlash = 0.5 + Math.sin(Date.now() / 120 + wi) * 0.5;
    ctx.strokeStyle = 'rgba(255,255,100,' + wpFlash + ')';
    ctx.lineWidth = 1.5;
    var wsz = wp.hw * w;
    ctx.beginPath();
    ctx.moveTo(wpx - wsz, wpy);
    ctx.lineTo(wpx, wpy - wsz);
    ctx.lineTo(wpx + wsz, wpy);
    ctx.lineTo(wpx, wpy + wsz);
    ctx.closePath();
    ctx.stroke();
  }

  // Rage visual: screen-edge distortion lines
  if (this.rageMode) {
    var rAlpha = 0.06 + Math.sin(Date.now() / 80) * 0.04;
    ctx.strokeStyle = 'rgba(255,0,0,' + rAlpha + ')';
    ctx.lineWidth = 1;
    for (var ri = 0; ri < 4; ri++) {
      var rx = cx + (Math.random() - 0.5) * s * 4;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(cx + (Math.random() - 0.5) * s * 2, cy - s * 2);
      ctx.stroke();
    }
  }

  // Phantom vulnerability window indicator
  if (typeDef.teleports && this.vulnerableTimer > 0) {
    var vAlpha = Math.min(1.0, this.vulnerableTimer) * 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,' + vAlpha + ')';
    ctx.lineWidth = 2;
    var vR = s * 1.5;
    for (var vi = 0; vi < 8; vi++) {
      var vA = (vi / 8) * Math.PI * 2 + this.moveTimer;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(vA) * vR, cy + Math.sin(vA) * vR);
      ctx.lineTo(cx + Math.cos(vA) * (vR + 8), cy + Math.sin(vA) * (vR + 8));
      ctx.stroke();
    }
  }

  // Dreadnought laser beam
  if (typeDef.hasLaser && this.laserActive) {
    ctx.strokeStyle = 'rgba(255,50,50,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.laserAngle) * w, cy + Math.sin(this.laserAngle) * h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,150,150,0.3)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.laserAngle) * w, cy + Math.sin(this.laserAngle) * h);
    ctx.stroke();
  }
};

BossEntity.prototype._renderSentinel = function(ctx, cx, cy, s, pulse, color, rF, w, h) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 1.5);
  ctx.lineTo(cx - s * 0.6, cy + s * 0.5);
  ctx.lineTo(cx - s * 1.5, cy);
  ctx.lineTo(cx - s * 1.8, cy - s * 0.5 - pulse);
  ctx.lineTo(cx - s * 1.2, cy - s * 1.0);
  ctx.lineTo(cx - s * 0.4, cy - s * 1.2);
  ctx.lineTo(cx + s * 0.4, cy - s * 1.2);
  ctx.lineTo(cx + s * 1.2, cy - s * 1.0);
  ctx.lineTo(cx + s * 1.8, cy - s * 0.5 - pulse);
  ctx.lineTo(cx + s * 1.5, cy);
  ctx.lineTo(cx + s * 0.6, cy + s * 0.5);
  ctx.closePath();
  ctx.stroke();
  // Core target box
  ctx.strokeStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy - s * 0.2);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.2);
  ctx.closePath();
  ctx.stroke();
  // Phase 2 spinning spokes
  if (this.phase >= 2) {
    ctx.strokeStyle = color;
    for (var i = 0; i < 6; i++) {
      var a = this.rotationAngle + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5);
      ctx.lineTo(cx + Math.cos(a) * s * 1.0, cy + Math.sin(a) * s * 1.0);
      ctx.stroke();
    }
  }
};

BossEntity.prototype._renderHydra = function(ctx, cx, cy, s, pulse, color, rF, w, h) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  // Main body
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 1.2);
  ctx.lineTo(cx - s * 1.2, cy + s * 0.2);
  ctx.lineTo(cx - s * 1.5, cy - s * 0.5);
  ctx.lineTo(cx - s * 0.8, cy - s * 0.8);
  ctx.lineTo(cx + s * 0.8, cy - s * 0.8);
  ctx.lineTo(cx + s * 1.5, cy - s * 0.5);
  ctx.lineTo(cx + s * 1.2, cy + s * 0.2);
  ctx.closePath();
  ctx.stroke();
  // Three heads
  var headOffsets = [[-0.7, -1.3], [0, -1.6], [0.7, -1.3]];
  for (var i = 0; i < 3; i++) {
    if (this.weakPoints[i] && this.weakPoints[i].destroyed) continue;
    var hx = cx + headOffsets[i][0] * s;
    var hy = cy + headOffsets[i][1] * s;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(hx, hy - s * 0.5 - pulse);
    ctx.lineTo(hx - s * 0.3, hy);
    ctx.lineTo(hx + s * 0.3, hy);
    ctx.closePath();
    ctx.stroke();
    // Neck
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(cx + headOffsets[i][0] * s * 0.3, cy - s * 0.5);
    ctx.stroke();
  }
  // Core
  ctx.strokeStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, cy - s * 0.15);
  ctx.lineTo(cx - s * 0.25, cy + s * 0.25);
  ctx.lineTo(cx + s * 0.25, cy + s * 0.25);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.15);
  ctx.closePath();
  ctx.stroke();
};

BossEntity.prototype._renderFortress = function(ctx, cx, cy, s, pulse, color, rF, w, h) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  // Main box
  ctx.beginPath();
  ctx.moveTo(cx - s * 1.4, cy - s * 1.0);
  ctx.lineTo(cx + s * 1.4, cy - s * 1.0);
  ctx.lineTo(cx + s * 1.4, cy + s * 1.0);
  ctx.lineTo(cx - s * 1.4, cy + s * 1.0);
  ctx.closePath();
  ctx.stroke();
  // Inner structure
  ctx.strokeStyle = 'rgba(255,170,0,0.4)';
  for (var gi = -1; gi <= 1; gi++) {
    ctx.beginPath();
    ctx.moveTo(cx + gi * s * 0.7, cy - s * 1.0);
    ctx.lineTo(cx + gi * s * 0.7, cy + s * 1.0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 1.4, cy + gi * s * 0.5);
    ctx.lineTo(cx + s * 1.4, cy + gi * s * 0.5);
    ctx.stroke();
  }
  // Core (only exposed when turrets gone)
  if (this.coreExposed) {
    var cFlash = 0.5 + Math.sin(Date.now() / 100) * 0.5;
    ctx.strokeStyle = 'rgba(255,200,0,' + cFlash + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.35, cy - s * 0.3);
    ctx.lineTo(cx - s * 0.35, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.35, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.3);
    ctx.closePath();
    ctx.stroke();
  }
  // Turrets
  for (var ti = 0; ti < this.turrets.length; ti++) {
    var tur = this.turrets[ti];
    if (!tur.active) continue;
    var tx = cx + tur.ox * w;
    var ty = cy + tur.oy * h;
    var turPct = tur.health / tur.maxHealth;
    ctx.strokeStyle = turPct > 0.5 ? color : 'rgba(255,100,0,0.8)';
    ctx.lineWidth = 1.5;
    // Turret body
    ctx.beginPath();
    ctx.moveTo(tx - s * 0.3, ty - s * 0.3);
    ctx.lineTo(tx + s * 0.3, ty - s * 0.3);
    ctx.lineTo(tx + s * 0.3, ty + s * 0.3);
    ctx.lineTo(tx - s * 0.3, ty + s * 0.3);
    ctx.closePath();
    ctx.stroke();
    // Turret barrel
    var bA = tur.angle;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(bA) * s * 0.4, ty + Math.sin(bA) * s * 0.4);
    ctx.stroke();
    // Health pips
    for (var hp = 0; hp < tur.health; hp++) {
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(tx - s * 0.2 + hp * s * 0.2, ty - s * 0.45);
      ctx.lineTo(tx - s * 0.2 + hp * s * 0.2, ty - s * 0.35);
      ctx.stroke();
    }
  }
};

BossEntity.prototype._renderPhantom = function(ctx, cx, cy, s, pulse, color, rF, w, h) {
  // Semi-transparent during non-vulnerable phase
  var alpha = this.vulnerableTimer > 0 ? 1.0 : (0.3 + Math.sin(Date.now() / 200) * 0.2);
  var col = color.replace('#', '');
  var r = parseInt(col.substring(0, 2), 16);
  var g = parseInt(col.substring(2, 4), 16);
  var b = parseInt(col.substring(4, 6), 16);
  ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  ctx.lineWidth = 2;
  // Ethereal diamond shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 1.8 - pulse);
  ctx.lineTo(cx - s * 1.4, cy);
  ctx.lineTo(cx, cy + s * 1.2);
  ctx.lineTo(cx + s * 1.4, cy);
  ctx.closePath();
  ctx.stroke();
  // Inner shifted diamond (ghostly double)
  ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.4) + ')';
  var shift = Math.sin(Date.now() / 150) * s * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx + shift, cy - s * 1.2);
  ctx.lineTo(cx - s * 0.9 + shift, cy);
  ctx.lineTo(cx + shift, cy + s * 0.8);
  ctx.lineTo(cx + s * 0.9 + shift, cy);
  ctx.closePath();
  ctx.stroke();
  // Spinning orbital lines
  ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha * 0.6) + ')';
  for (var oi = 0; oi < 4; oi++) {
    var oA = this.rotationAngle + (oi / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(oA) * s * 0.6, cy + Math.sin(oA) * s * 0.6);
    ctx.lineTo(cx + Math.cos(oA + 0.8) * s * 1.2, cy + Math.sin(oA + 0.8) * s * 1.2);
    ctx.stroke();
  }
  // Core
  ctx.strokeStyle = 'rgba(255,220,0,' + alpha + ')';
  ctx.lineWidth = 1.5;
  var cs = s * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - cs);
  ctx.lineTo(cx + cs, cy);
  ctx.lineTo(cx, cy + cs);
  ctx.lineTo(cx - cs, cy);
  ctx.closePath();
  ctx.stroke();
};

BossEntity.prototype._renderDreadnought = function(ctx, cx, cy, s, pulse, color, rF, w, h) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  // Massive elongated hull
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 2.0 - pulse);
  ctx.lineTo(cx - s * 0.8, cy - s * 1.4);
  ctx.lineTo(cx - s * 2.0, cy - s * 0.5);
  ctx.lineTo(cx - s * 2.2, cy + s * 0.5);
  ctx.lineTo(cx - s * 1.5, cy + s * 1.4);
  ctx.lineTo(cx - s * 0.6, cy + s * 1.6);
  ctx.lineTo(cx + s * 0.6, cy + s * 1.6);
  ctx.lineTo(cx + s * 1.5, cy + s * 1.4);
  ctx.lineTo(cx + s * 2.2, cy + s * 0.5);
  ctx.lineTo(cx + s * 2.0, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.8, cy - s * 1.4);
  ctx.closePath();
  ctx.stroke();
  // Cannon ports along sides
  ctx.lineWidth = 1.5;
  var cannons = [[-1.8, 0], [1.8, 0], [-1.5, 0.8], [1.5, 0.8]];
  for (var ci = 0; ci < cannons.length; ci++) {
    if (this.weakPoints[ci] && this.weakPoints[ci].destroyed) continue;
    var canX = cx + cannons[ci][0] * s;
    var canY = cy + cannons[ci][1] * s;
    ctx.strokeStyle = 'rgba(255,80,80,0.7)';
    ctx.beginPath();
    ctx.moveTo(canX - s * 0.15, canY - s * 0.1);
    ctx.lineTo(canX - s * 0.15, canY + s * 0.1);
    ctx.lineTo(canX + s * 0.15, canY + s * 0.1);
    ctx.lineTo(canX + s * 0.15, canY - s * 0.1);
    ctx.closePath();
    ctx.stroke();
  }
  // Phase indicator lines
  for (var pi = 0; pi < this.phase; pi++) {
    ctx.strokeStyle = this.phase === 3 ? 'rgba(255,0,0,0.8)' : 'rgba(255,80,80,0.4)';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4 + pi * s * 0.4, cy - s * 0.4);
    ctx.lineTo(cx - s * 0.4 + pi * s * 0.4, cy + s * 0.4);
    ctx.stroke();
  }
  // Core
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy - s * 0.3);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.4, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.4, cy - s * 0.3);
  ctx.closePath();
  ctx.stroke();
  // Extra detail on phase 2+
  if (this.phase >= 2) {
    ctx.strokeStyle = color;
    for (var i = 0; i < 4; i++) {
      var a = this.rotationAngle + (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6);
      ctx.lineTo(cx + Math.cos(a) * s * 1.1, cy + Math.sin(a) * s * 1.1);
      ctx.stroke();
    }
  }
};

// ============================================================
// MINI BOSS — tougher elite enemy (appears mid-wave)
// ============================================================

function MiniBoss(score) {
  this.x = 0.5;
  this.y = -0.1;
  this.vx = 0;
  this.vy = 0;
  this.active = true;
  this.defeated = false;
  var hpScale = 1 + (score || 0) / 5000 * 0.3;
  this.maxHealth = Math.floor(8 * hpScale);
  this.health = this.maxHealth;
  this.moveTimer = 0;
  this.attackTimer = 1.5;
  this.color = '#ff8800';
  this.variant = Math.floor(Math.random() * 3); // 0=speeder, 1=gunner, 2=bruiser
}

MiniBoss.prototype.spawn = function(score) {
  this.x = 0.2 + Math.random() * 0.6;
  this.y = -0.1;
  this.active = true;
  this.defeated = false;
  var colors = ['#ff8800', '#ff00aa', '#00ffaa'];
  this.color = colors[this.variant];
};

MiniBoss.prototype.update = function(dt, playerX, playerY) {
  if (!this.active) return null;
  this.moveTimer += dt;

  if (this.y < 0.2) {
    this.y += 0.12 * dt;
    return null;
  }

  // Movement varies by variant
  if (this.variant === 0) {
    // Speeder: fast zigzag
    this.x += Math.sin(this.moveTimer * 3) * 0.3 * dt;
    this.y += 0.05 * dt;
  } else if (this.variant === 1) {
    // Gunner: hover and strafe
    var targetX = playerX || 0.5;
    this.vx += (targetX - this.x) * 0.5 * dt;
    this.vx *= 0.95;
    this.x += this.vx * dt;
    this.y += (0.25 - this.y) * 0.5 * dt;
  } else {
    // Bruiser: slow dive
    this.y += 0.04 * dt;
    this.x += Math.sin(this.moveTimer) * 0.08 * dt;
  }

  this.x = Math.max(0.1, Math.min(0.9, this.x));

  if (this.y > 1.1) { this.active = false; return null; }

  this.attackTimer -= dt;
  if (this.attackTimer <= 0) {
    this.attackTimer = this.variant === 1 ? 0.8 : 1.4;
    return 'fire';
  }
  return null;
};

MiniBoss.prototype.generateAttack = function(playerX, playerY) {
  var attacks = [];
  var dx = (playerX || 0.5) - this.x;
  var dy = (playerY || 0.8) - this.y;
  var dist = Math.sqrt(dx * dx + dy * dy) || 1;
  var spd = 0.28;

  if (this.variant === 0) {
    // Speeder: 3 spread shots
    for (var i = -1; i <= 1; i++) {
      var a = Math.atan2(dy, dx) + i * 0.25;
      attacks.push({ x: this.x, y: this.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd });
    }
  } else if (this.variant === 1) {
    // Gunner: 5-way fan
    for (var j = -2; j <= 2; j++) {
      var a2 = Math.atan2(dy, dx) + j * 0.2;
      attacks.push({ x: this.x, y: this.y, vx: Math.cos(a2) * spd, vy: Math.sin(a2) * spd });
    }
  } else {
    // Bruiser: aimed double shot
    attacks.push({ x: this.x - 0.02, y: this.y, vx: (dx / dist) * spd, vy: (dy / dist) * spd });
    attacks.push({ x: this.x + 0.02, y: this.y, vx: (dx / dist) * spd, vy: (dy / dist) * spd });
  }
  return attacks;
};

MiniBoss.prototype.checkBulletHit = function(bx, by) {
  var dx = bx - this.x;
  var dy = by - this.y;
  return (dx * dx + dy * dy) < 0.055 * 0.055;
};

MiniBoss.prototype.render = function(ctx, w, h) {
  if (!this.active) return;
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.035;
  var pulse = Math.sin(this.moveTimer * 4) * s * 0.1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = this.color;

  if (this.variant === 0) {
    // Speeder: sleek wedge
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.2);
    ctx.lineTo(cx - s * 0.5, cy - s * 0.3);
    ctx.lineTo(cx - s * 1.2, cy - s * 0.8 - pulse);
    ctx.lineTo(cx, cy - s * 1.2);
    ctx.lineTo(cx + s * 1.2, cy - s * 0.8 - pulse);
    ctx.lineTo(cx + s * 0.5, cy - s * 0.3);
    ctx.closePath();
    ctx.stroke();
  } else if (this.variant === 1) {
    // Gunner: wide platform
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.8);
    ctx.lineTo(cx - s * 1.5, cy);
    ctx.lineTo(cx - s * 1.8, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.5, cy - s * 1.0);
    ctx.lineTo(cx + s * 0.5, cy - s * 1.0);
    ctx.lineTo(cx + s * 1.8, cy - s * 0.5);
    ctx.lineTo(cx + s * 1.5, cy);
    ctx.closePath();
    ctx.stroke();
    // Gun barrels
    ctx.beginPath();
    ctx.moveTo(cx - s * 1.3, cy - s * 0.3);
    ctx.lineTo(cx - s * 1.3, cy + s * 0.2 + pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 1.3, cy - s * 0.3);
    ctx.lineTo(cx + s * 1.3, cy + s * 0.2 + pulse);
    ctx.stroke();
  } else {
    // Bruiser: chunky diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 1.5 - pulse);
    ctx.lineTo(cx - s * 1.5, cy);
    ctx.lineTo(cx, cy + s * 1.5);
    ctx.lineTo(cx + s * 1.5, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,136,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx - s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx + s, cy);
    ctx.closePath();
    ctx.stroke();
  }
  // Health bar
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  var hpPct = this.health / this.maxHealth;
  var barW = s * 2;
  ctx.beginPath();
  ctx.moveTo(cx - barW, cy - s * 2.2);
  ctx.lineTo(cx - barW + barW * 2 * hpPct, cy - s * 2.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(cx - barW + barW * 2 * hpPct, cy - s * 2.2);
  ctx.lineTo(cx + barW, cy - s * 2.2);
  ctx.stroke();
};

// ============================================================
// SCORE DROP — victory lap pickups
// ============================================================

function ScoreDrop(x, y) {
  this.x = x;
  this.y = y;
  this.vy = 0.05 + Math.random() * 0.04;
  this.vx = (Math.random() - 0.5) * 0.06;
  this.active = true;
  this.lifetime = 0;
  this.points = 250;
}

ScoreDrop.prototype.update = function(dt) {
  if (!this.active) return;
  this.x += this.vx * dt;
  this.y += this.vy * dt;
  this.lifetime += dt;
  if (this.y > 1.15 || this.lifetime > 6) this.active = false;
};

ScoreDrop.prototype.checkPickup = function(px, py) {
  var dx = this.x - px;
  var dy = this.y - py;
  return (dx * dx + dy * dy) < 0.04 * 0.04;
};

ScoreDrop.prototype.render = function(ctx, w, h) {
  if (!this.active) return;
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.012;
  var pulse = Math.sin(this.lifetime * 10) * s * 0.3;
  var alpha = Math.min(1, Math.min(this.lifetime * 4, (6 - this.lifetime)));
  ctx.strokeStyle = 'rgba(255,220,0,' + alpha + ')';
  ctx.lineWidth = 1.5;
  // Star shape
  for (var i = 0; i < 4; i++) {
    var a = (i / 4) * Math.PI * 2 + this.lifetime * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (s + pulse), cy + Math.sin(a) * (s + pulse));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,150,' + (alpha * 0.6) + ')';
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx + s, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx, cy + s);
  ctx.stroke();
};

// ============================================================
// ENERGY DROP
// ============================================================

function EnergyDrop(x, y) {
  this.x = x;
  this.y = y;
  this.vy = 0.08;
  this.active = true;
  this.lifetime = 0;
}

EnergyDrop.prototype.update = function(dt) {
  if (!this.active) return;
  this.y += this.vy * dt;
  this.lifetime += dt;
  if (this.y > 1.1) this.active = false;
};

EnergyDrop.prototype.checkPickup = function(playerX, playerY) {
  var dx = this.x - playerX;
  var dy = this.y - playerY;
  return (dx * dx + dy * dy) < 0.03 * 0.03;
};

EnergyDrop.prototype.render = function(ctx, w, h) {
  if (!this.active) return;
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.01;
  var pulse = Math.sin(this.lifetime * 8) * s * 0.3;
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s - pulse);
  ctx.lineTo(cx + s + pulse, cy);
  ctx.lineTo(cx, cy + s + pulse);
  ctx.lineTo(cx - s - pulse, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy);
  ctx.lineTo(cx + s * 0.5, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.5);
  ctx.lineTo(cx, cy + s * 0.5);
  ctx.stroke();
};

// ============================================================
// WEAPON DROP
// ============================================================

function WeaponDrop(x, y, type) {
  this.x = x;
  this.y = y;
  this.vy = 0.07;
  this.active = true;
  this.lifetime = 0;
  this.type = type || 'rapid';
}

WeaponDrop.prototype.update = function(dt) {
  if (!this.active) return;
  this.y += this.vy * dt;
  this.lifetime += dt;
  if (this.y > 1.1) this.active = false;
};

WeaponDrop.prototype.checkPickup = function(playerX, playerY) {
  var dx = this.x - playerX;
  var dy = this.y - playerY;
  return (dx * dx + dy * dy) < 0.035 * 0.035;
};

WeaponDrop.prototype.render = function(ctx, w, h) {
  if (!this.active) return;
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.012;
  var spin = this.lifetime * 4;
  var col = WEAPON_TYPES[this.type] ? WEAPON_TYPES[this.type].color : '#ffffff';
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  for (var i = 0; i < 4; i++) {
    var a1 = spin + i * Math.PI / 2;
    var a2 = spin + (i + 1) * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * s, cy + Math.sin(a1) * s);
    ctx.lineTo(cx + Math.cos(a2) * s, cy + Math.sin(a2) * s);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy);
  ctx.lineTo(cx + s * 0.4, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.4);
  ctx.lineTo(cx, cy + s * 0.4);
  ctx.stroke();
};

// ============================================================
// ENERGY SYSTEM
// ============================================================

// TDD: PASS - testEnergyDropAndDecay and testSpreadActivationAndDrain
function EnergySystem() {
  this.energy = 0;
  this.maxEnergy = ENERGY_CONFIG.maxEnergy;
  this.decayRate = ENERGY_CONFIG.decayRate;
  this.lastTapTime = 0;
  this.spreadActive = false;
  this.spreadTimer = 0;
  this.spreadShots = 0;
}

EnergySystem.prototype.collect = function(amount) {
  this.energy = Math.min(this.maxEnergy, this.energy + (amount || ENERGY_CONFIG.dropAmount));
};

EnergySystem.prototype.update = function(dt) {
  if (this.energy > 0 && this.energy < this.maxEnergy) {
    this.energy = Math.max(0, this.energy - this.decayRate * dt);
  }
  if (this.spreadActive) {
    this.spreadTimer -= dt;
    if (this.spreadTimer <= 0 || this.spreadShots >= ENERGY_CONFIG.spreadMaxShots) {
      this.deactivateSpread();
    }
  }
};

EnergySystem.prototype.canActivate = function() {
  return this.energy >= this.maxEnergy && !this.spreadActive;
};

EnergySystem.prototype.tryDoubleTap = function(timestamp) {
  var diff = timestamp - this.lastTapTime;
  this.lastTapTime = timestamp;
  if (diff > 0 && diff <= ENERGY_CONFIG.doubleTapWindow && this.canActivate()) {
    this.activateSpread();
    return true;
  }
  return false;
};

EnergySystem.prototype.activateSpread = function() {
  this.spreadActive = true;
  this.spreadTimer = ENERGY_CONFIG.spreadDuration;
  this.spreadShots = 0;
};

EnergySystem.prototype.deactivateSpread = function() {
  this.spreadActive = false;
  this.spreadTimer = 0;
  this.spreadShots = 0;
  this.energy = ENERGY_CONFIG.spreadDrainTo;
};

EnergySystem.prototype.recordShot = function() {
  if (this.spreadActive) this.spreadShots++;
};

// ============================================================
// BULLET FACTORY
// ============================================================

// TDD: PASS - testSpreadActivationAndDrain validates bullet patterns
var BulletFactory = {
  createPlayerBullets: function(shipX, shipY, isSpread, level) {
    var result = [];
    if (isSpread) {
      var angles = [-15, 0, 15];
      for (var i = 0; i < angles.length; i++) {
        var b = new Bullet();
        var rad = angles[i] * Math.PI / 180;
        b.x = shipX;
        b.y = shipY - 0.03;
        b.vx = Math.sin(rad) * b.speed;
        b.vy = -Math.cos(rad) * b.speed;
        b.isEnemyBullet = false;
        b.isSpread = true;
        b.active = true;
        result.push(b);
      }
    } else {
      var lvl = level || 1;
      var gap = 0.012;
      var bL = new Bullet();
      bL.x = shipX - gap; bL.y = shipY - 0.03; bL.vx = 0; bL.vy = -bL.speed;
      bL.isEnemyBullet = false; bL.active = true; result.push(bL);

      var bR = new Bullet();
      bR.x = shipX + gap; bR.y = shipY - 0.03; bR.vx = 0; bR.vy = -bR.speed;
      bR.isEnemyBullet = false; bR.active = true; result.push(bR);

      if (lvl >= 3) {
        var bC = new Bullet();
        bC.x = shipX; bC.y = shipY - 0.03; bC.vx = 0; bC.vy = -bC.speed * 1.1;
        bC.isEnemyBullet = false; bC.active = true; result.push(bC);
      }

      if (lvl >= 5) {
        var spr = 8 * Math.PI / 180;
        var bOL = new Bullet();
        bOL.x = shipX - gap * 2; bOL.y = shipY - 0.02;
        bOL.vx = -Math.sin(spr) * bOL.speed; bOL.vy = -Math.cos(spr) * bOL.speed;
        bOL.isEnemyBullet = false; bOL.active = true; result.push(bOL);

        var bOR = new Bullet();
        bOR.x = shipX + gap * 2; bOR.y = shipY - 0.02;
        bOR.vx = Math.sin(spr) * bOR.speed; bOR.vy = -Math.cos(spr) * bOR.speed;
        bOR.isEnemyBullet = false; bOR.active = true; result.push(bOR);
      }

      if (lvl >= 8) {
        var rear = 35 * Math.PI / 180;
        var bRL = new Bullet();
        bRL.x = shipX - gap; bRL.y = shipY + 0.01;
        bRL.vx = -Math.sin(rear) * bRL.speed * 0.6; bRL.vy = -Math.cos(rear) * bRL.speed * 0.6;
        bRL.isEnemyBullet = false; bRL.active = true; result.push(bRL);

        var bRR = new Bullet();
        bRR.x = shipX + gap; bRR.y = shipY + 0.01;
        bRR.vx = Math.sin(rear) * bRR.speed * 0.6; bRR.vy = -Math.cos(rear) * bRR.speed * 0.6;
        bRR.isEnemyBullet = false; bRR.active = true; result.push(bRR);
      }
    }
    return result;
  },

  createPiercingBullet: function(shipX, shipY) {
    var result = [];
    var offsets = [-0.014, 0, 0.014];
    for (var i = 0; i < offsets.length; i++) {
      var b = new Bullet();
      b.x = shipX + offsets[i]; b.y = shipY - 0.03; b.vx = 0; b.vy = -b.speed * 1.2;
      b.isEnemyBullet = false; b.isPiercing = true; b.active = true; result.push(b);
    }
    return result;
  },

  createHomingBullet: function(shipX, shipY) {
    var result = [];
    var sides = [-0.015, 0.015];
    for (var i = 0; i < sides.length; i++) {
      var b = new Bullet();
      b.x = shipX + sides[i]; b.y = shipY - 0.03;
      b.vx = sides[i] * 2; b.vy = -b.speed * 0.6;
      b.isEnemyBullet = false; b.isHoming = true; b.active = true; result.push(b);
    }
    return result;
  },

  // TDD: PASS - testPredictiveAiming validates lead bullet creation
  createLeadBullet: function(ex, ey, playerX, playerY, playerVX, playerVY, bulletSpeed, score) {
    var lead = calculateLead(playerX, playerY, playerVX || 0, playerVY || 0, ex, ey, bulletSpeed);
    var accuracy = Math.min(1, AI_CONFIG.leadAccuracyBase + score / AI_CONFIG.leadAccuracyScoreScale);
    var tx = playerX + (lead.x - playerX) * accuracy;
    var ty = playerY + (lead.y - playerY) * accuracy;
    var b = new Bullet();
    var dx = tx - ex;
    var dy = ty - ey;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    b.x = ex; b.y = ey;
    b.vx = (dx / dist) * bulletSpeed; b.vy = (dy / dist) * bulletSpeed;
    b.isEnemyBullet = true; b.isSpread = false; b.active = true;
    return b;
  }
};

// ============================================================
// GAME STATE
// ============================================================

// TDD: PASS - testGameStateIntegrity validates reset cycle
function GameState() {
  this.score = 0;
  this.level = 1;
  this.lives = 3;
  this.gameRunning = false;
  this.isGameOver = false;
  this.bossActive = false;
  this.bossDefeated = false;
  this.invincibilityTimer = 0;
  this.spawnScaleReset = false;
  this.combo = 0;
  this.comboTimer = 0;
  this.comboMultiplier = 1;
  this.maxCombo = 0;
  this.highScore = 0;
  this.grazeCount = 0;
  this.bossScheduleIndex = 0; // which boss type comes next
}

GameState.prototype.reset = function() {
  this.score = 0;
  this.level = 1;
  this.lives = 3;
  this.gameRunning = true;
  this.isGameOver = false;
  this.bossActive = false;
  this.bossDefeated = false;
  this.invincibilityTimer = 0;
  this.spawnScaleReset = false;
  this.combo = 0;
  this.comboTimer = 0;
  this.comboMultiplier = 1;
  this.maxCombo = 0;
  this.grazeCount = 0;
  this.bossScheduleIndex = 0;
};

GameState.prototype.update = function(dt) {
  if (this.invincibilityTimer > 0) {
    this.invincibilityTimer = Math.max(0, this.invincibilityTimer - dt);
  }
  this.level = Math.floor(this.score / 5000) + 1;
  if (this.comboTimer > 0) {
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      this.combo = 0;
      this.comboMultiplier = 1;
    }
  }
};

GameState.prototype.addKill = function(basePoints) {
  this.combo++;
  this.comboTimer = 2.0;
  this.comboMultiplier = 1 + Math.floor(this.combo / 3) * 0.5;
  if (this.combo > this.maxCombo) this.maxCombo = this.combo;
  var points = Math.floor(basePoints * this.comboMultiplier);
  this.score += points;
  return points;
};

GameState.prototype.onBossDefeat = function() {
  this.score += BOSS_CONFIG.defeatBonus;
  this.bossActive = false;
  this.bossDefeated = true;
  this.invincibilityTimer = BOSS_CONFIG.invincibilityTime;
  this.spawnScaleReset = true;
  this.bossScheduleIndex++;
};

// Get the next boss trigger score
GameState.prototype.getNextBossTrigger = function() {
  var idx = this.bossScheduleIndex;
  if (idx < BOSS_SCORE_TRIGGERS.length) return BOSS_SCORE_TRIGGERS[idx];
  // Cycle with increasing gaps after last
  var base = BOSS_SCORE_TRIGGERS[BOSS_SCORE_TRIGGERS.length - 1];
  return base + (idx - BOSS_SCORE_TRIGGERS.length + 1) * BOSS_CONFIG.bossInterval;
};

// Get current boss type index (cycles through 5 types)
GameState.prototype.getBossTypeIndex = function() {
  return this.bossScheduleIndex % BOSS_CONFIG.types.length;
};

// ============================================================
// COORDINATED FIRE
// ============================================================

// TDD: PASS - testCoordinatedFire validates angle computation
/** @returns {Array<number|null>} Firing angles per enemy; null for inactive */
function getCoordinatedFireAngles(waveEnemies, playerX, playerY) {
  var alpha = null;
  var alphaIdx = -1;
  for (var i = 0; i < waveEnemies.length; i++) {
    if (waveEnemies[i].isAlpha && waveEnemies[i].active) {
      alpha = waveEnemies[i];
      alphaIdx = i;
      break;
    }
  }
  if (!alpha) return [];

  var dx = playerX - alpha.x;
  var dy = playerY - alpha.y;
  var baseAngle = Math.atan2(dy, dx);

  var result = [];
  for (var j = 0; j < waveEnemies.length; j++) {
    if (!waveEnemies[j].active) { result.push(null); continue; }
    if (j === alphaIdx) {
      result.push(baseAngle);
    } else {
      var rank = j - alphaIdx;
      result.push(baseAngle + rank * (Math.PI / 12));
    }
  }
  return result;
}

// ============================================================
// OBJECT POOL
// ============================================================

// TDD: PASS - testObjectPool validates reuse and growth
function ObjectPool(Factory, initialSize) {
  this.Factory = Factory;
  this.pool = [];
  for (var i = 0; i < (initialSize || 0); i++) {
    var obj = new Factory();
    obj.active = false;
    this.pool.push(obj);
  }
}

ObjectPool.prototype.get = function() {
  for (var i = 0; i < this.pool.length; i++) {
    if (!this.pool[i].active) {
      this.pool[i].active = true;
      return this.pool[i];
    }
  }
  var obj = new this.Factory();
  obj.active = true;
  this.pool.push(obj);
  return obj;
};

ObjectPool.prototype.release = function(obj) { obj.active = false; };

ObjectPool.prototype.getActiveCount = function() {
  var count = 0;
  for (var i = 0; i < this.pool.length; i++) { if (this.pool[i].active) count++; }
  return count;
};

ObjectPool.prototype.releaseAll = function() {
  for (var i = 0; i < this.pool.length; i++) { this.pool[i].active = false; }
};

// ============================================================
// EXPORTS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MOBILE_DIFFICULTY_CONFIG: MOBILE_DIFFICULTY_CONFIG,
    BOSS_CONFIG: BOSS_CONFIG,
    BOSS_SCORE_TRIGGERS: BOSS_SCORE_TRIGGERS,
    ENERGY_CONFIG: ENERGY_CONFIG,
    AI_CONFIG: AI_CONFIG,
    GRAZE_CONFIG: GRAZE_CONFIG,
    WEAPON_TYPES: WEAPON_TYPES,
    computeSpawnInterval: computeSpawnInterval,
    calculateLead: calculateLead,
    checkEvasionThreat: checkEvasionThreat,
    getFormationOffset: getFormationOffset,
    generateEnergyLines: generateEnergyLines,
    generateBossHealthLines: generateBossHealthLines,
    generateBossHealthData: generateBossHealthData,
    getCoordinatedFireAngles: getCoordinatedFireAngles,
    checkGraze: checkGraze,
    Ship: Ship,
    Enemy: Enemy,
    Bullet: Bullet,
    Starfield: Starfield,
    BossEntity: BossEntity,
    MiniBoss: MiniBoss,
    ScoreDrop: ScoreDrop,
    EnergyDrop: EnergyDrop,
    WeaponDrop: WeaponDrop,
    EnergySystem: EnergySystem,
    BulletFactory: BulletFactory,
    GameState: GameState,
    ObjectPool: ObjectPool
  };
}
