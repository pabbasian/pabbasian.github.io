// Smooth Particle Background Animation - Optimized & Simple
console.log('Particle Animation Loading...');

class ParticleBackground {
    constructor() {
        console.log('ParticleBackground constructor called');
        this.canvas = document.getElementById('bg-canvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        console.log('Canvas found, initializing particles...');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { 
            x: window.innerWidth / 2, 
            y: window.innerHeight / 2,
            radius: 120
        };
        this.time = 0;
        
        this.init();
        this.createParticles();
        this.setupEvents();
        this.animate();
    }
    
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        const particleCount = Math.min(50, Math.floor(this.canvas.width * this.canvas.height / 15000));
        console.log(`Creating ${particleCount} particles`);
        
        this.particles = [];
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                baseX: Math.random() * this.canvas.width,
                baseY: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.5 + 0.2,
                phase: Math.random() * Math.PI * 2
            });
        }
    }
    
    setupEvents() {
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('mouseleave', () => {
            this.mouse.x = this.canvas.width / 2;
            this.mouse.y = this.canvas.height / 2;
        });
    }
    
    updateParticles() {
        this.time += 0.005;
        
        this.particles.forEach((particle, i) => {
            // Gentle floating motion
            particle.baseX += Math.sin(this.time + particle.phase) * 0.1;
            particle.baseY += Math.cos(this.time + particle.phase * 0.8) * 0.05;
            
            // Mouse interaction
            const dx = this.mouse.x - particle.x;
            const dy = this.mouse.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.mouse.radius) {
                const force = (this.mouse.radius - distance) / this.mouse.radius;
                const angle = Math.atan2(dy, dx);
                particle.vx += Math.cos(angle) * force * 0.01;
                particle.vy += Math.sin(angle) * force * 0.01;
            }
            
            // Return to base position
            const returnX = particle.baseX - particle.x;
            const returnY = particle.baseY - particle.y;
            particle.vx += returnX * 0.001;
            particle.vy += returnY * 0.001;
            
            // Apply velocity
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Friction
            particle.vx *= 0.95;
            particle.vy *= 0.95;
            
            // Boundary wrapping
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
            
            // Update base position boundaries
            if (particle.baseX < 0) particle.baseX = this.canvas.width;
            if (particle.baseX > this.canvas.width) particle.baseX = 0;
            if (particle.baseY < 0) particle.baseY = this.canvas.height;
            if (particle.baseY > this.canvas.height) particle.baseY = 0;
        });
    }
    
    drawParticles() {
        // Clear with subtle fade effect
        this.ctx.fillStyle = 'rgba(10, 25, 47, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connections
        this.particles.forEach((particle, i) => {
            this.particles.slice(i + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 80) {
                    const opacity = (1 - distance / 80) * 0.1;
                    this.ctx.strokeStyle = `rgba(100, 255, 218, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(otherParticle.x, otherParticle.y);
                    this.ctx.stroke();
                }
            });
        });
        
        // Draw particles
        this.particles.forEach(particle => {
            const pulseSize = particle.size + Math.sin(this.time * 2 + particle.phase) * 0.2;
            
            this.ctx.fillStyle = `rgba(100, 255, 218, ${particle.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, pulseSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Glow effect
            this.ctx.shadowColor = 'rgba(100, 255, 218, 0.5)';
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, pulseSize * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }
    
    animate() {
        this.updateParticles();
        this.drawParticles();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ParticleBackground();
});