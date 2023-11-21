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
import { Trooper } from './trooper.js';
import { Actor } from './actor.js';

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

    enemys = [];
    spheres = [];
    sphereIdx = 0;

    mouseTime = 0;

    keyStates = {};

    vector1 = new THREE.Vector3();
    vector2 = new THREE.Vector3();
    vector3 = new THREE.Vector3();

    audioListenerPromise = null;

    constructor() {
        this.clock = new THREE.Clock();
        this.gui = new GUI({ width: 200 });
        this.initDebugGui();

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

    }

    async init() {
        this.initAudio();
        
        await this.initScene();

        this.setupXR();
        
        //init audio on first click
        document.addEventListener('mousedown', async () => this.onFirstUserAction(), { once: true });

        this.renderer.xr.addEventListener('sessionstart', async () => {
            this.onFirstUserAction()
            this.removeDefaultSaber();
        }, { once: true });
        
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

        document.body.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                this.player.camera.rotation.y -= event.movementX / 500;
                this.player.camera.rotation.x -= event.movementY / 500;
            }
        });

        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    initDebugGui() {
        this.gui.add({ debugActor: false }, 'debugActor')
            .onChange(function (value) {
                Actor.debug = value;
            });
        this.gui.add({ debugSaber: false }, 'debugSaber')
            .onChange(function (value) {
                Saber.debug = value;
            });
    }

    /**
     * Executes actions when the user performs their first interaction.
     * Plays audio and adds a light saber to the player's scene.
     */
    async onFirstUserAction() {
        //init audio
        const listener = new THREE.AudioListener();
        this.setAudioListener(listener);

        window.addEventListener('blur', async () => listener.context.suspend());
        window.addEventListener('focus', async () => listener.context.resume());

        //init saber
        this.addDefaultSaber();
    }

    /***
     * @returns {Promise}
     */
    async initScene() {

        //init world
        this.world = new World(this.audioListenerPromise, this.gui);
        this.scene = await this.world.loadScene();

        //init player
        this.player = new Player(this.scene, this.audioListenerPromise, this.GRAVITY);
        this.camera = this.player.getCamera();

        //init trooper
        this.initEnemies(this.world.enemySpawnPoints);

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

    initEnemies(spawnPositions) {
        spawnPositions = spawnPositions.length>0 ? spawnPositions : [
            new THREE.Vector3(1.6, -1.6, -7),
        ];

        const spawn = (spawnPosition, respawn=true)=>{
            const trooper = new Trooper(this.GRAVITY, this.scene);
            trooper.rotation.set(0, Math.PI, 0);
            trooper.setPosition(spawnPosition.x, spawnPosition.y, spawnPosition.z);

            const deadHandler = (e) => {
                trooper.removeEventListener('dead', deadHandler);
                setTimeout(() => {
                    this.scene.remove(trooper);
                    trooper.dispose();
                    this.enemys.splice(this.enemys.indexOf(trooper), 1);
                    if(respawn) spawn(spawnPosition,respawn);
                }, 3000);
            };
            trooper.addEventListener('dead', deadHandler.bind(this));
            this.enemys.push(trooper);
            this.scene.add(trooper);
        }

        spawnPositions.forEach((spawnPosition) => {
            spawn(spawnPosition);
        });
    }

    initAudio() {
        this.audioListenerPromise = new Promise((resolve) => {
            this.setAudioListener = resolve;
        });
        return this.audioListenerPromise;
    }

    defaultSaberToggle(e) {
        if (e.button === 2) this.saber.toggle();
        if (e.button === 0) this.saber.swing();
    }

    addDefaultSaber() {
        this.saber = new Saber(this.scene, this.audioListenerPromise);
        this.saber.position.set(0, -0.3, -0.6);
        this.saber.setInitialRotation(-Math.PI / 4, 0, -0.7);
        this.player.camera.add(this.saber);

        document.addEventListener('mouseup', this.defaultSaberToggle.bind(this));
    }

    removeDefaultSaber() {
        this.player.camera.remove(this.saber);
        this.saber = null;
        document.removeEventListener('mouseup', this.defaultSaberToggle);
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('connected', (e) => {
            this.controller1.gamepad = e.data.gamepad;
            this.saber1 = new Saber(this.scene, this.audioListenerPromise);
            this.controller1.add( this.saber1 );
        });
        this.controller1.addEventListener('disconnected', (e) => {
            this.controller1.gamepad = null;
            this.controller1.remove( this.controller1.children[0] );
        });

        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('connected', (e) => {
            this.controller2.gamepad = e.data.gamepad;
            this.saber2 = new Saber(this.scene, this.audioListenerPromise);
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

        this.camera.getWorldDirection(this.player.direction);

        sphere.collider.center.copy(this.player.collider.end).addScaledVector(this.player.direction, this.player.collider.radius * 1.5);

        // throw the ball with more force if we hold the button longer, and if we move forward

        const impulse = 15 + 30 * (1 - Math.exp((this.mouseTime - performance.now()) * 0.001));

        sphere.velocity.copy(this.player.direction).multiplyScalar(impulse);
        sphere.velocity.addScaledVector(this.player.velocity, 2);

        this.sphereIdx = (this.sphereIdx + 1) % this.spheres.length;

    }


    /***
     * @param {THREE.Sphere} sphere
     */
    playerSphereCollision(sphere) {

        const center = this.vector1.addVectors(this.player.collider.start, this.player.collider.end).multiplyScalar(0.5);

        const sphere_center = sphere.collider.center;

        const r = this.player.collider.radius + sphere.collider.radius;
        const r2 = r * r;

        // approximation: player = 3 spheres

        for (const point of [this.player.collider.start, this.player.collider.end, center]) {

            const d2 = point.distanceToSquared(sphere_center);

            if (d2 < r2) {

                const normal = this.vector1.subVectors(point, sphere_center).normalize();
                const v1 = this.vector2.copy(normal).multiplyScalar(normal.dot(this.player.velocity));
                const v2 = this.vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

                this.player.velocity.add(v2).sub(v1);
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

    controls(deltaTime) {

        // gives a bit of air control
        const speedDelta = deltaTime * (this.player.onFloor ? 25 : 8);

        if (this.keyStates['KeyW']) {
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(speedDelta));
        }

        if (this.keyStates['KeyS']) {
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(- speedDelta));
        }

        if (this.keyStates['KeyA']) {
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(- speedDelta));
        }

        if (this.keyStates['KeyD']) {
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(speedDelta));
        }

        if (this.player.onFloor) {
            if (this.keyStates['Space']) {
                this.player.velocity.y = 15;
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
            if (this.player.onFloor && this.controller1.gamepad.buttons[1].pressed) {
                this.player.velocity.y = 15;
            }
            //move
            if(this.controller1.gamepad.axes[3] > 0.2) this.player.velocity.add(this.player.getForwardVector().multiplyScalar(-speedDelta));
            if(this.controller1.gamepad.axes[3] < -0.2) this.player.velocity.add(this.player.getForwardVector().multiplyScalar(speedDelta));
            if(this.controller1.gamepad.axes[2] > 0.2) this.player.velocity.add(this.player.getSideVector().multiplyScalar(speedDelta));
            if(this.controller1.gamepad.axes[2] < -0.2) this.player.velocity.add(this.player.getSideVector().multiplyScalar(-speedDelta));
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

            this.player.collider.start.set(0, 0.35, 0);
            this.player.collider.end.set(0, 1, 0);
            this.player.collider.radius = 0.35;
            this.player.position.copy(this.player.collider.end);
            this.player.rotation.set(0, 0, 0);

        }

    }


    animate() {
        const deltaTime = Math.min(0.05, this.clock.getDelta()) / this.STEPS_PER_FRAME;

        // we look for collisions in substeps to mitigate the risk of
        // an object traversing another too quickly for detection.

        for (let i = 0; i < this.STEPS_PER_FRAME; i++) {

            this.controls(deltaTime);

            this.player.animate(deltaTime, this.world);
            if(this.saber) this.saber.animate(deltaTime, this.world, this.enemys);
            if(this.saber1) this.saber1.animate(deltaTime, this.world, this.enemys);
            if(this.saber2) this.saber2.animate(deltaTime, this.world, this.enemys);

            this.enemys.forEach(enemy => {
                enemy.animate(deltaTime, this.world);
            });

            this.updateSpheres(deltaTime);

            this.teleportPlayerIfOob();

        }

        //this.composer.render(deltaTime);

        this.renderer.render(this.scene, this.camera);
    }

}


export { App };