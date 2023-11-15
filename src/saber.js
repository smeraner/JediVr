import * as THREE from './three/three.module.js';
import { Actor } from './actor.js';

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

        this.saberColor = saberColor;

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
            roughness: 1,
            metalness: 0,
        });
        const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
        bladeMesh.position.set(0, 0.8, 0);
        blade.add(bladeMesh);

        const bladeGlowGeometry = new THREE.CylinderGeometry(0.027, 0.027, 1.3, 8, 1, false);
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
        bladeGlowMesh.position.set(0, 0.8, 0);
        blade.add(bladeGlowMesh);

        const bladeGlowGeometry2 = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8, 1, false);
        const bladeGlowMesh2 = new THREE.Mesh(bladeGlowGeometry2, bladeGlowMaterial);
        bladeGlowMesh2.position.set(0, 0.8, 0);
        blade.add(bladeGlowMesh2);

        const light = new THREE.PointLight(saberColor, 1, 100 );
        light.position.set(0, 0.8, 0);
        this.light = light;
        blade.add(light);

        const point = new THREE.Object3D();
        point.position.set(0, 1.3, 0);
        this.spike = point;
        blade.add(point);

        let raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0, 1, 0), 0, 1.3);
        this.raycaster = raycaster;

        this.blade = blade;

        this.add(handle);
        this.add(blade);
        this.rotation.x = -Math.PI / 4;

        if (Saber.debug) {
            const box3 = new THREE.Box3().setFromObject(this.blade);
            const box = new THREE.Box3Helper(box3, 0xffff00);
            this.add(box);
        }

        // const material = new THREE.LineBasicMaterial({
        //     color: 0xff0000,
        //     fog: false
        // });
        // const points = [];
        // points.push( this.raycaster.ray.origin );
        // points.push( this.raycaster.ray.direction );
        
        // const geometry = new THREE.BufferGeometry().setFromPoints( points );
        
        // const line = new THREE.Line( geometry, material );
        // this.line = line;
        // app.scene.add( line );
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
        if(this.animation !== Saber.ANIMATIONS.NO) return;

        this.animation = Saber.ANIMATIONS.SWING;
        if (this.soundSwing && this.blade.visible===true) this.soundSwing.play();
    }

    animate(deltaTime, world, enemys) {
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
                this.soundSwing.stop();
            }
        }
        this.collide(world,enemys);
    }

    collide(world, enemys) {
        //if(!this.blade.visible) return;
        /*
        //get world position of handle
        let v1 = new THREE.Vector3(0,0,0);
        this.handle.getWorldPosition(v1);

        //get world position of blade
        let v2 = new THREE.Vector3(0,0,0);
        this.spike.getWorldPosition(v2);

        //calculate direction from handle to blade
        v2.sub(v1);

        //set raycaster to handle position and direction to blade position
        this.raycaster.set(v1, v2.normalize());
        let intersectioned = this.raycaster.intersectObjects([...enemys, world])
        if(intersectioned.length){
            console.log(intersectioned)
        }
        this.drawRaycastLine(this.raycaster);*/

         if(this.blade.visible){
            const box3 = new THREE.Box3().setFromObject(this.blade)

            const collisions = [...enemys, world].map((obj) => {
                const box3Obj = new THREE.Box3().setFromObject(obj)

                return {
                    obj: obj,
                    intersection: box3.intersectsBox(box3Obj)?box3.intersect(box3Obj):null,
                }
            }).filter((inter) => {
                return inter.intersection;
            });

            if(collisions.length>0){
                //console.log(collisions)
                this.setSaberColor(0x00ff00);
                const actorCollisions = collisions.filter((inter) => {
                    return inter.obj instanceof Actor;
                });
                if(actorCollisions){
                    actorCollisions.forEach(inter => {
                        const vector = inter.intersection.max;
                        //translate to local space
                        this.worldToLocal(vector);
                        this.collisionEffect(vector);
                        //inter.obj.damage(1);
                    });
                }
            } else {
                this.setSaberColor(0xff0000);
                this.collisionEffect();
            }
            //const box = new THREE.Box3Helper(box3, 0xffff00);

        }
    }

    collisionEffect(vector) {
        if(vector) {
            this.light.position.copy(vector);
        } else {
            this.light.position.set(0, 0.8, 0);
        }
    }

    drawRaycastLine(raycaster) {

        this.line.geometry.dispose();
        const points = [];
        points.push( raycaster.ray.origin );
        points.push( raycaster.ray.origin.clone().add( raycaster.ray.direction ) );

        const geometry = new THREE.BufferGeometry().setFromPoints( points );
        this.line.geometry = geometry;

      }

}