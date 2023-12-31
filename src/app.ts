import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { createText } from 'three/addons/webxr/Text2D.js';
import nipplejs from 'nipplejs';

import { Player } from './player';
import { World } from './world';
import { Saber } from './saber';
import { Hand } from './hand';
import { Trooper } from './trooper';
import { Actor } from './actor';

export class App {
    static firstUserActionEvents = ['mousedown', 'touchstart', 'mousemove','scroll','keydown'];
    static firstUserAction = true;

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
    private joystickMoveVector: { x: number; y: number; } | undefined;
    joystickLookVector: any;

    constructor() {
        this.clock = new THREE.Clock();
        this.gui = new GUI({ width: 200 });
        this.gui.hide();
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

        //if mobile, add joystick
        if(window.innerWidth <= 800) {
            const joystick_left = document.createElement('div');
            document.body.appendChild(joystick_left);
            const manager = nipplejs.create({
                zone: joystick_left,
                mode: 'static',
                position: { left: '15%', bottom: '20%' },
                color: 'red',
                size: 150,
            });
            manager.on('move', (evt: nipplejs.EventData, data: nipplejs.JoystickOutputData) => {
                this.joystickMoveVector = data.vector;
            });
            manager.on('end', () => {
                this.joystickMoveVector = undefined;
            });
            
            const joystick_right = document.createElement('div');
            document.body.appendChild(joystick_right);
            const manager2 = nipplejs.create({
                zone: joystick_right,
                mode: 'static',
                position: { right: '15%', bottom: '20%' },
                color: 'red',
                size: 150,
            });
            manager2.on('move', (evt: any, data: any) => {
                this.joystickLookVector = data.vector;
            });
            manager2.on('end', () => {
                this.joystickLookVector = undefined;
            });
        }

        this.audioListenerPromise = new Promise<THREE.AudioListener>((resolve) => {
            this.setAudioListener = resolve;
        });

        this.init();
    }

    async init() {
       
        await this.initScene();

        this.setupXR();
        
        //init audio on first click

        App.firstUserActionEvents.forEach((event) => {
            document.addEventListener(event, this.onFirstUserAction.bind(this), { once: true });
        });

        this.renderer.xr.addEventListener('sessionstart', () => this.handleXrModeChange(true));
        this.renderer.xr.addEventListener('sessionend', () => this.handleXrModeChange(false));
        
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
        if(App.firstUserAction === false) return;
        App.firstUserAction = false;

        App.firstUserActionEvents.forEach((event) => {
            document.removeEventListener(event, this.onFirstUserAction.bind(this));
        });

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

        this.world?.startTimer();
    }

    /***
     * @returns {Promise}
     */
    async initScene() {

        //init world
        this.world = new World(this.audioListenerPromise, this.gui);
        this.world.addEventListener('timerExpired', () => {
            this.updateHud();
            if(!this.world || !this.player) return;
            this.player.blendBlack();
            this.world.allLightsOff();
            this.world.stopTimer();
            this.world.stopWorldAudio();
         } );
        this.world.addEventListener('timerTick', () => this.updateHud() );
        this.scene = await this.world.loadScene();

        //init player
        this.player = new Player(this.scene, this.audioListenerPromise, this.GRAVITY);
        this.player.teleport(this.world.playerSpawnPoint);
        this.saber = this.player.saber;
        this.hand = this.player.hand;
        this.player.addEventListener('dead', () => {
            if(navigator.vibrate) navigator.vibrate(1000);
            this.updateHud();
            if(!this.world || !this.player) return;
            this.player.teleport(this.world.playerSpawnPoint);
            this.world.allLightsOff();
            this.world.stopTimer();
            this.world.stopWorldAudio();
        });
        this.player.addEventListener('damaged', () => {
            if(navigator.vibrate) navigator.vibrate(100);
            this.updateHud();
        });
        this.updateHud();

        //setup saber
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
                    if(respawn) {
                        spawn(spawnPosition,respawn);
                    } else {
                        if(this.enemys.length === 0) {
                            this.displayWinMessage();
                        }
                    }
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

    displayWinMessage() {
        if(!this.player || !this.world) return;
        this.player.blendBlack();
        this.updateInstructionText("You win! Reload to restart.");
        this.world.allLightsOff();
        this.world.stopTimer();
        this.world.stopWorldAudio();
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

    handleXrModeChange(xrMode: boolean) {
        this.setupSaberAndHand(xrMode);
    }

    setupSaberAndHand(xrMode=false) {
        if(!this.hand || !this.saber || !this.player) return;
        if(!xrMode) {
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
        
        const speedDelta = deltaTime * (this.player.onFloor ? this.player.speedOnFloor : this.player.speedInAir);

        //keyboard controls
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

        //virtual joystick controls
        if(this.joystickMoveVector) {
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(this.joystickMoveVector.y * speedDelta));
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(this.joystickMoveVector.x * speedDelta));
        }
        if(this.joystickLookVector) {
            this.player.camera.rotation.y -= this.joystickLookVector.x * 0.1 * speedDelta;
            this.player.camera.rotation.x += this.joystickLookVector.y * 0.1 * speedDelta;
        }

        //vr controls
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

    private updateHud(){
        if(!this.player) return;

        let hudText = "";
        if(this.player.health === 0) {
            hudText = "☠ You died. Reload to restart.";
        } else {
            hudText = `✙ ${this.player.health.toFixed(0)}`;
            if(this.world) {
                if(this.world.timerSeconds > 0) {
                    // timer is active, 00:00 format
                    const minutes = Math.floor(this.world.timerSeconds / 60);
                    const seconds = this.world.timerSeconds % 60;
                    hudText += ` ⧗ ${minutes}:${seconds.toFixed(0).padStart(2, '0')}`;
                } else if (this.world.timerSeconds === 0) {
                    hudText = ` ⧗ Time is up. Reload to restart.`;
                }
            }
        }

        this.updateInstructionText(hudText);
    }

    private updateInstructionText(text: string): void {
        if(!this.player) return;

        this.player.camera.remove(this.instructionText);
        this.instructionText = createText(text, 0.04);
        if(this.renderer.xr.isPresenting) {
            this.instructionText.position.set(0,0.05,-0.2);
        } else {
            this.instructionText.position.set(0,0.1,-0.2);
        }
        this.instructionText.scale.set(0.3,0.3,0.3);
        this.player.camera.add(this.instructionText);
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

            if (this.world) this.world.update(deltaTime, this.player.camera);

            this.teleportPlayerIfOob();
        }

        this.stats.update();
        this.renderer.render(this.scene, this.player.camera);
    }
}
