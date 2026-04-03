// Space Shooter - Game Engine
// Lines-only procedural graphics. No fillRect, arc, drawImage.

var MOBILE_DIFFICULTY_CONFIG = {
  baseSpawnInterval: 1800,
  spawnDecay: 1.015,
  minSpawnInterval: 500,
  trackingSensitivity: 0.02,
  difficultyMultiplier: 1.2,
  levelScoreThreshold: 1000
};

function computeSpawnInterval(score) {
  var interval = MOBILE_DIFFICULTY_CONFIG.baseSpawnInterval *
    Math.pow(MOBILE_DIFFICULTY_CONFIG.spawnDecay, -Math.floor(score / 100));
  return Math.max(MOBILE_DIFFICULTY_CONFIG.minSpawnInterval, interval);
}

function Ship(x) {
  this.x = (x !== undefined) ? x : 0.5;
  this.y = 0.8;
  this.vx = 0;
  this.vy = 0;
}

Ship.prototype.update = function(dt, inputState) {
  if (inputState.touchActive) {
    this.x += (inputState.touchX - this.x) * 0.15;
    this.y += (inputState.touchY - this.y) * 0.15;
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
};

Ship.prototype.render = function(ctx, w, h) {
  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.026;

  ctx.lineWidth = 1.5;

  // Engine thrust glow
  var thrustFlicker = 0.7 + Math.sin(Date.now() / 60) * 0.3;
  var thrustLen = s * (1.2 + Math.sin(Date.now() / 80) * 0.4);
  ctx.strokeStyle = 'rgba(255,120,20,' + thrustFlicker + ')';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.9);
  ctx.lineTo(cx, cy + s * 0.9 + thrustLen);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.9);
  ctx.stroke();

  // Main hull (pointed nose, tapered body)
  ctx.strokeStyle = '#00ddff';
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 2);           // nose
  ctx.lineTo(cx - s * 0.35, cy - s * 0.6);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.9);  // rear left
  ctx.lineTo(cx + s * 0.5, cy + s * 0.9);  // rear right
  ctx.lineTo(cx + s * 0.35, cy - s * 0.6);
  ctx.closePath();
  ctx.stroke();

  // Left wing
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.4);
  ctx.lineTo(cx - s * 1.4, cy + s * 1.0);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.9);
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.5, cy + s * 0.4);
  ctx.lineTo(cx + s * 1.4, cy + s * 1.0);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.9);
  ctx.stroke();

  // Cockpit window
  ctx.strokeStyle = '#66ffff';
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 1.3);
  ctx.lineTo(cx - s * 0.2, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.2, cy - s * 0.5);
  ctx.closePath();
  ctx.stroke();
};

function Enemy(type) {
  this.x = 0;
  this.y = 0;
  this.vx = 0;
  this.vy = 0;
  this.speed = 0.15;
  this.active = true;
  this.type = (type !== undefined) ? type : Math.floor(Math.random() * 3);
  this.health = 1 + Math.floor(this.type / 2);
}

Enemy.prototype.spawn = function(score, speedMultiplier) {
  this.x = 0.1 + Math.random() * 0.8;
  this.y = -0.05;

  speedMultiplier = speedMultiplier || 1;
  // Base speed is gentle; level multiplier does the scaling
  this.speed = 0.08 * speedMultiplier;

  this.vx = (Math.random() - 0.5) * 0.05;
  this.vy = this.speed;
  this.active = true;
};

Enemy.prototype.update = function(dt, playerX) {
  if (!this.active) return;

  if (this.type === 0) {
    // Scout: fast zigzag, slight homing on player X
    var zigzag = Math.sin(Date.now() / 200 + this.x * 15) * 0.12;
    if (playerX !== undefined) {
      var dx = playerX - this.x;
      this.vx += dx * 0.3 * dt;
    }
    this.vx *= 0.97;
    this.x += (this.vx + zigzag) * dt;
    this.y += this.vy * 1.15 * dt;

  } else if (this.type === 1) {
    // Cruiser: tracks player X, strafes horizontally
    if (playerX !== undefined) {
      var dx2 = playerX - this.x;
      this.vx += dx2 * 0.5 * dt;
    }
    this.vx *= 0.95;
    var strafe = Math.sin(Date.now() / 600 + this.y * 8) * 0.03;
    this.x += (this.vx + strafe) * dt;
    this.y += this.vy * dt;

  } else {
    // Destroyer: advance to mid-screen then hold, drift side to side
    var targetY = 0.3 + Math.sin(this.x * 5) * 0.1;
    if (this.y < targetY) {
      this.y += this.vy * dt;
    } else {
      // Hold position, slow drift
      this.y += (targetY - this.y) * 0.5 * dt;
    }
    var drift = Math.sin(Date.now() / 800 + this.x * 3) * 0.06;
    if (playerX !== undefined) {
      var dx3 = playerX - this.x;
      this.vx += dx3 * 0.2 * dt;
    }
    this.vx *= 0.96;
    this.x += (this.vx + drift) * dt;
  }

  // Keep in bounds horizontally
  if (this.x < 0.03) { this.x = 0.03; this.vx = Math.abs(this.vx); }
  if (this.x > 0.97) { this.x = 0.97; this.vx = -Math.abs(this.vx); }

  if (this.y > 1.1) {
    this.active = false;
  }
};

Enemy.prototype.render = function(ctx, w, h) {
  if (!this.active) return;

  var cx = this.x * w;
  var cy = this.y * h;
  var s = Math.min(w, h) * 0.022;
  var pulse = Math.sin(Date.now() / 300) * s * 0.1;

  ctx.lineWidth = 1.5;

  if (this.type === 0) {
    // Scout - small fast dart ship (red)
    ctx.strokeStyle = '#ff4444';
    // Body - inverted V
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.5);           // nose (pointing down)
    ctx.lineTo(cx - s * 0.6, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.3, cy - s * 0.8);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.8);
    ctx.lineTo(cx + s * 0.6, cy - s * 0.5);
    ctx.closePath();
    ctx.stroke();
    // Wings angled back
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.6, cy - s * 0.3);
    ctx.lineTo(cx - s * 1.2, cy - s * 0.9 - pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.6, cy - s * 0.3);
    ctx.lineTo(cx + s * 1.2, cy - s * 0.9 - pulse);
    ctx.stroke();

  } else if (this.type === 1) {
    // Cruiser - bulkier mid-tier ship (orange/yellow)
    ctx.strokeStyle = '#ffaa22';
    // Wide hull
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.3);          // nose
    ctx.lineTo(cx - s * 0.8, cy);
    ctx.lineTo(cx - s * 1.0, cy - s * 0.6);
    ctx.lineTo(cx - s * 0.4, cy - s * 1.0);
    ctx.lineTo(cx + s * 0.4, cy - s * 1.0);
    ctx.lineTo(cx + s * 1.0, cy - s * 0.6);
    ctx.lineTo(cx + s * 0.8, cy);
    ctx.closePath();
    ctx.stroke();
    // Center stripe
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.3);
    ctx.lineTo(cx, cy - s * 1.0);
    ctx.stroke();
    // Engine pods
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
    // Destroyer - big tough ship (purple/magenta)
    ctx.strokeStyle = '#cc44ff';
    // Heavy angular hull
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 1.5);          // nose
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
    // Weapon hardpoints
    ctx.beginPath();
    ctx.moveTo(cx - s * 1.3, cy - s * 0.2);
    ctx.lineTo(cx - s * 1.6, cy + s * 0.2 + pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 1.3, cy - s * 0.2);
    ctx.lineTo(cx + s * 1.6, cy + s * 0.2 + pulse);
    ctx.stroke();
    // Bridge
    ctx.strokeStyle = '#ff66ff';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy - s * 0.3);
    ctx.lineTo(cx, cy + s * 0.2);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.3);
    ctx.stroke();
  }

  // Health pips
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

function Bullet() {
  this.x = 0;
  this.y = 0;
  this.vx = 0;
  this.vy = 0;
  this.speed = 0.8;
  this.active = true;
  this.isEnemyBullet = false;
}

Bullet.prototype.spawnPlayerBullet = function(shipX, shipY) {
  this.x = shipX;
  this.y = shipY - 0.03;
  this.vx = 0;
  this.vy = -this.speed;
  this.isEnemyBullet = false;
  this.active = true;
  return this;
};

Bullet.prototype.spawnEnemyBullet = function(ex, ey, targetX, targetY, score) {
  this.x = ex;
  this.y = ey;
  this.isEnemyBullet = true;
  this.active = true;

  var dx = targetX - ex;
  var dy = targetY - ey;
  var dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Gentle tracking that scales slowly with score
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
    // Enemy bullet - red/orange dot
    ctx.strokeStyle = '#ff4422';
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx + s, cy - s);
    ctx.stroke();
  } else {
    // Player bullet - bright cyan laser
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

function Starfield(count) {
  this.stars = [];
  this.count = count || 80;
  this._init();
}

Starfield.prototype._init = function() {
  this.stars = [];
  for (var i = 0; i < this.count; i++) {
    this.stars.push({
      x: Math.random(),
      y: Math.random(),
      speed: 0.02 + Math.random() * 0.06,
      size: 0.5 + Math.random() * 1.5,
      wrapCount: 0
    });
  }
};

Starfield.prototype.generateStars = function(count) {
  var stars = [];
  for (var i = 0; i < count; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      speed: 0.02 + Math.random() * 0.06,
      size: 0.5 + Math.random() * 1.5,
      wrapCount: 0
    });
  }
  return stars;
};

Starfield.prototype.update = function(dt) {
  for (var i = 0; i < this.stars.length; i++) {
    var star = this.stars[i];
    star.y += star.speed * dt;
    if (star.y > 1.05) {
      star.y = -0.05;
      star.x = Math.random();
      star.wrapCount++;
    }
  }
  return [];
};

Starfield.prototype.render = function(ctx, w, h) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.5;

  for (var i = 0; i < this.stars.length; i++) {
    var star = this.stars[i];
    var sx = star.x * w;
    var sy = star.y * h;
    var sz = star.size;

    ctx.beginPath();
    ctx.moveTo(sx - sz, sy);
    ctx.lineTo(sx + sz, sy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx, sy - sz);
    ctx.lineTo(sx, sy + sz);
    ctx.stroke();
  }
};

// Export for Node.js/Jest
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MOBILE_DIFFICULTY_CONFIG: MOBILE_DIFFICULTY_CONFIG,
    computeSpawnInterval: computeSpawnInterval,
    Ship: Ship,
    Enemy: Enemy,
    Bullet: Bullet,
    Starfield: Starfield
  };
}
