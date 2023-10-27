
//// From webxr_vr_dragging example https://threejs.org/examples/#webxr_vr_dragging
///
//// TO ACCESS 'ENTER VR' button you need to be in debug view here: https://cdpn.io/jason-buchheim/debug/zYqYGXM
///
// modified example to include a camera dolly that moves around using touchControllers while within webXR and provides haptic feedback
// by Jason Buchheim
// https://3d-360.com
// https://odysseyexpeditions.com

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.119.1/build/three.module.min.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/controls/OrbitControls.min.js";
import { VRButton } from "https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/webxr/VRButton.min.js";
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/webxr/XRControllerModelFactory.min.js";

var container;
var camera, scene, renderer;
var controller1, controller2;
var controllerGrip1, controllerGrip2;

var raycaster,
  intersected = [];
var tempMatrix = new THREE.Matrix4();

var controls, group;

var dolly;
var cameraVector = new THREE.Vector3(); // create once and reuse it!
// a variable to store the values from the last polling of the gamepads
const prevGamePads = new Map();

//default values for speed movement of each axis
var speedFactor = [0.1, 0.1, 0.1, 0.1];

init();
animate();

function init() {
  container = document.createElement("div");
  document.body.appendChild(container);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x808080);

  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(0, 1.6, 3);

  

  var geometry = new THREE.PlaneBufferGeometry(100, 100);
  var material = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 1.0,
    metalness: 0.0
  });
  var floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.HemisphereLight(0x808080, 0x606060));

  var light = new THREE.DirectionalLight(0xffffff);
  light.position.set(0, 200, 0);
  light.castShadow = true;
  light.shadow.camera.top = 200;
  light.shadow.camera.bottom = -200;
  light.shadow.camera.right = 200;
  light.shadow.camera.left = -200;
  light.shadow.mapSize.set(4096, 4096);
  scene.add(light);

  group = new THREE.Group();
  scene.add(group);

  var geometries = [
    new THREE.BoxBufferGeometry(0.2, 0.2, 0.2),
    new THREE.ConeBufferGeometry(0.2, 0.2, 64),
    new THREE.CylinderBufferGeometry(0.2, 0.2, 0.2, 64),
    new THREE.IcosahedronBufferGeometry(0.2, 3),
    new THREE.TorusBufferGeometry(0.2, 0.04, 64, 32)
  ];

  for (var i = 0; i < 100; i++) {
    var geometry = geometries[Math.floor(Math.random() * geometries.length)];
    var material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff,
      roughness: 0.7,
      side: THREE.DoubleSide,
      metalness: 0.0
    });

    var object = new THREE.Mesh(geometry, material);

    object.position.x = Math.random() * 200 - 100;
    object.position.y = Math.random() * 100;
    object.position.z = Math.random() * 200 - 100;

    object.rotation.x = Math.random() * 2 * Math.PI;
    object.rotation.y = Math.random() * 2 * Math.PI;
    object.rotation.z = Math.random() * 2 * Math.PI;

    object.scale.setScalar(Math.random() * 20 + 0.5);

    object.castShadow = true;
    object.receiveShadow = true;

    group.add(object);
  }

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true;
  //the following increases the resolution on Quest
  renderer.xr.setFramebufferScaleFactor(2.0);
  container.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));
  
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.6, 0);
  controls.update();
  
  // controllers
  controller1 = renderer.xr.getController(0);
  controller1.name="left";
  controller1.addEventListener("selectstart", onSelectStart);
  controller1.addEventListener("selectend", onSelectEnd);
  scene.add(controller1);

  controller2 = renderer.xr.getController(1);
  controller2.name="right";
  controller2.addEventListener("selectstart", onSelectStart);
  controller2.addEventListener("selectend", onSelectEnd);
  scene.add(controller2);

  var controllerModelFactory = new XRControllerModelFactory();

  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(
    controllerModelFactory.createControllerModel(controllerGrip1)
  );
  scene.add(controllerGrip1);

  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(
    controllerModelFactory.createControllerModel(controllerGrip2)
  );
  scene.add(controllerGrip2);

  //Raycaster Geometry
  var geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);

  var line = new THREE.Line(geometry);
  line.name = "line";
  line.scale.z = 5;

  controller1.add(line.clone());
  controller2.add(line.clone());

  raycaster = new THREE.Raycaster();

  //dolly for camera
  dolly = new THREE.Group();
  dolly.position.set(0, 0, 0);
  dolly.name = "dolly";
  scene.add(dolly);
  dolly.add(camera);
  //add the controls to the dolly also or they will not move with the dolly
  dolly.add(controller1);
  dolly.add(controller2);
  dolly.add(controllerGrip1);
  dolly.add(controllerGrip2);

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelectStart(event) {
  var controller = event.target;

  var intersections = getIntersections(controller);

  if (intersections.length > 0) {
    var intersection = intersections[0];
    var object = intersection.object;
    object.material.emissive.b = 1;
    controller.attach(object);
    controller.userData.selected = object;
  }
}

function onSelectEnd(event) {
  var controller = event.target;
  if (controller.userData.selected !== undefined) {
    var object = controller.userData.selected;
    object.material.emissive.b = 0;
    group.attach(object);
    controller.userData.selected = undefined;
  }
}

function getIntersections(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  return raycaster.intersectObjects(group.children);
}

function intersectObjects(controller) {
  // Do not highlight when already selected

  if (controller.userData.selected !== undefined) return;

  var line = controller.getObjectByName("line");
  var intersections = getIntersections(controller);

  if (intersections.length > 0) {
    var intersection = intersections[0];
    //provide haptic feedback if we are intersecting with an object
    const session = renderer.xr.getSession();
    if (session) {  //only if we are in a webXR session
      for (const sourceXR of session.inputSources) {

        if (!sourceXR.gamepad) continue;
        if (
          sourceXR &&
          sourceXR.gamepad &&
          sourceXR.gamepad.hapticActuators &&
          sourceXR.gamepad.hapticActuators[0] &&
          sourceXR.handedness == controller.name        
        ) {
          var didPulse = sourceXR.gamepad.hapticActuators[0].pulse(0.8, 100);
          var otherPulse = gamepadHapticActuatorInstance.pulse(0.8, 100);
        }
      }
    }

    var object = intersection.object;
    object.material.emissive.r = 1;
    intersected.push(object);

    line.scale.z = intersection.distance;
  } else {
    line.scale.z = 50;
  }
}

function cleanIntersected() {
  while (intersected.length) {
    var object = intersected.pop();
    object.material.emissive.r = 0;
  }
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render() {
  cleanIntersected();

  intersectObjects(controller1);
  intersectObjects(controller2);

  //add gamepad polling for webxr to renderloop
  dollyMove();

  renderer.render(scene, camera);
}

function dollyMove() {
  var handedness = "unknown";

  //determine if we are in an xr session
  const session = renderer.xr.getSession();
  let i = 0;

  if (session) {
    let xrCamera = renderer.xr.getCamera(camera);
    xrCamera.getWorldDirection(cameraVector);

    //a check to prevent console errors if only one input source
    if (isIterable(session.inputSources)) {
      for (const source of session.inputSources) {
        if (source && source.handedness) {
          handedness = source.handedness; //left or right controllers
        }
        if (!source.gamepad) continue;
        const controller = renderer.xr.getController(i++);
        const old = prevGamePads.get(source);
        const data = {
          handedness: handedness,
          buttons: source.gamepad.buttons.map((b) => b.value),
          axes: source.gamepad.axes.slice(0)
        };
        if (old) {
          data.buttons.forEach((value, i) => {
            //handlers for buttons
            if (value !== old.buttons[i] || Math.abs(value) > 0.8) {
              //check if it is 'all the way pushed'
              if (value === 1) {
                //console.log("Button" + i + "Down");
                if (data.handedness == "left") {
                  //console.log("Left Paddle Down");
                  if (i == 1) {
                    dolly.rotateY(-THREE.Math.degToRad(1));
                  }
                  if (i == 3) {
                    //reset teleport to home position
                    dolly.position.x = 0;
                    dolly.position.y = 5;
                    dolly.position.z = 0;
                  }
                } else {
                  //console.log("Right Paddle Down");
                  if (i == 1) {
                    dolly.rotateY(THREE.Math.degToRad(1));
                  }
                }
              } else {
                // console.log("Button" + i + "Up");

                if (i == 1) {
                  //use the paddle buttons to rotate
                  if (data.handedness == "left") {
                    //console.log("Left Paddle Down");
                    dolly.rotateY(-THREE.Math.degToRad(Math.abs(value)));
                  } else {
                    //console.log("Right Paddle Down");
                    dolly.rotateY(THREE.Math.degToRad(Math.abs(value)));
                  }
                }
              }
            }
          });
          data.axes.forEach((value, i) => {
            //handlers for thumbsticks
            //if thumbstick axis has moved beyond the minimum threshold from center, windows mixed reality seems to wander up to about .17 with no input
            if (Math.abs(value) > 0.2) {
              //set the speedFactor per axis, with acceleration when holding above threshold, up to a max speed
              speedFactor[i] > 1 ? (speedFactor[i] = 1) : (speedFactor[i] *= 1.001);
              console.log(value, speedFactor[i], i);
              if (i == 2) {
                //left and right axis on thumbsticks
                if (data.handedness == "left") {
                  // (data.axes[2] > 0) ? console.log('left on left thumbstick') : console.log('right on left thumbstick')

                  //move our dolly
                  //we reverse the vectors 90degrees so we can do straffing side to side movement
                  dolly.position.x -= cameraVector.z * speedFactor[i] * data.axes[2];
                  dolly.position.z += cameraVector.x * speedFactor[i] * data.axes[2];

                  //provide haptic feedback if available in browser
                  if (
                    source.gamepad.hapticActuators &&
                    source.gamepad.hapticActuators[0]
                  ) {
                    var pulseStrength = Math.abs(data.axes[2]) + Math.abs(data.axes[3]);
                    if (pulseStrength > 0.75) {
                      pulseStrength = 0.75;
                    }

                    var didPulse = source.gamepad.hapticActuators[0].pulse(
                      pulseStrength,
                      100
                    );
                  }
                } else {
                  // (data.axes[2] > 0) ? console.log('left on right thumbstick') : console.log('right on right thumbstick')
                  dolly.rotateY(-THREE.Math.degToRad(data.axes[2]));
                }
                controls.update();
              }

              if (i == 3) {
                //up and down axis on thumbsticks
                if (data.handedness == "left") {
                  // (data.axes[3] > 0) ? console.log('up on left thumbstick') : console.log('down on left thumbstick')
                  dolly.position.y -= speedFactor[i] * data.axes[3];
                  //provide haptic feedback if available in browser
                  if (
                    source.gamepad.hapticActuators &&
                    source.gamepad.hapticActuators[0]
                  ) {
                    var pulseStrength = Math.abs(data.axes[3]);
                    if (pulseStrength > 0.75) {
                      pulseStrength = 0.75;
                    }
                    var didPulse = source.gamepad.hapticActuators[0].pulse(
                      pulseStrength,
                      100
                    );
                  }
                } else {
                  // (data.axes[3] > 0) ? console.log('up on right thumbstick') : console.log('down on right thumbstick')
                  dolly.position.x -= cameraVector.x * speedFactor[i] * data.axes[3];
                  dolly.position.z -= cameraVector.z * speedFactor[i] * data.axes[3];

                  //provide haptic feedback if available in browser
                  if (
                    source.gamepad.hapticActuators &&
                    source.gamepad.hapticActuators[0]
                  ) {
                    var pulseStrength = Math.abs(data.axes[2]) + Math.abs(data.axes[3]);
                    if (pulseStrength > 0.75) {
                      pulseStrength = 0.75;
                    }
                    var didPulse = source.gamepad.hapticActuators[0].pulse(
                      pulseStrength,
                      100
                    );
                  }
                }
                controls.update();
              }
            } else {
              //axis below threshold - reset the speedFactor if it is greater than zero  or 0.025 but below our threshold
              if (Math.abs(value) > 0.025) {
                speedFactor[i] = 0.025;
              }
            }
          });
        }
        prevGamePads.set(source, data);
      }
    }
  }
}

function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === "function";
}