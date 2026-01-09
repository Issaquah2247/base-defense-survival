// Base Defense Survival Game - Complete Implementation
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.resources = { gold: 500, wood: 300, stone: 200 };
        this.buildings = [];
        this.enemies = [];
        this.particles = [];
        this.projectiles = [];
        this.wave = 1;
        this.enemyCount = 0;
        this.waveTimer = 30;
        this.placingBuilding = null;
        this.selectedBuilding = null;
        this.gridSize = 20;
        this.cellSize = 2;
        
        this.buildingTypes = {
            wall: { name: 'Wall', cost: {gold: 50, wood: 30, stone: 0}, hp: 200, color: 0x8b7355, height: 1.5 },
            turret: { name: 'Turret', cost: {gold: 100, wood: 50, stone: 30}, hp: 150, color: 0x4a4a4a, height: 2, damage: 10, range: 8 },
            mine: { name: 'Gold Mine', cost: {gold: 150, wood: 100, stone: 0}, hp: 100, color: 0xffd700, height: 1.2, produces: 'gold', rate: 5 },
            barracks: { name: 'Barracks', cost: {gold: 200, wood: 150, stone: 100}, hp: 300, color: 0x8b4513, height: 2.5 }
        };
        
        this.init();
        this.animate();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 20, 60);
        
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 25, 25);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('gameCanvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        const pointLight1 = new THREE.PointLight(0xff6b6b, 0.5, 30);
        pointLight1.position.set(-10, 5, -10);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x4ecdc4, 0.5, 30);
        pointLight2.position.set(10, 5, 10);
        this.scene.add(pointLight2);
        
        this.createGround();
        this.createGrid();
        this.createStartingBase();
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('click', (e) => this.onClick(e));
        window.addEventListener('resize', () => this.onWindowResize());
        
        setInterval(() => this.gameLoop(), 1000);
        setInterval(() => this.updateProduction(), 2000);
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(this.gridSize * this.cellSize, this.gridSize * this.cellSize);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d4a2b,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.name = 'ground';
        this.scene.add(ground);
        
        for (let i = 0; i < 100; i++) {
            const grassGeometry = new THREE.ConeGeometry(0.1, 0.5, 3);
            const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7c59 });
            const grass = new THREE.Mesh(grassGeometry, grassMaterial);
            grass.position.set(
                (Math.random() - 0.5) * this.gridSize * this.cellSize,
                0.25,
                (Math.random() - 0.5) * this.gridSize * this.cellSize
            );
            grass.rotation.y = Math.random() * Math.PI * 2;
            this.scene.add(grass);
        }
    }
    
    createGrid() {
        const gridHelper = new THREE.GridHelper(
            this.gridSize * this.cellSize, 
            this.gridSize, 
            0x444444, 
            0x333333
        );
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }
    
    createStartingBase() {
        const baseBuilding = this.createBuilding('barracks', 0, 0);
        baseBuilding.userData.level = 1;
        baseBuilding.userData.isMain = true;
    }
    
    createBuilding(type, gridX, gridZ) {
        const buildingData = this.buildingTypes[type];
        const geometry = new THREE.BoxGeometry(this.cellSize * 0.8, buildingData.height, this.cellSize * 0.8);
        const material = new THREE.MeshStandardMaterial({ 
            color: buildingData.color,
            roughness: 0.7,
            metalness: 0.3
        });
        const building = new THREE.Mesh(geometry, material);
        
        building.position.set(
            gridX * this.cellSize,
            buildingData.height / 2,
            gridZ * this.cellSize
        );
        building.castShadow = true;
        building.receiveShadow = true;
        
        building.userData = {
            type: type,
            gridX: gridX,
            gridZ: gridZ,
            hp: buildingData.hp,
            maxHp: buildingData.hp,
            level: 1,
            damage: buildingData.damage || 0,
            range: buildingData.range || 0,
            produces: buildingData.produces || null,
            rate: buildingData.rate || 0
        };
        
        this.scene.add(building);
        this.buildings.push(building);
        
        if (type === 'mine' || type === 'turret') {
            const glowGeometry = new THREE.SphereGeometry(0.2, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({ 
                color: type === 'mine' ? 0xffff00 : 0xff0000,
                transparent: true,
                opacity: 0.6
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.y = buildingData.height;
            building.add(glow);
        }
        
        return building;
    }
    
    placeBuilding(type) {
        const buildingData = this.buildingTypes[type];
        if (this.resources.gold >= buildingData.cost.gold &&
            this.resources.wood >= buildingData.cost.wood &&
            this.resources.stone >= buildingData.cost.stone) {
            this.placingBuilding = type;
            this.showMessage(`Place ${buildingData.name}`);
        } else {
            this.showMessage('Not enough resources!');
        }
    }
    
    canPlaceBuilding(gridX, gridZ) {
        if (Math.abs(gridX) >= this.gridSize / 2 || Math.abs(gridZ) >= this.gridSize / 2) return false;
        return !this.buildings.some(b => b.userData.gridX === gridX && b.userData.gridZ === gridZ);
    }
    
    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    
    onClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x / this.cellSize);
            const gridZ = Math.round(point.z / this.cellSize);
            
            if (this.placingBuilding) {
                if (this.canPlaceBuilding(gridX, gridZ)) {
                    const buildingData = this.buildingTypes[this.placingBuilding];
                    this.resources.gold -= buildingData.cost.gold;
                    this.resources.wood -= buildingData.cost.wood;
                    this.resources.stone -= buildingData.cost.stone;
                    
                    this.createBuilding(this.placingBuilding, gridX, gridZ);
                    this.updateUI();
                    this.placingBuilding = null;
                    this.showMessage('Building placed!');
                    this.createParticleEffect(gridX * this.cellSize, 0, gridZ * this.cellSize, 0x00ff00);
                } else {
                    this.showMessage('Cannot place here!');
                }
            } else {
                const clickedBuilding = this.buildings.find(b => 
                    b.userData.gridX === gridX && b.userData.gridZ === gridZ
                );
                if (clickedBuilding) {
                    this.showUpgradePanel(clickedBuilding);
                }
            }
        }
    }
    
    createEnemy() {
        const geometry = new THREE.ConeGeometry(0.5, 1.5, 4);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const enemy = new THREE.Mesh(geometry, material);
        
        const angle = Math.random() * Math.PI * 2;
        const distance = this.gridSize * this.cellSize * 0.45;
        enemy.position.set(
            Math.cos(angle) * distance,
            0.75,
            Math.sin(angle) * distance
        );
        enemy.castShadow = true;
        
        enemy.userData = {
            hp: 50 + this.wave * 10,
            maxHp: 50 + this.wave * 10,
            speed: 0.02 + this.wave * 0.005,
            damage: 5 + this.wave * 2
        };
        
        this.scene.add(enemy);
        this.enemies.push(enemy);
        this.enemyCount++;
        return enemy;
    }
    
    updateEnemies() {
        this.enemies.forEach(enemy => {
            const target = this.findClosestBuilding(enemy.position);
            if (target) {
                const dir = new THREE.Vector3();
                dir.subVectors(target.position, enemy.position);
                const distance = dir.length();
                
                if (distance > 1) {
                    dir.normalize();
                    enemy.position.add(dir.multiplyScalar(enemy.userData.speed));
                    enemy.lookAt(target.position);
                } else {
                    target.userData.hp -= enemy.userData.damage;
                    if (target.userData.hp <= 0) {
                        this.removeBuilding(target);
                    }
                }
            }
        });
    }
    
    findClosestBuilding(position) {
        let closest = null;
        let minDist = Infinity;
        
        this.buildings.forEach(building => {
            const dist = position.distanceTo(building.position);
            if (dist < minDist) {
                minDist = dist;
                closest = building;
            }
        });
        
        return closest;
    }
    
    updateTurrets() {
        this.buildings.filter(b => b.userData.type === 'turret').forEach(turret => {
            const target = this.findClosestEnemy(turret.position, turret.userData.range);
            if (target) {
                this.createProjectile(turret.position, target.position, turret.userData.damage);
            }
        });
    }
    
    findClosestEnemy(position, range) {
        let closest = null;
        let minDist = Infinity;
        
        this.enemies.forEach(enemy => {
            const dist = position.distanceTo(enemy.position);
            if (dist < range && dist < minDist) {
                minDist = dist;
                closest = enemy;
            }
        });
        
        return closest;
    }
    
    createProjectile(from, to, damage) {
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const projectile = new THREE.Mesh(geometry, material);
        projectile.position.copy(from);
        
        const dir = new THREE.Vector3();
        dir.subVectors(to, from).normalize();
        
        projectile.userData = {
            velocity: dir.multiplyScalar(0.5),
            damage: damage,
            lifetime: 100
        };
        
        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }
    
    updateProjectiles() {
        this.projectiles = this.projectiles.filter(proj => {
            proj.position.add(proj.userData.velocity);
            proj.userData.lifetime--;
            
            if (proj.userData.lifetime <= 0) {
                this.scene.remove(proj);
                return false;
            }
            
            const hitEnemy = this.enemies.find(e => 
                e.position.distanceTo(proj.position) < 1
            );
            
            if (hitEnemy) {
                hitEnemy.userData.hp -= proj.userData.damage;
                if (hitEnemy.userData.hp <= 0) {
                    this.removeEnemy(hitEnemy);
                    this.resources.gold += 10;
                }
                this.scene.remove(proj);
                this.createParticleEffect(proj.position.x, proj.position.y, proj.position.z, 0xff8800);
                return false;
            }
            
            return true;
        });
    }
    
    removeEnemy(enemy) {
        this.scene.remove(enemy);
        this.enemies = this.enemies.filter(e => e !== enemy);
        this.enemyCount--;
    }
    
    removeBuilding(building) {
        this.scene.remove(building);
        this.buildings = this.buildings.filter(b => b !== building);
        this.createParticleEffect(building.position.x, building.position.y, building.position.z, 0xff0000);
        if (building.userData.isMain) {
            this.showMessage('Game Over!');
        }
    }
    
    createParticleEffect(x, y, z, color) {
        for (let i = 0; i < 20; i++) {
            const geometry = new THREE.SphereGeometry(0.1, 4, 4);
            const material = new THREE.MeshBasicMaterial({ color: color });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.set(x, y, z);
            
            particle.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * 0.3,
                    (Math.random() - 0.5) * 0.2
                ),
                lifetime: 30
            };
            
            this.scene.add(particle);
            this.particles.push(particle);
        }
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.position.add(particle.userData.velocity);
            particle.userData.velocity.y -= 0.01;
            particle.userData.lifetime--;
            particle.scale.multiplyScalar(0.95);
            
            if (particle.userData.lifetime <= 0) {
                this.scene.remove(particle);
                return false;
            }
            return true;
        });
    }
    
    updateProduction() {
        this.buildings.filter(b => b.userData.produces).forEach(building => {
            const resource = building.userData.produces;
            const amount = building.userData.rate * building.userData.level;
            this.resources[resource] += amount;
            this.createParticleEffect(building.position.x, building.position.y + 2, building.position.z, 0xffd700);
        });
        this.updateUI();
    }
    
    showUpgradePanel(building) {
        const panel = document.getElementById('upgradePanel');
        const content = document.getElementById('upgradeContent');
        
        const buildingData = this.buildingTypes[building.userData.type];
        const upgradeCost = {
            gold: buildingData.cost.gold * building.userData.level,
            wood: buildingData.cost.wood * building.userData.level,
            stone: buildingData.cost.stone * building.userData.level
        };
        
        content.innerHTML = `
            <div class="upgrade-option">
                <strong>${buildingData.name} - Level ${building.userData.level}</strong>
                <div>HP: ${building.userData.hp}/${building.userData.maxHp}</div>
                ${building.userData.damage ? `<div>Damage: ${building.userData.damage}</div>` : ''}
                ${building.userData.range ? `<div>Range: ${building.userData.range}</div>` : ''}
                ${building.userData.produces ? `<div>Production: ${building.userData.rate}/2s</div>` : ''}
            </div>
            <div class="upgrade-option">
                <strong>Upgrade to Level ${building.userData.level + 1}</strong>
                <div>Cost: ${upgradeCost.gold}🪙 ${upgradeCost.wood}🪵 ${upgradeCost.stone}🪨</div>
                <button class="upgrade-btn" onclick="game.upgradeBuilding(${this.buildings.indexOf(building)})">Upgrade</button>
            </div>
        `;
        
        panel.style.display = 'block';
        this.selectedBuilding = building;
    }
    
    closeUpgradePanel() {
        document.getElementById('upgradePanel').style.display = 'none';
        this.selectedBuilding = null;
    }
    
    upgradeBuilding(index) {
        const building = this.buildings[index];
        const buildingData = this.buildingTypes[building.userData.type];
        const upgradeCost = {
            gold: buildingData.cost.gold * building.userData.level,
            wood: buildingData.cost.wood * building.userData.level,
            stone: buildingData.cost.stone * building.userData.level
        };
        
        if (this.resources.gold >= upgradeCost.gold &&
            this.resources.wood >= upgradeCost.wood &&
            this.resources.stone >= upgradeCost.stone) {
            this.resources.gold -= upgradeCost.gold;
            this.resources.wood -= upgradeCost.wood;
            this.resources.stone -= upgradeCost.stone;
            
            building.userData.level++;
            building.userData.maxHp = buildingData.hp * building.userData.level;
            building.userData.hp = building.userData.maxHp;
            if (building.userData.damage) building.userData.damage = buildingData.damage * building.userData.level;
            if (building.userData.range) building.userData.range = buildingData.range + building.userData.level;
            
            building.scale.set(1 + building.userData.level * 0.1, 1 + building.userData.level * 0.1, 1 + building.userData.level * 0.1);
            
            this.createParticleEffect(building.position.x, building.position.y, building.position.z, 0x00ffff);
            this.closeUpgradePanel();
            this.updateUI();
            this.showMessage('Upgraded!');
        } else {
            this.showMessage('Not enough resources!');
        }
    }
    
    gameLoop() {
        this.waveTimer--;
        document.getElementById('waveTimer').textContent = this.waveTimer;
        
        if (this.waveTimer <= 0) {
            this.startWave();
        }
        
        this.updateEnemies();
        this.updateTurrets();
        this.updateProjectiles();
        this.updateParticles();
        
        const waveProgress = Math.max(0, ((30 - this.waveTimer) / 30) * 100);
        document.getElementById('waveProgress').style.width = waveProgress + '%';
        document.getElementById('enemyCount').textContent = this.enemies.length;
    }
    
    startWave() {
        this.wave++;
        this.waveTimer = 30;
        const enemyCount = 3 + this.wave * 2;
        
        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => this.createEnemy(), i * 500);
        }
        
        this.showMessage(`Wave ${this.wave}!`);
        document.getElementById('waveNumber').textContent = this.wave;
    }
    
    showMessage(text) {
        const msg = document.getElementById('message');
        msg.textContent = text;
        msg.style.opacity = 1;
        setTimeout(() => { msg.style.opacity = 0; }, 2000);
    }
    
    updateUI() {
        document.getElementById('goldAmount').textContent = Math.floor(this.resources.gold);
        document.getElementById('woodAmount').textContent = Math.floor(this.resources.wood);
        document.getElementById('stoneAmount').textContent = Math.floor(this.resources.stone);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Animate camera slightly
        this.camera.position.x = Math.sin(Date.now() * 0.0001) * 2;
        
        // Animate lights
        this.scene.children.forEach(child => {
            if (child instanceof THREE.PointLight) {
                child.intensity = 0.5 + Math.sin(Date.now() * 0.001) * 0.2;
            }
        });
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game on page load
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new Game();
});
