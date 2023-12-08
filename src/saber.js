import * as THREE from 'three';
import { Actor } from './actor.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Saber extends THREE.Object3D {

    static debug = false;
    static soundBufferHumming = null;
    static soundBufferInit = null;
    static soundBufferSwing = null;
    static #staticConstructorDummyResult = (function () {
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
            gltf.scene.rotation.set(-Math.PI / 2, 0 , 0);
            gltf.scene.position.set(0,0.005,0.02);
            return gltf;
        });
    })()

    static ANIMATIONS = {
        NO: 0,
        SWING: 1,
        SWING_BACK: 2,
    }
    static handleHeight = 0.2;
    static bladeHeight = 1.2;
    static bladeScaleInitial = 0.01;

    animation = Saber.ANIMATIONS.NO;

    /**
     * @param {THREE.Scene} scene
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     * @param {String} saberColor white, red or limegreen
     */
    constructor(scene, audioListenerPromise, saberColor = 0xff0000) {
        super();

        this.scene = scene;
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
        //hack to make sure material geometry is loaded, visibility managed by GPU
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

        //handle peak: saber blade starts here
        const handlePeak = new THREE.Object3D();
        handlePeak.position.set(0, Saber.handleHeight, 0);
        this.handlePeak = handlePeak;
        handle.add(handlePeak);

        //blade peak: saber blade ends here
        const bladePeak = new THREE.Object3D();
        bladePeak.position.set(0, Saber.handleHeight + Saber.bladeHeight, 0);
        this.bladePeak = bladePeak;
        blade.add(bladePeak);

        const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, Saber.bladeHeight);
        this.raycaster = raycaster;

        this.add(handle);
        this.add(blade);
        this.rotation.x = -Math.PI / 4;

        // this.bounds = new THREE.Box3().setFromObject(this.blade);
        // this.boundsHelper = new THREE.Box3Helper(this.bounds, 0xffff00);
        // this.boundsHelper.visible = Saber.debug;
        // this.scene.add(this.boundsHelper);

    }

    setSaberColor(saberColor) {
        this.saberColor = saberColor;
        this.blade.children[0].material.color.set(saberColor);
        this.blade.children[0].material.emissive.set(saberColor);
        this.blade.children[1].material.color.set(saberColor);
        this.blade.children[1].material.emissive.set(saberColor);
        this.blade.children[3].color.set(saberColor);
    }

    async initAudio(audioListenerPromise) {
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

    setInitialRotation(x, y, z) {
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

    animate(deltaTime, world, enemys) {
        if (this.isOn()) {
            this.blade.rotation.y += deltaTime * 0.5;
        }

        const maxSpeed = 30;
        if (this.animation == Saber.ANIMATIONS.SWING) {
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
                this.soundSwing.stop();
            }
        }
        this.collide(world, enemys);
        //this.boundsHelper.visible = Saber.debug;
    }

    /**
     * @param {World} world
     * @param {Array<Actor>} enemys
     */
    collide(world, enemys) {
        //this.bounds.setFromObject(this.blade, true);

        if (this.isOn()) {

            const colliders = enemys.map((enemy) => enemy.colliderMesh);
            colliders.push(world.map);

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
                // const collisions = enemys.map((obj) => {
                //     const box3Obj = new THREE.Box3().setFromObject(obj)
                //     let intersection = null;
                //     const intersectBox = this.bounds.intersectsBox(box3Obj);
                //     if(intersectBox){
                //         console.log("intersectBox");
                //         // intersection = {
                //         //     point: this.blade.getWorldPosition(new THREE.Vector3()),
                //         // }
                //         // //intersection = this.bounds.intersect(box3Obj);
                //         const rayOrigin = this.handle.getWorldPosition(new THREE.Vector3());
                //         const rayDirection = this.bladePeak.getWorldPosition(new THREE.Vector3()).sub(rayOrigin).normalize();
                //         this.raycaster.set(rayOrigin, rayDirection);
                //         const rayIntersections = this.raycaster.intersectObject(obj,true);
                //         if(rayIntersections.length){
                //             //console.log(rayIntersections)
                //             intersection = rayIntersections[0];
                //         }
                //     }

                //     return {
                //         obj: obj,
                //         intersection: intersection,
                //     }
                // })
                .filter((col) => col.intersection);

            if (collisions.length > 0) {
                //console.log(collisions)
                //this.setSaberColor(0x00ff00);
                collisions.forEach(col => {
                    const point = col.intersection.point;
                    const distance = col.intersection.distance;
                    //translate to local space
                    this.collisionEffect(point, distance);
                    if(col.obj && col.obj.damage) //col.obj instanceof Actor
                        col.obj.damage(5);
                });
            } else {
                //this.setSaberColor(0xff0000);
                this.collisionEffect();
            }
            //const box = new THREE.Box3Helper(box3, 0xffff00);

        }
    }

    collisionEffect(point, distance) {
        if (point) {
            this.lensPlane.visible = true;
            this.lensPlane.position.copy(point);
            this.lensPlane.quaternion.copy(app.camera.quaternion);

            // //global position to local position
            // let localPoint = this.blade.worldToLocal(point);
            // //substract vector from local point
            // localPoint = localPoint.sub(this.bladePeak.position).normalize().multiplyScalar(0.1);
            this.light.position.y = distance - Saber.bladeHeight * 0.5 - 0.5;

        } else {
            this.lensPlane.visible = false;
            this.light.position.y = 0;
        }
    }

}