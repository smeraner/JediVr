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
            emissiveIntensity: 1,
            flatShading: false,
        });
        const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
        //bladeMesh.layers.toggle(bloom_scene);
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
                glowColor: { type: "c", value: new THREE.Color(0xffff00) },
                viewVector: { type: "v3", value: new THREE.Vector3(0,0,0) }
            },
            vertexShader:  vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            //transparent: true,
        });

            
        const bladeGlow = new THREE.Mesh( bladeGeometry, customMaterial );
        bladeGlow.position.set(0, 0.8, 0);
        bladeGlow.scale.x = bladeGlow.scale.z = 1.9;
        blade.add(bladeGlow);
        this.blade = blade;

        //gui debug
        const gui = app.gui;
        const parameters = 
        { c: 1.0, p: 1.4, bs: false, fs: true, nb: false, ab: true, mv: true, color: "#ffff00" };
        
        var top = gui.addFolder('Glow Shader Attributes');
        
        var cGUI = top.add( parameters, 'c' ).min(0.0).max(1.0).step(0.01).name("c").listen();
        cGUI.onChange( function(value) { 
            bladeGlow.material.uniforms[ "c" ].value = parameters.c; 
        });
        
        var pGUI = top.add( parameters, 'p' ).min(0.0).max(6.0).step(0.01).name("p").listen();
        pGUI.onChange( function(value) { 
            bladeGlow.material.uniforms[ "p" ].value = parameters.p; 
        });
    
        var glowColor = top.addColor( parameters, 'color' ).name('Glow Color').listen();
        glowColor.onChange( function(value) {
            bladeGlow.material.uniforms.glowColor.value.setHex( value.replace("#", "0x"));   
        });
        top.open();
        
        // toggle front side / back side 
        var folder1 = gui.addFolder('Render side');
        var fsGUI = folder1.add( parameters, 'fs' ).name("THREE.FrontSide").listen();
        fsGUI.onChange( function(value) { 
            if (value) 
            {
                bsGUI.setValue(false);
                bladeGlow.material.side = THREE.FrontSide;   
            }
        });
        var bsGUI = folder1.add( parameters, 'bs' ).name("THREE.BackSide").listen();
        bsGUI.onChange( function(value) { 
            if (value)
            {
                fsGUI.setValue(false);
                bladeGlow.material.side = THREE.BackSide;  
            }
        });
        folder1.open();
        
        // toggle normal blending / additive blending
        var folder2 = gui.addFolder('Blending style');
        var nbGUI = folder2.add( parameters, 'nb' ).name("THREE.NormalBlending").listen();
        nbGUI.onChange( function(value) { 
            if (value) 
            {
                abGUI.setValue(false);
                bladeGlow.material.blending = THREE.NormalBlending;  
            }
        });
        var abGUI = folder2.add( parameters, 'ab' ).name("THREE.AdditiveBlending").listen();
        abGUI.onChange( function(value) { 
            if (value)
            {
                nbGUI.setValue(false);
                bladeGlow.material.blending = THREE.AdditiveBlending; 
            }
        });
        folder2.open();
    


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
        sound.setRefDistance( 0.2 );
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
        if (!this.sound) return;
        if (this.blade.visible) {
            this.sound.play();
        } else {
            this.sound.stop();
        }
    }

}