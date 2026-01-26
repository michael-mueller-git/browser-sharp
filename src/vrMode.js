import { XrHands } from "@sparkjsdev/spark";
import { VRButton } from "./vrButton.ts";
import {
  renderer,
  camera,
  controls,
  scene,
  currentMesh,
  requestRender,
  suspendRenderLoop,
  resumeRenderLoop,
  THREE,
} from "./viewer.js";
import { useStore } from "./store.js";
import { restoreHomeView } from "./cameraUtils.js";
import { loadNextAsset, loadPrevAsset } from "./fileLoader.js";

let vrButton = null;
let xrHands = null;
let xrHandMesh = null;
let initialModelScale = null;
let initialModelPosition = null;
let initialModelQuaternion = null; // Store initial rotation
let keyListenerAttached = false;

// Controller tracking
let xrControllers = [];
const grabState = {
  right: { active: false, relativePos: null, relativeQuat: null },
  left: { active: false, relativePos: null, relativeQuat: null }
};

// Quest controller button indices (xr-standard mapping, per controller)
const BTN_TRIGGER = 0;
const BTN_GRIP = 1;
const BTN_TOUCHPAD = 2; // placeholder on Quest
const BTN_THUMBSTICK = 3;
const BTN_A_OR_X = 4; // A on right, X on left
const BTN_B_OR_Y = 5; // B on right, Y on left

// Axes indices
const AXIS_THUMBSTICK_X = 2;
const AXIS_THUMBSTICK_Y = 3;

// Tuning constants
const SCALE_STEP = 1.5; // for button presses
const MIN_SCALE = 0.02;
const MAX_SCALE = 20.0;
const STICK_DEADZONE = 0.15;
const TRANSLATE_SPEED = 1.0; // units per second for panning (base speed)
const DEPTH_SPEED = 1.5; // units per second for push/pull
const ROTATION_SPEED = 0.6; // radians per second for model rotation
const AXIS_LOCK_THRESHOLD = 0.25; // minimum deflection to lock axis
const MIN_VR_SCREEN_WIDTH = 768;
const MIN_VR_SCREEN_HEIGHT = 480;

// Axis locking state for rotation
let lockedRotationAxis = null; // 'x', 'y', or null

// Debounce tracking for button presses
const BUTTON_COOLDOWN_MS = 300;
let lastResetMs = 0;
let lastRotResetMs = 0;
let lastNextMs = 0;
let lastPrevMs = 0;
let lastScaleUpMs = 0;
let lastScaleDownMs = 0;

let vrSupportCheckPromise = null;

const isSmallScreen = () => {
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  return w < MIN_VR_SCREEN_WIDTH || h < MIN_VR_SCREEN_HEIGHT;
};

const checkVrSupport = async () => {
  const store = useStore.getState();

  if (isSmallScreen()) {
    store.setVrSupported(false);
    return { ok: false, reason: "small-screen" };
  }

  if (!navigator?.xr || typeof navigator.xr.isSessionSupported !== "function") {
    store.setVrSupported(false);
    return { ok: false, reason: "no-webxr" };
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-vr");
    store.setVrSupported(Boolean(supported));
    return { ok: Boolean(supported), reason: supported ? null : "unsupported" };
  } catch (err) {
    console.warn("WebXR support probe failed:", err);
    store.setVrSupported(false);
    return { ok: false, reason: "probe-error", error: err };
  }
};

const scaleModel = (multiplier) => {
  const store = useStore.getState();
  if (!currentMesh || !initialModelScale) return;

  const prevScale = store.vrModelScale || 1;
  const nextScale = THREE.MathUtils.clamp(prevScale * multiplier, MIN_SCALE, MAX_SCALE);
  if (nextScale === prevScale) return;

  const ratio = nextScale / prevScale;
  currentMesh.scale.multiplyScalar(ratio);
  store.setVrModelScale(nextScale);
  requestRender();
};

const restoreModelTransform = () => {
  const store = useStore.getState();
  if (currentMesh && initialModelScale) {
    currentMesh.scale.copy(initialModelScale);
  }
  if (currentMesh && initialModelPosition) {
    currentMesh.position.copy(initialModelPosition);
  }
  if (currentMesh && initialModelQuaternion) {
    currentMesh.quaternion.copy(initialModelQuaternion);
  }
  store.setVrModelScale(1);
  initialModelScale = null;
  initialModelPosition = null;
  initialModelQuaternion = null;
};

const resetRotationOnly = () => {
  if (currentMesh && initialModelQuaternion) {
    currentMesh.quaternion.copy(initialModelQuaternion);
    requestRender();
  }
};

const handleScaleKeydown = (event) => {
  if (!useStore.getState().vrSessionActive) return;
  if (event.key === "+" || event.key === "=") {
    scaleModel(SCALE_STEP);
  } else if (event.key === "-" || event.key === "_") {
    scaleModel(1 / SCALE_STEP);
  }
};

const ensureHands = () => {
  if (!xrHands) {
    xrHands = new XrHands();
    xrHandMesh = xrHands.makeGhostMesh();
    if (xrHandMesh) {
      xrHandMesh.editable = false;
    }
  }

  if (xrHandMesh && !scene.children.includes(xrHandMesh)) {
    scene.add(xrHandMesh);
  }
};

const removeHands = () => {
  if (xrHandMesh && scene.children.includes(xrHandMesh)) {
    scene.remove(xrHandMesh);
  }
};

const onControllerConnected = (event) => {
  const controller = event.target;
  controller.userData.handedness = event.data.handedness;
};

const onControllerDisconnected = (event) => {
  const controller = event.target;
  controller.userData.handedness = null;
};

const setupControllers = () => {
  // Initialize controller objects
  if (xrControllers.length === 0 && renderer?.xr) {
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      controller.addEventListener('connected', onControllerConnected);
      controller.addEventListener('disconnected', onControllerDisconnected);
      xrControllers.push(controller);
      scene.add(controller);
    }
  }
};

const removeControllers = () => {
  xrControllers.forEach(c => {
    c.removeEventListener('connected', onControllerConnected);
    c.removeEventListener('disconnected', onControllerDisconnected);
    scene.remove(c);
  });
  xrControllers = [];
};

const setupVrAnimationLoop = () => {
  if (!renderer) return;
  let lastTime = performance.now();
  renderer.setAnimationLoop((time, xrFrame) => {
    const dt = Math.max(0.001, (time - lastTime) / 1000);
    lastTime = time;

    if (xrHands && xrHandMesh) {
      xrHands.update({ xr: renderer.xr, xrFrame });
    }

    handleVrGamepadInput(dt);

    renderer.render(scene, camera);
  });
};

const stopVrAnimationLoop = () => {
  if (!renderer) return;
  renderer.setAnimationLoop(null);
};

const performVrReset = () => {
  restoreHomeView();
  prepareVrCameraStart();
  if (initialModelPosition && currentMesh) {
    currentMesh.position.copy(initialModelPosition);
  }
  if (initialModelScale && currentMesh) {
    currentMesh.scale.copy(initialModelScale);
    useStore.getState().setVrModelScale(1);
  }
  if (initialModelQuaternion && currentMesh) {
    currentMesh.quaternion.copy(initialModelQuaternion);
  }
  requestRender();
};

const handleVrGamepadInput = (dt) => {
  const session = renderer?.xr?.getSession?.();
  if (!session) return;

  const now = performance.now();
  const ANALOG_SCALE_SPEED = 2.0;

  for (const source of session.inputSources) {
    const gp = source?.gamepad;
    const hand = source?.handedness || "unknown";
    if (!gp) continue;

    const axes = gp.axes || [];
    const buttons = gp.buttons || [];

    // Get thumbstick values (axes 2 and 3 for xr-standard)
    const stickY = axes[AXIS_THUMBSTICK_Y] ?? 0;

    // Button helpers
    const isPressed = (idx) => buttons[idx]?.pressed ?? false;

    const controllerObject = xrControllers.find(c => c.userData.handedness === hand);
    const gripValue = buttons[BTN_GRIP]?.value ?? 0;
    const isGrabbing = gripValue > 0.5;

    // GRAB LOGIC
    if (currentMesh && controllerObject && isGrabbing) {
      if (!grabState[hand].active) {
        // Start grab: Store relationship
        grabState[hand].active = true;
        grabState[hand].relativePos = controllerObject.worldToLocal(currentMesh.position.clone());
        grabState[hand].relativeQuat = controllerObject.quaternion.clone().invert().multiply(currentMesh.quaternion);
      } else {
        // Maintain grab: Apply transform
        const newPos = controllerObject.localToWorld(grabState[hand].relativePos.clone());
        const newQuat = controllerObject.quaternion.clone().multiply(grabState[hand].relativeQuat);
        currentMesh.position.copy(newPos);
        currentMesh.quaternion.copy(newQuat);
        requestRender();
      }
    } else {
      grabState[hand].active = false;

      // THUMBSTICK SCALING (When not grabbing)
      if (Math.abs(stickY) > STICK_DEADZONE) {
        // stickY is -1 for Up (increase), 1 for Down (decrease)
        // Invert stickY so Up is positive factor
        const direction = -stickY;
        const factor = 1.0 + (direction * ANALOG_SCALE_SPEED * dt);
        scaleModel(factor);
      }
    }

    // Thumbstick click: reset
    if (isPressed(BTN_THUMBSTICK)) {
      if (now - lastResetMs > BUTTON_COOLDOWN_MS) {
        if (hand === "left") {
             resetRotationOnly();
             lastRotResetMs = now;
        } else {
             performVrReset();
             lastResetMs = now;
        }
      }
    }

    // Keep A/B/X/Y buttons for discrete scaling or asset navigation
    if (hand === "right") {
       // B button: next image
       if (isPressed(BTN_B_OR_Y)) {
         if (now - lastNextMs > BUTTON_COOLDOWN_MS) {
           loadNextAsset();
           lastNextMs = now;
         }
       }
       // A button: previous image
       if (isPressed(BTN_A_OR_X)) {
         if (now - lastPrevMs > BUTTON_COOLDOWN_MS) {
           loadPrevAsset();
           lastPrevMs = now;
         }
       }
    } else if (hand === "left") {
       // Y/X for discrete scaling (optional, but keeping as backup)
       if (isPressed(BTN_B_OR_Y)) {
         if (now - lastScaleUpMs > BUTTON_COOLDOWN_MS) {
           scaleModel(SCALE_STEP);
           lastScaleUpMs = now;
         }
       }
       if (isPressed(BTN_A_OR_X)) {
         if (now - lastScaleDownMs > BUTTON_COOLDOWN_MS) {
           scaleModel(1 / SCALE_STEP);
           lastScaleDownMs = now;
         }
       }
    }
  }
};

const prepareVrCameraStart = () => {
  if (!camera) return;
  const target = controls?.target?.clone?.() ?? new THREE.Vector3();
  const offset = new THREE.Vector3().subVectors(camera.position, target);
  const baseDist = offset.length() || 1;
  const dir = offset.normalize();
  const startDist = baseDist * 1.2 + 0.5;
  camera.position.copy(target).addScaledVector(dir, startDist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
};

const handleSessionStart = () => {
  const store = useStore.getState();
  store.setVrSessionActive(true);

  suspendRenderLoop();
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType?.("local-floor");
  if (controls) controls.enabled = false;

  prepareVrCameraStart();
  initialModelScale = currentMesh?.scale?.clone() ?? null;
  initialModelPosition = currentMesh?.position?.clone() ?? null;
  initialModelQuaternion = currentMesh?.quaternion?.clone() ?? null; // Store initial rotation
  store.setVrModelScale(1);
  ensureHands();
  setupControllers();
  setupVrAnimationLoop();

  if (!keyListenerAttached) {
    window.addEventListener("keydown", handleScaleKeydown);
    keyListenerAttached = true;
  }
};

const handleSessionEnd = () => {
  const store = useStore.getState();

  stopVrAnimationLoop();
  renderer.xr.enabled = false;
  if (controls) controls.enabled = true;
  restoreModelTransform();
  removeHands();
  removeControllers();
  if (keyListenerAttached) {
    window.removeEventListener("keydown", handleScaleKeydown);
    keyListenerAttached = false;
  }
  
  // Restore camera to home view after VR session
  restoreHomeView();
  
  resumeRenderLoop();
  requestRender();
  store.setVrSessionActive(false);
};

const attachSessionListeners = () => {
  if (!renderer || !renderer.xr) return;
  renderer.xr.removeEventListener?.("sessionstart", handleSessionStart);
  renderer.xr.removeEventListener?.("sessionend", handleSessionEnd);
  renderer.xr.addEventListener?.("sessionstart", handleSessionStart);
  renderer.xr.addEventListener?.("sessionend", handleSessionEnd);
};

export const initVrSupport = async (containerEl) => {
  const store = useStore.getState();

  if (!renderer || vrButton) return vrButton;

  if (!vrSupportCheckPromise) {
    vrSupportCheckPromise = checkVrSupport();
  }

  const support = await vrSupportCheckPromise;
  if (!support?.ok) {
    return null;
  }

  try {
    vrButton = VRButton.createButton(renderer, {
      optionalFeatures: ["hand-tracking"],
    }, "immersive-ar");
  } catch (err) {
    console.warn("VR button creation failed:", err);
    store.setVrSupported(false);
    return null;
  }

  if (!vrButton) {
    store.setVrSupported(false);
    return null;
  }

  // Do NOT append to DOM - the button auto-shows itself when VR is supported.
  // Keep it detached and just click it programmatically via enterVrSession().
  vrButton.style.display = "none";
  attachSessionListeners();
  store.setVrSupported(true);
  return vrButton;
};

export const enterVrSession = async () => {
  const store = useStore.getState();
  
  // If already in a VR session, exit it
  const currentSession = renderer?.xr?.getSession?.();
  if (currentSession) {
    try {
      await currentSession.end();
    } catch (err) {
      console.warn("Failed to end VR session:", err);
    }
    return true;
  }
  
  // Otherwise, start a new session
  const viewer = document.getElementById("viewer");
  const button = vrButton || await initVrSupport(viewer);
  if (!button) {
    store.addLog?.("VR not available on this device");
    return false;
  }

  try {
    button.click();
    return true;
  } catch (err) {
    store.addLog?.("Failed to start VR session");
    console.warn("VR start failed:", err);
    return false;
  }
};
