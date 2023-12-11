import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createText } from 'three/addons/webxr/Text2D.js';

import { Player } from './player';
import { World } from './world';
import { Saber } from './saber';
import { Hand } from './hand';
import { Trooper } from './trooper';
import { Actor } from './actor';

export class App {
    private hand: Hand | undefined;
    private player: Player | undefined;
    private renderer: THREE.WebGLRenderer;
    private controller1: any;
    private controller2: any;
    private instructionText: any;
    private vector1 = new THREE.Vector3();
    private vector2 = new THREE.Vector3();
    private vector3 = new THREE.Vector3();
    private world: World | undefined;
    private GRAVITY: number = 9.8 * 3.5;
    private gui: GUI;

    private keyStates: any = {};
    private mouseTime = 0;
    private clock: any;
    private STEPS_PER_FRAME = 5;
    private stats: Stats = new Stats();
    private scene: THREE.Scene | undefined;
    private saber: Saber | undefined;
    private enemys: Actor[] = [];
    private trigger1Released = true;
    private trigger2Released = true;

    private audioListenerPromise: Promise<THREE.AudioListener>;
    private container: HTMLDivElement;
    public setAudioListener: any;

    constructor() {
        this.clock = new THREE.Clock();
        this.gui = new GUI({ width: 200 });
        this.initDebugGui();

        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        this.renderer = new THREE.WebGLRenderer({
            antialias: window.devicePixelRatio <= 1,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));

        this.container.appendChild( this.stats.dom );

        this.audioListenerPromise = new Promise<THREE.AudioListener>((resolve) => {
            this.setAudioListener = resolve;
        });

        this.init();
    }

    async init() {
       
        await this.initScene();

        this.setupXR();
        
        //init audio on first click
        document.addEventListener('mousedown', () => this.onFirstUserAction(), { once: true });

        this.renderer.xr.addEventListener('sessionstart', () => this.setupSaberAndHand(true));
        this.renderer.xr.addEventListener('sessionend', () => this.setupSaberAndHand(false));
        
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
            if (document.pointerLockElement === document.body && this.player) {
                this.player.camera.rotation.y -= event.movementX / 500;
                this.player.camera.rotation.x -= event.movementY / 500;
            }
        });

        this.renderer.setAnimationLoop(this.update.bind(this));
    }

    initDebugGui() {
        this.gui.add({ debugPlayer: false }, 'debugPlayer')
            .onChange(function (value) {
                Player.debug = value;
            });
        this.gui.add({ debugActor: false }, 'debugActor')
            .onChange(function (value) {
                Actor.debug = value;
            });
        this.gui.add({ debugSaber: false }, 'debugSaber')
            .onChange(function (value) {
                Saber.debug = value;
            });
        this.gui.add({ debugWorld: false }, 'debugWorld')
            .onChange((value: boolean) => {
                if (this.world && this.world.helper) {
                    this.world.helper.visible = value;
                }
            });
    }


    /**
     * Executes actions when the user performs their first interaction.
     * Plays audio and adds a light saber to the player's scene.
     */
    onFirstUserAction() {
        //init audio
        const listener = new THREE.AudioListener();
        if (this.setAudioListener) {
            this.setAudioListener(listener);
        }

        window.addEventListener('blur', () => listener.context.suspend());
        window.addEventListener('focus', () => listener.context.resume());

        setTimeout(() => {
            document.addEventListener('mouseup', this.mouseUpHandler.bind(this));
            document.addEventListener('mousedown', this.mouseDownHandler.bind(this));

            if(this.saber) this.saber.on();
        }, 500);

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
        this.player.teleport(this.world.playerSpawnPoint);

        //init saber
        this.initSaberAndHand();
        this.setupSaberAndHand();
        //this.addDefaultSaberAndHand();

        //init trooper
        this.initEnemies(this.world.enemySpawnPoints);

    }

    initEnemies(spawnPositions: THREE.Vector3[]) {
        spawnPositions = spawnPositions.length>0 ? spawnPositions : [
            new THREE.Vector3(1.6, -1.6, -7),
        ];

        const spawn = (spawnPosition: THREE.Vector3, respawn=false)=>{
            if(!this.scene) return;
            const trooper = new Trooper(this.GRAVITY, this.scene, this.audioListenerPromise);
            trooper.rotation.set(0, Math.PI, 0);
            trooper.setPosition(spawnPosition.x, spawnPosition.y, spawnPosition.z);

            const deadHandler = () => {
                trooper.removeEventListener('dead', deadHandler);
                setTimeout(() => {
                    if(!this.scene) return;
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

    mouseDownHandler(e: MouseEvent) {
        if(!this.hand) return;
        if (e.button === 2) this.hand.forcePull();
    }

    mouseUpHandler(e: MouseEvent) {
        if(!this.hand || !this.saber) return;
        if (e.button === 2) this.hand.forceRelease();
        if (e.button === 0) this.saber.swing();
    }

    initSaberAndHand() {
        if(!this.scene || !this.player) return;
        this.saber = new Saber(this.scene, this.player.camera, this.audioListenerPromise);
        this.hand = new Hand(this.scene, this.audioListenerPromise);
    }

    setupSaberAndHand(xr=false) {
        if(!this.hand || !this.saber || !this.player) return;
        if(!xr) {
            this.saber.position.set(0.2,-0.3, -0.6);
            this.saber.setInitialRotation(-Math.PI / 4, 0, -0.7);
            this.player.camera.add(this.saber);

            this.hand.position.set(-0.2,-0.4, -0.6);
            this.hand.rotation.set(-1.5,0,0);
            this.player.camera.add(this.hand);
        } else {
            this.saber.position.set(0,0,0);
            this.saber.setInitialRotation(-Math.PI/4,0,0);
            this.player.camera.remove(this.saber);

            this.hand.position.set(0,0,0.1);
            this.hand.rotation.set(-Math.PI/2,0,0);
            this.player.camera.remove(this.hand);
        }
    }

    private setupXR(): void {
        if(!this.player) return;

        this.renderer.xr.enabled = true;
        this.renderer.xr.setFramebufferScaleFactor(2.0);

        const connectController = (e: any) => {          
            let controller;
            if(e.data.handedness === 'left') {
                controller = this.controller1;
                controller.gamepad = e.data.gamepad;
                controller.add(this.hand);
            } else {
                controller = this.controller2;
                controller.gamepad = e.data.gamepad;
                controller.add(this.saber);
            }
        }
        const disconnectController = (e: any) => {
            let controller;
            if(e.data.handedness === 'left') {
                controller = this.controller1;
                controller.gamepad = null;
                controller.remove(this.hand);
            } else {
                controller = this.controller2;
                controller.gamepad = null;
                controller.remove(this.saber);
            }
        }

        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('connected', connectController);
        this.controller1.addEventListener('disconnected', disconnectController);

        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('connected', connectController);
        this.controller2.addEventListener('disconnected', disconnectController);

        this.instructionText = createText('', 0.04);
        this.instructionText.position.set(0, 1.6, -0.6);
        this.player.add(this.instructionText);

        this.player.add(this.controller1);
        this.player.add(this.controller2);
    }

    private resize(): void {
        if(!this.player) return;
        this.player.camera.aspect = window.innerWidth / window.innerHeight;
        this.player.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // private playerSphereCollision(sphere: any): void {
    //     const center = this.vector1.addVectors(this.player.collider.start, this.player.collider.end).multiplyScalar(0.5);
    //     const sphere_center = sphere.collider.center;
    //     const r = this.player.collider.radius + sphere.collider.radius;
    //     const r2 = r * r;

    //     for (const point of [this.player.collider.start, this.player.collider.end, center]) {
    //         const d2 = point.distanceToSquared(sphere_center);

    //         if (d2 < r2) {
    //             const normal = this.vector1.subVectors(point, sphere_center).normalize();
    //             const v1 = this.vector2.copy(normal).multiplyScalar(normal.dot(this.player.velocity));
    //             const v2 = this.vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

    //             this.player.velocity.add(v2).sub(v1);
    //             sphere.velocity.add(v1).sub(v2);

    //             const d = (r - Math.sqrt(d2)) / 2;
    //             sphere_center.addScaledVector(normal, -d);
    //         }
    //     }
    // }

    private controls(deltaTime: number): void {
        if(!this.player || !this.saber || !this.hand) return;
        
        const speedDelta = deltaTime * (this.player.onFloor ? 25 : 8);

        if (this.keyStates['KeyW']) {
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(speedDelta));
        }

        if (this.keyStates['KeyS']) {
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(-speedDelta));
        }

        if (this.keyStates['KeyA']) {
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(-speedDelta));
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
            if (this.controller1.gamepad.buttons[0].pressed && this.trigger2Released) {
                this.trigger2Released = false;
            } else if (!this.controller1.gamepad.buttons[0].pressed) {
                this.trigger2Released = true;
            }

            if (this.controller1.gamepad.buttons[1].pressed) {
                this.hand.forcePull(this.controller1.gamepad.buttons[1].value);
            } else {
                this.hand.forceRelease();
            }

            if (this.controller1.gamepad.axes[3] > 0.2) this.player.velocity.add(this.player.getForwardVector().multiplyScalar(-speedDelta));
            if (this.controller1.gamepad.axes[3] < -0.2) this.player.velocity.add(this.player.getForwardVector().multiplyScalar(speedDelta));
            if (this.controller1.gamepad.axes[2] > 0.2) this.player.velocity.add(this.player.getSideVector().multiplyScalar(speedDelta));
            if (this.controller1.gamepad.axes[2] < -0.2) this.player.velocity.add(this.player.getSideVector().multiplyScalar(-speedDelta));
        }

        if (this.controller2.gamepad) {
            if (this.controller2.gamepad.buttons[0].pressed && this.trigger1Released) {
                this.saber.toggle();
                this.trigger1Released = false;
            } else if (!this.controller2.gamepad.buttons[0].pressed) {
                this.trigger1Released = true;
            }

            if (this.player.onFloor && this.controller2.gamepad.buttons[1].pressed) {
                this.player.velocity.y = 15;
            }

            if (this.controller2.gamepad.axes[2] > 0.2) {
                this.player.rotation.y -= 0.005;
            }
            if (this.controller2.gamepad.axes[2] < -0.2) {
                this.player.rotation.y += 0.005;
            }
        }
    }

    private updateInstructionText(text: string): void {
        if(!this.player || !this.instructionText) return;

        this.player.remove(this.instructionText);
        this.instructionText = createText(text, 0.04);
        this.instructionText.position.set(0, 1.6, -0.6);
        this.player.add(this.instructionText);
    }

    private teleportPlayerIfOob(): void {
        if(!this.player || !this.world) return;
        if (this.world && this.player.position.y <= -25) {
            this.player.teleport(this.world.playerSpawnPoint);
        }
    }

    public update(): void {
        if(!this.player || !this.scene || !this.world) return;

        const deltaTime = Math.min(0.05, this.clock.getDelta()) / this.STEPS_PER_FRAME;

        for (let i = 0; i < this.STEPS_PER_FRAME; i++) {
            this.controls(deltaTime);

            if(this.world) this.player.update(deltaTime, this.world);
            if (this.saber && this.world) this.saber.update(deltaTime, this.world, this.enemys);
            if (this.hand) this.hand.update(deltaTime, this.world, this.enemys);

            for (let i = 0; i < this.enemys.length; i++) {
                const enemy = this.enemys[i];
                enemy.update(deltaTime, this.world, this.player);
            }

            if (this.world) this.world.update(deltaTime);

            this.teleportPlayerIfOob();
        }

        this.stats.update();
        this.renderer.render(this.scene, this.player.camera);
    }
}
