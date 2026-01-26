# Agentic Coding Guidelines (AGENTS.md)

This document provides essential information for agentic coding agents operating in this repository.

## 🛠 Build, Lint, and Test Commands

The project is built using Vite and uses Preact.

- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Preview Build:** `npm run preview`
- **Tests:** `npm test` (Note: Currently no tests are defined in `package.json`).
- **Single Test:** If a test framework is added (e.g., Vitest), use `npx vitest run path/to/file.test.js`.

## 🎨 Code Style & Conventions

### 📦 Imports
- Use **ESM** syntax (`import`/`export`).
- Prefer named exports for utilities and components.
- Group imports: built-in, external libraries, internal modules.
- File extensions: Use `.jsx` for Preact components with JSX, `.js` for logic, and `.ts` for TypeScript files.

### 🖋 Formatting & Naming
- **Indentation:** 2 spaces.
- **Semicolons:** Required.
- **Quotes:** Single quotes `'` for strings, except in JSX where double quotes `"` are preferred for props.
- **Naming:**
    - **Variables/Functions:** `camelCase`.
    - **Components:** `PascalCase`.
    - **Constants:** `SCREAMING_SNAKE_CASE`.
    - **Files:** `camelCase.js` or `PascalCase.jsx` for components.

### ⚛️ Preact / UI
- Use **Hooks** (`useEffect`, `useState`, `useCallback`, `useRef`) from `preact/hooks`.
- Use **Zustand** for global state management (see `src/store.js`).
- Prefer functional components over class components.

### 🧊 Three.js
- The viewer logic is centered in `src/viewer.js`.
- Use `requestRender()` to trigger a frame instead of a continuous loop where possible to save battery/resources.
- Access the scene via the exported `scene` object from `src/viewer.js`.
- The `SparkRenderer` is used for high-quality splat rendering.

### 🚨 Error Handling
- Use `try/catch` blocks for asynchronous operations and external API calls (e.g., Supabase, File System Access API).
- Provide user-facing feedback via `setStatus` or `addLog` from the store.
- Log errors to the console with descriptive prefixes like `[Storage]`, `[Viewer]`, `[Loader]`.

### 🏷 Types
- Use **JSDoc** for documenting functions, parameters, and return types in `.js`/`.jsx` files.
- For `.ts` files, use explicit TypeScript types.

## 📂 Project Structure

- `src/components/`: Preact components (JSX).
- `src/storage/`: Logic for handling different storage backends (Supabase, Local, etc.).
- `src/utils/`: Generic utility functions and custom hooks.
- `src/viewer.js`: Core Three.js setup, renderer, and render loop.
- `src/fileLoader.js`: Orchestrates asset loading, transitions, and state updates.
- `src/store.js`: Centralized Zustand state management.
- `src/assetManager.js`: Manages the list of assets and navigation state.
- `src/splatManager.js`: Handles caching and activation of SplatMesh entries.

## 🧠 State Management (Zustand)

The store in `src/store.js` is the source of truth for:
- **UI State:** `panelOpen`, `assetSidebarOpen`, `isLoading`, `status`.
- **Assets:** `assets` (array), `currentAssetIndex`.
- **Camera:** `fov`, `cameraRange`, `dollyZoomEnabled`.
- **Environment:** `isMobile`, `isPortrait`, `immersiveMode`.

Use the `useStore` selector for reading state and actions:
```javascript
const fov = useStore((state) => state.fov);
const setStatus = useStore((state) => state.setStatus);
```

## 🚀 Asset Loading Workflow

Asset loading (via `src/fileLoader.js`) follows this pattern:
1. **Normalization:** Convert file/descriptor to an asset object.
2. **Pre-load Animation:** Start `slideOutAnimation` if a mesh is already present.
3. **Activation:** Call `ensureSplatEntry` and `activateSplatEntry` via `splatManager`.
4. **Metadata:** Apply camera metadata (intrinsics, pose) if available.
5. **Warmup:** Render for a few frames to stabilize before capturing preview/background.
6. **Finalize:** Apply `slideInAnimation` and update store status.

## 🤖 Interaction Rules

- **Proactiveness:** Always ensure your changes don't break the Three.js render loop or state sync.
- **Verification:** After modifying UI components, ensure they are responsive and work on both mobile and desktop.
- **Dependencies:** Verify if a package is already in `package.json` before suggesting or using it.
- **Performance:** Avoid expensive operations in the render loop (`animate` function in `viewer.js`).
- **Mobile First:** The application is designed to work well on mobile. Test transitions and sheet layouts carefully.

## 🛠 Specialized Modules

- **Immersive Mode:** `src/immersiveMode.js` handles device orientation-based camera control.
- **Background Manager:** `src/backgroundManager.js` handles blurred background generation from the scene.
- **VR Support:** `src/vrMode.js` and `src/vrButton.ts` provide WebXR integration.
- **Layout:** `src/layout.js` handles aspect ratio management between 3D scene and UI.

## 🧩 Key Components & Patterns

- **App.jsx:** Root component, handles global event listeners and layout orchestrations.
- **Viewer.jsx:** Lightweight wrapper for the Three.js canvas.
- **SidePanel.jsx / MobileSheet.jsx:** Responsive UI for settings and logs.
- **AssetSidebar.jsx:** Gallery for navigating between loaded files.
- **Transitions:** Handled via GSAP and custom CSS classes (`slide-out`, `slide-in`).

## 💾 Storage Backends

- **FileSystemSource:** Uses the File System Access API for local folder access.
- **SupabaseSource:** Connects to Supabase buckets for remote asset loading.
- **PublicUrlSource:** Loads assets from a list of public URLs.
- **IndexedDB:** Used for persisting storage source configurations and caching thumbnails.
