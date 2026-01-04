/**
 * Side panel component for desktop and landscape modes.
 * Contains file upload controls, debug info display, and settings panels.
 * Collapsible via toggle button.
 */

import { useStore } from '../store';
import CameraControls from './CameraControls';
import AnimationSettings from './AnimationSettings';

function SidePanel() {
  // Store state
  const status = useStore((state) => state.status);
  const fileInfo = useStore((state) => state.fileInfo);
  const isMobile = useStore((state) => state.isMobile);
  
  // Store actions
  const togglePanel = useStore((state) => state.togglePanel);

  return (
    <>
      {/* Panel toggle button */}
      <button
        class="panel-toggle"
        aria-label="Toggle info panel"
        type="button"
        onClick={togglePanel}
      >
        {'<'}
      </button>
      
      {/* Side panel content */}
      <div class="side">
        
        {/* File info display - hidden on mobile */}
        {!isMobile && (
          <div class="debug">
            <div class="row">
              <span>Status</span>
              <span>{status}</span>
            </div>
            <div class="row">
              <span>File</span>
              <span>{fileInfo.name}</span>
            </div>
            <div class="row">
              <span>Size</span>
              <span>{fileInfo.size}</span>
            </div>
            <div class="row">
              <span>Splats</span>
              <span>{fileInfo.splatCount}</span>
            </div>
            <div class="row">
              <span>Time</span>
              <span>{fileInfo.loadTime}</span>
            </div>
          </div>
        )}
        
        {/* Settings panels */}
        <CameraControls />
        <AnimationSettings />
        {/* <AssetGallery /> */}
      </div>
    </>
  );
}

export default SidePanel;
