import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';
import { OBJLoader } from "https://unpkg.com/three@0.126.1/examples/jsm/loaders/OBJLoader.js";

(async function() {
    const canvas = document.getElementById("myCanvas");
    
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.scrollWidth * devicePixelRatio;
    canvas.height = canvas.scrollHeight * devicePixelRatio;

    class Spherical {
        constructor(distance, theta, phi) {
            this.distance = distance;
            this.theta = theta;
            this.phi = phi;
        }
        getX() { return this.distance * Math.cos(this.phi) * Math.cos(this.theta); }
        getY() { return this.distance * Math.sin(this.phi); }
        getZ() { return this.distance * Math.cos(this.phi) * Math.sin(this.theta); }
    }

    const simulationParams = {
        NUM_BOIDS: 25,
        MIN_SPEED: 0.003,
        MAX_SPEED: 0.004,
        NEIGHBORHOOD_RADIUS: 0.05,
        AVOIDANCE_RADIUS: 0.2,
        SEPARATION_WEIGHT: 1.0,
        ALIGNMENT_WEIGHT: 1.0,
        GROUP_WEIGHT: 10.,
        COLLISION_WEIGHT: 0.2,
        RANDOM_WEIGHT: 0.01,
        INERTIA: 0.002
    };
    const AQUARIUM_BOUNDS = { min: new THREE.Vector3(-0.85, -0.5, -0.5), max: new THREE.Vector3(0.85, 0.48, 0.48) };

    const SPECIES = {
        FISH: 0,
        LONG_FISH: 1
    };

    const textureLoader = new THREE.TextureLoader();
    const objLoader = new OBJLoader();
    let fishGeometryTemplate = null;
    let longFishGeometryTemplate = null;

    function loadAssetPromise(loader, url) {
        return new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
    }

    async function loadAssets() {
        console.log("Rozpoczynanie ładowania modeli...");
        
        try {
            const fishTexture = await loadAssetPromise(textureLoader, 'textures/fish.jpg');
            const longFishTexture = await loadAssetPromise(textureLoader, 'textures/LongFin.jpg');

            const fishObj = await loadAssetPromise(objLoader, 'models/Fish.obj');
            const longFishObj = await loadAssetPromise(objLoader, 'models/LongFin.obj');

            fishObj.traverse(function (child) {
                if (child.isMesh) {
                    child.material = new THREE.MeshPhongMaterial({ map: fishTexture });
                }
            });
            fishGeometryTemplate = fishObj;

            longFishObj.traverse(function (child) {
                if (child.isMesh) {
                    child.material = new THREE.MeshPhongMaterial({ map: longFishTexture });
                }
            });
            longFishGeometryTemplate = longFishObj;

            console.log("Modele załadowane pomyślnie!");
            return true;

        } catch (error) {
            console.error("Błąd podczas ładowania modeli:", error);
            return false;
        }
    }

    let boids = []; 

    class Boid {
        constructor(pos, vel, type) {
            this.pos = pos;
            this.vel = vel;
            this.type = type;

            this.shape = new THREE.Object3D();

            let mesh;
            if (type === SPECIES.LONG_FISH) {
                mesh = longFishGeometryTemplate.clone();
                mesh.scale.set(0.05, 0.05, 0.05);
                mesh.rotation.set(Math.PI/2, Math.PI, -Math.PI/2);
            } else if (type === SPECIES.FISH) {
                mesh = fishGeometryTemplate.clone();
                mesh.scale.set(0.0055, 0.0055, 0.0055);
                mesh.rotation.set(Math.PI/2, Math.PI, -Math.PI/2);
            } else {
                console.error("Nie udało się utworzyć rybki z modeli. Tworzona rybka stożek");
                const geometry = new THREE.ConeGeometry(0.015, 0.025, 12);
                const material = new THREE.MeshPhongMaterial({ color: "#f25844" });
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.set(Math.PI / 2, 0, 0);
            }
            this.shape.add(mesh);
            this.neighborhood = [];
            this.updateShape();
        }

        move(deltaTime) {
            this.neighborhood = [];
            for (const b of boids) {
                if (b!= this && this.pos.distanceToSquared(b.pos) <= (simulationParams.NEIGHBORHOOD_RADIUS*simulationParams.NEIGHBORHOOD_RADIUS)) {
                    this.neighborhood.push(b);
                }
            }
            const deltaV = this.separationFromOthers();
            deltaV.add(this.alignmentWithGroup());
            deltaV.add(this.cohesiveGroupMovement());
            deltaV.add(this.collisionControl());
            deltaV.add(this.randomMovement());
            deltaV.multiplyScalar(simulationParams.INERTIA);
            this.vel.add(deltaV);
            this.vel.clampLength(simulationParams.MIN_SPEED, simulationParams.MAX_SPEED);
            
            const scaledVel = this.vel.clone().multiplyScalar((deltaTime * 60) / 1000);;
            this.pos.add(scaledVel);
            this.pos.clamp(AQUARIUM_BOUNDS.min, AQUARIUM_BOUNDS.max);
            this.updateShape();
        }

        updateShape() {
            this.shape.position.set(this.pos.x, this.pos.y, this.pos.z);
            const lookingDirection = this.vel.clone().add(this.pos);
            this.shape.lookAt(lookingDirection);
        }

        separationFromOthers() {
            const resultVectorSum = new THREE.Vector3(0, 0, 0);
            for (const b of this.neighborhood) {
                const distToNeighbour = b.pos.distanceTo(this.pos);
                const oppositeDirectionFromNeighbour = this.pos.clone().sub(b.pos);
                if (distToNeighbour != 0) {
                    oppositeDirectionFromNeighbour.divideScalar(distToNeighbour);
                }
                resultVectorSum.add(oppositeDirectionFromNeighbour);
            }
            resultVectorSum.multiplyScalar(simulationParams.SEPARATION_WEIGHT);
            return resultVectorSum;
        }

        alignmentWithGroup() {
            const resultVectorSum = new THREE.Vector3(0, 0, 0);
            for (const b of this.neighborhood) {
                if (this.type === b.type){
                    resultVectorSum.add(b.vel);
                }
            }
            resultVectorSum.normalize();
            resultVectorSum.multiplyScalar(simulationParams.ALIGNMENT_WEIGHT);
            return resultVectorSum;
        }

        cohesiveGroupMovement() {
            const resultVectorSum = new THREE.Vector3(0, 0, 0);
            let count = 0;
            const center = new THREE.Vector3(0, 0, 0);
            for (const b of this.neighborhood) {
                if (this.type === b.type){
                    center.add(b.pos);
                    count++;
                }
            }
            if (count > 0) {
                center.divideScalar(count);
                resultVectorSum.subVectors(center, this.pos);
                resultVectorSum.multiplyScalar(simulationParams.GROUP_WEIGHT);
            }
            return resultVectorSum;
        }

        collisionControl() {
            const resultVectorSum = new THREE.Vector3(0, 0, 0);
            if (Math.abs(this.pos.x) + simulationParams.AVOIDANCE_RADIUS >= 0.85) resultVectorSum.x = -Math.sign(this.pos.x);
            if (Math.abs(this.pos.y) + simulationParams.AVOIDANCE_RADIUS >= 0.5) resultVectorSum.y = -Math.sign(this.pos.y);
            if (Math.abs(this.pos.z) + simulationParams.AVOIDANCE_RADIUS >= 0.5) resultVectorSum.z = -Math.sign(this.pos.z);
            resultVectorSum.multiplyScalar(simulationParams.COLLISION_WEIGHT);
            return resultVectorSum;
        }

        randomMovement() {
            const resultVector = randomVec(1, 1, 1).multiplyScalar(simulationParams.RANDOM_WEIGHT);
            return resultVector;
        }
    }

    function randomVec(xBound, yBound, zBound) {
        const x = Math.random() * 2 * xBound - xBound;
        const y = Math.random() * 2 * yBound - yBound;
        const z = Math.random() * 2 * zBound - zBound;
        return new THREE.Vector3(x, y, z);	
    }

    const camera_position = new Spherical(1.5, Math.PI / 2 - Math.PI / 16, Math.PI / 8);
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    const scene = new THREE.Scene();

    // Pomocniczy układ współrzędnych
    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);

    const camera = new THREE.PerspectiveCamera(100, canvas.width / canvas.height, 0.001, 1000);
    camera.position.set(camera_position.getX(), camera_position.getY(), camera_position.getZ());
    camera.lookAt(0, 0, 0);
    scene.add(camera);

    const controls = new OrbitControls(camera, canvas);
    controls.minDistance = 0.1;
    controls.maxDistance = 2.;

    const tank = new THREE.Object3D();
    scene.add(tank);
    const edgeMaterial = new THREE.MeshPhongMaterial({
        color: "#000000", 
        specular: "#5a5959ff", 
        shininess: 30 
    });
    const edgeThickness = 0.005;
    const w = 1.7, h = 1, d = 1;

    const verticalEdges = [
        new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, 0, -d / 2),
        new THREE.Vector3(-w / 2, 0, d / 2), new THREE.Vector3(w / 2, 0, d / 2)
    ];
    verticalEdges.forEach(pos => {
        const edgeGeom = new THREE.BoxGeometry(edgeThickness, h, edgeThickness);
        const edgeMesh = new THREE.Mesh(edgeGeom, edgeMaterial);
        edgeMesh.position.set(pos.x, pos.y, pos.z);
        tank.add(edgeMesh);
    });

    [-h / 2, h / 2].forEach(yPos => {
        [-w / 2, w / 2].forEach(xPos => {
            const edgeGeom = new THREE.BoxGeometry(edgeThickness, edgeThickness, d);
            const edgeMesh = new THREE.Mesh(edgeGeom, edgeMaterial);
            edgeMesh.position.set(xPos, yPos, 0);
            tank.add(edgeMesh);
        });
        [-d / 2, d / 2].forEach(zPos => {
            const edgeGeom = new THREE.BoxGeometry(w, edgeThickness, edgeThickness);
            const edgeMesh = new THREE.Mesh(edgeGeom, edgeMaterial);
            edgeMesh.position.set(0, yPos, zPos);
            tank.add(edgeMesh);
        });
    });

    const waterTexture = textureLoader.load('textures/water.jpg');
    waterTexture.wrapS = THREE.RepeatWrapping;
    waterTexture.wrapT = THREE.RepeatWrapping;

    const waterMaterial = new THREE.MeshPhongMaterial({
        map: waterTexture,
        opacity: 0.3,
        transparent: true,
        side: THREE.BockSide,
        shininess: 100
    });
    const boxGeometry = new THREE.BoxGeometry(1.7, 1, 1); 
    const water = new THREE.Mesh(boxGeometry, waterMaterial);
    scene.add(water);

    const floorTexture = textureLoader.load('textures/rocks.jpg');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set( 4, 4 );

    const floorMaterial = new THREE.MeshPhongMaterial({
        map: floorTexture,
        shininess: 20 
    });
    const floorGeometry = new THREE.BoxGeometry(1.7, 0.02,1);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, -0.5, 0);
    tank.add(floor);

    const ambientLight = new THREE.AmbientLight("#fff7cc", 1);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight("#ccffe1ff", 0.5, 100);
    pointLight.position.set(0.6, 0.4, 0.4);
    scene.add(pointLight);

    function regenerateBoids() {
        for (const boid of boids) {
            scene.remove(boid.shape);
        }
        boids = [];
        for (let i = 0; i < simulationParams.NUM_BOIDS; i++) {
            const boid = new Boid(randomVec(0.85, 0.4, 0.3), randomVec(1, 1, 1), (i % 2 === 0)? SPECIES.FISH : SPECIES.LONG_FISH);
            scene.add(boid.shape);
            boids.push(boid);
        }
    }

    const loaded = await loadAssets();
    if(loaded){
        regenerateBoids();

        const gui = new GUI({title:"Ustawienia symulacji", width: 350 });
        gui.add(simulationParams, 'NUM_BOIDS', 2, 40, 1).name('Ilość rybek').onFinishChange(regenerateBoids);
        gui.add(simulationParams, 'COLLISION_WEIGHT', 0, 1, 0.1).name('Waga unikania kolizji');
        gui.add(simulationParams, 'GROUP_WEIGHT', 0, 100, 2).name('Waga spójności grupy');
        gui.add(simulationParams, 'RANDOM_WEIGHT', 0, 0.1, 0.01).name('Waga Losowości ruchu rybki');
        gui.add(simulationParams, 'INERTIA', 0.00, 1.0, 0.01).name('Moc wektora zmian prędkości na rybkę');
        gui.open();


        let lastTime = Date.now();
        let t_anim = 0;

        const _loop = (dt) =>{
            const now = Date.now();
            const deltaTime = now - lastTime;
            lastTime = now;

            for (const b of boids) {
                b.move(deltaTime);
            }

            const cameraMoveSpeed = 0.02; 
            const cameraRotateSpeed = 0.02;

            if (keyState['ArrowUp']) {
                camera.translateZ(-cameraMoveSpeed);
            }
            if (keyState['ArrowDown']) {
                camera.translateZ(cameraMoveSpeed);
            }
            if (keyState['ArrowLeft']) {
                camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotateSpeed);
            }
            if (keyState['ArrowRight']) {
                camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -cameraRotateSpeed);
            }

            water.material.side = THREE.FrontSide;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObject(water);
            if (intersects.length === 0) {
                water.material.side = THREE.BackSide;
            }

            const baseColor = new THREE.Color("#3a80c9");
            const otherColor = new THREE.Color("#3a80c9");
            const alpha = Math.sin((t_anim * Math.PI) / 1000);
            baseColor.lerp(otherColor, alpha);
            water.material.color = baseColor;
            t_anim = (t_anim + 1) % 1000;

            controls.update();
            renderer.render(scene, camera);
            requestAnimationFrame(_loop);
        }

        const keyState = {};
        window.addEventListener('keydown', (e) => { keyState[e.code] = true; });
        window.addEventListener('keyup', (e) => { keyState[e.code] = false; });
        requestAnimationFrame(_loop);

    }
    
    window.addEventListener("resize", () => {
        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvas.scrollWidth * devicePixelRatio;
        canvas.height = canvas.scrollHeight * devicePixelRatio;
        
        camera.aspect = canvas.width / canvas.height;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.width, canvas.height);
    });

})();