import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class Hand extends THREE.Object3D {
    static model = null;
    static #staticConstructorDummyResult = (function () {
        //load model     
        const gltfLoader = new GLTFLoader();
        Hand.model = gltfLoader.loadAsync('./models/hand.glb').then(gltf => {
            //change right hand to left hand
            gltf.scene.scale.set(-0.01, 0.01, 0.01);
            gltf.scene.rotation.set(4.8,0,2)
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

    force = false;
    forceRange = 15;

    animation = Hand.ANIMATIONS.OPENED;
    animationProgress = 1;
    animationSpeed = 1.2;

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

            //little animation
            //this.addEventListener('closed', () => { this.openHand(); this.removeEventListener('closed') });
            //this.closeHand();
        });

        const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, this.forceRange);
        this.raycaster = raycaster;

        const handDirection = new THREE.Object3D();
        handDirection.position.set(0,this.forceRange,0);
        this.add(handDirection);
        this.handDirection = handDirection;

        //line to viszualize raycaster
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0,this.forceRange,0)]);
        const line = new THREE.Line(lineGeometry, new THREE.LineDashedMaterial( { color: 0xffffff, dashSize: .1, gapSize: .1, opacity: .3, transparent: true } ));
        line.computeLineDistances();
        this.add(line);
        this.line = line;
    }

    animate(deltaTime, world, enemys) {
        if(!this.skeleton) return;

        const handRoot = this.skeleton.bones[0].children[0];

        if(this.animation === Hand.ANIMATIONS.CLOSE) {
            handRoot.children.forEach(finger => {
                let bone = finger.children[0];
                while(bone) {
                    bone.rotation.x -= deltaTime * this.animationSpeed;
                    bone = bone.children[0];
                }
            });
            this.animationProgress += deltaTime * this.animationSpeed;

            if(this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.animation = Hand.ANIMATIONS.CLOSED;
                this.dispatchEvent({type: 'closed'});
            }
        } else if(this.animation === Hand.ANIMATIONS.OPEN) {
            handRoot.children.forEach(finger => {
                let bone = finger.children[0];
                while(bone) {
                    bone.rotation.x += deltaTime * this.animationSpeed;
                    bone = bone.children[0];
                }
            });
            this.animationProgress += deltaTime * this.animationSpeed;

            if(this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.animation = Hand.ANIMATIONS.OPENED;
                this.dispatchEvent({type: 'opened'});
            }
        }
        this.collide(world, enemys);
    }

    closeHand() {
        if(!this.skeleton) return;
        if(this.animation === Hand.ANIMATIONS.CLOSED) return;

        this.animation = Hand.ANIMATIONS.CLOSE;
        this.animationProgress = 1 - this.animationProgress;
        this.animationSpeed = 3;
    }

    openHand() {
        if(!this.skeleton) return;
        if(this.animation === Hand.ANIMATIONS.OPENED) return;

        this.animation = Hand.ANIMATIONS.OPEN;
        this.animationProgress = 1 - this.animationProgress;
        this.animationSpeed = 3;
    }

    collide(world, enemys) {
        if(!this.force) return;

        const handPosition = new THREE.Vector3();
        this.getWorldPosition(handPosition);
        const handDirection = new THREE.Vector3();
        this.handDirection.getWorldPosition(handDirection);
        this.raycaster.set(handPosition, handDirection);

        const colliders = enemys.map((enemy) => enemy.colliderMesh);

        const collisions = this.raycaster.intersectObjects(colliders);
        if(collisions.length > 0) {
            const collision = collisions[0];
            const obj = collision.object.userData.obj;
            if(obj) {
                //console.debug('force',obj);
                this.forcePullObj(obj, this.raycaster.ray.direction, collision.distance);
            }
        }
    }

    forcePull() {
        this.force = true;
        this.closeHand();
    }

    forceRelease() {
        this.force = false;
        this.openHand();
    }

    forcePullObj(obj,direction,distance) {
        if(distance > 1) {
            obj.velocity.addScaledVector(direction, -0.001 * distance);
        }
    }
    
}