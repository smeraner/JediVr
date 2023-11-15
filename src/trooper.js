/// <reference path="./world.js" />
import * as THREE from './three/three.module.js';
import { Actor } from './actor.js';
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';

/**
 * Trooper is a NPC enemy that will guard the world
 * and attack the player if he gets too close.
 */
export class Trooper extends Actor {
    
    static debug = false;
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

    constructor(gravity) {
        super(gravity);

        Trooper.trooperModel.then(gltf => {
            this.model = gltf.scene;
            this.add(this.model);
            const animations = gltf.animations;
            this.mixer = new THREE.AnimationMixer(this.model);

            this.idleAction = this.mixer.clipAction(animations[0]);
            this.walkAction = this.mixer.clipAction(animations[3]);
            this.runAction = this.mixer.clipAction(animations[1]);
            this.TPoseAction = this.mixer.clipAction(animations[2]);

            this.actions = [this.idleAction, this.walkAction, this.runAction];

            this.setAnimationWeight(this.idleAction, 1);
            this.setAnimationWeight(this.walkAction, 0);
            this.setAnimationWeight(this.runAction, 0);
            this.setAnimationWeight(this.TPoseAction, 0);

            this.actions.forEach(action => {
                action.play();
            });

            // if(Trooper.debug) {
            //     const box3 = new THREE.Box3().setFromObject(this);
            //     const box = new THREE.Box3Helper(box3, 0xffff00);
            //     this.add(box);
            // }
        });

    }

    setAnimationWeight(action, weight) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }

    die() {
        super.die();

        this.actions.forEach(action => {
            action.stop();
        });
        this.rotation.x = -Math.PI/2;
        this.setAnimationWeight(this.TPoseAction, 1);
    }


    animate(deltaTime, world) {
        super.animate(deltaTime, world);

        this.mixer.update(deltaTime);
    }

}

