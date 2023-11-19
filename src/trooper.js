/// <reference path="./world.js" />
import * as THREE from './three/three.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Actor } from './actor.js';
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';
import { Capsule } from './three/addons/math/Capsule.js';

/**
 * Trooper is a NPC enemy that will guard the world
 * and attack the player if he gets too close.
 */
export class Trooper extends Actor {
    
    static debug = false;
    static model = null;
    static #staticConstructorDummyResult = (function () {
        //load model     
        const gltfLoader = new GLTFLoader();
        Trooper.model = gltfLoader.loadAsync('./models/trooper.glb').then(gltf => {
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            return gltf;
        });
    })()

    damageMultiplyer = 0.25;
    colliderHeight = 1.2;

    /**
     * 
     * @param {number} gravity 
     * @param {THREE.Scene} scene 
     */
    constructor(gravity, scene) {
        super(gravity, scene);

        this.collider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, this.colliderHeight, 0), this.colliderRadius);
        this.colliderMesh.geometry = new THREE.CapsuleGeometry(this.collider.radius, this.collider.end.y - this.collider.start.y);

        Trooper.model.then(gltf => {
            this.model = SkeletonUtils.clone( gltf.scene );
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

        this.mixer.stopAllAction();
        this.rotation.x = -Math.PI/2;
        this.setAnimationWeight(this.TPoseAction, 1);
    }


    animate(deltaTime, world) {
        super.animate(deltaTime, world);

        this.mixer.update(deltaTime);
    }

    dispose() {
        super.dispose();
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.model);
        this.model.traverse(child => {
            if (child.isMesh) {
                child.material.dispose();
            }
            if ( child.isSkinnedMesh ) child.skeleton.dispose();
        });
    }

}

