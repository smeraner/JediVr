import * as THREE from './three/three.module.js';

export class Saber extends THREE.Object3D {
    constructor(bloom_scene, listener) {
        super();

        const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8, 1, false);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 'grey',
            flatShading: false,
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        this.handle = handle;

        const bladeGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8, 1, false);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 'white',
            emissive: 'white',
            emissiveIntensity: 0.5,
            flatShading: false,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.layers.toggle(bloom_scene);
        blade.position.set(0, 0.8, 0);
        blade.visible = false;
        this.blade = blade;

        this.add(handle);
        this.add(blade);
        this.rotation.x = -Math.PI / 4;

        //load audio
        const audioLoader = new THREE.AudioLoader();
        const sound = new THREE.PositionalAudio(listener);
        audioLoader.load( './sounds/saber-humming.ogg', function( buffer ) {
            sound.setBuffer( buffer );
            sound.setRefDistance( 0.5 );
            sound.setLoop(true);
            sound.autoplay = false;
        });
        blade.add(sound);
        this.sound = sound;

    }

    on() {
        this.blade.visible = true;
        this.sound.play();
    }

    off() {
        this.blade.visible = false;
        this.sound.stop();
    }

    toggle() {
        this.blade.visible = !this.blade.visible;
        if (this.blade.visible) {
            this.sound.play();
        } else {
            this.sound.stop();
        }
    }

}