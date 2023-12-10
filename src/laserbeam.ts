import * as THREE from 'three';

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

/**
 * 
 * @param {THREE.Scene} scene 
 */
    constructor(scene: THREE.Scene) {
        super();

        this.scene = scene;
        
        const laserGeometry = new THREE.CylinderGeometry(this.thickness, this.thickness, this.length, 8);
        const laserMaterial = new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 1, metalness: 0, roughness: 1 });
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
        laser.lookAt(direction);

        scene.add(laser);
        return laser;
    }

    animate(deltaTime: number) {
        this.distance += this.speed * deltaTime;

        //move in direction
        this.position.addScaledVector(this.getWorldDirection(new THREE.Vector3()), this.speed * deltaTime);

        if(this.distance > this.maxDistance) {
            this.dispatchEvent({type: "expired"} as LaserBeamExpiredEvent);
            this.scene.remove(this);
        }
    }
}
