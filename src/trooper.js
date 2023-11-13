import * as THREE from './three/three.module.js';
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';
import { Capsule } from './three/addons/math/Capsule.js';

/**
 * Trooper is a NPC enemy that will guard the world
 * and attack the player if he gets too close.
 */
export class Trooper extends THREE.Object3D {
    gravity = 0;
    onFloor = false;

    collider = new Capsule(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 1, 0), 0.1);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();

    static trooperModel = null;
    static #staticConstructorDummyResult = (function () {
        //load audio     
        const gltfLoader = new GLTFLoader();
        Trooper.trooperModel = gltfLoader.loadAsync('./models/trooper.glb').then(gltf => {
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            return gltf;
        });
    })()

    constructor(scene, gravity) {
        super();

        this.scene = scene;
        this.gravity = gravity;

        Trooper.trooperModel.then(gltf => {
            const model = gltf.scene;
            this.add(model);
            const animations = gltf.animations;
            this.mixer = new THREE.AnimationMixer(model);

            this.idleAction = this.mixer.clipAction(animations[0]);
            this.walkAction = this.mixer.clipAction(animations[3]);
            this.runAction = this.mixer.clipAction(animations[1]);

            this.actions = [this.idleAction, this.walkAction, this.runAction];

            this.setAnimationWeight(this.idleAction, 1);
            this.setAnimationWeight(this.walkAction, 0);
            this.setAnimationWeight(this.runAction, 0);

            this.actions.forEach(action => {
                action.play();
            });
        });

        this.scene.add(this);
    }

    setAnimationWeight(action, weight) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }

    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.collider.end.set(x, y, z);
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

        this.collitions(world);

        this.position.copy(this.collider.end);

        this.mixer.update(deltaTime);
    }

}

