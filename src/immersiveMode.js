/**
 * Immersive Mode - Device orientation-based camera control
 * 
 * Maps device rotation to camera orbit for a parallax effect.
 * Tilting the device orbits the camera around the target.
 */

import { camera, controls, requestRender, THREE } from './viewer.js';
import { useStore } from './store.js';
import { setLoadAnimationEnabled } from './cameraAnimations.js';

// State
let isActive = false;
let baseQuaternion = null;
let baseSpherical = null;
let lastBeta = null;
let lastGamma = null;

// Sensitivity settings
const SENSITIVITY = {
  tilt: 0.015,      // How much camera moves per degree of device tilt
  maxAngle: 15,     // Maximum degrees of camera orbit from center
  smoothing: 0.15,  // Smoothing factor (0-1, lower = smoother)
};

// Smoothed values
let smoothedBeta = 0;
let smoothedGamma = 0;

/**
 * Gets the current immersive mode state from store.
 */
const getImmersiveMode = () => useStore.getState().immersiveMode;

/**
 * Requests permission for device orientation on iOS 13+.
 * Returns true if permission granted or not needed.
 */
export const requestOrientationPermission = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.warn('Device orientation permission denied:', err);
      return false;
    }
  }
  // Permission not required on this device
  return true;
};

/**
 * Handles device orientation event.
 * Maps beta (front-back tilt) and gamma (left-right tilt) to camera orbit.
 */
const handleDeviceOrientation = (event) => {
  if (!isActive || !camera || !controls) return;
  
  const { beta, gamma } = event;
  
  // beta: front-back tilt (-180 to 180, 0 when flat)
  // gamma: left-right tilt (-90 to 90, 0 when flat)
  
  if (beta === null || gamma === null) return;
  
  // Initialize base values on first reading
  if (lastBeta === null) {
    lastBeta = beta;
    lastGamma = gamma;
    smoothedBeta = 0;
    smoothedGamma = 0;
    
    // Capture current camera position as baseline
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    baseSpherical = new THREE.Spherical().setFromVector3(offset);
    return;
  }
  
  // Calculate delta from initial orientation
  let deltaBeta = beta - lastBeta;
  let deltaGamma = gamma - lastGamma;
  
  // Handle wrap-around for beta
  if (deltaBeta > 180) deltaBeta -= 360;
  if (deltaBeta < -180) deltaBeta += 360;
  
  // Clamp to max angle
  deltaBeta = THREE.MathUtils.clamp(deltaBeta, -SENSITIVITY.maxAngle, SENSITIVITY.maxAngle);
  deltaGamma = THREE.MathUtils.clamp(deltaGamma, -SENSITIVITY.maxAngle, SENSITIVITY.maxAngle);
  
  // Apply smoothing
  smoothedBeta += (deltaBeta - smoothedBeta) * SENSITIVITY.smoothing;
  smoothedGamma += (deltaGamma - smoothedGamma) * SENSITIVITY.smoothing;
  
  // Apply to camera orbit
  if (baseSpherical) {
    const newSpherical = baseSpherical.clone();
    
    // Map device tilt to camera orbit
    // Gamma (left-right tilt) -> azimuthal angle (horizontal orbit)
    // Beta (front-back tilt) -> polar angle (vertical orbit)
    newSpherical.theta = baseSpherical.theta - smoothedGamma * SENSITIVITY.tilt;
    newSpherical.phi = baseSpherical.phi - smoothedBeta * SENSITIVITY.tilt;
    
    // Clamp phi to avoid flipping
    newSpherical.phi = THREE.MathUtils.clamp(
      newSpherical.phi,
      0.1,
      Math.PI - 0.1
    );
    
    // Apply to camera position
    const offset = new THREE.Vector3().setFromSpherical(newSpherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    
    requestRender();
  }
};

/**
 * Enables immersive mode.
 * Disables orbit controls and starts listening to device orientation.
 */
export const enableImmersiveMode = async () => {
  if (isActive) return true;
  
  // Request permission if needed (iOS)
  const hasPermission = await requestOrientationPermission();
  if (!hasPermission) {
    console.warn('Immersive mode requires device orientation permission');
    return false;
  }
  
  // Disable load animations
  setLoadAnimationEnabled(false);
  
  // Disable orbit controls drag (but keep zoom/pan)
  if (controls) {
    controls.enableRotate = false;
  }
  
  // Reset state
  lastBeta = null;
  lastGamma = null;
  smoothedBeta = 0;
  smoothedGamma = 0;
  baseSpherical = null;
  
  // Start listening to device orientation
  window.addEventListener('deviceorientation', handleDeviceOrientation, true);
  
  isActive = true;
  console.log('Immersive mode enabled');
  return true;
};

/**
 * Disables immersive mode.
 * Re-enables orbit controls and stops listening to device orientation.
 */
export const disableImmersiveMode = () => {
  if (!isActive) return;
  
  // Stop listening to device orientation
  window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
  
  // Re-enable orbit controls
  if (controls) {
    controls.enableRotate = true;
  }
  
  // Re-enable load animations (restore from store)
  const storedAnimationEnabled = useStore.getState().animationEnabled;
  setLoadAnimationEnabled(storedAnimationEnabled);
  
  // Reset state
  isActive = false;
  lastBeta = null;
  lastGamma = null;
  baseSpherical = null;
  
  console.log('Immersive mode disabled');
};

/**
 * Toggles immersive mode.
 */
export const toggleImmersiveMode = async () => {
  if (isActive) {
    disableImmersiveMode();
    return false;
  } else {
    return await enableImmersiveMode();
  }
};

/**
 * Resets the baseline orientation to current device position.
 * Call this to re-center the parallax effect.
 */
export const resetImmersiveBaseline = () => {
  lastBeta = null;
  lastGamma = null;
  smoothedBeta = 0;
  smoothedGamma = 0;
  baseSpherical = null;
};

/**
 * Returns whether immersive mode is currently active.
 */
export const isImmersiveModeActive = () => isActive;
