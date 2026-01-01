/**
 * Camera controls component for adjusting FOV, orbit range, and view positioning.
 * Provides sliders for camera parameters and buttons for view manipulation.
 */

import { useEffect, useRef } from 'preact/hooks';
import { useStore } from '../store';
import { camera, controls, defaultCamera, defaultControls, dollyZoomBaseDistance, dollyZoomBaseFov, requestRender, THREE } from '../viewer';
import { applyCameraRangeDegrees, restoreHomeView } from '../cameraUtils';
import { currentMesh, raycaster, SplatMesh, scene } from '../viewer';
import { updateDollyZoomBaselineFromCamera } from '../viewer';
import { startAnchorTransition } from '../cameraAnimations';

/** Default orbit range in degrees */
const DEFAULT_CAMERA_RANGE_DEGREES = 8;

/**
 * Clamps a value between min and max bounds.
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @returns {number} Clamped value
 */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Converts a linear slider value (0-180) to non-linear degrees.
 * Uses piecewise linear mapping for finer control at lower values:
 * - 0-50% slider → 0-10° (fine control)
 * - 50-85% slider → 10-30° (medium control)
 * - 85-100% slider → 30-180° (coarse control)
 * @param {number} sliderValue - Slider value between 0 and 180
 * @returns {number} Degrees between 0 and 180
 */
const sliderValueToDegrees = (sliderValue) => {
  const t = clamp(sliderValue / 180, 0, 1);
  if (t <= 0.5) {
    return 20 * t;
  }
  if (t <= 0.85) {
    const localT = (t - 0.5) / 0.35;
    return 10 + 20 * localT;
  }
  const localT = (t - 0.85) / 0.15;
  return 30 + 150 * localT;
};

/**
 * Converts degrees to a linear slider value (0-180).
 * Inverse of sliderValueToDegrees for initializing slider position.
 * @param {number} degrees - Degrees between 0 and 180
 * @returns {number} Slider value between 0 and 180
 */
const degreesToSliderValue = (degrees) => {
  const clamped = clamp(degrees, 0, 180);
  if (clamped <= 10) {
    return (clamped / 20) * 180;
  }
  if (clamped <= 30) {
    const localT = (clamped - 10) / 20;
    return (0.5 + 0.35 * localT) * 180;
  }
  const localT = (clamped - 30) / 150;
  return (0.85 + 0.15 * localT) * 180;
};

/**
 * Formats degrees for display, using 1 decimal place for small values.
 * @param {number} degrees - Angle in degrees
 * @returns {string} Formatted string
 */
const formatDegrees = (degrees) => (degrees < 10 ? degrees.toFixed(1) : degrees.toFixed(0));

/**
 * Updates orbit controls speed based on current FOV.
 * Slower controls at narrower FOV for precision, faster at wider FOV.
 * @param {number} fov - Current field of view in degrees
 */
const updateControlSpeedsForFov = (fov) => {
  if (!controls) return;
  const fovScale = THREE.MathUtils.clamp(fov / defaultCamera.fov, 0.05, 2.0);
  controls.rotateSpeed = Math.max(0.02, defaultControls.rotateSpeed * fovScale * 0.45);
  controls.zoomSpeed = Math.max(0.05, defaultControls.zoomSpeed * fovScale * 0.8);
  controls.panSpeed = Math.max(0.05, defaultControls.panSpeed * fovScale * 0.8);
};

function CameraControls() {
  // Store state and actions
  const fov = useStore((state) => state.fov);
  const setFov = useStore((state) => state.setFov);
  const cameraRange = useStore((state) => state.cameraRange);
  const setCameraRange = useStore((state) => state.setCameraRange);
  const addLog = useStore((state) => state.addLog);

  // Ref for camera range slider to avoid DOM queries
  const rangeSliderRef = useRef(null);

  /**
   * Handles FOV slider changes with dolly-zoom compensation.
   * Maintains the apparent size of objects at the focus point by
   * adjusting camera distance inversely with FOV changes.
   */
  const handleFovChange = (e) => {
    const newFov = Number(e.target.value);
    if (!Number.isFinite(newFov) || !camera || !controls) return;

    setFov(newFov);

    // Apply dolly-zoom effect to maintain object size at focus point
    if (dollyZoomBaseDistance && dollyZoomBaseFov) {
      const baseTan = Math.tan(THREE.MathUtils.degToRad(dollyZoomBaseFov / 2));
      const newTan = Math.tan(THREE.MathUtils.degToRad(newFov / 2));
      const newDistance = dollyZoomBaseDistance * (baseTan / newTan);

      const direction = new THREE.Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
      camera.position.copy(controls.target).addScaledVector(direction, newDistance);
    }

    camera.fov = newFov;
    camera.updateProjectionMatrix();
    updateControlSpeedsForFov(newFov);
    controls.update();
    requestRender();
  };

  /**
   * Handles orbit range slider changes.
   * Converts linear slider value to non-linear degrees for intuitive control.
   */
  const handleCameraRangeChange = (e) => {
    const val = Number.parseFloat(e.target.value);
    if (!Number.isFinite(val) || !controls) return;

    const degrees = sliderValueToDegrees(val);
    setCameraRange(degrees);
    applyCameraRangeDegrees(degrees);
  };

  /**
   * Resets camera to the stored home view position.
   */
  const handleRecenter = () => {
    if (!camera || !controls) return;
    restoreHomeView();
  };

  /**
   * Automatically sets the orbit target to the center of the visible scene.
   * Attempts raycasting first, falls back to bounding box center, then origin.
   */
  const handleAutoAnchor = () => {
    if (!currentMesh || !camera || !raycaster) {
      addLog('Auto target unavailable: no mesh loaded');
      return;
    }

    // Try raycasting from screen center
    const centerRay = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(centerRay, camera);
    const intersects = [];
    raycaster.intersectObjects(scene.children, true, intersects);
    const splatHit = intersects.find((hit) => hit.object instanceof SplatMesh) ?? null;

    /** Callback to update baseline after transition completes */
    const onTransitionComplete = () => {
      updateDollyZoomBaselineFromCamera();
      requestRender();
    };

    if (splatHit) {
      startAnchorTransition(splatHit.point, {
        duration: 700,
        onComplete: onTransitionComplete,
      });
      const distanceText = splatHit.distance != null
        ? ` (distance: ${splatHit.distance.toFixed(2)})`
        : '';
      addLog(
        `Auto target: ${splatHit.point.x.toFixed(2)}, ${splatHit.point.y.toFixed(2)}, ${splatHit.point.z.toFixed(2)}${distanceText}`
      );
      return;
    }

    // Fall back to bounding box center
    const box = currentMesh.getBoundingBox?.();
    if (box) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      startAnchorTransition(center, {
        duration: 700,
        onComplete: onTransitionComplete,
      });
      addLog(
        `Auto target (bounds): ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`
      );
      return;
    }

    // Last resort: mesh position or origin
    const fallbackPoint = currentMesh.position?.clone?.() ?? new THREE.Vector3(0, 0, 0);
    startAnchorTransition(fallbackPoint, {
      duration: 700,
      onComplete: onTransitionComplete,
    });
    addLog(
      `Auto target (origin): ${fallbackPoint.x.toFixed(2)}, ${fallbackPoint.y.toFixed(2)}, ${fallbackPoint.z.toFixed(2)}`
    );
  };

  // Initialize camera range on mount
  useEffect(() => {
    if (!controls || !rangeSliderRef.current) return;

    const initialSliderValue = degreesToSliderValue(DEFAULT_CAMERA_RANGE_DEGREES);
    rangeSliderRef.current.value = String(initialSliderValue.toFixed(1));

    const degrees = sliderValueToDegrees(initialSliderValue);
    setCameraRange(degrees);
    applyCameraRangeDegrees(degrees);
  }, [setCameraRange]);

  return (
    <div class="settings">
      <div class="settings-header">
        <span class="settings-eyebrow">Camera Settings</span>
      </div>

      {/* Orbit range control */}
      <div class="control-row camera-range-controls">
        <span class="control-label">Orbit range</span>
        <div class="control-track">
          <input
            ref={rangeSliderRef}
            type="range"
            min="0"
            max="180"
            step="0.1"
            value={degreesToSliderValue(cameraRange)}
            onInput={handleCameraRangeChange}
          />
          <span class="control-value">
            {formatDegrees(cameraRange)}°
          </span>
        </div>
      </div>

      {/* FOV control */}
      <div class="control-row">
        <span class="control-label">FOV</span>
        <div class="control-track">
          <input
            type="range"
            min="20"
            max="120"
            step="1"
            value={fov}
            onInput={handleFovChange}
          />
          <span class="control-value">
            {fov}°
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div class="settings-footer">
        <button class="secondary" onClick={handleRecenter}>
          Recenter view
        </button>
        <button class="secondary" onClick={handleAutoAnchor}>
          Auto target
        </button>
      </div>
    </div>
  );
}

export default CameraControls;
