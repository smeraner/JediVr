import * as THREE from 'three';
import { Actor } from './actor';
import { World } from './world';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface SaberEventMap extends THREE.Object3DEventMap  {
    collision: SaberCollisionEvent;
}

interface SaberCollisionEvent extends THREE.Event {
    type: 'collision';
    collisions: Array<{
        obj: Actor | THREE.Mesh,
        intersection: THREE.Intersection
    }>;
}

export class Saber extends THREE.Object3D<SaberEventMap> {

    static debug = false;

    static initialize() {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        Saber.soundBufferHumming = audioLoader.loadAsync('./sounds/saber-humming.ogg');
        Saber.soundBufferInit = audioLoader.loadAsync('./sounds/saber-init.ogg');
        Saber.soundBufferSwing = audioLoader.loadAsync('./sounds/saber-swing.ogg');

        const textureLoader = new THREE.TextureLoader();
        Saber.textureFlare0 = textureLoader.loadAsync('./textures/lensflare0.png');

        //load model     
        const gltfLoader = new GLTFLoader();
        Saber.model = gltfLoader.loadAsync('./models/saber.glb').then(gltf => {
            gltf.scene.scale.set(0.007, 0.007, 0.007);
            gltf.scene.rotation.set(-Math.PI / 2, 0, 0);
            return gltf;
        });
    }

    static model: Promise<any>;
    static textureFlare0: Promise<THREE.Texture>;
    static soundBufferHumming: Promise<AudioBuffer>;
    static soundBufferInit: Promise<AudioBuffer>;
    static soundBufferSwing: Promise<AudioBuffer>;

    static ANIMATIONS = {
        NO: 0,
        SWING: 1,
        SWING_BACK: 2,
    }
    static handleHeight = 0.2;
    static bladeHeight = 1.2;
    static bladeScaleInitial = 0.001;

    animation = Saber.ANIMATIONS.NO;

    scene: THREE.Scene;
    saberColor: number;
    handle: THREE.Group;
    blade: THREE.Object3D;
    light: THREE.PointLight;
    lensPlane: THREE.Mesh | undefined;
    handlePeak: THREE.Object3D;
    bladePeak: THREE.Object3D;
    raycaster: THREE.Raycaster;
    soundHumming: THREE.PositionalAudio | undefined;
    soundInit: THREE.PositionalAudio | undefined;
    soundSwing: THREE.PositionalAudio | undefined;
    initalRotationX = 0;
    initalRotationY = 0;
    initalRotationZ = 0;
    camera: THREE.Camera;

    constructor(scene: THREE.Scene, camera: THREE.Camera, audioListenerPromise: Promise<THREE.AudioListener>, saberColor = 0xff0000) {
        super();

        this.scene = scene;
        this.camera = camera;
        this.saberColor = saberColor;

        this.initAudio(audioListenerPromise);

        const handle = new THREE.Group();
        this.handle = handle;
        Saber.model.then(gltf => {
            const model = gltf.scene.clone();
            handle.add(model);
        });

        const blade = new THREE.Object3D();
        blade.position.set(0, Saber.handleHeight * 0.5, 0);

        const bladeGeometry = new THREE.CylinderGeometry(0.013, 0.013, Saber.bladeHeight, 8, 1, false);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: saberColor,
            emissive: saberColor,
            emissiveIntensity: 1,
            flatShading: false,
            side: THREE.DoubleSide,
            roughness: 1,
            metalness: 0,
        });
        const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.add(bladeMesh);

        const bladeGlowGeometry = new THREE.CylinderGeometry(0.02, 0.02, Saber.bladeHeight, 8, 1, false);
        const bladeGlowMaterial = new THREE.MeshStandardMaterial({
            color: saberColor,
            emissive: saberColor,
            emissiveIntensity: 1,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            roughness: 1,
            metalness: 0,
        });
        const bladeGlowMesh = new THREE.Mesh(bladeGlowGeometry, bladeGlowMaterial);
        blade.add(bladeGlowMesh);

        const bladeGlowGeometry2 = new THREE.CylinderGeometry(0.025, 0.025, Saber.bladeHeight, 8, 1, false);
        const bladeGlowMesh2 = new THREE.Mesh(bladeGlowGeometry2, bladeGlowMaterial);
        blade.add(bladeGlowMesh2);

        const light = new THREE.PointLight(saberColor, 0, 100, 3);
        this.light = light;

        blade.add(light);
        this.blade = blade;
        this.blade.scale.setScalar(Saber.bladeScaleInitial);

        Saber.textureFlare0.then(textureFlare0 => {
            const lensPlaneGeometry = new THREE.PlaneGeometry(2, 2);
            const lensMaterial = new THREE.MeshBasicMaterial({
                map: textureFlare0,
                alphaMap: textureFlare0,
                color: 0xffffff,
                transparent: true
            });
            const lensPlane = new THREE.Mesh(lensPlaneGeometry, lensMaterial);
            lensPlane.visible = false;
            this.lensPlane = lensPlane;
            this.scene.add(lensPlane);
        });

        const handlePeak = new THREE.Object3D();
        handlePeak.position.set(0, Saber.handleHeight, 0);
        this.handlePeak = handlePeak;
        handle.add(handlePeak);

        const bladePeak = new THREE.Object3D();
        bladePeak.position.set(0, Saber.handleHeight + Saber.bladeHeight, 0);
        this.bladePeak = bladePeak;
        blade.add(bladePeak);

        const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, Saber.bladeHeight);
        this.raycaster = raycaster;

        this.add(handle);
        this.add(blade);
        this.rotation.x = -Math.PI / 4;
    }

    setSaberColor(saberColor: number) {
        this.saberColor = saberColor;
        this.blade.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.material.color.set(saberColor);
                child.material.emissive.set(saberColor);
            } else if (child instanceof THREE.PointLight) {
                child.color.set(saberColor);
            }
        });
    }

    async initAudio(audioListenerPromise: Promise<THREE.AudioListener>) {
        const audioListener = await audioListenerPromise;
        const bufferHumming = await Saber.soundBufferHumming;
        const soundHumming = new THREE.PositionalAudio(audioListener);
        soundHumming.setBuffer(bufferHumming);
        soundHumming.setRefDistance(0.2);
        soundHumming.setLoop(true);
        soundHumming.setVolume(0.5);
        this.blade.add(soundHumming);
        this.soundHumming = soundHumming;

        const bufferInit = await Saber.soundBufferInit;
        const soundInit = new THREE.PositionalAudio(audioListener);
        soundInit.setBuffer(bufferInit);
        soundInit.setRefDistance(0.2);
        soundInit.setLoop(false);
        this.handle.add(soundInit);
        this.soundInit = soundInit;

        const bufferSwing = await Saber.soundBufferSwing;
        const soundSwing = new THREE.PositionalAudio(audioListener);
        soundSwing.setBuffer(bufferSwing);
        soundSwing.setRefDistance(0.2);
        soundSwing.setLoop(false);
        this.blade.add(soundSwing);
        this.soundSwing = soundSwing;
    }

    on() {
        if (this.soundInit) this.soundInit.play();

        let scale = 0;
        const animateIgnition = () => {
            scale += 0.1;
            this.blade.scale.setScalar(scale);
            this.light.intensity = 2 * scale;

            this.blade.position.y = Saber.handleHeight * 0.5 + Saber.bladeHeight * this.blade.scale.y * 0.5;
            if (this.blade.scale.y < 1) {
                setTimeout(() => { animateIgnition() }, 10);
            } else {
                this.blade.scale.y = 1;
                this.blade.position.y = Saber.handleHeight * 0.5 + Saber.bladeHeight * 0.5;
                if (this.soundHumming) this.soundHumming.play();
            }
        }
        animateIgnition();
    }

    off() {
        this.blade.scale.setScalar(Saber.bladeScaleInitial);
        this.blade.position.set(0, Saber.handleHeight * 0.5, 0);
        this.light.intensity = 0;
        if (this.soundHumming) this.soundHumming.stop();
        if (this.soundInit) this.soundInit.stop();
    }

    isOn() {
        return this.blade.scale.y > Saber.bladeScaleInitial;
    }

    toggle() {
        if (this.isOn()) {
            this.off();
        } else {
            this.on();
        }
    }

    setInitialRotation(x: number, y: number, z: number) {
        this.initalRotationX = x;
        this.initalRotationY = y;
        this.initalRotationZ = z;
        this.rotation.set(x, y, z);
    }

    swing() {
        if (this.animation !== Saber.ANIMATIONS.NO) return;

        this.animation = Saber.ANIMATIONS.SWING;
        if (this.soundSwing && this.isOn()) this.soundSwing.play();
    }

    animate(deltaTime: number, world: World, enemys: Array<Actor>) {
        if (this.isOn()) {
            this.blade.rotation.y += deltaTime * 0.5;
        }

        const maxSpeed = 30;
        if (this.animation == Saber.ANIMATIONS.SWING) {
            const speed = maxSpeed * Math.max(0.5, Math.min(1, this.rotation.z / 2));

            this.rotation.z += deltaTime * speed;
            this.rotation.x -= deltaTime * speed * 0.5;
            if (this.rotation.z >= 1) {
                this.animation = Saber.ANIMATIONS.SWING_BACK;
            }
        } else if (this.animation == Saber.ANIMATIONS.SWING_BACK) {
            const speed = maxSpeed * Math.max(0.1, Math.min(1, this.rotation.z / 2));

            this.rotation.z -= deltaTime * speed;
            this.rotation.x += deltaTime * speed * 0.5;
            if (this.rotation.z <= this.initalRotationZ) {
                this.rotation.z = this.initalRotationZ
                this.rotation.x = this.initalRotationX
                this.animation = Saber.ANIMATIONS.NO;
                if(this.soundSwing) this.soundSwing.stop();
            }
        }
        this.collide(world, enemys);
    }

    collide(world: World, enemys: Array<Actor>) {
        if (this.isOn()) {
            const colliders: Array<THREE.Object3D> = enemys.map((enemy) => enemy.colliderMesh);
            if(world.map) colliders.push(world.map);

            const rayOrigin = this.handle.getWorldPosition(new THREE.Vector3());
            const rayDirection = this.bladePeak.getWorldPosition(new THREE.Vector3()).sub(rayOrigin).normalize();
            this.raycaster.set(rayOrigin, rayDirection);
            const rayIntersections = this.raycaster.intersectObjects(colliders, true);

            const collisions = rayIntersections.map((inters) => {
                let obj = inters.object.userData.obj || inters.object;

                return {
                    obj: obj,
                    intersection: inters
                }
            })
                .filter((col) => col.intersection);

            if (collisions.length > 0) {
                this.dispatchEvent({ type: "collision", collisions: collisions } as SaberCollisionEvent);
                
                collisions.forEach(col => {
                    const point = col.intersection.point;
                    const distance = col.intersection.distance;
                    this.collisionEffect(point, distance);
                    if (col.obj && col.obj.damage)
                        col.obj.damage(5);
                });
            } else {
                this.hideCollisionEffect();
            }
        }
    }

    collisionEffect(point: THREE.Vector3, distance: number) {
        if(this.lensPlane === undefined) return;
        this.lensPlane.visible = true;
        this.lensPlane.position.copy(point);
        this.lensPlane.quaternion.copy(this.camera.quaternion);

        this.light.position.y = distance - Saber.bladeHeight * 0.5 - 0.5;
    }

    hideCollisionEffect() {
        if(this.lensPlane === undefined) return;
        this.lensPlane.visible = false;
        this.light.position.y = 0;
    }
}
Saber.initialize();
