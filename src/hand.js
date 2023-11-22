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

    /**
     * 
     * @param {THREE.Scene} scene 
     */
    constructor(scene) {
        super();

        this.scene = scene;

        Hand.model.then(gltf => {
            const model = SkeletonUtils.clone( gltf.scene );
            this.add(model);
        });
    }
    
}