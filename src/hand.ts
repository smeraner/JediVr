import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Actor } from './actor';
import { World } from './world';

interface HandEventMap extends THREE.Object3DEventMap  {
    opened: HandOpenedEvent;
    closed: HandClosedEvent;
}

interface HandOpenedEvent extends THREE.Event {
    type: 'opened';
}
interface HandClosedEvent extends THREE.Event {
    type: 'closed';
}

export class Hand extends THREE.Object3D<HandEventMap> {
    static model: Promise<any>;
    scene: THREE.Scene;
    raycaster: THREE.Raycaster;
    bones: {};
    skeleton: THREE.Skeleton | null;
    handDirection: THREE.Object3D<THREE.Object3DEventMap>;
    line: THREE.Line<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.LineDashedMaterial>;
    static soundBufferForcePull: Promise<AudioBuffer>;
    soundForcePull: THREE.PositionalAudio | undefined;

    static initialize () {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        Hand.soundBufferForcePull = audioLoader.loadAsync('./sounds/force-pull.ogg');

        //load model     
        const gltfLoader = new GLTFLoader();
        Hand.model = gltfLoader.loadAsync('./models/hand.glb').then(gltf => {
            //change right hand to left hand
            gltf.scene.scale.set(-0.01, 0.01, 0.01);
            gltf.scene.rotation.set(4.8,0,2)
            gltf.scene.traverse(child => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh && mesh.material) {
                    mesh.material = new THREE.MeshPhongMaterial({
                        color: 0x000000,
                        specular: 0x111111,
                        shininess: 200,
                    });
                }
            });
            return gltf;
        });
    }

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
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     */
    constructor(scene: THREE.Scene, audioListenerPromise: Promise<THREE.AudioListener>) {
        super();

        this.scene = scene;
        this.bones = {};
        this.skeleton = null;

        this.initAudio(audioListenerPromise);

        Hand.model.then(gltf => {
            const model = SkeletonUtils.clone( gltf.scene );
            model.traverse(child => {
                const bone = child as THREE.Bone;
                if(bone.isBone && child.name === '_rootJoint') {
                    this.skeleton = new THREE.Skeleton([bone]);
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

    async initAudio(audioListenerPromise: Promise<THREE.AudioListener>) {
        const audioListener = await audioListenerPromise;
        const bufferForcePull = await Hand.soundBufferForcePull;
        const soundForcePull = new THREE.PositionalAudio(audioListener);
        soundForcePull.setBuffer(bufferForcePull);
        this.add(soundForcePull);
        this.soundForcePull = soundForcePull;
    }

    update(deltaTime: number, world: World | undefined, enemys: Actor[]) {
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
                this.dispatchEvent({type: "closed"} as HandClosedEvent);
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
                this.dispatchEvent({type: "opened"} as HandOpenedEvent);
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

    collide(world: World | undefined, enemys: Actor[]): void {
        if(!this.force) return;

        this.getWorldPosition(this.raycaster.ray.origin);
        this.handDirection.getWorldPosition(this.raycaster.ray.direction);  

        const colliders = enemys.map((enemy: { colliderMesh: any; }) => enemy.colliderMesh);

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
        if (this.soundForcePull) {
            this.soundForcePull.setVolume(1.0);
            this.soundForcePull.play();
        }
        this.force = true;
        this.closeHand();
    }

    forceRelease() {
        if (this.soundForcePull) {
            this.soundForcePull.setVolume(0.0);
            setTimeout(() => { this.soundForcePull?.stop(); }, 10);
        }
        this.force = false;
        this.openHand();
    }

    forcePullObj(obj: { velocity: { addScaledVector: (arg0: any, arg1: number) => void; }; },direction: THREE.Vector3,distance: number) {
        if(distance > 1) {
            obj.velocity.addScaledVector(direction, -0.001 * distance);
        }
    }
    
}
Hand.initialize();