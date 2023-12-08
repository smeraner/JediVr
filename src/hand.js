import * as THREE from 'three';
import { Actor } from './actor.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class Hand extends THREE.Object3D {
    static model = null;
    static #staticConstructorDummyResult = (function () {
        //load model     
        const gltfLoader = new GLTFLoader();
        Hand.model = gltfLoader.loadAsync('./models/hand.glb').then(gltf => {
            gltf.scene.scale.set(0.01, 0.01, 0.01);
            gltf.scene.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0x000000,
                        roughness: 0,
                        metalness: 1
                    });
                }
            });
            return gltf;
        });
    })()

    static ANIMATIONS = {
        CLOSE: 1,
        CLOSED: 2,
        OPEN: 3,
        OPENED: 4
    }

    animation = Hand.ANIMATIONS.OPENED;
    animationProgress = 0;

    /**
     * 
     * @param {THREE.Scene} scene 
     */
    constructor(scene) {
        super();

        this.scene = scene;
        this.bones = {};
        this.skeleton = null;

        Hand.model.then(gltf => {
            const model = SkeletonUtils.clone( gltf.scene );
            model.traverse(child => {
                if(child.isBone && child.name === '_rootJoint') {
                    this.skeleton = new THREE.Skeleton([child]);
                }
            });

            this.add(model);
            this.closeHand();
        });
    }

    animate(deltaTime) {
        if(!this.skeleton) return;

        const handRoot = this.skeleton.bones[0].children[0];

        if(this.animation === Hand.ANIMATIONS.CLOSE) {
            handRoot.children.forEach(finger => {
                let bone = finger.children[0];
                while(bone) {
                    bone.rotation.x -= deltaTime * 1.2;
                    bone = bone.children[0];
                }
            });
            this.animationProgress += deltaTime;

            if(this.animationProgress >= 1) {
                this.animation = Hand.ANIMATIONS.CLOSED;
                this.openHand();
            }
        } else if(this.animation === Hand.ANIMATIONS.OPEN) {
            handRoot.children.forEach(finger => {
                let bone = finger.children[0];
                while(bone) {
                    bone.rotation.x += deltaTime * 1.2;
                    bone = bone.children[0];
                }
            });
            this.animationProgress += deltaTime;

            if(this.animationProgress >= 1) {
                this.animation = Hand.ANIMATIONS.OPENED;
            }
        }
    }

    closeHand() {
        if(!this.skeleton) return;
        if(this.animation !== Hand.ANIMATIONS.OPENED) return;

        this.animation = Hand.ANIMATIONS.CLOSE;
        this.animationProgress = 0;
    }

    openHand() {
        if(!this.skeleton) return;
        if(this.animation !== Hand.ANIMATIONS.CLOSED) return;

        this.animation = Hand.ANIMATIONS.OPEN;
        this.animationProgress = 0;
    }

    forcePull() {
        this.closeHand();
    }
    
}