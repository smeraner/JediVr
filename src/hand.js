import * as THREE from './three/three.module.js';
import { Actor } from './actor.js';
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from './three/addons/utils/SkeletonUtils.js';

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
                // if (child.isBone && child.name === 'thumb01_R_01') {
                //     this.bones.thumb01_R_01 = child;
                // } else if (child.isBone && child.name === 'thumb02_R_02') {
                //     this.bones.thumb02_R_02 = child;
                // } else if (child.isBone && child.name === 'thumb03_R_03') {
                //     this.bones.thumb03_R_03 = child;
                // } else if (child.isBone && child.name === 'index00_R_04') {
                //     this.bones.index00_R_04 = child;
                // } else if (child.isBone && child.name === 'index01_R_05') {
                //     this.bones.index01_R_05 = child;
                // } else if (child.isBone && child.name === 'index02_R_06') {
                //     this.bones.index02_R_06 = child;
                // } else if (child.isBone && child.name === 'index03_R_07') {
                //     this.bones.index03_R_07 = child;
                // } else if (child.isBone && child.name === 'middle00_R_08') {
                //     this.bones.middle00_R_08 = child;
                // } else if (child.isBone && child.name === 'middle01_R_09') {
                //     this.bones.middle01_R_09 = child;
                // } else if (child.isBone && child.name === 'middle02_R_010') {
                //     this.bones.middle02_R_010 = child;
                // } else if (child.isBone && child.name === 'middle03_R_011') {
                //     this.bones.middle03_R_011 = child;
                // } else if (child.isBone && child.name === 'ring00_R_012') {
                //     this.bones.ring00_R_012 = child;
                // } else if (child.isBone && child.name === 'ring01_R_013') {
                //     this.bones.ring01_R_013 = child;
                // } else if (child.isBone && child.name === 'ring02_R_014') {
                //     this.bones.ring02_R_014 = child;
                // } else if (child.isBone && child.name === 'ring03_R_015') {
                //     this.bones.ring03_R_015 = child;
                // } else if (child.isBone && child.name === 'pinky00_R_016') {
                //     this.bones.pinky00_R_016 = child;
                // } else if (child.isBone && child.name === 'pinky01_R_017') {
                //     this.bones.pinky01_R_017 = child;
                // } else if (child.isBone && child.name === 'pinky02_R_018') {
                //     this.bones.pinky02_R_018 = child;
                // } else if (child.isBone && child.name === 'pinky03_R_019') {
                //     this.bones.pinky03_R_019 = child;
                // }
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
    
}