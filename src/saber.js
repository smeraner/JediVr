import * as THREE from './three/three.module.js';
import { Actor } from './actor.js';
import { OBB } from './three/addons/math/OBB.js';

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
    })()

    static ANIMATIONS = {
        NO: 0,
        SWING: 1,
        SWING_BACK: 2,
    }

    animation = Saber.ANIMATIONS.NO;

    /**
     * @param {String} saberColor white, red or limegreen
     */
    constructor(saberColor = 0xff0000) {
        super();

        this.saberColor = saberColor;

        const handleGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8, 1, false);
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
        const bladeGeometry = new THREE.CylinderGeometry(0.013, 0.013, 1.2, 8, 1, false);
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
        bladeMesh.position.set(0, 0.7, 0);
        blade.add(bladeMesh);

        const bladeGlowGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8, 1, false);
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
        bladeGlowMesh.position.set(0, 0.7, 0);
        blade.add(bladeGlowMesh);

        const bladeGlowGeometry2 = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8, 1, false);
        const bladeGlowMesh2 = new THREE.Mesh(bladeGlowGeometry2, bladeGlowMaterial);
        bladeGlowMesh2.position.set(0, 0.7, 0);
        blade.add(bladeGlowMesh2);

        const light = new THREE.PointLight(saberColor, 2, 100, 3);
        light.position.set(0, 0.8, 0);
        this.light = light;
        blade.add(light);
        this.blade = blade;

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
            app.scene.add(lensPlane);
        });

        const bladePeak = new THREE.Object3D();
        bladePeak.position.set(0, 2.1, 0);
        this.bladePeak = bladePeak;
        blade.add(bladePeak);

        const raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 2.1);
        this.raycaster = raycaster;

        this.add(handle);
        this.add(blade);
        this.rotation.x = -Math.PI / 4;

        this.bounds = new THREE.Box3().setFromObject(this.blade);
        this.boundsHelper = new THREE.Box3Helper(this.bounds, 0xffff00);
        this.boundsHelper.visible = Saber.debug;
        app.scene.add(this.boundsHelper);

    }

    setSaberColor(saberColor) {
        this.saberColor = saberColor;
        this.blade.children[0].material.color.set(saberColor);
        this.blade.children[0].material.emissive.set(saberColor);
        this.blade.children[1].material.color.set(saberColor);
        this.blade.children[1].material.emissive.set(saberColor);
        this.blade.children[3].color.set(saberColor);
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
        this.blade.scale.y = 0.01;
        const animateIgnition = () => {
            this.blade.scale.y += 0.1;
            if (this.blade.scale.y < 1) {
                setTimeout(() => { animateIgnition() }, 10);
            } else {
                this.blade.scale.y = 1;
            }
        }
        animateIgnition();
    }

    off() {
        this.blade.visible = false;
        if (this.soundHumming) this.soundHumming.stop();
        if (this.soundInit) this.soundInit.stop();
    }

    toggle() {
        if (this.blade.visible) {
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
        if (this.soundSwing && this.blade.visible === true) this.soundSwing.play();
    }

    animate(deltaTime, world, enemys) {
        if (this.blade.visible) {
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
        this.boundsHelper.visible = Saber.debug;
    }

    collide(world, enemys) {
        //this.bounds.setFromObject(this.blade, true);

        if (this.blade.visible) {

            const enemyColliders = enemys.map((enemy) => enemy.colliderHelper);

            const rayOrigin = this.handle.getWorldPosition(new THREE.Vector3());
            const rayDirection = this.bladePeak.getWorldPosition(new THREE.Vector3()).sub(rayOrigin).normalize();
            this.raycaster.set(rayOrigin, rayDirection);
            const rayIntersections = this.raycaster.intersectObjects(enemyColliders, true);

            const collisions = rayIntersections.map((inters) => {
                let obj = inters.object.userData.obj;

                return {
                    obj: obj,
                    intersection: {
                        point: inters.point,
                    }
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
                .filter((col) => col.intersection && col.obj);

            if (collisions.length > 0) {
                //console.log(collisions)
                //this.setSaberColor(0x00ff00);
                const actorCollisions = collisions.filter((col) => {
                    return col.obj instanceof Actor;
                });
                if (actorCollisions) {
                    actorCollisions.forEach(col => {
                        const point = col.intersection.point;
                        //translate to local space
                        this.collisionEffect(point);
                        col.obj.damage(1);
                    });
                }
            } else {
                //this.setSaberColor(0xff0000);
                this.collisionEffect();
            }
            //const box = new THREE.Box3Helper(box3, 0xffff00);

        }
    }

    collisionEffect(point) {
        if (point) {
            this.lensPlane.visible = true;
            this.lensPlane.position.copy(point);
            this.lensPlane.quaternion.copy(app.camera.quaternion);
        } else {
            this.lensPlane.visible = false;
        }
    }

}