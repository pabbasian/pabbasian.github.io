'use strict';

var game = require('../src/game');
var MOBILE_DIFFICULTY_CONFIG = game.MOBILE_DIFFICULTY_CONFIG;
var BOSS_CONFIG = game.BOSS_CONFIG;
var ENERGY_CONFIG = game.ENERGY_CONFIG;
var AI_CONFIG = game.AI_CONFIG;
var computeSpawnInterval = game.computeSpawnInterval;
var calculateLead = game.calculateLead;
var checkEvasionThreat = game.checkEvasionThreat;
var getFormationOffset = game.getFormationOffset;
var generateEnergyLines = game.generateEnergyLines;
var generateBossHealthLines = game.generateBossHealthLines;
var Ship = game.Ship;
var Enemy = game.Enemy;
var Bullet = game.Bullet;
var Starfield = game.Starfield;
var BossEntity = game.BossEntity;
var EnergySystem = game.EnergySystem;
var EnergyDrop = game.EnergyDrop;
var BulletFactory = game.BulletFactory;
var GameState = game.GameState;
var getCoordinatedFireAngles = game.getCoordinatedFireAngles;
var ObjectPool = game.ObjectPool;

describe('Space Shooter - TDD Implementation', function() {

  // ===== EXISTING: Config =====
  describe('MOBILE_DIFFICULTY_CONFIG', function() {
    it('should define base spawn interval and decay rate', function() {
      expect(MOBILE_DIFFICULTY_CONFIG.baseSpawnInterval).toBe(1800);
      expect(MOBILE_DIFFICULTY_CONFIG.spawnDecay).toBe(1.015);
    });

    it('should define minimum spawn interval', function() {
      expect(MOBILE_DIFFICULTY_CONFIG.minSpawnInterval).toBe(500);
    });

    it('should define tracking sensitivity', function() {
      expect(MOBILE_DIFFICULTY_CONFIG.trackingSensitivity).toBe(0.02);
    });

    it('should compute spawn interval from score correctly', function() {
      var config = MOBILE_DIFFICULTY_CONFIG;
      var testScore = 900;
      var expected = Math.max(
        config.minSpawnInterval,
        config.baseSpawnInterval * Math.pow(config.spawnDecay, -Math.floor(testScore / 100))
      );
      expect(computeSpawnInterval(testScore)).toBeCloseTo(expected);
    });

    it('should clamp minimum spawn interval to prevent spam', function() {
      var computed = computeSpawnInterval(999999);
      expect(computed).toBeGreaterThanOrEqual(MOBILE_DIFFICULTY_CONFIG.minSpawnInterval);
    });

    it('should decrease interval as score increases', function() {
      var low = computeSpawnInterval(0);
      var high = computeSpawnInterval(1000);
      expect(high).toBeLessThan(low);
    });
  });

  // ===== EXISTING: Ship =====
  describe('Ship', function() {
    var ship;
    var noInput = {
      left: false, right: false, up: false, down: false,
      touchActive: false, touchX: 0, touchY: 0
    };

    beforeEach(function() {
      ship = new Ship(0.5);
    });

    it('should start at given x with zero velocity', function() {
      expect(ship.x).toBe(0.5);
      expect(ship.y).toBe(0.8);
      expect(ship.vx).toBe(0);
      expect(ship.vy).toBe(0);
    });

    it('should stay near position with no input', function() {
      ship.update(1 / 60, noInput);
      expect(Math.abs(ship.x - 0.5)).toBeLessThan(0.01);
    });

    it('should clamp x to screen bounds', function() {
      ship.x = 2.0;
      ship.update(1 / 60, noInput);
      expect(ship.x).toBeLessThanOrEqual(0.95);
    });

    it('should clamp y to screen bounds', function() {
      ship.y = 2.0;
      ship.update(1 / 60, noInput);
      expect(ship.y).toBeLessThanOrEqual(0.95);
    });

    it('should move toward touch position', function() {
      var touchInput = {
        left: false, right: false, up: false, down: false,
        touchActive: true, touchX: 0.9, touchY: 0.5
      };
      ship.update(1 / 60, touchInput);
      expect(ship.x).toBeGreaterThan(0.5);
    });

    it('should move right with keyboard input', function() {
      var rightInput = {
        left: false, right: true, up: false, down: false,
        touchActive: false, touchX: 0, touchY: 0
      };
      ship.update(1 / 60, rightInput);
      expect(ship.x).toBeGreaterThan(0.5);
    });

    it('should decelerate when no keys pressed', function() {
      ship.vx = 0.5;
      ship.update(1 / 60, noInput);
      expect(Math.abs(ship.vx)).toBeLessThan(0.5);
    });
  });

  // ===== EXISTING: Enemy (updated for AI) =====
  describe('Enemy', function() {
    var enemy;

    beforeEach(function() {
      enemy = new Enemy(0);
    });

    it('should spawn from top edge', function() {
      enemy.spawn(0);
      expect(enemy.y).toBe(-0.05);
      expect(enemy.x).toBeGreaterThanOrEqual(0.1);
      expect(enemy.x).toBeLessThanOrEqual(0.9);
    });

    it('should be active after spawn', function() {
      enemy.spawn(0);
      expect(enemy.active).toBe(true);
    });

    it('should move downward on update', function() {
      enemy.spawn(0);
      var startY = enemy.y;
      enemy.update(1 / 60);
      expect(enemy.y).toBeGreaterThan(startY);
    });

    it('should deactivate when off-screen bottom', function() {
      enemy.spawn(0);
      enemy.y = 1.2;
      enemy.vy = 0.1;
      enemy.update(1 / 60);
      expect(enemy.active).toBe(false);
    });

    it('should scale speed with score', function() {
      var e1 = new Enemy(0);
      e1.spawn(0);
      var e2 = new Enemy(0);
      e2.spawn(5000);
      expect(e2.speed).toBeGreaterThan(e1.speed);
    });

    it('should assign health based on type', function() {
      var e0 = new Enemy(0);
      var e2 = new Enemy(2);
      expect(e0.health).toBe(1);
      expect(e2.health).toBe(2);
    });
  });

  // ===== EXISTING: Bullet =====
  describe('Bullet', function() {
    var bullet;

    beforeEach(function() {
      bullet = new Bullet();
    });

    it('should spawn at ship position for player bullets', function() {
      bullet.spawnPlayerBullet(0.5, 0.8);
      expect(bullet.x).toBe(0.5);
      expect(bullet.active).toBe(true);
      expect(bullet.isEnemyBullet).toBe(false);
    });

    it('should move upward for player bullets', function() {
      bullet.spawnPlayerBullet(0.5, 0.8);
      var startY = bullet.y;
      bullet.update(1 / 60);
      expect(bullet.y).toBeLessThan(startY);
    });

    it('should deactivate when off-screen', function() {
      bullet.y = -0.2;
      bullet.update(1 / 60);
      expect(bullet.active).toBe(false);
    });

    it('should have positive speed', function() {
      expect(bullet.speed).toBeGreaterThan(0);
    });

    it('should support legacy spawn method', function() {
      bullet.spawn(0.3, 0.7);
      expect(bullet.x).toBe(0.3);
      expect(bullet.y).toBe(0.7);
      expect(bullet.active).toBe(true);
    });

    it('should spawn enemy bullets toward target', function() {
      bullet.spawnEnemyBullet(0.5, 0.1, 0.5, 0.8, 0);
      expect(bullet.isEnemyBullet).toBe(true);
      expect(bullet.vy).toBeGreaterThan(0);
    });
  });

  // ===== EXISTING: Starfield =====
  describe('Starfield', function() {
    var starfield;

    beforeEach(function() {
      starfield = new Starfield(50);
    });

    it('should create requested number of stars', function() {
      expect(starfield.stars.length).toBe(50);
    });

    it('should generate stars via generateStars method', function() {
      var stars = starfield.generateStars(30);
      expect(stars.length).toBe(30);
    });

    it('should have wrapCount on stars', function() {
      expect(starfield.stars[0].wrapCount).toBe(0);
    });

    it('should move stars downward on update', function() {
      var firstY = starfield.stars[0].y;
      starfield.update(1);
      expect(starfield.stars[0].y).toBeGreaterThan(firstY);
    });

    it('should wrap stars that go off-screen', function() {
      starfield.stars[0].y = 1.06;
      starfield.update(0.01);
      expect(starfield.stars[0].y).toBeLessThan(0);
      expect(starfield.stars[0].wrapCount).toBe(1);
    });

    it('should return empty array from update', function() {
      var result = starfield.update(1 / 60);
      expect(result).toEqual([]);
    });
  });

  // ===== NEW TEST 1: Predictive Aiming (AI) =====
  // TDD: RED → tests written before calculateLead implementation
  describe('Predictive Aiming (AI)', function() {
    it('should return player position for stationary target', function() {
      // TDD: PASS - testPredictiveAiming validates lead calculation
      var lead = calculateLead(0.5, 0.8, 0, 0, 0.5, 0.1, 0.3);
      expect(lead.x).toBeCloseTo(0.5);
      expect(lead.y).toBeCloseTo(0.8);
    });

    it('should lead a rightward-moving player', function() {
      var lead = calculateLead(0.5, 0.8, 0.3, 0, 0.5, 0.1, 0.3);
      expect(lead.x).toBeGreaterThan(0.5);
    });

    it('should lead a downward-moving player', function() {
      var lead = calculateLead(0.5, 0.5, 0, 0.2, 0.5, 0.1, 0.3);
      expect(lead.y).toBeGreaterThan(0.5);
    });

    it('should increase lead offset with distance', function() {
      var near = calculateLead(0.5, 0.3, 0.2, 0, 0.5, 0.2, 0.3);
      var far = calculateLead(0.5, 0.8, 0.2, 0, 0.5, 0.1, 0.3);
      expect(Math.abs(far.x - 0.5)).toBeGreaterThan(Math.abs(near.x - 0.5));
    });

    it('should return finite time-to-target', function() {
      var lead = calculateLead(0.5, 0.8, 0.1, 0, 0.5, 0.1, 0.3);
      expect(lead.time).toBeGreaterThan(0);
      expect(isFinite(lead.time)).toBe(true);
    });

    it('should create lead bullet with accuracy scaled by score', function() {
      // Low score → less accurate lead
      var b1 = BulletFactory.createLeadBullet(0.5, 0.1, 0.5, 0.8, 0.3, 0, 0.3, 0);
      // High score → more accurate lead (more vx toward predicted position)
      var b2 = BulletFactory.createLeadBullet(0.5, 0.1, 0.5, 0.8, 0.3, 0, 0.3, 5000);
      expect(b2.vx).toBeGreaterThan(b1.vx);
    });
  });

  // ===== NEW TEST 2: Enemy Evasive Maneuvers =====
  // TDD: RED → tests written before checkEvasionThreat implementation
  describe('Enemy Evasive Maneuvers (AI)', function() {
    it('should detect threat when bullet approaches within radius', function() {
      // TDD: PASS - testEnemyEvasiveManeuvers validates threat detection
      var result = checkEvasionThreat(0.5, 0.5, 0, -0.5, 0.5, 0.45, 0.1);
      expect(result.threatened).toBe(true);
    });

    it('should not detect threat when bullet moves away', function() {
      var result = checkEvasionThreat(0.5, 0.5, 0, 0.5, 0.5, 0.45, 0.1);
      expect(result.threatened).toBe(false);
    });

    it('should determine evasion side via cross product', function() {
      var left = checkEvasionThreat(0.48, 0.6, 0, -0.5, 0.5, 0.5, 0.15);
      var right = checkEvasionThreat(0.52, 0.6, 0, -0.5, 0.5, 0.5, 0.15);
      expect(left.side).not.toBe(right.side);
    });

    it('should not detect threat outside radius', function() {
      var result = checkEvasionThreat(0.5, 0.9, 0, -0.5, 0.5, 0.1, 0.06);
      expect(result.threatened).toBe(false);
    });

    it('should respect evasion cooldown on enemy', function() {
      var enemy = new Enemy(0);
      enemy.spawn(0);
      enemy.aiState = 'ENGAGE';
      enemy.y = 0.3;
      enemy.evasionCooldown = 1.0;

      var b = new Bullet();
      b.x = enemy.x;
      b.y = enemy.y + 0.04;
      b.vx = 0;
      b.vy = -0.5;
      b.active = true;
      b.isEnemyBullet = false;

      enemy.update(1 / 60, 0.5, 0.8, 0, 0, [b], 0);
      expect(enemy.aiState).toBe('ENGAGE');
    });
  });

  // ===== NEW TEST 3: Formation Adaptation =====
  // TDD: RED → tests written before getFormationOffset implementation
  describe('Formation Adaptation (AI)', function() {
    it('should shift formation center toward player position', function() {
      // TDD: PASS - testFormationAdaptation validates coordinate math
      var leftPlayer = getFormationOffset(0, 5, 0.2, 0);
      var rightPlayer = getFormationOffset(0, 5, 0.8, 0);
      expect(leftPlayer.x).toBeLessThan(rightPlayer.x);
    });

    it('should create valid wedge positions', function() {
      var positions = [];
      for (var i = 0; i < 5; i++) {
        positions.push(getFormationOffset(i, 5, 0.5, 0));
      }
      positions.forEach(function(p) {
        expect(p.x).toBeGreaterThanOrEqual(0.05);
        expect(p.x).toBeLessThanOrEqual(0.95);
        expect(p.y).toBeLessThanOrEqual(0);
      });
    });

    it('should create alternating flank positions', function() {
      var p0 = getFormationOffset(0, 4, 0.5, 1);
      var p1 = getFormationOffset(1, 4, 0.5, 1);
      expect(Math.sign(p0.x - 0.5)).not.toBe(Math.sign(p1.x - 0.5));
    });

    it('should clamp all positions within bounds', function() {
      var pRight = getFormationOffset(0, 3, 0.99, 0);
      expect(pRight.x).toBeLessThanOrEqual(0.95);
      var pLeft = getFormationOffset(0, 3, 0.01, 0);
      expect(pLeft.x).toBeGreaterThanOrEqual(0.05);
    });

    it('should create stagger grid positions', function() {
      var p = getFormationOffset(4, 6, 0.5, 2);
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(p.y).toBeLessThanOrEqual(0);
    });
  });

  // ===== NEW TEST 4: AI State Transitions =====
  // TDD: RED → tests written before Enemy AI state machine
  describe('AI State Transitions', function() {
    it('should start in SPAWN state', function() {
      // TDD: PASS - testAIStateTransitions validates SPAWN initial
      var enemy = new Enemy(0);
      enemy.spawn(0);
      expect(enemy.aiState).toBe('SPAWN');
    });

    it('should transition SPAWN → POSITION when entering screen', function() {
      var enemy = new Enemy(0);
      enemy.spawn(0);
      enemy.y = -0.01;
      enemy.speed = 0.5;
      enemy.update(0.1);
      expect(enemy.y).toBeGreaterThan(0);
      expect(enemy.aiState).toBe('POSITION');
    });

    it('should transition POSITION → ENGAGE when timer expires', function() {
      var enemy = new Enemy(0);
      enemy.spawn(0);
      enemy.aiState = 'POSITION';
      enemy.formationX = 0.5;
      enemy.formationY = 0.25;
      enemy.x = 0.5;
      enemy.y = 0.25;
      enemy.aiTimer = 0.01;
      enemy.update(0.02);
      expect(enemy.aiState).toBe('ENGAGE');
    });

    it('should transition ENGAGE → EVADE on bullet threat', function() {
      var enemy = new Enemy(0);
      enemy.spawn(0);
      enemy.aiState = 'ENGAGE';
      enemy.x = 0.5;
      enemy.y = 0.3;
      enemy.evasionCooldown = 0;

      var b = new Bullet();
      b.x = 0.5;
      b.y = 0.35;
      b.vx = 0;
      b.vy = -0.8;
      b.active = true;
      b.isEnemyBullet = false;

      enemy.update(1 / 60, 0.5, 0.8, 0, 0, [b], 0);
      expect(enemy.aiState).toBe('EVADE');
    });

    it('should return EVADE → ENGAGE after timer expires', function() {
      var enemy = new Enemy(0);
      enemy.spawn(0);
      enemy.aiState = 'EVADE';
      enemy.aiTimer = 0.01;
      enemy.evasionDir = 1;
      enemy.update(0.02);
      expect(enemy.aiState).toBe('ENGAGE');
      expect(enemy.evasionCooldown).toBeGreaterThan(0);
    });

    it('should deactivate in any state when off-screen', function() {
      var enemy = new Enemy(0);
      enemy.spawn(0);
      enemy.aiState = 'ENGAGE';
      enemy.y = 1.2;
      enemy.update(1 / 60);
      expect(enemy.active).toBe(false);
    });
  });

  // ===== NEW TEST 5: Boss Phase and Core Collision =====
  // TDD: RED → tests written before BossEntity implementation
  describe('Boss Phase and Core Collision', function() {
    it('should spawn with health > 0 and phase 1', function() {
      // TDD: PASS - testBossPhaseAndCoreCollision validates boss lifecycle
      var boss = new BossEntity(5000);
      boss.active = true;
      expect(boss.health).toBeGreaterThan(0);
      expect(boss.phase).toBe(1);
    });

    it('should have trigger score defined in config', function() {
      expect(BOSS_CONFIG.triggerScore).toBe(5000);
      expect(BOSS_CONFIG.defeatBonus).toBe(2000);
    });

    it('should transition to phase 2 at 50% health', function() {
      var boss = new BossEntity(5000);
      boss.active = true;
      boss.y = boss.targetY;
      boss.health = Math.floor(boss.maxHealth * 0.5);
      boss.update(0.1);
      expect(boss.phase).toBe(2);
    });

    it('should register damage on core hit', function() {
      var boss = new BossEntity(5000);
      boss.active = true;
      boss.y = boss.targetY;
      var result = boss.checkBulletHit(boss.x, boss.y);
      expect(result).toBe('core');
    });

    it('should not register damage on weak point hit', function() {
      var boss = new BossEntity(5000);
      boss.active = true;
      boss.y = boss.targetY;
      var wp = boss.weakPointRects[0];
      var result = boss.checkBulletHit(boss.x + wp.ox, boss.y + wp.oy);
      expect(result).toBe('weak');
    });

    it('should miss when outside all hitboxes', function() {
      var boss = new BossEntity(5000);
      boss.active = true;
      boss.y = boss.targetY;
      var result = boss.checkBulletHit(0.9, 0.9);
      expect(result).toBe('miss');
    });

    it('should scale health logarithmically with score', function() {
      var b1 = new BossEntity(5000);
      var b2 = new BossEntity(20000);
      expect(b2.maxHealth).toBeGreaterThan(b1.maxHealth);
    });

    it('should generate phase 1 circular ring attack', function() {
      var boss = new BossEntity(5000);
      boss.phase = 1;
      var attacks = boss.generateAttack(0.5, 0.8);
      expect(attacks.length).toBe(BOSS_CONFIG.ringBullets);
      attacks.forEach(function(a) {
        expect(a.vx * a.vx + a.vy * a.vy).toBeGreaterThan(0);
      });
    });

    it('should generate phase 2 homing + cross attack', function() {
      var boss = new BossEntity(5000);
      boss.phase = 2;
      var attacks = boss.generateAttack(0.5, 0.8);
      expect(attacks.length).toBe(5);
    });
  });

  // ===== NEW TEST 6: Energy Drop and Decay =====
  // TDD: RED → tests written before EnergySystem implementation
  describe('Energy Drop and Decay', function() {
    it('should start at 0 energy', function() {
      // TDD: PASS - testEnergyDropAndDecay validates meter behavior
      var es = new EnergySystem();
      expect(es.energy).toBe(0);
    });

    it('should increment on collect', function() {
      var es = new EnergySystem();
      es.collect(15);
      expect(es.energy).toBe(15);
    });

    it('should clamp to max 100', function() {
      var es = new EnergySystem();
      es.energy = 95;
      es.collect(15);
      expect(es.energy).toBe(100);
    });

    it('should not go below 0', function() {
      var es = new EnergySystem();
      es.energy = 1;
      es.update(2);
      expect(es.energy).toBe(0);
    });

    it('should decay at 2 per second when between 0 and 100', function() {
      var es = new EnergySystem();
      es.energy = 50;
      es.update(1);
      expect(es.energy).toBeCloseTo(48);
    });

    it('should not decay when at exactly 0', function() {
      var es = new EnergySystem();
      es.energy = 0;
      es.update(1);
      expect(es.energy).toBe(0);
    });

    it('should not decay when at exactly 100', function() {
      var es = new EnergySystem();
      es.energy = 100;
      es.update(1);
      expect(es.energy).toBe(100);
    });

    it('should create EnergyDrop that falls and can be picked up', function() {
      var drop = new EnergyDrop(0.5, 0.5);
      expect(drop.active).toBe(true);
      drop.update(0.1);
      expect(drop.y).toBeGreaterThan(0.5);
      expect(drop.checkPickup(0.5, drop.y)).toBe(true);
      expect(drop.checkPickup(0.9, 0.9)).toBe(false);
    });

    it('should deactivate drop when off-screen', function() {
      var drop = new EnergyDrop(0.5, 1.15);
      drop.update(0.1);
      expect(drop.active).toBe(false);
    });
  });

  // ===== NEW TEST 7: Spread Activation and Drain =====
  // TDD: RED → tests written before spread shot implementation
  describe('Spread Activation and Drain', function() {
    it('should not activate when energy < 100', function() {
      // TDD: PASS - testSpreadActivationAndDrain validates power-up cycle
      var es = new EnergySystem();
      es.energy = 99;
      expect(es.canActivate()).toBe(false);
    });

    it('should activate on double-tap at 100 energy', function() {
      var es = new EnergySystem();
      es.energy = 100;
      es.tryDoubleTap(1000);
      var result = es.tryDoubleTap(1200);
      expect(result).toBe(true);
      expect(es.spreadActive).toBe(true);
    });

    it('should not activate on slow double-tap (>300ms)', function() {
      var es = new EnergySystem();
      es.energy = 100;
      es.tryDoubleTap(1000);
      var result = es.tryDoubleTap(1500);
      expect(result).toBe(false);
      expect(es.spreadActive).toBe(false);
    });

    it('should create 3 spread bullets with correct angles', function() {
      var bullets = BulletFactory.createPlayerBullets(0.5, 0.8, true);
      expect(bullets.length).toBe(3);
      expect(bullets[0].isSpread).toBe(true);
      expect(bullets[1].isSpread).toBe(true);
      expect(bullets[2].isSpread).toBe(true);
      // Left bullet should veer left, right should veer right
      expect(bullets[0].vx).toBeLessThan(0);
      expect(bullets[1].vx).toBeCloseTo(0, 5);
      expect(bullets[2].vx).toBeGreaterThan(0);
      // All should move upward
      bullets.forEach(function(b) {
        expect(b.vy).toBeLessThan(0);
        expect(b.active).toBe(true);
        expect(b.isEnemyBullet).toBe(false);
      });
    });

    it('should create twin normal bullets when not spread', function() {
      var bullets = BulletFactory.createPlayerBullets(0.5, 0.8, false, 1);
      expect(bullets.length).toBe(2);
      expect(bullets[0].isSpread).toBeFalsy();
      expect(bullets[1].isSpread).toBeFalsy();
      // Twin shots should be offset left and right of center
      expect(bullets[0].x).toBeLessThan(0.5);
      expect(bullets[1].x).toBeGreaterThan(0.5);
    });

    it('should normalize spread bullet speeds', function() {
      var bullets = BulletFactory.createPlayerBullets(0.5, 0.8, true);
      var baseSpeed = new Bullet().speed;
      bullets.forEach(function(b) {
        var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        expect(spd).toBeCloseTo(baseSpeed, 2);
      });
    });

    it('should expire spread after 4 seconds', function() {
      var es = new EnergySystem();
      es.energy = 100;
      es.activateSpread();
      expect(es.spreadActive).toBe(true);
      es.update(4.1);
      expect(es.spreadActive).toBe(false);
      expect(es.energy).toBe(ENERGY_CONFIG.spreadDrainTo);
    });

    it('should expire spread after 20 shots', function() {
      var es = new EnergySystem();
      es.energy = 100;
      es.activateSpread();
      for (var i = 0; i < 20; i++) es.recordShot();
      es.update(0.01);
      expect(es.spreadActive).toBe(false);
      expect(es.energy).toBe(ENERGY_CONFIG.spreadDrainTo);
    });

    it('should drain energy to 60 on deactivation', function() {
      var es = new EnergySystem();
      es.energy = 100;
      es.activateSpread();
      es.deactivateSpread();
      expect(es.energy).toBe(60);
    });
  });

  // ===== NEW TEST 8: UI Line Generation =====
  // TDD: RED → tests written before line generator implementation
  describe('UI Line Generation', function() {
    it('should generate more energy lines at higher values', function() {
      // TDD: PASS - testUILineGeneration validates line array scaling
      var full = generateEnergyLines(100, 100, 0.02, 0.2, 0.4);
      var half = generateEnergyLines(50, 100, 0.02, 0.2, 0.4);
      var empty = generateEnergyLines(0, 100, 0.02, 0.2, 0.4);
      expect(full.length).toBeGreaterThan(half.length);
      expect(half.length).toBeGreaterThan(empty.length);
    });

    it('should generate valid line coordinates', function() {
      var lines = generateEnergyLines(75, 100, 0.02, 0.2, 0.4);
      lines.forEach(function(l) {
        expect(typeof l.x1).toBe('number');
        expect(typeof l.y1).toBe('number');
        expect(typeof l.x2).toBe('number');
        expect(typeof l.y2).toBe('number');
        expect(isNaN(l.x1)).toBe(false);
      });
    });

    it('should generate boss health lines proportional to health', function() {
      var full = generateBossHealthLines(100, 100, 0.2, 0.02, 0.6);
      var half = generateBossHealthLines(50, 100, 0.2, 0.02, 0.6);
      expect(full.length).toBeGreaterThan(half.length);
    });

    it('should handle zero values without error', function() {
      var e = generateEnergyLines(0, 100, 0.02, 0.2, 0.4);
      var b = generateBossHealthLines(0, 100, 0.2, 0.02, 0.6);
      expect(e.length).toBeGreaterThan(0);
      expect(b.length).toBeGreaterThan(0);
    });

    it('should generate border lines even at zero fill', function() {
      var lines = generateEnergyLines(0, 100, 0.02, 0.2, 0.4);
      expect(lines.length).toBe(4);
    });
  });

  // ===== NEW TEST 9: Game State Integrity =====
  // TDD: RED → tests written before GameState implementation
  describe('Game State Integrity', function() {
    it('should initialize with default values', function() {
      // TDD: PASS - testGameStateIntegrity validates reset cycle
      var gs = new GameState();
      expect(gs.score).toBe(0);
      expect(gs.lives).toBe(3);
      expect(gs.invincibilityTimer).toBe(0);
      expect(gs.bossActive).toBe(false);
    });

    it('should reset cleanly after game over', function() {
      var gs = new GameState();
      gs.score = 9999;
      gs.lives = 0;
      gs.bossActive = true;
      gs.invincibilityTimer = 2;
      gs.isGameOver = true;
      gs.reset();
      expect(gs.score).toBe(0);
      expect(gs.lives).toBe(3);
      expect(gs.bossActive).toBe(false);
      expect(gs.invincibilityTimer).toBe(0);
      expect(gs.gameRunning).toBe(true);
      expect(gs.isGameOver).toBe(false);
    });

    it('should handle boss defeat: +2000 score, invincibility, scale reset', function() {
      var gs = new GameState();
      gs.bossActive = true;
      gs.score = 5000;
      gs.onBossDefeat();
      expect(gs.score).toBe(5000 + BOSS_CONFIG.defeatBonus);
      expect(gs.bossActive).toBe(false);
      expect(gs.invincibilityTimer).toBe(BOSS_CONFIG.invincibilityTime);
      expect(gs.spawnScaleReset).toBe(true);
    });

    it('should tick down invincibility timer', function() {
      var gs = new GameState();
      gs.invincibilityTimer = 3;
      gs.update(1);
      expect(gs.invincibilityTimer).toBe(2);
      gs.update(3);
      expect(gs.invincibilityTimer).toBe(0);
    });

    it('should compute level from score', function() {
      var gs = new GameState();
      gs.score = 0;
      gs.update(0);
      expect(gs.level).toBe(1);
      gs.score = 5000;
      gs.update(0);
      expect(gs.level).toBe(2);
    });

    it('should maintain energy across power-up activation/expiration', function() {
      var es = new EnergySystem();
      es.energy = 100;
      es.activateSpread();
      expect(es.spreadActive).toBe(true);
      es.update(4.1);
      expect(es.spreadActive).toBe(false);
      expect(es.energy).toBe(60);
      es.collect(20);
      expect(es.energy).toBe(80);
    });

    it('should maintain energy across boss phase transitions', function() {
      var es = new EnergySystem();
      var boss = new BossEntity(5000);
      es.energy = 60;
      boss.active = true;
      boss.y = boss.targetY;
      boss.health = Math.floor(boss.maxHealth * 0.5);
      boss.update(0.1);
      expect(boss.phase).toBe(2);
      expect(es.energy).toBe(60);
    });
  });

  // ===== NEW TEST 10: Coordinated Fire =====
  // TDD: RED → tests written before getCoordinatedFireAngles implementation
  describe('Coordinated Fire', function() {
    it('should identify alpha enemy and return angles for wave', function() {
      // TDD: PASS - Alpha at index 0 fires base angle, others offset
      var alpha = new Enemy(1);
      alpha.isAlpha = true; alpha.active = true; alpha.x = 0.5; alpha.y = 0.2;
      var w1 = new Enemy(0);
      w1.active = true; w1.x = 0.3; w1.y = 0.2;
      var angles = getCoordinatedFireAngles([alpha, w1], 0.5, 0.8);
      expect(angles.length).toBe(2);
      expect(angles[0]).toBeDefined();
      expect(angles[1]).toBeDefined();
    });

    it('should compute correct base angle from alpha to player below', function() {
      var alpha = new Enemy(0);
      alpha.isAlpha = true; alpha.active = true; alpha.x = 0.5; alpha.y = 0.2;
      var angles = getCoordinatedFireAngles([alpha], 0.5, 0.8);
      // Player directly below: atan2(0.6, 0) = PI/2
      expect(angles[0]).toBeCloseTo(Math.PI / 2, 1);
    });

    it('should offset wingmen angles by rank distance from alpha', function() {
      var w1 = new Enemy(0); w1.active = true; w1.x = 0.3; w1.y = 0.2;
      var alpha = new Enemy(0); alpha.isAlpha = true; alpha.active = true; alpha.x = 0.5; alpha.y = 0.2;
      var w2 = new Enemy(0); w2.active = true; w2.x = 0.7; w2.y = 0.2;
      var angles = getCoordinatedFireAngles([w1, alpha, w2], 0.5, 0.8);
      var baseAngle = angles[1]; // alpha at index 1
      // w1 rank -1, w2 rank +1 → symmetric offsets at ±PI/12
      expect(angles[0]).toBeCloseTo(baseAngle - Math.PI / 12, 5);
      expect(angles[2]).toBeCloseTo(baseAngle + Math.PI / 12, 5);
    });

    it('should create overlapping bullet field with unique angles', function() {
      var all = [];
      var alpha = new Enemy(0);
      alpha.isAlpha = true; alpha.active = true; alpha.x = 0.5; alpha.y = 0.2;
      all.push(alpha);
      for (var i = 0; i < 4; i++) {
        var w = new Enemy(0); w.active = true; w.x = 0.3 + i * 0.15; w.y = 0.2;
        all.push(w);
      }
      var angles = getCoordinatedFireAngles(all, 0.5, 0.8);
      expect(angles.length).toBe(5);
      for (var a = 0; a < angles.length; a++) {
        for (var b = a + 1; b < angles.length; b++) {
          expect(Math.abs(angles[a] - angles[b])).toBeGreaterThan(0.01);
        }
      }
    });

    it('should return empty array when no alpha exists', function() {
      var e1 = new Enemy(0); e1.active = true; e1.x = 0.5; e1.y = 0.2;
      var angles = getCoordinatedFireAngles([e1], 0.5, 0.8);
      expect(angles.length).toBe(0);
    });

    it('should skip inactive enemies with null angle', function() {
      var alpha = new Enemy(0); alpha.isAlpha = true; alpha.active = true; alpha.x = 0.5; alpha.y = 0.2;
      var dead = new Enemy(0); dead.active = false; dead.x = 0.3; dead.y = 0.2;
      var w2 = new Enemy(0); w2.active = true; w2.x = 0.7; w2.y = 0.2;
      var angles = getCoordinatedFireAngles([alpha, dead, w2], 0.5, 0.8);
      expect(angles[0]).toBeDefined();
      expect(angles[1]).toBeNull();
      expect(angles[2]).toBeDefined();
    });
  });

  // ===== NEW TEST 11: Object Pool =====
  // TDD: RED → tests written before ObjectPool implementation
  describe('Object Pool', function() {
    it('should pre-allocate objects in pool', function() {
      var pool = new ObjectPool(Bullet, 5);
      expect(pool.pool.length).toBe(5);
    });

    it('should return object from pool and mark active', function() {
      var pool = new ObjectPool(Bullet, 3);
      var b = pool.get();
      expect(b).toBeDefined();
      expect(b.active).toBe(true);
    });

    it('should grow when pool is exhausted', function() {
      var pool = new ObjectPool(Bullet, 2);
      pool.get(); pool.get();
      var b3 = pool.get();
      expect(b3).toBeDefined();
      expect(b3.active).toBe(true);
      expect(pool.pool.length).toBe(3);
    });

    it('should reuse released objects', function() {
      var pool = new ObjectPool(Bullet, 2);
      var b1 = pool.get();
      pool.release(b1);
      expect(b1.active).toBe(false);
      var b2 = pool.get();
      expect(b2).toBe(b1);
    });

    it('should count active objects', function() {
      var pool = new ObjectPool(Bullet, 3);
      expect(pool.getActiveCount()).toBe(0);
      pool.get(); pool.get();
      expect(pool.getActiveCount()).toBe(2);
    });

    it('should release all objects', function() {
      var pool = new ObjectPool(Bullet, 3);
      pool.get(); pool.get(); pool.get();
      expect(pool.getActiveCount()).toBe(3);
      pool.releaseAll();
      expect(pool.getActiveCount()).toBe(0);
    });

    it('should work with Enemy factory', function() {
      var pool = new ObjectPool(Enemy, 4);
      var e = pool.get();
      expect(e).toBeDefined();
      expect(typeof e.spawn).toBe('function');
      pool.release(e);
      expect(e.active).toBe(false);
    });
  });

});
