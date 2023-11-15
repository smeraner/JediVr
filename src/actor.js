import * as THREE from './three/three.module.js';
import { Capsule } from './three/addons/math/Capsule.js';

export class Actor extends THREE.Object3D {
    
    gravity = 0;
    health = 100;
    damageMultiplyer = 0.1;
    onFloor = false;

    collider = new Capsule(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 1, 0), 0.1);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();

    constructor(gravity) {
        super();

        this.gravity = gravity;
        this.addEventListener('dead', this.die);
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
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.collider.end.set(x, y, z);
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
