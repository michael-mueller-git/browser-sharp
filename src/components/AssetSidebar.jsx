import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { useStore } from '../store';
import { loadAssetByIndex } from '../fileLoader';

function AssetSidebar() {
  const assets = useStore((state) => state.assets);
  const currentAssetIndex = useStore((state) => state.currentAssetIndex);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef(null);
  const sidebarRef = useRef(null);

  // Only show if we have multiple assets
  const hasMultipleAssets = assets.length > 1;

  const hideSidebar = useCallback(() => {
    setIsVisible(false);
  }, []);

  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideSidebar();
    }, 4000);
  }, [hideSidebar]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const showSidebar = useCallback(() => {
    setIsVisible(true);
    startHideTimer();
  }, [startHideTimer]);

  // Show on index change (navigation)
  useEffect(() => {
    if (hasMultipleAssets) {
      showSidebar();
    }
  }, [currentAssetIndex, hasMultipleAssets, showSidebar]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  if (!hasMultipleAssets) return null;

  return (
    <>
      {/* Invisible hover target on left edge */}
      <div 
        class="sidebar-hover-target"
        onMouseEnter={showSidebar}
      />

      {/* Trigger Button (Index indicator) - Visible when sidebar is hidden */}
      <button 
        class={`sidebar-trigger-btn left${isVisible ? ' hidden' : ''}`}
        onClick={showSidebar}
        title="Open asset browser"
      >
        {currentAssetIndex + 1} / {assets.length}
      </button>

      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        class={`asset-sidebar ${isVisible ? 'visible' : ''}`}
        onMouseEnter={clearHideTimer}
        onMouseLeave={startHideTimer}
        onMouseMove={clearHideTimer} // Keep open while moving mouse inside
      >
        <div class="asset-list-vertical">
          {assets.map((asset, index) => (
            <button
              key={asset.id || index}
              class={`asset-item-vertical ${index === currentAssetIndex ? 'active' : ''}`}
              title={asset.name}
              onClick={() => loadAssetByIndex(index)}
            >
              <div class={`asset-preview ${asset.preview ? '' : 'loading'}`}>
                {asset.preview ? (
                  <img src={asset.preview} alt={asset.name} loading="lazy" />
                ) : (
                  <div class="preview-spinner" />
                )}
              </div>
            </button>
          ))}
        </div>
        <div class="sidebar-footer">
          {currentAssetIndex + 1} / {assets.length}
        </div>
      </div>
    </>
  );
}

export default AssetSidebar;
