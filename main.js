import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";

const canvas = document.getElementById("myCanvas");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, canvas.clientWidth / canvas.clientHeight, 0.001, 1000);
camera.position.z = 1.5;
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });

const controls = new OrbitControls(camera, canvas);
controls.minDistance = 0.3;
controls.maxDistance = 3;

const NUM_BOIDS = 40; //the number of boids in the tank
const SPEED = 0.003; //how fast the boids travel
const NEIGHBORHOOD_RADIUS = 0.03; //the squared radius of the boids' sphere of vision
const AVOIDANCE_RADIUS = 0.15; //the radius of the boid's sightline to the walls
const SEP_WEIGHT = 1; //how much the boid separates itself from it's neighboids
const ALI_WEIGHT = 0.8; //how much the boid aligns with it's neighboids
const COH_WEIGHT = 0.98; //how much the boid groups with it's neighboids
const AVO_WEIGHT = 0.2; //how much the boid dodges the walls
const RAN_WEIGHT = 0.01; //how much the boid goes in a random direction
const INERTIA = 0.01; //the proportion with which the rules should affect the current speed

let boids, bounds, water, t;
let lastTime = Date.now();

class Boid {
	constructor(pos, vel, green) {
		/* set properties */
		this.pos = pos;
		this.vel = vel;
		this.green = green;

		/* create THREE.js object */
		let col = "#f25844";
		if (green) col = "#51824b";
		const shape = new THREE.Object3D();
		const geometry = new THREE.ConeGeometry(0.015, 0.025, 12);
		const material = new THREE.MeshPhongMaterial({ color: col });
		const cone = new THREE.Mesh(geometry, material);
		cone.rotation.set(Math.PI / 2, 0, 0);
		shape.add(cone);

		this.shape = shape;
		this.neighborhood = [];
		this.updateShape();
	}

	move(deltaTime) {
		/* create neighborhood */
		this.neighborhood = [];
		for (const b of boids) {
			if (b == this) continue;
			if (this.pos.distanceToSquared(b.pos) <= NEIGHBORHOOD_RADIUS) this.neighborhood.push(b);
		}

		/* apply all rules*/
		const deltaV = this.separation();
		deltaV.add(this.alignment());
		deltaV.add(this.cohesion());
		deltaV.add(this.avoidance());
		deltaV.add(this.randomness());
		deltaV.multiplyScalar(INERTIA);

		/* add rules to current velocity and update position */
		this.vel.add(deltaV);
		this.vel.clampLength(SPEED, SPEED);
		const scaledVel = this.vel.clone();
		scaledVel.multiplyScalar((deltaTime * 60) / 1000);
		this.pos.add(scaledVel);
		this.pos.clamp(bounds.min, bounds.max);
		this.updateShape(); //update THREE.js shape
	}

	updateShape() {
		this.shape.position.set(this.pos.x, this.pos.y, this.pos.z); //move the cone
		/* look in the direction of travel */
		const lookDir = this.vel.clone();
		lookDir.add(this.pos);
		this.shape.lookAt(lookDir);
	}

	/* avoid all boids in neighborhood */
	separation() {
		const result = new THREE.Vector3(0, 0, 0);
		for (const b of this.neighborhood) {
			const dist = b.pos.distanceTo(this.pos);
			const oppositeDir = this.pos.clone();
			oppositeDir.sub(b.pos);
			if (dist != 0) oppositeDir.divideScalar(dist);
			result.add(oppositeDir);
		}
		result.clampLength(SEP_WEIGHT, SEP_WEIGHT);
		return result;
	}

	/* align velocity with all boids in neighborhood (when boids are the same color) */
	alignment() {
		const result = new THREE.Vector3(0, 0, 0);
		for (const b of this.neighborhood) {
			if (this.green === b.green) {
				result.add(b.vel);
			}
		}
		result.clampLength(ALI_WEIGHT, ALI_WEIGHT);
		return result;
	}

	/* move towards center of mass of neighborhood (when boids are the same color) */
	cohesion() {
		const result = new THREE.Vector3(0, 0, 0);
		let count = 0;
		const center = new THREE.Vector3(0, 0, 0);
		for (const b of this.neighborhood) {
			if (this.green !== b.green) continue;
			center.add(b.pos);
			count++;
		}
		if (count > 0) {
			center.divideScalar(count);
			result.subVectors(center, this.pos);
			result.clampLength(COH_WEIGHT, COH_WEIGHT);
		}
		return result;
	}

	/* move away from walls when boid is close to hitting them */
	avoidance() {
		const result = new THREE.Vector3(0, 0, 0);
		if (Math.abs(this.pos.x) + AVOIDANCE_RADIUS >= 0.85) {
			result.x = -Math.sign(this.pos.x);
		}
		if (Math.abs(this.pos.y) + AVOIDANCE_RADIUS >= 0.5) {
			result.y = -Math.sign(this.pos.y);
		}
		if (Math.abs(this.pos.z) + AVOIDANCE_RADIUS >= 0.5) {
			result.z = -Math.sign(this.pos.z);
		}
		result.clampLength(AVO_WEIGHT, AVO_WEIGHT);
		return result;
	}

	/* shake things up with a little randomness */
	randomness() {
		const result = randomVec(1, 1, 1);
		result.clampLength(RAN_WEIGHT, RAN_WEIGHT);
		return result;
	}
}

const init = () => {
	const tank = new THREE.Object3D();

	/* WIREFRAME EDGES */
	const boxGeometry = new THREE.BoxGeometry(1.7, 1, 1);
	const boxEdges = new THREE.EdgesGeometry(boxGeometry);
	const boxLines = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: "#000000" }));
	tank.add(boxLines);
	scene.add(tank);

	/* WATER */
	const waterMaterial = new THREE.MeshPhongMaterial({
		color: "#6895ed",
		opacity: 0.5,
		transparent: true,
		side: THREE.FrontSide,
	});
	water = new THREE.Mesh(boxGeometry, waterMaterial);
	scene.add(water);

	/* LIGHTS */
	const ambientLight = new THREE.AmbientLight("#fff7cc", 1);
	scene.add(ambientLight);

	const pointLight = new THREE.PointLight("#fff7cc", 0.5, 100);
	pointLight.position.set(0.6, 0.4, 0.4);
	scene.add(pointLight);

	/* bounds of tank */
	const minBound = new THREE.Vector3(-0.83, -0.48, -0.48);
	const maxBound = new THREE.Vector3(0.83, 0.48, 0.48);
	bounds = { min: minBound, max: maxBound };

	/* create actual boids */
	boids = [];
	for (let i = 0; i < NUM_BOIDS; i++) {
		const boid = new Boid(randomVec(0.85, 0.5, 0.5), randomVec(1, 1, 1), i % 2 === 0);
		scene.add(boid.shape);
		boids.push(boid);
	}

	t = 0;
	animate();
};

const animate = () => {
	requestAnimationFrame(animate);
	const deltaTime = Date.now() - lastTime;
	lastTime = Date.now();

	/* move all boids */
	for (const b of boids) {
		b.move(deltaTime);
	}

	/* check if camera is inside tank */
	water.material.side = THREE.FrontSide;
	const raycaster = new THREE.Raycaster();
	raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
	const intersects = raycaster.intersectObject(water);
	if (intersects.length === 0) {
		water.material.side = THREE.BackSide; //change how walls render
	}

	/* lerp water color over time */
	const baseColor = new THREE.Color("#3a80c9");
	const otherColor = new THREE.Color("#4790cc");
	const alpha = Math.sin((t * Math.PI) / 1000);

	baseColor.lerp(otherColor, alpha);
	water.material.color = baseColor;

	t = (t + 1) % 1000;

	renderer.render(scene, camera); //render the scene
};

const randomVec = (xBound, yBound, zBound) => {
	const x = Math.random() * 2 * xBound - xBound;
	const y = Math.random() * 2 * yBound - yBound;
	const z = Math.random() * 2 * zBound - zBound;
	return new THREE.Vector3(x, y, z);
};

document.onload = init();