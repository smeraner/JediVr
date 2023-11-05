import * as THREE from './three/three.module.js';

export class Saber extends THREE.Object3D {
    constructor(bloom_scene, vertexShader, fragmentShader) {
        super();

        const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8, 1, false);
        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 'grey',
            flatShading: false,
        });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        this.handle = handle;

        const blade = new THREE.Object3D();
        blade.visible = false;
        const bladeGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8, 1, false);
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 'white',
            emissive: 'white',
            emissiveIntensity: 0.5,
            flatShading: false,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
        bladeMesh.layers.toggle(bloom_scene);
        bladeMesh.position.set(0, 0.8, 0);
        blade.add(bladeMesh);
        
        // create custom material from the shader code above
	    //   that is within specially labeled script tags
	    var customMaterial = new THREE.ShaderMaterial( 
        {
            uniforms: 
            { 
                "c":   { type: "f", value: 1.0 },
                "p":   { type: "f", value: 1.4 },
                glowColor: { type: "c", value: new THREE.Color(0xffffff) },
                //viewVector: { type: "v3", value: camera.position }
            },
            vertexShader:  vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
            
        const bladeGlow = new THREE.Mesh( bladeGeometry.clone(), customMaterial.clone() );
        bladeGlow.position.set(0, 0.8, 0);
        bladeGlow.scale.z = 1.5;
        bladeGlow.scale.x = 1.5;
        blade.add(bladeGlow);
        this.blade = blade;

        this.add(handle);
        this.add(blade);
        this.rotation.x = -Math.PI / 4;

        //load audio     
        const audioLoader = new THREE.AudioLoader();
        this.soundBufferHumming = audioLoader.loadAsync( './sounds/saber-humming.ogg');
    }

    async initAudio(audioListener) {
        const buffer = await this.soundBufferHumming;
        const sound = new THREE.PositionalAudio(audioListener);
        sound.setBuffer( buffer );
        sound.setRefDistance( 0.5 );
        sound.setLoop(true);
        this.blade.add(sound);
        this.sound = sound;
    }

    on() {
        this.blade.visible = true;
        if(this.sound) this.sound.play();
    }

    off() {
        this.blade.visible = false;
        if(this.sound) this.sound.stop();
    }

    toggle() {
        this.blade.visible = !this.blade.visible;
        if (this.blade.visible && this.sound) {
            this.sound.play();
        } else {
            this.sound.stop();
        }
    }

}