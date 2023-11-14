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

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.collider.end.set(x, y, z);
    }

    damage(amount) {
        this.health -= amount * this.damageMultiplyer;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.health = 0;
        console.log(this, 'dead');
    }
}
