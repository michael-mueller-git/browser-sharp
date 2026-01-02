/**
 * Side panel component.
 * Contains file upload controls, debug info display, and settings panels.
 * Collapsible via toggle button (desktop/landscape) or swipe-up (mobile portrait).
 */

import { useRef, useCallback, useEffect, useState } from 'preact/hooks';
import { useStore } from '../store';
import CameraControls from './CameraControls';
import AnimationSettings from './AnimationSettings';
import AssetGallery from './AssetGallery';
import LogPanel from './LogPanel';
import { getSupportedLabel, getFormatAccept } from '../formats/index';
import { handleMultipleFiles } from '../fileLoader';

/** Supported file formats label for UI display */
const supportedLabel = getSupportedLabel();

/** File input accept attribute value */
const formatAccept = getFormatAccept();

/** Touch drag threshold in pixels before considering it a swipe */
const SWIPE_THRESHOLD = 10;

function SidePanel() {
  // Store state
  const panelOpen = useStore((state) => state.panelOpen);
  const status = useStore((state) => state.status);
  const fileInfo = useStore((state) => state.fileInfo);
  const debugLoadingMode = useStore((state) => state.debugLoadingMode);
  const isMobile = useStore((state) => state.isMobile);
  const isPortrait = useStore((state) => state.isPortrait);
  
  // Store actions
  const togglePanel = useStore((state) => state.togglePanel);
  const toggleDebugLoadingMode = useStore((state) => state.toggleDebugLoadingMode);
  const setMobileState = useStore((state) => state.setMobileState);

  // Ref for file input to avoid DOM queries
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  
  // Touch handling state for swipe gestures
  const [touchStart, setTouchStart] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Detects mobile device and orientation.
   * Uses the smaller dimension to detect mobile, works for both orientations.
   */
  const updateMobileState = useCallback(() => {
    const mobile = Math.min(window.innerWidth, window.innerHeight) <= 768;
    const portrait = window.innerHeight > window.innerWidth;
    setMobileState(mobile, portrait);
  }, [setMobileState]);

  /**
   * Initialize mobile detection on mount and on resize.
   */
  useEffect(() => {
    updateMobileState();
    window.addEventListener('resize', updateMobileState);
    return () => window.removeEventListener('resize', updateMobileState);
  }, [updateMobileState]);

  /**
   * Handles touch start for swipe gesture (mobile portrait only).
   */
  const handleTouchStart = useCallback((e) => {
    if (!isMobile || !isPortrait) return;
    const touch = e.touches[0];
    setTouchStart({ y: touch.clientY, time: Date.now() });
    setIsDragging(false);
  }, [isMobile, isPortrait]);

  /**
   * Handles touch move for swipe gesture (mobile portrait only).
   */
  const handleTouchMove = useCallback((e) => {
    if (!touchStart || !isMobile || !isPortrait) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStart.y;
    
    if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
      setIsDragging(true);
      // Prevent default scrolling during swipe
      e.preventDefault();
    }
  }, [touchStart, isMobile, isPortrait]);

  /**
   * Handles touch end for swipe gesture (mobile portrait only).
   */
  const handleTouchEnd = useCallback((e) => {
    if (!touchStart || !isMobile || !isPortrait) {
      setTouchStart(null);
      setIsDragging(false);
      return;
    }
    
    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStart.time;
    const velocity = Math.abs(deltaY) / deltaTime;
    
    // Swipe down to close, swipe up to open
    if (Math.abs(deltaY) > 30 || velocity > 0.3) {
      if (deltaY > 0 && panelOpen) {
        togglePanel();
      } else if (deltaY < 0 && !panelOpen) {
        togglePanel();
      }
    }
    
    setTouchStart(null);
    setIsDragging(false);
  }, [touchStart, panelOpen, togglePanel, isMobile, isPortrait]);

  /**
   * Triggers file picker dialog by clicking hidden file input.
   */
  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handles file selection from file picker.
   * Passes selected files to file loader and resets input.
   * @param {Event} event - Change event from file input
   */
  const handleFileChange = useCallback(async (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleMultipleFiles(Array.from(files));
      event.target.value = '';
    }
  }, []);

  return (
    <>
      {/* Panel toggle button - fixed position (landscape/desktop only) */}
      {(!isMobile || !isPortrait) && (
        <button
          class="panel-toggle"
          aria-label="Toggle info panel"
          aria-expanded={panelOpen}
          type="button"
          onClick={togglePanel}
        >
          {panelOpen ? '>' : '<'}
        </button>
      )}
      
      {/* Mobile portrait toggle button - bottom left */}
      {isMobile && isPortrait && (
        <button
          class="panel-toggle mobile-portrait-toggle"
          aria-label="Toggle settings panel"
          aria-expanded={panelOpen}
          type="button"
          onClick={togglePanel}
        >
          {panelOpen ? '▼' : '▲'}
        </button>
      )}
      
      {/* Side panel content */}
      <div 
        ref={panelRef}
        class={`side ${isMobile && isPortrait ? 'mobile-portrait' : ''}`}
      >
        {/* Drag handle for mobile portrait (visual only now) */}
        {isMobile && isPortrait && (
          <div class="drag-handle">
            <div class="drag-handle-bar" />
          </div>
        )}
        
        {/* Header with file upload */}
        <div class="header">
          <div>
            <div class="title">3DGS File Upload</div>
          </div>
          <button class="primary" onClick={handlePickFile}>
            Choose File
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            accept={formatAccept} 
            multiple 
            hidden 
            onChange={handleFileChange}
          />
        </div>
        
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
        
        {/* Debug controls */}
        {/* <div class="settings">
          <div class="control-row animate-toggle-row">
            <span class="control-label">Debug Loading</span>
            <label class="switch">
              <input
                type="checkbox"
                checked={debugLoadingMode}
                onChange={toggleDebugLoadingMode}
              />
              <span class="switch-track"></span>
            </label>
          </div>
        </div> */}
        
        {/* Settings panels */}
        <CameraControls />
        <AnimationSettings />
        <AssetGallery />
        {/* <LogPanel /> */}
      </div>
    </>
  );
}

export default SidePanel;
