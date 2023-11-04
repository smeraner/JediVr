import * as THREE from './three/three.module.js';
import { Capsule } from './three/addons/math/Capsule.js';

export class Player extends THREE.Object3D {
    gravity = 0;
    playerOnFloor = false;

    playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);

    playerVelocity = new THREE.Vector3();
    playerDirection = new THREE.Vector3();

    constructor(scene, gravity) {
        super();

        this.scene = scene;
        this.gravity = gravity;

        this.rotation.order = 'YXZ';
        this.position.z = 5;
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';
        this.add(this.camera);
        this.scene.add(this);
    }

    getCamera() {
        return this.camera;
    }

    /**
     * 
     * @param {World} world 
     */
    playerCollisions(world) {
        const result = world.worldOctree.capsuleIntersect(this.playerCollider);

        this.playerOnFloor = false;

        if (result) {

            this.playerOnFloor = result.normal.y > 0;

            if (!this.playerOnFloor) {

                this.playerVelocity.addScaledVector(result.normal, - result.normal.dot(this.playerVelocity));

            }

            this.playerCollider.translate(result.normal.multiplyScalar(result.depth));

        }
    }

    /***
     * @param {number} deltaTime
     */
    updatePlayer(deltaTime, world) {

        let damping = Math.exp(- 4 * deltaTime) - 1;

        if (!this.playerOnFloor) {

            this.playerVelocity.y -= this.gravity * deltaTime;

            // small air resistance
            damping *= 0.1;

        }

        this.playerVelocity.addScaledVector(this.playerVelocity, damping);

        const deltaPosition = this.playerVelocity.clone().multiplyScalar(deltaTime);
        this.playerCollider.translate(deltaPosition);

        this.playerCollisions(world);

        this.position.copy(this.playerCollider.end);

    }
}