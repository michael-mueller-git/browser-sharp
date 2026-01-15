/**
 * Debug settings dropdown for the side panel.
 * Hosts FPS overlay toggle, mobile devtools toggle, and a DB wipe action.
 */

import { useCallback, useEffect, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../store';

let erudaInitPromise = null;

/** Lazily load and enable Eruda devtools */
const enableMobileDevtools = async () => {
  if (typeof window === 'undefined') return false;

  if (window.eruda) {
    window.eruda.show?.();
    return true;
  }

  if (!erudaInitPromise) {
    erudaInitPromise = import('eruda')
      .then(({ default: erudaLib }) =>
        import('eruda-indexeddb').then(({ default: erudaIndexedDB }) => {
          erudaLib.init();
          erudaLib.add(erudaIndexedDB);
          return erudaLib;
        })
      )
      .catch((err) => {
        erudaInitPromise = null;
        throw err;
      });
  }

  await erudaInitPromise;
  return true;
};

/** Tear down Eruda devtools if present */
const disableMobileDevtools = () => {
  const instance = typeof window !== 'undefined' ? window.eruda : null;
  if (instance?.destroy) {
    instance.destroy();
  }
};

function DebugSettings() {
  const showFps = useStore((state) => state.showFps);
  const setShowFps = useStore((state) => state.setShowFps);
  const mobileDevtoolsEnabled = useStore((state) => state.mobileDevtoolsEnabled);
  const setMobileDevtoolsEnabled = useStore((state) => state.setMobileDevtoolsEnabled);
  const debugSettingsExpanded = useStore((state) => state.debugSettingsExpanded);
  const toggleDebugSettingsExpanded = useStore((state) => state.toggleDebugSettingsExpanded);

  const [wipingDb, setWipingDb] = useState(false);

  /** Toggle FPS overlay visibility */
  const handleFpsToggle = useCallback((e) => {
    const enabled = Boolean(e.target.checked);
    setShowFps(enabled);
    const el = document.getElementById('fps-counter');
    if (el) el.style.display = enabled ? 'block' : 'none';
  }, [setShowFps]);

  /** Enable/disable mobile devtools (Eruda) */
  const handleDevtoolsToggle = useCallback((e) => {
    const enabled = Boolean(e.target.checked);
    setMobileDevtoolsEnabled(enabled);
  }, [setMobileDevtoolsEnabled]);

  /** Wipes IndexedDB image store and reloads */
  const handleWipeDb = useCallback(async () => {
    const confirmed = window.confirm('Wipe IndexedDB "sharp-viewer-storage"? This cannot be undone.');
    if (!confirmed) return;

    setWipingDb(true);
    try {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase('sharp-viewer-storage');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error('Failed to delete database'));
        request.onblocked = () => console.warn('Delete blocked: close other tabs or reopen the app.');
      });
      alert('IndexedDB sharp-viewer-storage wiped. Reloading...');
      window.location.reload();
    } catch (err) {
      console.error('DB wipe failed:', err);
      alert(err?.message || 'Failed to wipe DB');
    } finally {
      setWipingDb(false);
    }
  }, []);

  // React to devtools preference changes
  useEffect(() => {
    if (mobileDevtoolsEnabled) {
      enableMobileDevtools().catch((err) => {
        console.warn('[Devtools] Failed to enable:', err);
        setMobileDevtoolsEnabled(false);
      });
    } else {
      disableMobileDevtools();
    }
  }, [mobileDevtoolsEnabled, setMobileDevtoolsEnabled]);

  return (
    <div class="settings-group">
      <button
        class="group-toggle"
        aria-expanded={debugSettingsExpanded}
        onClick={toggleDebugSettingsExpanded}
      >
        <span class="settings-eyebrow">Debug Settings</span>
        <FontAwesomeIcon icon={faChevronDown} className="chevron" />
      </button>

      <div
        class="group-content"
        style={{ display: debugSettingsExpanded ? 'flex' : 'none' }}
      >
        <div class="control-row">
          <span class="control-label">Show FPS</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={showFps}
              onChange={handleFpsToggle}
            />
            <span class="switch-track" aria-hidden="true" />
          </label>
        </div>

        <div class="control-row">
          <span class="control-label">Mobile devtools</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={mobileDevtoolsEnabled}
              onChange={handleDevtoolsToggle}
            />
            <span class="switch-track" aria-hidden="true" />
          </label>
        </div>

        <div class="control-row">
          <span class="control-label">Delete image store</span>
          <button
            type="button"
            class={`secondary danger ${wipingDb ? 'is-busy' : ''}`}
            onClick={handleWipeDb}
            disabled={wipingDb}
          >
            {wipingDb ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DebugSettings;
