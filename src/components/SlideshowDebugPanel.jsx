/**
 * Slideshow Debug Panel
 * Provides bezier curve editor and duration controls for slide animations.
 * Uses Tweakpane for live parameter adjustment with test buttons.
 */

import { useEffect, useRef } from 'preact/hooks';
import { Pane } from 'tweakpane'; 
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { slideInAnimation, slideOutAnimation, SLIDESHOW_CONFIG } from '../cameraAnimations';

/**
 * Debug panel for tuning slideshow animations.
 * Renders Tweakpane UI with bezier curve controls and test buttons.
 * 
 * @param {Object} props
 * @param {string} props.slideMode - Current slide mode (horizontal, vertical, etc)
 * @param {boolean} props.visible - Whether panel should be visible
 */
function SlideshowDebugPanel({ slideMode, visible }) {
  const tweakpaneRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!visible || !containerRef.current) {
      if (tweakpaneRef.current) {
        tweakpaneRef.current.dispose();
        tweakpaneRef.current = null;
      }
      return;
    }

    // Create pane
    const pane = new Pane({
      container: containerRef.current,
      title: 'Animation Curve Editor',
    });
    pane.registerPlugin(EssentialsPlugin);

    // ============================================================================
    // SLIDE IN CONTROLS (PHASED)
    // ============================================================================
    const slideInFolder = pane.addFolder({ title: 'Slide In', expanded: true });
    
    const slideInParams = {
      totalDuration: SLIDESHOW_CONFIG.slideIn.totalDuration,
      speedMultiplier: SLIDESHOW_CONFIG.slideIn.speedMultiplier,
      decelTimeRatio: SLIDESHOW_CONFIG.slideIn.decelTimeRatio,
      fastSpeed: SLIDESHOW_CONFIG.slideIn.fastSpeed,
      slowSpeed: SLIDESHOW_CONFIG.slideIn.slowSpeed,
      decelEase: SLIDESHOW_CONFIG.slideIn.decelEase,
      slowEase: SLIDESHOW_CONFIG.slideIn.slowEase,
    };

    slideInFolder.addBinding(slideInParams, 'speedMultiplier', {
      min: 0.25,
      max: 4.0,
      step: 0.05,
      label: 'Speed Multiplier',
    });

    slideInFolder.addBinding(slideInParams, 'totalDuration', {
      min: 1,
      max: 15,
      step: 0.1,
      label: 'Total Duration (s)',
    });

    slideInFolder.addBinding(slideInParams, 'decelTimeRatio', {
      min: 0.1,
      max: 0.9,
      step: 0.01,
      label: 'Decel Time %',
    });

    slideInFolder.addBinding(slideInParams, 'fastSpeed', {
      min: 0.1,
      max: 7.0,
      step: 0.05,
      label: 'Fast Speed',
    });

    slideInFolder.addBinding(slideInParams, 'slowSpeed', {
      min: 0.05,
      max: 1.0,
      step: 0.05,
      label: 'Slow Speed',
    });

    slideInFolder.addBinding(slideInParams, 'decelEase', {
      options: {
        'Power2 Out': 'power2.out',
        'Power3 Out': 'power3.out',
        'Power4 Out': 'power4.out',
        'Expo Out': 'expo.out',
        'Circ Out': 'circ.out',
      },
      label: 'Decel Ease',
    });

    slideInFolder.addBinding(slideInParams, 'slowEase', {
      options: {
        'Linear': 'none',
        'Sine InOut': 'sine.inOut',
        'Power1 InOut': 'power1.inOut',
      },
      label: 'Slow Drift Ease',
    });

    slideInFolder.addButton({ title: '▶ Test Slide In' }).on('click', () => {
      SLIDESHOW_CONFIG.slideIn.totalDuration = slideInParams.totalDuration;
      SLIDESHOW_CONFIG.slideIn.speedMultiplier = slideInParams.speedMultiplier;
      SLIDESHOW_CONFIG.slideIn.decelTimeRatio = slideInParams.decelTimeRatio;
      SLIDESHOW_CONFIG.slideIn.fastSpeed = slideInParams.fastSpeed;
      SLIDESHOW_CONFIG.slideIn.slowSpeed = slideInParams.slowSpeed;
      SLIDESHOW_CONFIG.slideIn.decelEase = slideInParams.decelEase;
      SLIDESHOW_CONFIG.slideIn.slowEase = slideInParams.slowEase;
      slideInAnimation('next', { mode: slideMode });
    });

    // ============================================================================
    // SLIDE OUT CONTROLS (PHASED)
    // ============================================================================
    const slideOutFolder = pane.addFolder({ title: 'Slide Out', expanded: true });
    
    const slideOutParams = {
      totalDuration: SLIDESHOW_CONFIG.slideOut.totalDuration,
      speedMultiplier: SLIDESHOW_CONFIG.slideOut.speedMultiplier,
      slowTimeRatio: SLIDESHOW_CONFIG.slideOut.slowTimeRatio,
      fastSpeed: SLIDESHOW_CONFIG.slideOut.fastSpeed,
      slowSpeed: SLIDESHOW_CONFIG.slideOut.slowSpeed,
      accelEase: SLIDESHOW_CONFIG.slideOut.accelEase,
      fadeDelay: SLIDESHOW_CONFIG.slideOut.fadeDelay,
    };

    slideOutFolder.addBinding(slideOutParams, 'speedMultiplier', {
      min: 0.25,
      max: 4.0,
      step: 0.05,
      label: 'Speed Multiplier',
    });

    slideOutFolder.addBinding(slideOutParams, 'totalDuration', {
      min: 1,
      max: 15,
      step: 0.1,
      label: 'Total Duration (s)',
    });

    slideOutFolder.addBinding(slideOutParams, 'slowTimeRatio', {
      min: 0.1,
      max: 0.9,
      step: 0.01,
      label: 'Slow Time %',
    });

    slideOutFolder.addBinding(slideOutParams, 'fastSpeed', {
      min: 0.1,
      max: 7.0,
      step: 0.05,
      label: 'Fast Speed',
    });

    slideOutFolder.addBinding(slideOutParams, 'slowSpeed', {
      min: 0.05,
      max: 1.0,
      step: 0.05,
      label: 'Slow Speed',
    });

    slideOutFolder.addBinding(slideOutParams, 'accelEase', {
      options: {
        'Power2 In': 'power2.in',
        'Power3 In': 'power3.in',
        'Power4 In': 'power4.in',
        'Expo In': 'expo.in',
        'Circ In': 'circ.in',
      },
      label: 'Accel Ease',
    });

    slideOutFolder.addBinding(slideOutParams, 'fadeDelay', {
      min: 0,
      max: 1,
      step: 0.05,
      label: 'Fade Delay',
    });

    slideOutFolder.addButton({ title: '▶ Test Slide Out' }).on('click', async () => {
      const { camera, controls, bgImageContainer } = await import('../viewer.js');
      const originalPosition = camera.position.clone();
      const originalTarget = controls.target.clone();
      const viewerEl = document.getElementById('viewer');

      SLIDESHOW_CONFIG.slideOut.totalDuration = slideOutParams.totalDuration;
      SLIDESHOW_CONFIG.slideOut.speedMultiplier = slideOutParams.speedMultiplier;
      SLIDESHOW_CONFIG.slideOut.slowTimeRatio = slideOutParams.slowTimeRatio;
      SLIDESHOW_CONFIG.slideOut.fastSpeed = slideOutParams.fastSpeed;
      SLIDESHOW_CONFIG.slideOut.slowSpeed = slideOutParams.slowSpeed;
      SLIDESHOW_CONFIG.slideOut.accelEase = slideOutParams.accelEase;
      SLIDESHOW_CONFIG.slideOut.fadeDelay = slideOutParams.fadeDelay;

      console.log(`[Debug] Testing Slide Out: total=${slideOutParams.totalDuration}s, slow=${slideOutParams.slowTimeRatio}`);
      await slideOutAnimation('next', { mode: slideMode });

      camera.position.copy(originalPosition);
      controls.target.copy(originalTarget);
      controls.update();

      if (viewerEl) {
        viewerEl.classList.remove('slide-out', 'slide-in');
      }
      if (bgImageContainer) {
        bgImageContainer.classList.add('active');
      }

      console.log('[Debug] Slide Out test complete - camera and fade reset');
    });

    tweakpaneRef.current = pane;

    return () => {
      if (tweakpaneRef.current) {
        tweakpaneRef.current.dispose();
        tweakpaneRef.current = null;
      }
    };
  }, [visible, slideMode]);

  if (!visible) return null;

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        marginTop: '16px',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '4px',
      }} 
    />
  );
}

export default SlideshowDebugPanel;
