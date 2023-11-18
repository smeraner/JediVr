import * as THREE from './three/three.module.js';
import { Capsule } from './three/addons/math/Capsule.js';

export class Player extends THREE.Object3D {
    static debug = false;

    gravity = 0;
    onFloor = false;
     
    collider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.3, 0), 0.8);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();

    constructor(scene, gravity) {
        super();

        this.scene = scene;
        this.gravity = gravity;

        this.rotation.order = 'YXZ';
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';
        this.camera.position.y = 1.5;
        this.add(this.camera);
        this.scene.add(this);

        if (Player.debug) {
            const capsuleGeometry = new THREE.CapsuleGeometry(this.collider.radius, this.collider.end.y - this.collider.start.y);
            const capsuleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
            const capsule = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
            capsule.position.copy(this.collider.start);
            this.colliderHelper = capsule;
            this.scene.add(capsule);
        }
    }

    getCamera() {
        return this.camera;
    }

    /**
     * 
     * @param {World} world 
     */
    collitions(world) {
        const result = world.worldOctree.capsuleIntersect(this.collider);

        this.onFloor = false;

        if (result) {
            this.onFloor = result.normal.y > 0;

            if (!this.onFloor) {
                this.velocity.addScaledVector(result.normal, - result.normal.dot(this.velocity));
            }
            this.collider.translate(result.normal.multiplyScalar(result.depth));
            if(Player.debug) {
                this.colliderHelper.position.copy(this.collider.start);
            }
        }
    }

    /***
     * @param {number} deltaTime
     */
    animate(deltaTime, world) {

        let damping = Math.exp(- 4 * deltaTime) - 1;
        if (!this.onFloor) {
            this.velocity.y -= this.gravity * deltaTime;
            damping *= 0.1; // small air resistance
        }
        this.velocity.addScaledVector(this.velocity, damping);

        const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
        this.collider.translate(deltaPosition);

        this.collitions(world);

        this.position.copy(this.collider.end);
        this.position.y -= this.collider.radius;
    }

    getForwardVector() {

        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();

        return this.direction;

    }

    getSideVector() {

        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();
        this.direction.cross(this.camera.up);

        return this.direction;

    }
}