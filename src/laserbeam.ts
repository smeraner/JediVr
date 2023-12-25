import * as THREE from 'three';
import { Player } from './player';
import { World } from './world';

interface LaserBeamEventMap extends THREE.Object3DEventMap {
    expired: LaserBeamExpiredEvent;
}

export interface LaserBeamExpiredEvent extends THREE.Event {
    type: 'expired';
}

export class LaserBeam extends THREE.Object3D<LaserBeamEventMap> {

    color = 0xff0000;
    thickness = 0.01;
    length = 1;
    maxDistance = 35;
    distance = 0;
    speed = 10;
    scene: THREE.Scene;
    direction = new THREE.Vector3();
    raycaster: THREE.Raycaster;
    worldDirection = new THREE.Vector3();

    /**
     * 
     * @param {THREE.Scene} scene 
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     */
    constructor(scene: THREE.Scene, audioListenerPromise: Promise<THREE.AudioListener>) {
        super();

        this.scene = scene;

        const laserGeometry = new THREE.CylinderGeometry(this.thickness, this.thickness, this.length, 8);
        const laserMaterial = new THREE.MeshBasicMaterial({ color: this.color });
        const laserMesh = new THREE.Mesh(laserGeometry, laserMaterial);

        laserMesh.rotation.x = Math.PI / 2;
        laserMesh.position.z = this.length / 2;

        this.raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 1);

        this.add(laserMesh);
    }

  
    /**
     * Shoots a laser beam from the given origin in the given direction.
     * @param {THREE.Scene} scene
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     * @param {THREE.Vector3} origin 
     * @param {THREE.Vector3} direction
     * @returns {LaserBeam}
     */
    static shoot(scene: THREE.Scene, audioListenerPromise: Promise<THREE.AudioListener>, origin: THREE.Vector3, direction: THREE.Vector3) {
        const laser = new LaserBeam(scene,audioListenerPromise);
        laser.position.copy(origin);
        laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        laser.worldDirection = laser.getWorldDirection(laser.direction);
        
        scene.add(laser);
        return laser;
    }

    expire() {
        this.dispatchEvent({ type: "expired" } as LaserBeamExpiredEvent);
        this.scene.remove(this);
    }

    update(deltaTime: number, world: World, player: Player) {
        this.distance += this.speed * deltaTime;

        //move in direction

        this.position.addScaledVector(this.worldDirection, this.speed * deltaTime);

        //check collision
        if (this.distance > this.maxDistance) {
            this.expire();
        } else {
            this.raycaster.ray.origin.copy(this.position);
            this.raycaster.ray.direction.copy(this.worldDirection);
            const colliders: Array<THREE.Object3D>  = [player.saber.colliderMesh, player.colliderMesh];
            if(world.map) colliders.push(world.map);

            const result = this.raycaster.intersectObjects(colliders);
            if (result.length > 0) {
                if(result[0].object.userData.obj instanceof Player) {
                    player.damage(1);
                }
                this.expire();
            }

        }
    }
}