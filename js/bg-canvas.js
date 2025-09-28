// Industrial IoT Network Mesh Animation - Connected Devices & Data Flow
console.log('IoT Network Animation Loading...');

class IoTNetwork {
    constructor() {
        console.log('IoTNetwork constructor called');
        this.canvas = document.getElementById('bg-canvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        console.log('Canvas found, initializing IoT network...');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.dataPackets = [];
        this.mouse = { 
            x: window.innerWidth / 2, 
            y: window.innerHeight / 2,
            radius: 120
        };
        this.time = 0;
        this.animationId = null;
        
        this.init();
        this.createNodes();
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
    
    createNodes() {
        const nodeCount = Math.min(25, Math.floor(this.canvas.width * this.canvas.height / 20000));
        console.log(`Creating ${nodeCount} IoT nodes`);
        
        this.nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            const nodeType = this.getRandomNodeType();
            this.nodes.push({
                id: i,
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                baseX: Math.random() * this.canvas.width,
                baseY: Math.random() * this.canvas.height,
                vx: 0,
                vy: 0,
                size: nodeType.size,
                color: nodeType.color,
                type: nodeType.name,
                pulse: Math.random() * Math.PI * 2,
                connections: [],
                lastDataSent: 0,
                isActive: Math.random() > 0.3
            });
        }
        
        // Create network topology
        this.createNetworkConnections();
    }
    
    getRandomNodeType() {
        const nodeTypes = [
            { name: 'Gateway', size: 4, color: 'rgba(255, 165, 0, 0.8)' },    // Orange - Central hubs
            { name: 'Sensor', size: 2.5, color: 'rgba(100, 255, 218, 0.7)' }, // Cyan - Sensors
            { name: 'Controller', size: 3.5, color: 'rgba(138, 43, 226, 0.7)' }, // Purple - Controllers
            { name: 'Device', size: 3, color: 'rgba(50, 205, 50, 0.7)' },      // Green - Smart devices
            { name: 'Server', size: 5, color: 'rgba(255, 69, 0, 0.8)' }        // Red - Servers/Cloud
        ];
        
        const weights = [0.15, 0.4, 0.2, 0.2, 0.05]; // Sensor-heavy network
        const random = Math.random();
        let sum = 0;
        
        for (let i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (random < sum) return nodeTypes[i];
        }
        return nodeTypes[1]; // Default to sensor
    }
    
    createNetworkConnections() {
        this.nodes.forEach((node, i) => {
            // Find nearby nodes to connect to
            const nearbyNodes = this.nodes.filter((otherNode, j) => {
                if (i === j) return false;
                const distance = this.getDistance(node, otherNode);
                return distance < 200 && Math.random() > 0.6;
            });
            
            // Limit connections per node
            const maxConnections = node.type === 'Gateway' ? 6 : node.type === 'Server' ? 8 : 3;
            node.connections = nearbyNodes.slice(0, maxConnections).map(n => n.id);
        });
    }
    
    getDistance(node1, node2) {
        const dx = node1.x - node2.x;
        const dy = node1.y - node2.y;
        return Math.sqrt(dx * dx + dy * dy);
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
    
    updateNetwork() {
        this.time += 0.01;
        
        // Update nodes
        this.nodes.forEach((node, i) => {
            // Gentle floating motion
            const floatX = Math.sin(this.time * 0.5 + node.pulse) * 0.3;
            const floatY = Math.cos(this.time * 0.4 + node.pulse * 1.2) * 0.2;
            
            node.baseX += floatX;
            node.baseY += floatY;
            
            // Mouse interaction - nodes avoid cursor
            const dx = this.mouse.x - node.x;
            const dy = this.mouse.y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.mouse.radius) {
                const force = (this.mouse.radius - distance) / this.mouse.radius;
                const angle = Math.atan2(dy, dx);
                const pushStrength = force * 0.5;
                
                node.vx -= Math.cos(angle) * pushStrength;
                node.vy -= Math.sin(angle) * pushStrength;
            }
            
            // Return to base position
            node.vx += (node.baseX - node.x) * 0.002;
            node.vy += (node.baseY - node.y) * 0.002;
            
            // Apply velocity
            node.x += node.vx;
            node.y += node.vy;
            
            // Friction
            node.vx *= 0.95;
            node.vy *= 0.95;
            
            // Boundary handling
            const margin = 50;
            if (node.x < margin || node.x > this.canvas.width - margin) {
                node.vx *= -0.5;
                node.x = Math.max(margin, Math.min(this.canvas.width - margin, node.x));
            }
            if (node.y < margin || node.y > this.canvas.height - margin) {
                node.vy *= -0.5;
                node.y = Math.max(margin, Math.min(this.canvas.height - margin, node.y));
            }
            
            // Random data transmission
            if (Math.random() < 0.003 && node.connections.length > 0) {
                this.sendDataPacket(node);
            }
        });
        
        // Update data packets
        this.updateDataPackets();
    }
    
    sendDataPacket(fromNode) {
        if (fromNode.connections.length === 0) return;
        
        const targetId = fromNode.connections[Math.floor(Math.random() * fromNode.connections.length)];
        const targetNode = this.nodes[targetId];
        
        if (targetNode) {
            this.dataPackets.push({
                fromX: fromNode.x,
                fromY: fromNode.y,
                toX: targetNode.x,
                toY: targetNode.y,
                progress: 0,
                speed: 0.02,
                color: fromNode.color,
                size: 1.5,
                life: 1.0
            });
        }
    }
    
    updateDataPackets() {
        this.dataPackets = this.dataPackets.filter(packet => {
            packet.progress += packet.speed;
            packet.life -= 0.01;
            return packet.progress < 1 && packet.life > 0;
        });
    }
    
    drawNetwork() {
        // Clear with subtle fade
        this.ctx.fillStyle = 'rgba(10, 25, 47, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connections
        this.nodes.forEach(node => {
            node.connections.forEach(targetId => {
                const targetNode = this.nodes[targetId];
                if (targetNode) {
                    const distance = this.getDistance(node, targetNode);
                    const opacity = Math.max(0, (250 - distance) / 250) * 0.1;
                    
                    this.ctx.strokeStyle = `rgba(100, 255, 218, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(node.x, node.y);
                    this.ctx.lineTo(targetNode.x, targetNode.y);
                    this.ctx.stroke();
                }
            });
        });
        
        // Draw data packets
        this.dataPackets.forEach(packet => {
            const x = packet.fromX + (packet.toX - packet.fromX) * packet.progress;
            const y = packet.fromY + (packet.toY - packet.fromY) * packet.progress;
            
            this.ctx.fillStyle = packet.color.replace(/[\d.]+\)/, `${packet.life * 0.8})`);
            this.ctx.beginPath();
            this.ctx.arc(x, y, packet.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Data packet glow
            this.ctx.shadowColor = packet.color.replace(/[\d.]+\)/, '0.6)');
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.arc(x, y, packet.size * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
        
        // Draw nodes
        this.nodes.forEach(node => {
            const pulse = 1 + Math.sin(this.time * 2 + node.pulse) * 0.2;
            const currentSize = node.size * pulse;
            
            // Node body
            this.ctx.fillStyle = node.color;
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, currentSize, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Node glow
            this.ctx.shadowColor = node.color.replace(/[\d.]+\)/, '0.5)');
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = node.color.replace(/[\d.]+\)/, '0.3)');
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, currentSize * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            
            // Node type indicator (small inner circle)
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, currentSize * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    animate() {
        this.updateNetwork();
        this.drawNetwork();
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new IoTNetwork();
});