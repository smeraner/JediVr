import * as THREE from 'three';
import { Player } from './player';
import { World } from './world';

interface LaserBeamEventMap extends THREE.Object3DEventMap  {
    expired: LaserBeamExpiredEvent;
}

export interface LaserBeamExpiredEvent extends THREE.Event {
    type: 'expired';
}

export class LaserBeam extends THREE.Object3D<LaserBeamEventMap> {

    color = 0x00ff00;
    thickness = 0.01;
    length = 1;
    maxDistance = 35;
    distance = 0;
    speed = 10;
    scene: THREE.Scene;
    direction = new THREE.Vector3();

/**
 * 
 * @param {THREE.Scene} scene 
 */
    constructor(scene: THREE.Scene) {
        super();

        this.scene = scene;
        
        const laserGeometry = new THREE.CylinderGeometry(this.thickness, this.thickness, this.length, 8);
        const laserMaterial = new THREE.MeshBasicMaterial({ color: this.color });
        const laserMesh = new THREE.Mesh(laserGeometry, laserMaterial);

        laserMesh.rotation.x = Math.PI / 2;
        laserMesh.position.z = this.length / 2;

        this.add(laserMesh);
    }

    /**
     * 
     * @param {THREE.Scene} scene
     * @param {THREE.Vector3} origin 
     * @param {THREE.Vector3} direction
     * @returns {LaserBeam}
     */
    static shoot(scene: THREE.Scene, origin: THREE.Vector3, direction: THREE.Vector3) {
        const laser = new LaserBeam(scene);
        laser.position.copy(origin);
        laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        //laser.lookAt(direction);

        scene.add(laser);
        return laser;
    }

    update(deltaTime: number, world: World, player: Player) {
        this.distance += this.speed * deltaTime;

        //move in direction
        this.position.addScaledVector(this.getWorldDirection(this.direction), this.speed * deltaTime);

        if(this.distance > this.maxDistance) {
            this.dispatchEvent({type: "expired"} as LaserBeamExpiredEvent);
            this.scene.remove(this);
        }
    }
}
