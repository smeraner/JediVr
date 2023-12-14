import * as THREE from 'three';
import { World } from './world';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Saber } from './saber';
import { Hand } from './hand';

export class Player extends THREE.Object3D implements DamageableObject {
    static debug = false;

    gravity = 0;
    onFloor = false;

    colliderHeight = .3;
    collider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, this.colliderHeight, 0), 0.8);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    colliderMesh: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    health: number = 100;
    damageMultiplyer: number = 0.1;
    filterMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    saber: Saber;
    hand: Hand;

    /**
     * @param {THREE.Scene} scene
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     * @param {number} gravity
     */
    constructor(scene: THREE.Scene, audioListenerPromise: Promise<THREE.AudioListener>, gravity: number) {
        super();

        this.scene = scene;
        this.gravity = gravity;

        this.rotation.order = 'YXZ';

        let fov = 70;
        let far = 1000; // > 1080px screen width res camera
        let near = 0.1;

        // Mobile camera
        if (window.innerWidth <= 768) {
            far = 500
            // 769px - 1080px screen width camera
        } else if (window.innerWidth >= 769 && window.innerWidth <= 1080) {
            far = 750
        } 

        this.camera = new THREE.PerspectiveCamera(
            fov,
            window.innerWidth / window.innerHeight,
            near,
            far
        )

        //this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';
        this.camera.position.y = 1.5;
        this.add(this.camera);
        this.scene.add(this);

        //connect audio listener as soon as it is ready
        this.initAudio(audioListenerPromise);

        let filterGeometry = new THREE.SphereGeometry(0.5, 15, 32); // camera near is 0.1, camera goes inside this sphere
        let filterMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: 0.35, side: THREE.BackSide});
        let filterMesh = new THREE.Mesh(filterGeometry, filterMaterial);
        filterMesh.visible = false;
        this.camera.add(filterMesh);
        this.filterMesh = filterMesh;

        //collider
        const capsuleGeometry = new THREE.CapsuleGeometry(this.collider.radius, this.collider.end.y - this.collider.start.y);
        const capsuleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
        const colliderMesh = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
        colliderMesh.userData.obj = this;
        colliderMesh.position.copy(this.collider.start);
        this.colliderMesh = colliderMesh;
        this.scene.add(colliderMesh);
        this.colliderMesh.visible = Player.debug;

        this.saber = new Saber(this.scene, this.camera, audioListenerPromise);
        this.hand = new Hand(this.scene, audioListenerPromise);
    }

    /**
     * Process inbound damage
     * @param {number} amount
     */
    damage(amount: number) {
        if(this.health === 0) return;
        
        this.health -= amount * this.damageMultiplyer;
        if (this.health <= 0) {
            this.health = 0;
        }

        //hit animation, turn camera red 1 sec
        this.filterMesh.visible = true;
        setTimeout(() => {
            this.filterMesh.visible = false;
        }, 200);
    }

    getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    async initAudio(audioListenerPromise: Promise<THREE.AudioListener>): Promise<void> {
        const audioListener = await audioListenerPromise;
        this.camera.add(audioListener);
    }

    /**
     * 
     * @param {World} world 
     */
    collitions(world: World): void {
        const result = world.worldOctree.capsuleIntersect(this.collider);

        this.onFloor = false;

        if (result) {
            this.onFloor = result.normal.y > 0;

            if (!this.onFloor) {
                this.velocity.addScaledVector(result.normal, - result.normal.dot(this.velocity));
            }
            this.collider.translate(result.normal.multiplyScalar(result.depth));
            this.colliderMesh.position.copy(this.collider.start);
        }
    }

    /***
     * @param {number} deltaTime
     */
    update(deltaTime: number, world: World): void {

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

        this.colliderMesh.visible = Player.debug;
    }

    teleport(position: THREE.Vector3): void {
        this.position.copy(position);
        this.collider.start.copy(position);
        this.collider.end.copy(position);
        this.collider.end.y += this.colliderHeight;
        this.colliderMesh.position.copy(this.collider.start);

        this.velocity.set(0, 0, 0);
        this.onFloor = true;

    }

    getForwardVector(): THREE.Vector3 {

        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();

        return this.direction;

    }

    getSideVector(): THREE.Vector3 {

        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();
        this.direction.cross(this.camera.up);

        return this.direction;

    }
}