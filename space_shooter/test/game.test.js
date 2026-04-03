var game = require('../src/game');
var MOBILE_DIFFICULTY_CONFIG = game.MOBILE_DIFFICULTY_CONFIG;
var computeSpawnInterval = game.computeSpawnInterval;
var Ship = game.Ship;
var Enemy = game.Enemy;
var Bullet = game.Bullet;
var Starfield = game.Starfield;

describe('Space Shooter - TDD Implementation', function() {

  describe('MOBILE_DIFFICULTY_CONFIG', function() {
    it('should define base spawn interval and decay rate', function() {
      expect(MOBILE_DIFFICULTY_CONFIG.baseSpawnInterval).toBe(200);
      expect(MOBILE_DIFFICULTY_CONFIG.spawnDecay).toBe(1.03);
    });

    it('should define minimum spawn interval', function() {
      expect(MOBILE_DIFFICULTY_CONFIG.minSpawnInterval).toBe(60);
    });

    it('should define tracking sensitivity', function() {
      expect(MOBILE_DIFFICULTY_CONFIG.trackingSensitivity).toBe(0.08);
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
});
