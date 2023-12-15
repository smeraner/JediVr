import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Octree } from 'three/addons/math/Octree.js';

interface WorldEventMap extends THREE.Object3DEventMap  {
    timerExpired: WorldTimerExpiredEvent;
    timerTick: WorldTimerTickEvent;
}

interface WorldTimerExpiredEvent extends THREE.Event {
    type: 'timerExpired';
}

interface WorldTimerTickEvent extends THREE.Event {
    type: 'timerTick';
}

export class World extends THREE.Object3D<WorldEventMap> {

    static debug = false;
    static initialize() {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        World.soundBuffer = audioLoader.loadAsync('./sounds/background_breath.ogg');
    }

    worldOctree = new Octree();
    static soundBuffer: Promise<AudioBuffer>;
    gui: GUI;
    enemySpawnPoints: THREE.Vector3[];
    playerSpawnPoint: THREE.Vector3;
    objectLoader: THREE.ObjectLoader;
    sound: THREE.Audio | undefined;
    map: THREE.Object3D<THREE.Object3DEventMap> | undefined;
    helper: OctreeHelper | undefined;

    timerSeconds = 120; //seconds

    /**
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     * @param {GUI} gui
     */
    constructor(audioListenerPromise: Promise<THREE.AudioListener>, gui: GUI) {
        super();

        this.gui = gui;
        this.enemySpawnPoints = [];
        this.playerSpawnPoint = new THREE.Vector3();

        this.objectLoader = new THREE.ObjectLoader();

        this.initAudio(audioListenerPromise);
    }

    async initAudio(audioListenerPromise: Promise<THREE.AudioListener>) {
        const audioListener = await audioListenerPromise;
        const soundBuffer = await World.soundBuffer;
        this.sound = new THREE.Audio(audioListener);
        this.sound.setBuffer(soundBuffer);
        this.sound.setLoop(true);
        this.sound.setVolume(0.3);
        this.sound.play();
    }

    async loadScene(url = './models/scene_ship.json'): Promise<THREE.Scene> {

        const scene = await this.objectLoader.loadAsync(url);

        const map = scene.children.find(child=> child.name==="collision-world.glb");
        this.map = map;
        this.rebuildOctree();

        //find object with name "Hemisphere" and change material to repeat
        scene.traverse(child => {
            const mesh = child as THREE.Mesh;

            mesh.castShadow = false;
            mesh.receiveShadow = false;

            if (mesh.isMesh && child.name === "Hemisphere") {
                const map = (mesh.material as THREE.MeshBasicMaterial).map;

                if (map) {
                    map.wrapS = THREE.RepeatWrapping;
                    map.wrapT = THREE.RepeatWrapping;
                    map.repeat.set(2, 2);
                    map.anisotropy = 4;
                }
            } else if (child.name === "Enemy") {
                this.enemySpawnPoints.push(child.position);
            } else if (child.name === "Player") {
                this.playerSpawnPoint.copy(child.position);
            }

            // //all lights off
            // if ((child as THREE.Light).isLight) {
            //     child.visible = false;
            // }

            //damageable objects
            if(mesh.isMesh && child.userData && child.userData.health) {
                const damageableChild = child as DamageableObject;
                damageableChild.damage = (damage: number) => {
                    child.userData.health -= damage;
                    if(child.userData.health <= 0) {
                        if (child.parent !== null) {
                            child.parent.remove(child);
                        }
                        this.rebuildOctree();
                    }
                }
            }
                
            // else if (child.isMesh && child.name === "collision-world.glb") {
            //     if (child.material.map) {
            //         child.material.map.anisotropy = 4;
            //     }
                
            // }
        });
       
        const helper = new OctreeHelper(this.worldOctree);
        helper.visible = false;
        scene.add(helper);
        this.helper = helper;

        return scene as THREE.Scene;
    }

    startTimer() {
        const interval = setInterval(() => {
            this.timerSeconds--;
            if (this.timerSeconds <= 0) {
                this.timerSeconds = 0;
                clearInterval(interval);
                this.dispatchEvent({type: "timerExpired"} as WorldTimerExpiredEvent);
            } else {
                this.dispatchEvent({type: "timerTick"} as WorldTimerTickEvent);
            }
        }, 1000);
    }

    update(deltaTime: number) {

    }

    rebuildOctree() {
        if (this.map) {
            this.worldOctree.clear().fromGraphNode(this.map);
        }
    }
}
World.initialize();