import * as THREE from './three/three.module.js';
import { GLTFLoader } from './three/addons/loaders/GLTFLoader.js';
import { OctreeHelper } from './three/addons/helpers/OctreeHelper.js';
import { Octree } from './three/addons/math/Octree.js';

export class World extends THREE.Object3D {

    static debug = false;
    worldOctree = new Octree();

    constructor(gui) {
        super();

        this.gui = gui;

        this.objectLoader = new THREE.ObjectLoader();

        // const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
        // fillLight1.position.set(2, 1, 1);
        // this.scene.add(fillLight1);

        // const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        // directionalLight.position.set(- 5, 25, - 1);
        // directionalLight.castShadow = true;
        // directionalLight.shadow.camera.near = 0.01;
        // directionalLight.shadow.camera.far = 500;
        // directionalLight.shadow.camera.right = 30;
        // directionalLight.shadow.camera.left = - 30;
        // directionalLight.shadow.camera.top = 30;
        // directionalLight.shadow.camera.bottom = - 30;
        // directionalLight.shadow.mapSize.width = 1024;
        // directionalLight.shadow.mapSize.height = 1024;
        // directionalLight.shadow.radius = 4;
        // directionalLight.shadow.bias = - 0.00006;
        // this.scene.add(directionalLight);

        // this.scene.background = new THREE.Color(0x88ccee);
        // this.scene.fog = new THREE.Fog(0x88ccee, 0, 50);

        // this.textureLoader = new THREE.TextureLoader();
        // this.gltfLoader = new GLTFLoader();
        // this.gltfLoader.setPath('./models/gltf/');

    }

    async loadScene() {

        const scene = await this.objectLoader.loadAsync('./models/scene.json');

        const map = scene.children.find(child=> child.name==="collision-world.glb");
        this.map = map;
        this.worldOctree.fromGraphNode(map);

        //find object with name "Hemisphere" and change material to repeat
        scene.traverse(child => {
            if (child.isMesh && child.name === "Hemisphere") {

                [child.material.map,child.material.lightMap].forEach(map => {
                    if (map) {
                        map.wrapS = THREE.RepeatWrapping;
                        map.wrapT = THREE.RepeatWrapping;
                        map.repeat.set(2, 2);
                        map.anisotropy = 4;
                    }
                });
            } 
            // else if (child.isMesh && child.name === "collision-world.glb") {
            //     if (child.material.map) {
            //         child.material.map.anisotropy = 4;
            //     }
                
            // }
        });

        const helper = new OctreeHelper(this.worldOctree);
        helper.visible = false;
        scene.add(helper);

        this.gui.add({ debug: false }, 'debug')
            .onChange(function (value) {
                helper.visible = value;
            });

        return scene;

        // // Create the panoramic sphere geometery
        // const panoSphereGeo = new THREE.SphereGeometry(32, 256, 256);
        // // Create the panoramic sphere material
        // const panoSphereMat = new THREE.MeshStandardMaterial({
        //     side: THREE.BackSide,
        //     displacementScale: - 4.0
        // });
        // // Create the panoramic sphere mesh
        // const sphere = new THREE.Mesh(panoSphereGeo, panoSphereMat);
        // this.scene.add(sphere);

        // const panoramicTexture = await this.textureLoader.loadAsync('./textures/kandao3.jpg')
        // panoramicTexture.colorSpace = THREE.SRGBColorSpace;
        // panoramicTexture.minFilter = THREE.NearestFilter;
        // panoramicTexture.generateMipmaps = false;
        // sphere.material.map = panoramicTexture;

        // const panoramicDepth = await this.textureLoader.loadAsync('./textures/kandao3_depthmap.jpg')
        // panoramicDepth.minFilter = THREE.NearestFilter;
        // panoramicDepth.generateMipmaps = false;
        // sphere.material.displacementMap = panoramicDepth;

        // // const worldTexture = await this.textureLoader.loadAsync('./textures/brick_bump.jpg')
        // // worldTexture.minFilter = THREE.NearestFilter;
        // // worldTexture.generateMipmaps = false;
        // // worldTexture.wrapS = THREE.RepeatWrapping;
        // // worldTexture.wrapT = THREE.RepeatWrapping;

        // const gltf = await this.gltfLoader.loadAsync('collision-world.glb');
        // this.scene.add(gltf.scene);
        // this.worldOctree.fromGraphNode(gltf.scene);
        // gltf.scene.traverse(child => {
        //     if (child.isMesh) {
        //         child.castShadow = true;
        //         child.receiveShadow = true;

        //         if (child.material.map) {
        //             // child.material.map = worldTexture;
        //             // child.material.map.flipY = false;
        //             // child.material.map.repeat.set(1, 1);
        //             child.material.map.anisotropy = 4;
        //         }
        //     }
        // });


    }

}