import * as THREE from './three/three.module.js';

export class Saber extends THREE.Object3D {

    static soundBufferHumming = null;
    static soundBufferInit = null;
    static soundBufferSwing = null;
    static #staticConstructorDummyResult = (function () {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        Saber.soundBufferHumming = audioLoader.loadAsync('./sounds/saber-humming.ogg');
        Saber.soundBufferInit = audioLoader.loadAsync('./sounds/saber-init.ogg');
        Saber.soundBufferSwing = audioLoader.loadAsync('./sounds/saber-swing.ogg');
    })()

    static ANIMATIONS = {
        NO: 0,
        SWING: 1,
        SWING_BACK: 2,
    }

    animation = Saber.ANIMATIONS.NO;

    /**
     * @param {THREE.Scene} bloom_scene
     * @param {String} saberColor white, red or limegreen
     */
    constructor(bloom_scene, saberColor = 0xff0000) {
        super();

        const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8, 1, false);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 'grey',
            metalness: 0.5,
            roughness: 0.5,
            flatShading: false,
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        this.handle = handle;

        const blade = new THREE.Object3D();
        blade.visible = false;
        const bladeGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8, 1, false);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: saberColor,
            emissive: saberColor,
            emissiveIntensity: 1,
            flatShading: false,
            side: THREE.DoubleSide,
        });
        const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
        bladeMesh.position.set(0, 0.8, 0);
        blade.add(bladeMesh);

        const bladeGlowGeometry = new THREE.CylinderGeometry(0.027, 0.027, 1.3, 8, 1, false);
        const bladeGlowMaterial = new THREE.MeshBasicMaterial({
            color: saberColor,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
        });
        const bladeGlowMesh = new THREE.Mesh(bladeGlowGeometry, bladeGlowMaterial);
        bladeGlowMesh.position.set(0, 0.8, 0);
        blade.add(bladeGlowMesh);

        const bladeGlowGeometry2 = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8, 1, false);
        const bladeGlowMesh2 = new THREE.Mesh(bladeGlowGeometry2, bladeGlowMaterial);
        bladeGlowMesh2.position.set(0, 0.8, 0);
        blade.add(bladeGlowMesh2);

        const light = new THREE.PointLight(saberColor, 1, 100);
        light.position.set(0, 0.8, 0);
        blade.add(light);

        this.blade = blade;

        this.add(handle);
        this.add(blade);
        this.rotation.x = -Math.PI / 4;
    }

    async initAudio(audioListener) {
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
        this.blade.visible = true;
        if (this.soundInit) this.soundInit.play();
        if (this.soundHumming) this.soundHumming.play();
    }

    off() {
        this.blade.visible = false;
        if (this.soundHumming) this.soundHumming.stop();
        if (this.soundInit) this.soundInit.stop();
    }

    toggle() {
        this.blade.visible = !this.blade.visible;
        if (this.blade.visible) {
            if (this.soundInit) this.soundInit.play();
            if (this.soundHumming) this.soundHumming.play();
        } else {
            if (this.soundHumming) this.soundHumming.stop();
            if (this.soundInit) this.soundInit.stop();
        }
    }

    setInitialRotation(x, y, z) {
        this.initalRotationX = x;
        this.initalRotationY = y;
        this.initalRotationZ = z;
        this.rotation.set(x, y, z);
    }

    swing() {
        this.animation = Saber.ANIMATIONS.SWING;
        if (this.soundSwing && this.blade.visible===true) this.soundSwing.play();
    }

    animate(deltaTime) {
        if (this.blade.visible) {
            this.blade.rotation.y += deltaTime * 0.5;
        }

        const maxSpeed = 20;
        if(this.animation == Saber.ANIMATIONS.SWING) {
            //swing animation with start and end, end same position as start
            //calculate speed based on z rotation, start fast, end slow
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
            }
        }

    }

}