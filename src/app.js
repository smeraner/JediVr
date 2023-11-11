import * as THREE from './three/three.module.js';

import { GUI } from './three/addons/libs/lil-gui.module.min.js';
import { VRButton } from './three/addons/webxr/VRButton.js';
import { createText } from './three/addons/webxr/Text2D.js';

// import {
//     BloomEffect
// } from "./postprocessing/index.min.js";

// import { EffectComposerXR } from "./postprocessing/EffectComposerXR.js";
// import { EffectPassXR } from "./postprocessing/EffectPassXR.js";
// import { RenderPassXR } from "./postprocessing/RenderPassXR.js";

import { Player } from './player.js';
import { World } from './world.js';
import { Saber } from './saber.js';

class App {

    GRAVITY = 9.8 * 3.5;;
    BLOOM_SCENE = 1;

    NUM_SPHERES = 100;
    SPHERE_RADIUS = 0.2;

    STEPS_PER_FRAME = 5;

    materials = {};
    darkMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );

    saber1 = null;
    saber2 = null;
    saber1triggerReleased = true;
    saber2triggerReleased = true;

    sphereGeometry = new THREE.IcosahedronGeometry(this.SPHERE_RADIUS, 5);
    sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xdede8d });

    spheres = [];
    sphereIdx = 0;

    mouseTime = 0;

    keyStates = {};

    vector1 = new THREE.Vector3();
    vector2 = new THREE.Vector3();
    vector3 = new THREE.Vector3();

    constructor() {
        this.clock = new THREE.Clock();
        this.gui = new GUI({ width: 200 });
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));

        // // Create the effect composer.
        // this.composer = new EffectComposerXR(this.renderer, {
        //     //frameBufferType: HalfFloatType
        // });

    }

    async init() {
        await this.initScene();
        // this.composer.addPass(new RenderPassXR(this.scene, this.camera));
        // this.composer.addPass(new EffectPassXR(this.camera, new BloomEffect()));

        this.setupXR();
        await this.initAudio();

        //init audio on first click
        document.addEventListener('mouseup', async () => this.onFirstUserAction(), { once: true });
        window.addEventListener('blur', async () => this.stopAudio(), { once: true });
        this.renderer.xr.addEventListener('sessionstart', async () => this.onFirstUserAction(), { once: true });
        
        window.addEventListener('resize', this.resize.bind(this));
        document.addEventListener('keydown', (event) => {
            this.keyStates[event.code] = true;
        });

        document.addEventListener('keyup', (event) => {
            this.keyStates[event.code] = false;
        });

        this.container.addEventListener('mousedown', () => {
            document.body.requestPointerLock();
            this.mouseTime = performance.now();
        });

        // document.addEventListener('mouseup', () => {
        //     if (document.pointerLockElement !== null) this.throwBall();
        // });

        document.body.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                this.player.rotation.y -= event.movementX / 500;
                this.player.rotation.x -= event.movementY / 500;
            }
        });

        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    /**
     * Executes actions when the user performs their first interaction.
     * Plays audio and adds a light saber to the player's scene.
     */
    async onFirstUserAction() {
        //this.playAudio();

        //debug add light saber to player
        if(!this.renderer.xr.isPresenting) {
            this.saber = new Saber(this.BLOOM_SCENE);
            await this.saber.initAudio(this.listener);
            this.saber.on();
            this.saber.position.set(0, -0.2, -0.6);
            this.saber.setInitialRotation(-Math.PI / 4, 0, -0.7);
            this.player.add(this.saber);

            document.addEventListener('mouseup', async (e) => {
                if(e.button===2)this.saber.toggle();
                if(e.button===0)this.saber.swing();
            });
        }

    }

    /***
     * @returns {Promise}
     */
    async initScene() {

        //init world
        this.world = new World(this.gui);
        this.scene = await this.world.loadScene();

        //init player
        this.player = new Player(this.scene, this.GRAVITY);
        this.camera = this.player.getCamera();

        //init effect postprocessing
        /*
        const bloomLayer = new THREE.Layers();
        bloomLayer.set( this.BLOOM_SCENE );
        this.bloomLayer = bloomLayer;

        const renderScene = new RenderPass( this.scene, this.camera );

        const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
        bloomPass.threshold = 0;
        bloomPass.strength = 0.7;
        bloomPass.radius = 0.05;

        const bloomComposer = new EffectComposer( this.renderer );
        bloomComposer.renderToScreen = false;
        bloomComposer.addPass( renderScene );
        bloomComposer.addPass( bloomPass );
        this.bloomComposer = bloomComposer;

        const mixPass = new ShaderPass(
            new THREE.ShaderMaterial( {
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: bloomComposer.renderTarget2.texture }
                },
                vertexShader: document.getElementById( 'vertexshader' ).textContent,
                fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
                defines: {}
            } ), 'baseTexture'
        );
        mixPass.needsSwap = true;

        const outputPass = new OutputPass();

        const finalComposer = new EffectComposer( this.renderer );
        finalComposer.addPass( renderScene );
        finalComposer.addPass( mixPass );
        finalComposer.addPass( outputPass );
        this.finalComposer = finalComposer;
        */

        //spehere init
        for (let i = 0; i < this.NUM_SPHERES; i++) {
            const sphere = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial);
            sphere.castShadow = true;
            sphere.receiveShadow = true;

            this.scene.add(sphere);

            this.spheres.push({
                mesh: sphere,
                collider: new THREE.Sphere(new THREE.Vector3(0, - 100, 0), this.SPHERE_RADIUS),
                velocity: new THREE.Vector3()
            });
        }

    }

    async initAudio() {
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        this.sound = new THREE.Audio(this.listener);
        const audioLoader = new THREE.AudioLoader();
        const initSound = await audioLoader.loadAsync('sounds/background_song.ogg');
        this.sound.setBuffer(initSound);
        this.sound.setLoop(false);
        this.sound.setVolume(0.03);


        // audioLoader.load('sounds/358232_j_s_song.ogg', function (buffer) {
        //     sound.setBuffer(buffer);
        //     sound.setLoop(true);
        //     sound.setVolume(0.1);
        //     sound.play();
        // }); 
    }

    playAudio() {
        this.sound.play();
    }

    stopAudio() {
        this.sound.stop();
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('connected', (e) => {
            this.controller1.gamepad = e.data.gamepad;
            this.saber1 = new Saber(this.BLOOM_SCENE, this.saberVertexShader, this.saberFragmentShader);
            this.saber1.initAudio(this.listener);
            this.controller1.add( this.saber1 );
        });
        this.controller1.addEventListener('disconnected', (e) => {
            this.controller1.gamepad = null;
            this.controller1.remove( this.controller1.children[0] );
        });

        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('connected', (e) => {
            this.controller2.gamepad = e.data.gamepad;
            this.saber2 = new Saber(this.BLOOM_SCENE, this.saberVertexShader, this.saberFragmentShader);
            this.saber2.initAudio(this.listener);
            this.controller2.add( this.saber2 );
        });
        this.controller2.addEventListener('disconnected', (e) => {
            this.controller2.gamepad = null;
            this.controller2.remove( this.controller2.children[0] );
        });

        // const controllerModelFactory = new XRControllerModelFactory();
        // this.controllerGrip1 = this.renderer.xr.getControllerGrip( 0 );
        // this.controllerGrip1.add( controllerModelFactory.createControllerModel( this.controllerGrip1 ) );
        // this.controllerGrip2 = this.renderer.xr.getControllerGrip( 1 );
        // this.controllerGrip2.add( controllerModelFactory.createControllerModel( this.controllerGrip2 ) );

        this.instructionText = createText( '', 0.04 );
		this.instructionText.position.set( 0, 1.6, - 0.6 );
        this.player.add(this.instructionText);

        this.player.add(this.controller1);
        this.player.add(this.controller2);
        // this.player.add(this.controllerGrip1);
        // this.player.add(this.controllerGrip2);
    }


    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    throwBall() {

        const sphere = this.spheres[this.sphereIdx];

        this.camera.getWorldDirection(this.player.playerDirection);

        sphere.collider.center.copy(this.player.playerCollider.end).addScaledVector(this.player.playerDirection, this.player.playerCollider.radius * 1.5);

        // throw the ball with more force if we hold the button longer, and if we move forward

        const impulse = 15 + 30 * (1 - Math.exp((this.mouseTime - performance.now()) * 0.001));

        sphere.velocity.copy(this.player.playerDirection).multiplyScalar(impulse);
        sphere.velocity.addScaledVector(this.player.playerVelocity, 2);

        this.sphereIdx = (this.sphereIdx + 1) % this.spheres.length;

    }


    /***
     * @param {THREE.Sphere} sphere
     */
    playerSphereCollision(sphere) {

        const center = this.vector1.addVectors(this.player.playerCollider.start, this.player.playerCollider.end).multiplyScalar(0.5);

        const sphere_center = sphere.collider.center;

        const r = this.player.playerCollider.radius + sphere.collider.radius;
        const r2 = r * r;

        // approximation: player = 3 spheres

        for (const point of [this.player.playerCollider.start, this.player.playerCollider.end, center]) {

            const d2 = point.distanceToSquared(sphere_center);

            if (d2 < r2) {

                const normal = this.vector1.subVectors(point, sphere_center).normalize();
                const v1 = this.vector2.copy(normal).multiplyScalar(normal.dot(this.player.playerVelocity));
                const v2 = this.vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

                this.player.playerVelocity.add(v2).sub(v1);
                sphere.velocity.add(v1).sub(v2);

                const d = (r - Math.sqrt(d2)) / 2;
                sphere_center.addScaledVector(normal, - d);

            }

        }

    }

    spheresCollisions() {

        for (let i = 0, length = this.spheres.length; i < length; i++) {

            const s1 = this.spheres[i];

            for (let j = i + 1; j < length; j++) {

                const s2 = this.spheres[j];

                const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
                const r = s1.collider.radius + s2.collider.radius;
                const r2 = r * r;

                if (d2 < r2) {

                    const normal = this.vector1.subVectors(s1.collider.center, s2.collider.center).normalize();
                    const v1 = this.vector2.copy(normal).multiplyScalar(normal.dot(s1.velocity));
                    const v2 = this.vector3.copy(normal).multiplyScalar(normal.dot(s2.velocity));

                    s1.velocity.add(v2).sub(v1);
                    s2.velocity.add(v1).sub(v2);

                    const d = (r - Math.sqrt(d2)) / 2;

                    s1.collider.center.addScaledVector(normal, d);
                    s2.collider.center.addScaledVector(normal, - d);

                }

            }

        }

    }

    updateSpheres(deltaTime) {

        this.spheres.forEach(sphere => {

            sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);

            const result = this.world.worldOctree.sphereIntersect(sphere.collider);

            if (result) {

                sphere.velocity.addScaledVector(result.normal, - result.normal.dot(sphere.velocity) * 1.5);
                sphere.collider.center.add(result.normal.multiplyScalar(result.depth));

            } else {

                sphere.velocity.y -= this.GRAVITY * deltaTime;

            }

            const damping = Math.exp(- 1.5 * deltaTime) - 1;
            sphere.velocity.addScaledVector(sphere.velocity, damping);

            this.playerSphereCollision(sphere);

        });

        this.spheresCollisions();

        for (const sphere of this.spheres) {

            sphere.mesh.position.copy(sphere.collider.center);

        }

    }

    getForwardVector() {

        this.camera.getWorldDirection(this.player.playerDirection);
        this.player.playerDirection.y = 0;
        this.player.playerDirection.normalize();

        return this.player.playerDirection;

    }

    getSideVector() {

        this.camera.getWorldDirection(this.player.playerDirection);
        this.player.playerDirection.y = 0;
        this.player.playerDirection.normalize();
        this.player.playerDirection.cross(this.camera.up);

        return this.player.playerDirection;

    }

    controls(deltaTime) {

        // gives a bit of air control
        const speedDelta = deltaTime * (this.player.playerOnFloor ? 25 : 8);

        if (this.keyStates['KeyW']) {
            this.player.playerVelocity.add(this.getForwardVector().multiplyScalar(speedDelta));
        }

        if (this.keyStates['KeyS']) {
            this.player.playerVelocity.add(this.getForwardVector().multiplyScalar(- speedDelta));
        }

        if (this.keyStates['KeyA']) {
            this.player.playerVelocity.add(this.getSideVector().multiplyScalar(- speedDelta));
        }

        if (this.keyStates['KeyD']) {
            this.player.playerVelocity.add(this.getSideVector().multiplyScalar(speedDelta));
        }

        if (this.player.playerOnFloor) {
            if (this.keyStates['Space']) {
                this.player.playerVelocity.y = 15;
            }
        }

        if (this.controller1.gamepad && this.controller1.gamepad.axes.length > 0) {
            //throw ball
            // if (this.controller.gamepad1.buttons[0].pressed) {
            //     this.throwBall();
            // }

            if(this.controller1.gamepad.buttons[0].pressed && this.saber1triggerReleased) {
                this.saber1.toggle();
                this.saber1triggerReleased = false;
            } else if(!this.controller1.gamepad.buttons[0].pressed) {
                this.saber1triggerReleased = true;
            }

            //jump
            if (this.player.playerOnFloor && this.controller1.gamepad.buttons[1].pressed) {
                this.player.playerVelocity.y = 15;
            }
            //move
            if(this.controller1.gamepad.axes[3] > 0.2) this.player.playerVelocity.add(this.getForwardVector().multiplyScalar(-speedDelta));
            if(this.controller1.gamepad.axes[3] < -0.2) this.player.playerVelocity.add(this.getForwardVector().multiplyScalar(speedDelta));
            if(this.controller1.gamepad.axes[2] > 0.2) this.player.playerVelocity.add(this.getSideVector().multiplyScalar(speedDelta));
            if(this.controller1.gamepad.axes[2] < -0.2) this.player.playerVelocity.add(this.getSideVector().multiplyScalar(-speedDelta));
        }

        if (this.controller2.gamepad) {
            // let debugText = `Gamepad: ${this.controller1.gamepad.id}\nButtons: ${this.controller1.gamepad.buttons.length}\nAxes: ${this.controller1.gamepad.axes.length}\n`;
            // // for (let i = 0; i < this.controller.gamepad1.buttons.length; i++) {
            // //     debugText += `Button ${i}: ${this.controller.gamepad1.buttons[i].pressed}\n`;
            // // }
            // for (let i = 0; i < this.controller1.gamepad.axes.length; i++) {
            //     debugText += `Axis ${i}: ${this.controller1.gamepad.axes[i]}\n`;
            // }
            // this.updateInstructionText(debugText);

            if(this.controller2.gamepad.buttons[0].pressed && this.saber2triggerReleased) {
                this.saber2.toggle();
                this.saber2triggerReleased = false;
            } else if(!this.controller2.gamepad.buttons[0].pressed) {
                this.saber2triggerReleased = true;
            }

            if(this.controller2.gamepad.axes[2] > 0.2) {
                this.player.rotation.y -= 0.005;
            }
            if(this.controller2.gamepad.axes[2] < -0.2) {
                this.player.rotation.y += 0.005;
            }
        }

    }

    updateInstructionText(text) {
        this.player.remove(this.instructionText);
        this.instructionText = createText( text, 0.04 );
        this.instructionText.position.set( 0, 1.6, - 0.6 );
        this.player.add(this.instructionText);
    }

    teleportPlayerIfOob() {

        if (this.player.position.y <= - 25) {

            this.player.playerCollider.start.set(0, 0.35, 0);
            this.player.playerCollider.end.set(0, 1, 0);
            this.player.playerCollider.radius = 0.35;
            this.player.position.copy(this.player.playerCollider.end);
            this.player.rotation.set(0, 0, 0);

        }

    }


    animate() {
        const deltaTime = Math.min(0.05, this.clock.getDelta()) / this.STEPS_PER_FRAME;

        // we look for collisions in substeps to mitigate the risk of
        // an object traversing another too quickly for detection.

        for (let i = 0; i < this.STEPS_PER_FRAME; i++) {

            this.controls(deltaTime);

            this.player.updatePlayer(deltaTime, this.world);
            if(this.saber) this.saber.animate(deltaTime);

            this.updateSpheres(deltaTime);

            this.teleportPlayerIfOob();

        }

        //this.composer.render(deltaTime);

        this.renderer.render(this.scene, this.camera);
    }

}


export { App };