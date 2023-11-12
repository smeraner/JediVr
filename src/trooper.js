import * as THREE from './three/three.module.js';
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';
import { Capsule } from './three/addons/math/Capsule.js';

/**
 * Trooper is a NPC enemy that will guard the world
 * and attack the player if he gets too close.
 */
export class Trooper extends THREE.Object3D {
    gravity = 0;
    playerOnFloor = false;

    playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.7);

    trooperVelocity = new THREE.Vector3();
    trooperDirection = new THREE.Vector3();

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
            this.mixer = new THREE.AnimationMixer( model );

            this.idleAction = this.mixer.clipAction( animations[ 0 ] );
            this.walkAction = this.mixer.clipAction( animations[ 3 ] );
			this.runAction = this.mixer.clipAction( animations[ 1 ] );

            this.actions = [ this.idleAction, this.walkAction, this.runAction ];

            this.setAnimationWeight( this.idleAction, 1 );
            this.setAnimationWeight( this.walkAction, 0 );
            this.setAnimationWeight( this.runAction, 0 );

            this.actions.forEach( action => {
                action.play();
            });
        });
 
        this.scene.add(this);
    }

    setAnimationWeight( action, weight ) {
        action.enabled = true;
        action.setEffectiveTimeScale( 1 );
        action.setEffectiveWeight( weight );
    }

    animate(deltaTime) {
        this.mixer.update(deltaTime);
    }

}

