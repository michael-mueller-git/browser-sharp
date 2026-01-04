import { camera, controls, requestRender, THREE } from "./viewer.js";
import { useStore } from "./store.js";

// Get store state
const getStoreState = () => useStore.getState();

let animationState = null;
let resetAnimationState = null;
let anchorAnimationState = null;

// Easing functions
const easingFunctions = {
  'linear': (t) => t,
  'ease-in': (t) => t * t * t,
  'ease-out': (t) => 1 - Math.pow(1 - t, 3),
  'ease-in-out': (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

// Sweep direction presets (startDeg is the offset from center)
const sweepPresets = {
  left: { axis: 'up', direction: 1 },
  right: { axis: 'up', direction: -1 },
  up: { axis: 'right', direction: -1 },
  down: { axis: 'right', direction: 1 },
};

// Intensity presets
const intensityPresets = {
  subtle: { zoomFactor: 0.05, duration: 1200, sweepDegrees: 4 },
  medium: { zoomFactor: 0.1, duration: 1800, sweepDegrees: 8 },
  dramatic: { zoomFactor: 0.15, duration: 2400, sweepDegrees: 12 },
};

const validDirections = ['left', 'right', 'up', 'down', 'none'];

// Get animation settings from store
const getAnimationEnabled = () => getStoreState().animationEnabled;

export const isLoadAnimationEnabled = () => getAnimationEnabled();

export const setLoadAnimationEnabled = (enabled) => {
  getStoreState().setAnimationEnabled(enabled);
};

export const cancelLoadZoomAnimation = () => {
  if (animationState?.frameId) {
    cancelAnimationFrame(animationState.frameId);
  }
  if (animationState) {
    controls.enabled = animationState.wasEnabled;
    controls.update();
    requestRender();
  }
  animationState = null;
};

export const getLoadAnimationIntensityKey = () => getStoreState().animationIntensity;

export const setLoadAnimationIntensity = (key) => {
  if (intensityPresets[key] || key === 'custom') {
    getStoreState().setAnimationIntensity(key);
    return key;
  }
  return getStoreState().animationIntensity;
};

export const getLoadAnimationDirection = () => getStoreState().animationDirection;

export const setLoadAnimationDirection = (direction) => {
  const normalized = direction?.toLowerCase?.();
  if (validDirections.includes(normalized)) {
    getStoreState().setAnimationDirection(normalized);
    return normalized;
  }
  return getStoreState().animationDirection;
};

/**
 * Builds animation parameters from either a preset or custom settings.
 */
const buildAnimationParams = (distance) => {
  const state = getStoreState();
  const intensityKey = state.animationIntensity;
  
  if (intensityKey === 'custom') {
    const custom = state.customAnimation;
    const duration = custom.duration * 1000; // Convert to ms
    const easing = easingFunctions[custom.easing] ?? easingFunctions['ease-in-out'];
    
    // Rotation params
    const rotationType = custom.rotationType;
    const sweepDegrees = rotationType === 'none' ? 0 : custom.rotation;
    const sweepPreset = sweepPresets[rotationType] ?? null;
    
    // Zoom params - animation behavior:
    // zoomIn: start slightly before baseline → end zoomed in past baseline
    // zoomOut: start close → end at baseline (no overshoot)
    const zoomType = custom.zoomType;
    const zoomAmount = custom.zoom * 0.15; // Scale to reasonable range
    let startZoomOffset = 0;
    let endZoomOffset = 0;
    if (zoomType === 'in') {
      startZoomOffset = zoomAmount * 0.2;   // Start slightly before baseline (20% of zoom amount)
      endZoomOffset = -zoomAmount * 0.3;    // End zoomed in past baseline
    } else if (zoomType === 'out') {
      startZoomOffset = -zoomAmount * 0.5;  // Start zoomed in
      endZoomOffset = 0;                    // End at baseline (no overshoot)
    }
    
    return { duration, easing, sweepDegrees, sweepPreset, startZoomOffset, endZoomOffset };
  }
  
  // Use preset (presets zoom out then settle at baseline)
  const preset = intensityPresets[intensityKey] ?? intensityPresets.medium;
  const direction = state.animationDirection;
  const sweepPreset = direction === 'none' ? null : (sweepPresets[direction] ?? sweepPresets.left);
  
  return {
    duration: preset.duration,
    easing: easingFunctions['ease-out'],
    sweepDegrees: preset.sweepDegrees,
    sweepPreset,
    startZoomOffset: preset.zoomFactor,
    endZoomOffset: 0,
  };
};

export const startLoadZoomAnimation = (options = {}) => {
  const normalizedOptions = typeof options === 'string' ? { direction: options } : options ?? {};
  const forcePlayback = Boolean(normalizedOptions.force);

  if (!camera || !controls || (!getAnimationEnabled() && !forcePlayback)) return;

  const baseOffset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const distance = baseOffset.length();
  if (!Number.isFinite(distance) || distance <= 0.01) return;

  const { duration, easing, sweepDegrees, sweepPreset, startZoomOffset, endZoomOffset } = buildAnimationParams(distance);
  
  // Skip if nothing to animate
  if (duration <= 0 || (sweepDegrees === 0 && startZoomOffset === 0 && endZoomOffset === 0)) return;

  // Calculate axis vectors
  const upVector = (controls.object?.up ?? controls.up ?? new THREE.Vector3(0, 1, 0)).clone().normalize();
  const rightVector = new THREE.Vector3().copy(baseOffset).cross(upVector);
  if (rightVector.lengthSq() < 1e-6) {
    rightVector.copy(upVector).cross(new THREE.Vector3(1, 0, 0));
    if (rightVector.lengthSq() < 1e-6) {
      rightVector.copy(upVector).cross(new THREE.Vector3(0, 0, 1));
    }
  }
  rightVector.normalize();

  // Determine sweep axis and angle
  const axisVector = sweepPreset
    ? (sweepPreset.axis === 'right' ? rightVector : upVector).clone()
    : upVector.clone();
  const startAngle = sweepPreset
    ? THREE.MathUtils.degToRad(sweepDegrees * sweepPreset.direction)
    : 0;
  const endAngle = 0;

  // Determine zoom radii (animation passes through baseline)
  const startRadius = distance * (1 + startZoomOffset);
  const endRadius = distance * (1 + endZoomOffset);

  // Store target and set initial position
  const animTarget = controls.target.clone();
  const initialOffset = baseOffset.clone().applyAxisAngle(axisVector, startAngle).setLength(startRadius);
  camera.position.copy(animTarget).add(initialOffset);
  camera.lookAt(animTarget);

  const wasEnabled = controls.enabled;
  controls.enabled = false;
  requestRender();

  cancelLoadZoomAnimation();

  const animate = (timestamp) => {
    if (!animationState) return;

    if (animationState.startTime == null) {
      animationState.startTime = timestamp;
    }

    const elapsed = timestamp - animationState.startTime;
    const t = Math.min(elapsed / animationState.duration, 1);
    const eased = animationState.easing(t);

    const angle = THREE.MathUtils.lerp(animationState.startAngle, animationState.endAngle, eased);
    const radius = THREE.MathUtils.lerp(animationState.startRadius, animationState.endRadius, eased);
    const offset = animationState.baseOffset
      .clone()
      .applyAxisAngle(animationState.axisVector, angle)
      .setLength(radius);
    camera.position.copy(animationState.animTarget).add(offset);
    camera.lookAt(animationState.animTarget);
    requestRender();

    if (t < 1) {
      animationState.frameId = requestAnimationFrame(animate);
    } else {
      controls.enabled = animationState.wasEnabled;
      controls.update();
      requestRender();
      animationState = null;
    }
  };

  animationState = {
    frameId: requestAnimationFrame(animate),
    startTime: null,
    baseOffset,
    axisVector,
    startAngle,
    endAngle,
    startRadius,
    endRadius,
    duration,
    easing,
    animTarget,
    wasEnabled,
  };
};

// Smooth reset animation
const easeInOutCubic = easingFunctions['ease-in-out'];

export const cancelResetAnimation = () => {
  if (resetAnimationState?.frameId) {
    cancelAnimationFrame(resetAnimationState.frameId);
  }
  resetAnimationState = null;
};

export const startSmoothResetAnimation = (targetState, { duration = 800, onComplete } = {}) => {
  if (!camera || !controls || !targetState) return;

  cancelLoadZoomAnimation();
  cancelResetAnimation();

  const startState = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    fov: camera.fov,
    near: camera.near,
    far: camera.far,
    zoom: camera.zoom,
    target: controls.target.clone(),
  };

  const animate = (timestamp) => {
    if (!resetAnimationState) return;

    if (resetAnimationState.startTime == null) {
      resetAnimationState.startTime = timestamp;
    }

    const elapsed = timestamp - resetAnimationState.startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(t);

    // Lerp position
    camera.position.lerpVectors(startState.position, targetState.position, eased);

    // Slerp quaternion for smooth rotation
    camera.quaternion.slerpQuaternions(startState.quaternion, targetState.quaternion, eased);

    // Lerp FOV, near, far, zoom
    camera.fov = THREE.MathUtils.lerp(startState.fov, targetState.fov, eased);
    camera.near = THREE.MathUtils.lerp(startState.near, targetState.near, eased);
    camera.far = THREE.MathUtils.lerp(startState.far, targetState.far, eased);
    camera.zoom = THREE.MathUtils.lerp(startState.zoom, targetState.zoom, eased);
    camera.updateProjectionMatrix();

    // Lerp controls target
    controls.target.lerpVectors(startState.target, targetState.target, eased);
    controls.update();

    requestRender();

    if (t < 1) {
      resetAnimationState.frameId = requestAnimationFrame(animate);
    } else {
      resetAnimationState = null;
      if (onComplete) onComplete();
    }
  };

  resetAnimationState = {
    frameId: requestAnimationFrame(animate),
    startTime: null,
  };
};

export const cancelAnchorTransition = () => {
  if (anchorAnimationState?.frameId) {
    cancelAnimationFrame(anchorAnimationState.frameId);
  }
  anchorAnimationState = null;
};

export const startAnchorTransition = (nextTarget, { duration = 650, onComplete } = {}) => {
  if (!camera || !controls || !nextTarget) return;

  const currentTarget = controls.target.clone();
  if (currentTarget.distanceTo(nextTarget) < 1e-5) {
    controls.target.copy(nextTarget);
    controls.update();
    requestRender();
    if (typeof onComplete === "function") onComplete();
    return;
  }

  cancelAnchorTransition();
  cancelLoadZoomAnimation();

  const animate = (timestamp) => {
    if (!anchorAnimationState) return;
    if (anchorAnimationState.startTime == null) {
      anchorAnimationState.startTime = timestamp;
    }

    const elapsed = timestamp - anchorAnimationState.startTime;
    const t = Math.min(elapsed / anchorAnimationState.duration, 1);
    const eased = easeInOutCubic(t);

    const currentAnchor = new THREE.Vector3().lerpVectors(anchorAnimationState.startTarget, anchorAnimationState.endTarget, eased);

    controls.target.copy(currentAnchor);
    controls.update();
    requestRender();

    if (t < 1) {
      anchorAnimationState.frameId = requestAnimationFrame(animate);
    } else {
      anchorAnimationState = null;
      if (onComplete) onComplete();
    }
  };

  anchorAnimationState = {
    frameId: requestAnimationFrame(animate),
    startTime: null,
    duration,
    startTarget: currentTarget,
    endTarget: nextTarget.clone(),
  };
};
