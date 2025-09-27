// Interactive Fish Swarm Background Animation - Smooth & Simple
console.log('Fish Swarm Animation Loading...');

class FishSwarm {
    constructor() {
        console.log('FishSwarm constructor called');
        this.canvas = document.getElementById('bg-canvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        console.log('Canvas found, initializing fish swarm...');
        this.ctx = this.canvas.getContext('2d');
        this.fish = [];
        this.mouse = { 
            x: window.innerWidth / 2, 
            y: window.innerHeight / 2, 
            lastX: window.innerWidth / 2, 
            lastY: window.innerHeight / 2, 
            speed: 0
        };
        this.mouseIdle = true;
        this.idleTimer = 0;
        this.swarmCenter = { x: 0, y: 0 };
        this.time = 0;
        
        this.init();
        this.createFish();
        this.setupMouseTracking();
        this.animate();
    }
    
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.swarmCenter.x = this.canvas.width / 2;
        this.swarmCenter.y = this.canvas.height / 2;
    }
    
    createFish() {
        const fishCount = Math.min(15, Math.floor(this.canvas.width * this.canvas.height / 30000));
        console.log(`Creating ${fishCount} fish`);
        
        for (let i = 0; i < fishCount; i++) {
            this.fish.push({
                x: this.swarmCenter.x + (Math.random() - 0.5) * 200,
                y: this.swarmCenter.y + (Math.random() - 0.5) * 200,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                size: Math.random() * 1.5 + 1.5,
                angle: Math.random() * Math.PI * 2,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.6 + 0.4,
                color: `rgba(100, 255, 218, ${Math.random() * 0.3 + 0.2})`
            });
        }
    }
    
    setupMouseTracking() {
        document.addEventListener('mousemove', (e) => {
            this.mouse.lastX = this.mouse.x;
            this.mouse.lastY = this.mouse.y;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            
            // Calculate mouse speed
            const dx = this.mouse.x - this.mouse.lastX;
            const dy = this.mouse.y - this.mouse.lastY;
            this.mouse.speed = Math.sqrt(dx * dx + dy * dy);
            
            this.mouseIdle = false;
            this.idleTimer = 0;
        });
        
        document.addEventListener('mouseleave', () => {
            this.mouseIdle = true;
        });
    }
    
    updateFish() {
        this.time += 0.016; // ~60fps
        
        // Check if mouse is idle
        this.idleTimer++;
        if (this.idleTimer > 120) { // 2 seconds at 60fps
            this.mouseIdle = true;
        }
        
        // Update swarm center for idle behavior
        if (this.mouseIdle) {
            this.swarmCenter.x += Math.sin(this.time * 0.3) * 0.2;
            this.swarmCenter.y += Math.cos(this.time * 0.2) * 0.15;
            
            // Keep swarm center within bounds
            const margin = 100;
            this.swarmCenter.x = Math.max(margin, Math.min(this.canvas.width - margin, this.swarmCenter.x));
            this.swarmCenter.y = Math.max(margin, Math.min(this.canvas.height - margin, this.swarmCenter.y));
        }
        
        this.fish.forEach((fish, index) => {
            // Determine target based on mouse activity
            let targetX, targetY, attractionStrength;
            
            if (!this.mouseIdle) {
                // Follow mouse with delay based on speed
                targetX = this.mouse.x;
                targetY = this.mouse.y;
                attractionStrength = 0.015 + Math.min(this.mouse.speed * 0.0001, 0.01);
            } else {
                // Enhanced idle swarming
                const swarmRadius = 60 + Math.sin(this.time + fish.phase) * 20;
                targetX = this.swarmCenter.x + Math.sin(this.time * 0.4 + fish.phase) * swarmRadius;
                targetY = this.swarmCenter.y + Math.cos(this.time * 0.3 + fish.phase * 1.2) * swarmRadius * 0.6;
                attractionStrength = 0.008;
            }
            
            // Simple flocking behavior
            let separationX = 0, separationY = 0;
            let alignmentX = 0, alignmentY = 0;
            let neighborCount = 0;
            
            this.fish.forEach((otherFish, otherIndex) => {
                if (index !== otherIndex) {
                    const dx = fish.x - otherFish.x;
                    const dy = fish.y - otherFish.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 60 && distance > 0) {
                        // Separation
                        separationX += dx / distance;
                        separationY += dy / distance;
                        
                        // Alignment
                        alignmentX += otherFish.vx;
                        alignmentY += otherFish.vy;
                        
                        neighborCount++;
                    }
                }
            });
            
            if (neighborCount > 0) {
                separationX /= neighborCount;
                separationY /= neighborCount;
                alignmentX /= neighborCount;
                alignmentY /= neighborCount;
            }
            
            // Calculate forces
            const dx = targetX - fish.x;
            const dy = targetY - fish.y;
            
            // Apply forces
            fish.vx += (dx * attractionStrength) + (separationX * 0.02) + (alignmentX * 0.01);
            fish.vy += (dy * attractionStrength) + (separationY * 0.02) + (alignmentY * 0.01);
            
            // Apply drag
            fish.vx *= 0.9;
            fish.vy *= 0.9;
            
            // Limit maximum speed
            const maxSpeed = fish.speed * 1.5;
            const currentSpeed = Math.sqrt(fish.vx * fish.vx + fish.vy * fish.vy);
            if (currentSpeed > maxSpeed) {
                fish.vx = (fish.vx / currentSpeed) * maxSpeed;
                fish.vy = (fish.vy / currentSpeed) * maxSpeed;
            }
            
            // Update position
            fish.x += fish.vx;
            fish.y += fish.vy;
            
            // Update angle
            if (Math.abs(fish.vx) > 0.1 || Math.abs(fish.vy) > 0.1) {
                const targetAngle = Math.atan2(fish.vy, fish.vx);
                let angleDiff = targetAngle - fish.angle;
                if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                fish.angle += angleDiff * 0.1;
            }
            
            // Boundary wrapping
            const margin = 30;
            if (fish.x < -margin) fish.x = this.canvas.width + margin;
            if (fish.x > this.canvas.width + margin) fish.x = -margin;
            if (fish.y < -margin) fish.y = this.canvas.height + margin;
            if (fish.y > this.canvas.height + margin) fish.y = -margin;
        });
    }
    
    drawFish() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connection lines between nearby fish
        this.fish.forEach((fish, index) => {
            this.fish.slice(index + 1).forEach(otherFish => {
                const dx = fish.x - otherFish.x;
                const dy = fish.y - otherFish.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 50) {
                    const opacity = (1 - distance / 50) * 0.1;
                    this.ctx.strokeStyle = `rgba(100, 255, 218, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(fish.x, fish.y);
                    this.ctx.lineTo(otherFish.x, otherFish.y);
                    this.ctx.stroke();
                }
            });
        });
        
        // Draw fish
        this.fish.forEach(fish => {
            this.ctx.save();
            this.ctx.translate(fish.x, fish.y);
            this.ctx.rotate(fish.angle);
            
            // Fish body
            this.ctx.fillStyle = fish.color;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, fish.size * 1.5, fish.size * 0.7, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Fish tail
            this.ctx.beginPath();
            this.ctx.moveTo(-fish.size * 1.2, 0);
            this.ctx.lineTo(-fish.size * 1.8, -fish.size * 0.5);
            this.ctx.lineTo(-fish.size * 1.8, fish.size * 0.5);
            this.ctx.closePath();
            this.ctx.fill();
            
            // Fish eye
            this.ctx.fillStyle = `rgba(100, 255, 218, ${Math.min(1, parseFloat(fish.color.match(/[\d.]+(?=\))/)) + 0.2)})`;
            this.ctx.beginPath();
            this.ctx.ellipse(fish.size * 0.3, -fish.size * 0.2, fish.size * 0.15, fish.size * 0.15, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    animate() {
        this.updateFish();
        this.drawFish();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the fish swarm when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FishSwarm();
});