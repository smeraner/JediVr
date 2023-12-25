import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Cloud } from './cloud';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( './draco/' );
const geometryLoader = new GLTFLoader();
geometryLoader.setDRACOLoader( dracoLoader );

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
    static soundBufferBreath: Promise<AudioBuffer>;
    static soundBufferAlarm: Promise<AudioBuffer>;
    static model: Promise<THREE.Object3D>;

    static initialize() {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        World.soundBufferBreath = audioLoader.loadAsync('./sounds/background_breath.ogg');
        World.soundBufferAlarm = audioLoader.loadAsync('./sounds/alarm.ogg');

    }

    timerInterval: NodeJS.Timeout | undefined;
    worldOctree = new Octree();

    gui: GUI;
    enemySpawnPoints: THREE.Vector3[];
    playerSpawnPoint: THREE.Vector3;
    objectLoader: THREE.ObjectLoader;
    sound: THREE.Audio | undefined;
    scene: THREE.Scene | undefined;
    soundAlarm: THREE.Audio | undefined;
    map: THREE.Object3D<THREE.Object3DEventMap> | undefined;
    helper: OctreeHelper | undefined;

    animatedObjects: THREE.Object3D[] = [];

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
        const soundBuffer = await World.soundBufferBreath;
        this.sound = new THREE.Audio(audioListener);
        this.sound.setBuffer(soundBuffer);
        this.sound.setLoop(true);
        this.sound.setVolume(0.3);

        const soundBufferAlarm = await World.soundBufferAlarm;
        this.soundAlarm = new THREE.Audio(audioListener);
        this.soundAlarm.setBuffer(soundBufferAlarm);
        this.soundAlarm.setLoop(true);
        this.soundAlarm.setVolume(0.1);
        
        this.playWorldAudio();
    }

    playWorldAudio() {
        if (this.sound) {
            this.sound.play();
        }
        if (this.soundAlarm) {
            this.soundAlarm.play();
        }
    }

    stopWorldAudio() {
        if (this.sound) {
            this.sound.stop();
        }
        if (this.soundAlarm) {
            this.soundAlarm.stop();
        }
    }

    async loadScene(url = './models/scene_ship.json'): Promise<THREE.Scene> {
        this.scene = new THREE.Scene();

        //load geometry
        const gltf = await geometryLoader.loadAsync('./models/scene_ship.glb');
        
        //optimize performance
        gltf.scene.traverse(child => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
            }
            const light = child as THREE.Light;
            if (light.isLight) {
                light.castShadow = false;
            }
        });

        this.map = gltf.scene;
        this.rebuildOctree();

        //add hemisphere
        this.addHemisphere();

        this.addFog();

        gltf.scene.traverse(child => {
            const mesh = child as THREE.Mesh;

            if (child.name.startsWith("Enemy")) {
                this.enemySpawnPoints.push(child.position);
            } else if (child.name === "Player") {
                this.playerSpawnPoint.copy(child.position);
            }

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

        this.scene.add(gltf.scene);

        //add clouds
        // const cloud = new Cloud();
        // cloud.position.set(0, 1, 0);
        // this.scene.add(cloud);
        // this.animatedObjects.push(cloud);
       
        const helper = new OctreeHelper(this.worldOctree);
        helper.visible = false;
        this.scene.add(helper);
        this.helper = helper;

        return this.scene;
    }

    allLightsOff() {
        if (!this.scene) return;

        this.scene.traverse(child => {
            if ((child as THREE.Light).isLight) {
                child.visible = false;
            }
        });
    }

    allLightsOn() {
        if (!this.scene) return;

        this.scene.traverse(child => {
            if ((child as THREE.Light).isLight) {
                child.visible = true;
            }
        });
    }

    addFog() {
        if (!this.scene) return;

        this.scene.fog = new THREE.Fog(0x000000, 10, 35);
    }

    async addHemisphere() {
        if (!this.scene) return;

        //check if scene has hemisphere
        let hemisphere = this.scene.getObjectByName("Hemisphere");
        if (hemisphere) return;

        const textureLoader = new THREE.TextureLoader();
        const texture = await textureLoader.loadAsync('./textures/night-sky.jpg');
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        texture.anisotropy = 4;

        const hemisphereGeometry = new THREE.SphereGeometry(1000, 32, 32);
        const hemisphereMaterial = new THREE.MeshBasicMaterial({
            map: texture, 
            side: THREE.BackSide,
            fog: false
        });

        hemisphere = new THREE.Mesh(hemisphereGeometry, hemisphereMaterial);
        hemisphere.name = "Hemisphere";
        hemisphere.position.set(0, 0, 0);
        this.scene.add(hemisphere);
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            if (this.timerSeconds <= 0) {
                this.timerSeconds = 0;
                this.stopTimer();
                this.dispatchEvent({type: "timerExpired"} as WorldTimerExpiredEvent);
            } else {
                this.dispatchEvent({type: "timerTick"} as WorldTimerTickEvent);
            }
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.timerInterval);
    }

    update(deltaTime: number, camera: THREE.Camera) {
        this.animatedObjects.forEach(object => {
            if (object instanceof Cloud) {
                object.update(camera);
            }
        });

    }

    rebuildOctree() {
        if (this.map) {
            this.worldOctree.clear().fromGraphNode(this.map);
        }
    }
}
World.initialize();