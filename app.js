
import * as THREE from './three/three.module.js';

import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';

import { Octree } from './three/addons/math/Octree.js';
import { OctreeHelper } from './three/addons/helpers/OctreeHelper.js';

import { Capsule } from './three/addons/math/Capsule.js';

import { GUI } from './three/addons/libs/lil-gui.module.min.js';
import { VRButton } from './three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from './three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from './three/addons/webxr/XRHandModelFactory.js';

class App {

    GRAVITY = 30;

    NUM_SPHERES = 100;
    SPHERE_RADIUS = 0.2;

    STEPS_PER_FRAME = 5;

    sphereGeometry = new THREE.IcosahedronGeometry(this.SPHERE_RADIUS, 5);
    sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xdede8d });

    spheres = [];
    sphereIdx = 0;

    worldOctree = new Octree();

    playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);

    playerVelocity = new THREE.Vector3();
    playerDirection = new THREE.Vector3();

    playerOnFloor = false;
    mouseTime = 0;

    keyStates = {};

    vector1 = new THREE.Vector3();
    vector2 = new THREE.Vector3();
    vector3 = new THREE.Vector3();

    constructor() {
        this.clock = new THREE.Clock();
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x505050);

        this.fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
        this.fillLight1.position.set(2, 1, 1);
        this.scene.add(this.fillLight1);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        this.directionalLight.position.set(- 5, 25, - 1);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.camera.near = 0.01;
        this.directionalLight.shadow.camera.far = 500;
        this.directionalLight.shadow.camera.right = 30;
        this.directionalLight.shadow.camera.left = - 30;
        this.directionalLight.shadow.camera.top = 30;
        this.directionalLight.shadow.camera.bottom = - 30;
        this.directionalLight.shadow.mapSize.width = 1024;
        this.directionalLight.shadow.mapSize.height = 1024;
        this.directionalLight.shadow.radius = 4;
        this.directionalLight.shadow.bias = - 0.00006;
        this.scene.add(this.directionalLight);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));

    }

    async init() {
        await this.initScene();
        this.setupXR();

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

        document.addEventListener('mouseup', () => {
            if (document.pointerLockElement !== null) this.throwBall();
        });

        document.body.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                this.camera.rotation.y -= event.movementX / 500;
                this.camera.rotation.x -= event.movementY / 500;
            }
        });

        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    /***
     * @returns {Promise}
     */
    initScene() {

        this.scene.background = new THREE.Color(0x88ccee);
        this.scene.fog = new THREE.Fog(0x88ccee, 0, 50);

        this.dolly = new THREE.Object3D();
        this.dolly.position.z = 5;
        this.dolly.add(this.camera);
        this.scene.add(this.dolly);

        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        this.loader = new GLTFLoader().setPath('./models/gltf/');

        const promise = new Promise((resolve, reject) => {

            this.loader.load('collision-world.glb', (gltf) => {
                this.scene.add(gltf.scene);
                this.worldOctree.fromGraphNode(gltf.scene);
                gltf.scene.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if (child.material.map) {
                            child.material.map.anisotropy = 4;
                        }
                    }
                });

                const helper = new OctreeHelper(this.worldOctree);
                helper.visible = false;
                this.scene.add(helper);

                this.gui = new GUI({ width: 200 });
                this.gui.add({ debug: false }, 'debug')
                    .onChange(function (value) {
                        helper.visible = value;
                    });

                resolve();
            });
        });

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

        return promise;
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        function onSelectStart() {   
            this.userData.selectPressed = true;
        }

        function onSelectEnd() {
            this.userData.selectPressed = false;           
        }

        this.controller = this.renderer.xr.getController(0);
        this.controller.addEventListener( 'selectstart', onSelectStart );
        this.controller.addEventListener( 'selectend', onSelectEnd );

        this.controller.addEventListener('connected', (e) => {
            this.controller.gamepad = e.data.gamepad;

            const mesh = this.buildController.call(this, e.data);
            mesh.scale.z = 0;
            this.controller.add(mesh);
        });
        this.controller.addEventListener('disconnected', () => {

            this.controller.remove(this.children[0]);
            this.controller = null;
            this.controllerGrip1 = null;
            this.controllerGrip2 = null;

        });
        this.scene.add(this.controller);

        const controllerModelFactory = new XRControllerModelFactory();

        this.controllerGrip1 = this.renderer.xr.getControllerGrip( 0 );
        this.controllerGrip1.add( controllerModelFactory.createControllerModel( this.controllerGrip1 ) );
        this.controllerGrip2 = this.renderer.xr.getControllerGrip( 1 );
        this.controllerGrip2.add( controllerModelFactory.createControllerModel( this.controllerGrip2 ) );

        this.dolly.add(this.controller);
        this.dolly.add(this.controllerGrip1);
        this.dolly.add(this.controllerGrip2);
    }

    buildController(data) {
        let geometry, material;
        
        switch ( data.targetRayMode ) {
            
            case 'tracked-pointer':

                geometry = new THREE.BufferGeometry();
                geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, - 1 ], 3 ) );
                geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( [ 0.5, 0.5, 0.5, 0, 0, 0 ], 3 ) );

                material = new THREE.LineBasicMaterial( { vertexColors: true, blending: THREE.AdditiveBlending } );

                return new THREE.Line( geometry, material );

            case 'gaze':

                geometry = new THREE.RingBufferGeometry( 0.02, 0.04, 32 ).translate( 0, 0, - 1 );
                material = new THREE.MeshBasicMaterial( { opacity: 0.5, transparent: true } );
                return new THREE.Mesh( geometry, material );

        }
    }

    handleController(controller, speedDelta) {
        if (controller.userData.selectPressed) {
            // const speed = 2;
            // const quaternion = this.dolly.quaternion.clone();
            // this.dolly.quaternion.copy(this.dummyCam.getWorldQuaternion());
            // this.dolly.translateZ(- speed * dt);
            // this.dolly.position.y = 0;
            // this.dolly.quaternion.copy(quaternion);
        }
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    throwBall() {

        const sphere = this.spheres[this.sphereIdx];

        this.camera.getWorldDirection(this.playerDirection);

        sphere.collider.center.copy(this.playerCollider.end).addScaledVector(this.playerDirection, this.playerCollider.radius * 1.5);

        // throw the ball with more force if we hold the button longer, and if we move forward

        const impulse = 15 + 30 * (1 - Math.exp((this.mouseTime - performance.now()) * 0.001));

        sphere.velocity.copy(this.playerDirection).multiplyScalar(impulse);
        sphere.velocity.addScaledVector(this.playerVelocity, 2);

        this.sphereIdx = (this.sphereIdx + 1) % this.spheres.length;

    }

    playerCollisions() {

        const result = this.worldOctree.capsuleIntersect(this.playerCollider);

        this.playerOnFloor = false;

        if (result) {

            this.playerOnFloor = result.normal.y > 0;

            if (!this.playerOnFloor) {

                this.playerVelocity.addScaledVector(result.normal, - result.normal.dot(this.playerVelocity));

            }

            this.playerCollider.translate(result.normal.multiplyScalar(result.depth));

        }

    }

    /***
     * @param {number} deltaTime
     */
    updatePlayer(deltaTime) {

        let damping = Math.exp(- 4 * deltaTime) - 1;

        if (!this.playerOnFloor) {

            this.playerVelocity.y -= this.GRAVITY * deltaTime;

            // small air resistance
            damping *= 0.1;

        }

        this.playerVelocity.addScaledVector(this.playerVelocity, damping);

        const deltaPosition = this.playerVelocity.clone().multiplyScalar(deltaTime);
        this.playerCollider.translate(deltaPosition);

        this.playerCollisions();

        this.dolly.position.copy(this.playerCollider.end);

    }

    /***
     * @param {THREE.Sphere} sphere
     */
    playerSphereCollision(sphere) {

        const center = this.vector1.addVectors(this.playerCollider.start, this.playerCollider.end).multiplyScalar(0.5);

        const sphere_center = sphere.collider.center;

        const r = this.playerCollider.radius + sphere.collider.radius;
        const r2 = r * r;

        // approximation: player = 3 spheres

        for (const point of [this.playerCollider.start, this.playerCollider.end, center]) {

            const d2 = point.distanceToSquared(sphere_center);

            if (d2 < r2) {

                const normal = this.vector1.subVectors(point, sphere_center).normalize();
                const v1 = this.vector2.copy(normal).multiplyScalar(normal.dot(this.playerVelocity));
                const v2 = this.vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

                this.playerVelocity.add(v2).sub(v1);
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

            const result = this.worldOctree.sphereIntersect(sphere.collider);

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

        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();

        return this.playerDirection;

    }

    getSideVector() {

        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        this.playerDirection.cross(this.camera.up);

        return this.playerDirection;

    }

    controls(deltaTime) {

        // gives a bit of air control
        const speedDelta = deltaTime * (this.playerOnFloor ? 25 : 8);

        if (this.keyStates['KeyW']) {
            this.playerVelocity.add(this.getForwardVector().multiplyScalar(speedDelta));
        }

        if (this.keyStates['KeyS']) {
            this.playerVelocity.add(this.getForwardVector().multiplyScalar(- speedDelta));
        }

        if (this.keyStates['KeyA']) {
            this.playerVelocity.add(this.getSideVector().multiplyScalar(- speedDelta));
        }

        if (this.keyStates['KeyD']) {
            this.playerVelocity.add(this.getSideVector().multiplyScalar(speedDelta));
        }

        if (this.playerOnFloor) {
            if (this.keyStates['Space']) {
                this.playerVelocity.y = 15;
            }
        }

        if (this.controller.userData.selectPressed) {
            this.playerVelocity.add(this.getForwardVector().multiplyScalar(speedDelta));
        }

        // if (this.controller.gamepad) {
        //     //throw ball
        //     if (this.controller.gamepad.buttons[0].pressed) {
        //         this.throwBall();
        //     }

        //     //jump
        //     if (this.controller.gamepad.buttons[3].pressed) {
        //         this.playerVelocity.y = 15;
        //     }
        //     this.playerVelocity.add(this.getForwardVector().multiplyScalar(this.controller.gamepad.axes[0] * speedDelta));
        //     this.playerVelocity.add(this.getSideVector().multiplyScalar(this.controller.gamepad.axes[1] * speedDelta));

        // }

    }



    teleportPlayerIfOob() {

        if (this.camera.position.y <= - 25) {

            this.playerCollider.start.set(0, 0.35, 0);
            this.playerCollider.end.set(0, 1, 0);
            this.playerCollider.radius = 0.35;
            this.camera.position.copy(this.playerCollider.end);
            this.camera.rotation.set(0, 0, 0);

        }

    }


    animate() {
        const deltaTime = Math.min(0.05, this.clock.getDelta()) / this.STEPS_PER_FRAME;

        // we look for collisions in substeps to mitigate the risk of
        // an object traversing another too quickly for detection.

        for (let i = 0; i < this.STEPS_PER_FRAME; i++) {

            this.controls(deltaTime);

            if (this.controller) this.handleController(this.controller, deltaTime);

            this.updatePlayer(deltaTime);

            this.updateSpheres(deltaTime);

            this.teleportPlayerIfOob();

        }

        this.renderer.render(this.scene, this.camera);
    }
}


export { App };