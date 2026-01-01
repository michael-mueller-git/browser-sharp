/**
 * File loader module - drag/drop, file loading, format handling
 */

import { getFormatHandler, getSupportedExtensions } from "./formats/index.js";
import { useStore } from "./store.js";
import {
  scene,
  renderer,
  composer,
  camera,
  controls,
  spark,
  outputPass,
  currentMesh,
  setCurrentMesh,
  setOriginalImageAspect,
  originalImageAspect,
  activeCamera,
  removeCurrentMesh,
  requestRender,
  updateBackgroundImage,
  bgImageContainer,
  setBgImageUrl,
  THREE,
} from "./viewer.js";
import {
  fitViewToMesh,
  applyMetadataCamera,
  clearMetadataCamera,
  saveHomeView,
  applyCameraProjection,
} from "./cameraUtils.js";
import { startLoadZoomAnimation } from "./cameraAnimations.js";
import {
  setAssetList as setAssetListManager,
  getAssetList,
  getCurrentAssetIndex,
  setCurrentAssetIndex as setCurrentAssetIndexManager,
  getAssetByIndex,
  onPreviewGenerated,
  hasMultipleAssets,
  getAssetCount,
  nextAsset,
  prevAsset,
  setCapturePreviewFn,
  captureCurrentAssetPreview,
} from "./assetManager.js";

// Get store functions (these will be used from components)
const getStoreState = () => useStore.getState();

// Helper to get DOM elements
const getViewerEl = () => document.getElementById('viewer');
const getPickBtn = () => document.getElementById('pick-btn');
const getFileInput = () => document.getElementById('file-input');

// Helper to get supported extensions text
const supportedExtensions = getSupportedExtensions();
const supportedExtensionsText = supportedExtensions.join(", ");

// Update viewer aspect ratio based on image metadata
export const updateViewerAspectRatio = () => {
  const viewerEl = getViewerEl();
  if (!viewerEl) return;
  
  const pageEl = document.querySelector(".page");
  const sidePanelEl = document.getElementById("side-panel");
  const padding = 36; // 18px page padding on each side
  const panelWidth = pageEl?.classList.contains("panel-open")
    ? (sidePanelEl?.getBoundingClientRect().width ?? 0) + padding
    : 0;
  const availableWidth = Math.max(0, window.innerWidth - padding - panelWidth);
  const availableHeight = Math.max(0, window.innerHeight - padding);

  if (originalImageAspect && originalImageAspect > 0) {
    let viewerWidth, viewerHeight;
    
    viewerHeight = availableHeight;
    viewerWidth = viewerHeight * originalImageAspect;
    
    if (viewerWidth > availableWidth) {
      viewerWidth = availableWidth;
      viewerHeight = viewerWidth / originalImageAspect;
    }
    
    viewerEl.style.width = `${viewerWidth}px`;
    viewerEl.style.height = `${viewerHeight}px`;
  } else {
    viewerEl.style.width = `${availableWidth}px`;
    viewerEl.style.height = `${availableHeight}px`;
  }
};

export const resize = () => {
  const viewerEl = getViewerEl();
  if (!viewerEl) return;
  
  updateViewerAspectRatio();
  const { clientWidth, clientHeight } = viewerEl;
  renderer.setSize(clientWidth, clientHeight, false);
//   composer.setSize(clientWidth, clientHeight);
  
  if (activeCamera) {
    applyCameraProjection(activeCamera, clientWidth, clientHeight);
  } else {
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }
  requestRender();
};

// Capture a preview thumbnail from the current render
const capturePreviewThumbnail = () => {
  if (!currentMesh) return null;
  
  // Render with solid background for capture
  scene.background = new THREE.Color("#0c1018");
  renderer.setClearColor(0x0c1018, 1);
  composer.render();
  
  const dataUrl = renderer.domElement.toDataURL("image/jpeg", 0.85);
  
  // Restore transparent background
  scene.background = null;
  renderer.setClearColor(0x000000, 0);
  
  return dataUrl;
};

// Initialize capture function for asset manager
setCapturePreviewFn(capturePreviewThumbnail);

// Capture background from current render
const captureAndApplyBackground = () => {
  if (!currentMesh) return;

  // Set solid background for capture
  scene.background = new THREE.Color("#0c1018");
  renderer.setClearColor(0x0c1018, 1);
  
  composer.render();
  
  const dataUrl = renderer.domElement.toDataURL("image/jpeg", 0.9);
  
  setBgImageUrl(dataUrl);
  const blur = 20;
  updateBackgroundImage(dataUrl, blur);
  
  // Set transparent background so blurred image shows through
  scene.background = null;
  renderer.setClearColor(0x000000, 0);
  
  requestRender();
  getStoreState().addLog("Background captured from model render");
};

// Format bytes helper
const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
};

export const loadSplatFile = async (file) => {
  const viewerEl = getViewerEl();
  if (!file || !viewerEl) return;
  
  const store = getStoreState();
  
  const formatHandler = getFormatHandler(file);
  if (!formatHandler) {
    store.setStatus(`Only ${supportedExtensionsText} 3DGS files are supported`);
    return;
  }

  try {
    viewerEl.classList.add("loading");
    store.setIsLoading(true);
    
    store.setStatus("Reading local file...");
    const start = performance.now();
    const bytes = new Uint8Array(await file.arrayBuffer());

    let cameraMetadata = null;
    try {
      cameraMetadata = await formatHandler.loadMetadata({ file, bytes });
      if (cameraMetadata) {
        const { intrinsics } = cameraMetadata;
        setOriginalImageAspect(intrinsics.imageWidth / intrinsics.imageHeight);
        updateViewerAspectRatio();
        store.addLog(
          `${formatHandler.label} camera: fx=${intrinsics.fx.toFixed(1)}, fy=${intrinsics.fy.toFixed(1)}, ` +
            `cx=${intrinsics.cx.toFixed(1)}, cy=${intrinsics.cy.toFixed(1)}, ` +
            `img=${intrinsics.imageWidth}x${intrinsics.imageHeight}`,
        );
      } else {
        setOriginalImageAspect(null);
        updateViewerAspectRatio();
      }
    } catch (error) {
      setOriginalImageAspect(null);
      updateViewerAspectRatio();
      store.addLog(`Failed to parse camera metadata, falling back to default view: ${error?.message ?? error}`);
    }

    store.setStatus(`Parsing ${formatHandler.label} and building splats...`);
    const mesh = await formatHandler.loadData({ file, bytes });

    // Configure pipeline based on color space
    // if (formatHandler.colorSpace === "linear") {
    //   if (!composer.passes.includes(outputPass)) {
    //     composer.addPass(outputPass);
    //   }
    // } else {
    //   composer.removePass(outputPass);
    // }

    removeCurrentMesh();
    setCurrentMesh(mesh);
    viewerEl.classList.add("has-mesh");
    scene.add(mesh);

    clearMetadataCamera(resize);
    if (cameraMetadata) {
      applyMetadataCamera(mesh, cameraMetadata, resize);
    } else {
      fitViewToMesh(mesh);
    }
    spark.update({ scene });

    // Save home view BEFORE animation so we capture the correct position
    saveHomeView();

    startLoadZoomAnimation();

    // Warmup frames for spark renderer
    let warmupFrames = 120;
    let bgCaptured = false;
    let previewCaptured = false;
    const warmup = () => {
      if (warmupFrames > 0) {
        warmupFrames--;
        requestRender();
        requestAnimationFrame(warmup);
        
        if (!bgCaptured && warmupFrames === 90) {
          bgCaptured = true;
          captureAndApplyBackground();
        }
        
        // Capture preview thumbnail slightly after background (when fully warmed up)
        if (!previewCaptured && warmupFrames === 60) {
          previewCaptured = true;
          captureCurrentAssetPreview();
        }
      }
    };
    warmup();

    const loadMs = performance.now() - start;
    
    // Update file info in store
    store.setFileInfo({
      name: file.name,
      size: formatBytes(file.size),
      splatCount: mesh?.packedSplats?.numSplats ?? "-",
      loadTime: `${loadMs.toFixed(1)} ms`,
    });
    
    setTimeout(() => {
      viewerEl.classList.remove("loading");
      store.setIsLoading(false);
    }, 100);
    
    store.setStatus(
      cameraMetadata
        ? "Loaded "
        : "Loaded (no camera data)",
    );
    store.addLog(
      `Debug: splats=${mesh.packedSplats.numSplats}`,
    );
  } catch (error) {
    console.error(error);
    viewerEl.classList.remove("loading");
    store.setIsLoading(false);
    clearMetadataCamera(resize);
    store.setStatus("Load failed, please check the file or console log");
  }
};

// Drag and drop handlers
const preventDefaults = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

export const initDragDrop = () => {
  const viewerEl = getViewerEl();
  if (!viewerEl) return;
  
  ["dragenter", "dragover"].forEach((eventName) => {
    viewerEl.addEventListener(eventName, (event) => {
      preventDefaults(event);
      viewerEl.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    viewerEl.addEventListener(eventName, (event) => {
      preventDefaults(event);
      if (eventName === "dragleave") {
        viewerEl.classList.remove("dragging");
      }
    });
  });

  viewerEl.addEventListener("drop", async (event) => {
    viewerEl.classList.remove("dragging");
    
    const items = event.dataTransfer?.items;
    const files = [];
    
    if (items) {
      // Try to get folder contents using webkitGetAsEntry
      const entries = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          entries.push(entry);
        }
      }
      
      if (entries.length > 0) {
        // Process entries (files and folders)
        const processedFiles = await processEntries(entries);
        files.push(...processedFiles);
      } else {
        // Fallback to regular file list
        const fileList = event.dataTransfer?.files;
        if (fileList) {
          files.push(...Array.from(fileList));
        }
      }
    } else {
      // Fallback to regular file list
      const fileList = event.dataTransfer?.files;
      if (fileList) {
        files.push(...Array.from(fileList));
      }
    }
    
    if (files.length > 0) {
      await handleMultipleFiles(files);
    }
  });
};

// Process file/folder entries recursively
const processEntries = async (entries) => {
  const files = [];
  
  const readEntry = async (entry) => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => resolve([file]), () => resolve([]));
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const subEntries = await new Promise((resolve) => {
        const allEntries = [];
        const readEntries = () => {
          dirReader.readEntries((entries) => {
            if (entries.length === 0) {
              resolve(allEntries);
            } else {
              allEntries.push(...entries);
              readEntries();
            }
          }, () => resolve(allEntries));
        };
        readEntries();
      });
      const subFiles = await processEntries(subEntries);
      return subFiles;
    }
    return [];
  };
  
  for (const entry of entries) {
    const entryFiles = await readEntry(entry);
    files.push(...entryFiles);
  }
  
  return files;
};

// Handle multiple files (from drop or picker)
export const handleMultipleFiles = async (files) => {
  if (!files || files.length === 0) return;
  const store = getStoreState();
  const result = await setAssetListManager(files);
  
  if (result.count === 0) {
    store.setStatus(`No supported files found. Supported: ${supportedExtensionsText}`);
    return;
  }
  
  // Update store with assets
  store.setAssets(result.assets);
  
  if (result.count === 1) {
    // Single file - load directly
    setCurrentAssetIndexManager(0);
    store.setCurrentAssetIndex(0);
    await loadSplatFile(result.assets[0].file);
  } else {
    // Multiple files - show gallery and start loading
    store.addLog(`Found ${result.count} assets`);
    
    // Set up preview generation callback
    onPreviewGenerated((asset, index) => {
      store.updateAssetPreview(index, asset.preview);
    });
    
    // Load first asset (preview will be captured automatically after warmup)
    setCurrentAssetIndexManager(0);
    store.setCurrentAssetIndex(0);
    await loadSplatFile(result.assets[0].file);
  }
};

// Load asset by index (called from AssetGallery component)
export const loadAssetByIndex = async (index) => {
  const currentIndex = getCurrentAssetIndex();
  if (index === currentIndex) return;
  
  const asset = getAssetByIndex(index);
  if (!asset) return;
  
  const store = getStoreState();
  setCurrentAssetIndexManager(index);
  store.setCurrentAssetIndex(index);
  await loadSplatFile(asset.file);
};

// Navigate to next asset
export const loadNextAsset = async () => {
  if (!hasMultipleAssets()) return;
  
  const asset = nextAsset();
  if (asset) {
    const index = getCurrentAssetIndex();
    const store = getStoreState();
    store.setCurrentAssetIndex(index);
    await loadSplatFile(asset.file);
  }
};

// Navigate to previous asset
export const loadPrevAsset = async () => {
  if (!hasMultipleAssets()) return;
  
  const asset = prevAsset();
  if (asset) {
    const index = getCurrentAssetIndex();
    const store = getStoreState();
    store.setCurrentAssetIndex(index);
    await loadSplatFile(asset.file);
  }
};

export const initFilePicker = () => {
  const pickBtn = getPickBtn();
  const fileInput = getFileInput();
  if (!pickBtn || !fileInput) return;
  
  // Enable multiple file selection
  fileInput.setAttribute("multiple", "");
  // Add webkitdirectory for folder selection (optional secondary button could enable this)
  
  pickBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleMultipleFiles(Array.from(files));
      fileInput.value = "";
    }
  });
};
