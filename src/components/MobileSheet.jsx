/**
 * Mobile sheet component for portrait orientation.
 * Swipeable bottom sheet drawer with drag handle interaction.
 */

import { useRef, useCallback, useState } from 'preact/hooks';
import useSwipe from '../utils/useSwipe';
import { useStore } from '../store';
import CameraControls from './CameraControls';
import AnimationSettings from './AnimationSettings';
import { getFormatAccept } from '../formats/index';
import { handleMultipleFiles } from '../fileLoader';

/** File input accept attribute value */
const formatAccept = getFormatAccept();

/** Minimum swipe distance to trigger open/close */
const SWIPE_THRESHOLD = 50;

function MobileSheet() {
  // Store state
  const panelOpen = useStore((state) => state.panelOpen);
  const togglePanel = useStore((state) => state.togglePanel);

  // Refs
  const fileInputRef = useRef(null);
  const dragHandleRef = useRef(null);

  /**
   * Handle drag handle click to toggle
   */
  const handleDragHandleClick = useCallback(() => {
    togglePanel();
  }, [togglePanel]);

  // useSwipe on the drag handle to detect vertical swipes
  useSwipe(dragHandleRef, {
    direction: 'vertical',
    threshold: SWIPE_THRESHOLD,
    allowCross: 50,
    onSwipe: ({ dir }) => {
      if (dir === 'up' && !panelOpen) togglePanel();
      if (dir === 'down' && panelOpen) togglePanel();
    }
  });

  /**
   * Triggers file picker dialog.
   */
  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handles file selection from file picker.
   */
  const handleFileChange = useCallback(async (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleMultipleFiles(Array.from(files));
      event.target.value = '';
    }
  }, []);

  return (
    <div class={`mobile-sheet ${panelOpen ? 'open' : 'closed'}`}>
      {/* Drag handle with enlarged touch target - outside scroll container */}
      <div class="drag-handle" ref={dragHandleRef}>
        <div 
          class="drag-handle-touch-target"
          onClick={handleDragHandleClick}
        />
        <div class="drag-handle-bar" />
      </div>
      
      {/* Scrollable content container */}
      <div class="mobile-sheet-content">
        <CameraControls />
        <AnimationSettings />
        {/* <AssetGallery /> */}
      </div>
    </div>
  );
}

export default MobileSheet;
