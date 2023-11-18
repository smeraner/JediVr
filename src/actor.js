import * as THREE from './three/three.module.js';
import { Capsule } from './three/addons/math/Capsule.js';

export class Actor extends THREE.Object3D {
    static debug = false;
    
    gravity = 0;
    health = 100;
    damageMultiplyer = 0.1;
    onFloor = false;

    collider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.3, 0), 0.5);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();

    constructor(gravity) {
        super();

        this.gravity = gravity;
        this.addEventListener('dead', this.die);

        if (Actor.debug) {
            const capsuleGeometry = new THREE.CapsuleGeometry(this.collider.radius, this.collider.end.y - this.collider.start.y);
            const capsuleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
            const capsule = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
            capsule.position.copy(this.collider.start);
            this.colliderHelper = capsule;
            app.scene.add(capsule);
        }
    }

    /**
     * Handles the actor's movement.
     * @param {World} world 
     */
    worldCollitions(world) {
        const result = world.worldOctree.capsuleIntersect(this.collider);

        this.onFloor = false;

        if (result) {
            this.onFloor = result.normal.y > 0;

            if (!this.onFloor) {
                this.velocity.addScaledVector(result.normal, - result.normal.dot(this.velocity));
            }
            this.collider.translate(result.normal.multiplyScalar(result.depth));
            if(Actor.debug) {
                this.colliderHelper.position.copy(this.collider.start);
            }
        }
    }

    animate(deltaTime, world) {
        let damping = Math.exp(- 4 * deltaTime) - 1;
        if (!this.onFloor) {
            this.velocity.y -= this.gravity * deltaTime;
            damping *= 0.1; // small air resistance
        }
        this.velocity.addScaledVector(this.velocity, damping);

        const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
        this.collider.translate(deltaPosition);

        this.worldCollitions(world);

        this.position.copy(this.collider.end);
        this.position.y -= this.collider.radius;
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.collider.start.set(x, y, z);
        this.collider.end.set(x, y + 0.3, z);
    }

    damage(amount) {
        this.health -= amount * this.damageMultiplyer;
        if (this.health <= 0) {
            this.dispatchEvent({ type: 'dead' });
        }
    }

    die() {
        this.health = 0;
        console.log(this, 'dead');
    }
}
