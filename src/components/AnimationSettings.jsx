/**
 * Animation settings component.
 * Controls for load animation behavior including enable/disable,
 * animation style (intensity), and sweep direction.
 */

import { useCallback } from 'preact/hooks';
import { useStore } from '../store';
import { setLoadAnimationEnabled, setLoadAnimationIntensity, setLoadAnimationDirection } from '../cameraAnimations';

/** Animation style options with display labels */
const INTENSITY_OPTIONS = [
  { value: 'subtle', label: 'Subtle' },
  { value: 'medium', label: 'Medium' },
  { value: 'dramatic', label: 'Dramatic' },
];

/** Animation direction options with display labels */
const DIRECTION_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'up', label: 'Top' },
  { value: 'down', label: 'Bottom' },
  { value: 'none', label: 'None' },
];

function AnimationSettings() {
  // Store state
  const animationEnabled = useStore((state) => state.animationEnabled);
  const animationIntensity = useStore((state) => state.animationIntensity);
  const animationDirection = useStore((state) => state.animationDirection);
  const animSettingsExpanded = useStore((state) => state.animSettingsExpanded);
  
  // Store actions
  const setAnimationEnabledStore = useStore((state) => state.setAnimationEnabled);
  const setAnimationIntensityStore = useStore((state) => state.setAnimationIntensity);
  const setAnimationDirectionStore = useStore((state) => state.setAnimationDirection);
  const toggleAnimSettingsExpanded = useStore((state) => state.toggleAnimSettingsExpanded);

  /**
   * Toggles load animation on/off.
   * Updates both Zustand store and animation module state.
   */
  const handleToggleAnimation = useCallback((e) => {
    const enabled = e.target.checked;
    setAnimationEnabledStore(enabled);
    setLoadAnimationEnabled(enabled);
  }, [setAnimationEnabledStore]);

  /**
   * Changes animation intensity/style.
   * @param {Event} e - Change event from select element
   */
  const handleIntensityChange = useCallback((e) => {
    const intensity = e.target.value;
    setAnimationIntensityStore(intensity);
    setLoadAnimationIntensity(intensity);
  }, [setAnimationIntensityStore]);

  /**
   * Changes animation sweep direction.
   * @param {Event} e - Change event from select element
   */
  const handleDirectionChange = useCallback((e) => {
    const direction = e.target.value;
    setAnimationDirectionStore(direction);
    setLoadAnimationDirection(direction);
  }, [setAnimationDirectionStore]);

  return (
    <div class="settings-group">
      {/* Collapsible header */}
      <button
        class="group-toggle"
        aria-expanded={animSettingsExpanded}
        onClick={toggleAnimSettingsExpanded}
      >
        <span class="settings-eyebrow">Animation Settings</span>
        <span class="chevron" />
      </button>
      
      {/* Settings content */}
      <div 
        class="group-content" 
        style={{ display: animSettingsExpanded ? 'flex' : 'none' }}
      >
        {/* Enable/disable toggle */}
        <div class="control-row animate-toggle-row">
          <span class="control-label">Animate on load</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={animationEnabled}
              onChange={handleToggleAnimation}
            />
            <span class="switch-track" aria-hidden="true" />
          </label>
        </div>
        
        {/* Intensity selector */}
        <div class="control-row select-row">
          <span class="control-label">Style</span>
          <select value={animationIntensity} onChange={handleIntensityChange}>
            {INTENSITY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        
        {/* Direction selector */}
        <div class="control-row select-row">
          <span class="control-label">Direction</span>
          <select value={animationDirection} onChange={handleDirectionChange}>
            {DIRECTION_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default AnimationSettings;
