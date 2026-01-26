# AGENTS.md - Development Guidelines for browser-sharp

This document provides comprehensive guidelines for agentic coding assistants working on the browser-sharp codebase. Follow these conventions to maintain code quality and consistency.

## Build, Lint, and Test Commands

### Development Server
```bash
npm run dev          # Start Vite development server (hot reload)
npm run preview      # Preview production build locally
```

### Building
```bash
npm run build        # Build for production (outputs to dist/)
```

### Testing
**Note**: No test framework is currently configured. When adding tests:
```bash
# Future test commands (to be configured):
npm run test         # Run all tests
npm run test:unit    # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:watch   # Run tests in watch mode
```

### Single Test Execution
```bash
# When test framework is added, use:
npm run test -- path/to/test.spec.js    # Run single test file
npm run test -- --grep "test name"      # Run specific test by name
```

### Linting and Code Quality
**Note**: No linter is currently configured. When adding linting:
```bash
# Future lint commands (to be configured):
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix ESLint issues
npm run typecheck    # TypeScript type checking (for .ts files)
```

## Code Style Guidelines

### Language and Framework
- **Primary Framework**: Preact (lightweight React alternative)
- **Build Tool**: Vite
- **3D Graphics**: Three.js
- **State Management**: Zustand
- **File Extensions**: `.jsx` for components, `.js` for utilities, `.ts` for TypeScript files

### Import Organization
```javascript
// 1. Preact/React imports first
import { useEffect, useState, useCallback } from 'preact/hooks';

// 2. Third-party libraries (alphabetical)
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useStore } from '../store';

// 3. Local imports (relative, organized by type)
// - Components
import Viewer from './Viewer';
import SidePanel from './SidePanel';

// - Utilities and modules
import { initViewer } from '../viewer';
import { resize, loadFromStorageSource } from '../fileLoader';

// - Storage abstractions
import { getSourcesArray, createPublicUrlSource } from '../storage/index.js';
```

### Naming Conventions

#### Variables and Functions
- **camelCase**: `currentAssetIndex`, `handleResetView`, `updateControlSpeedsForFov`
- **Boolean prefixes**: `isFullscreen`, `hasMesh`, `viewerReady`
- **Event handlers**: `handle[Action]` pattern: `handleResetView`, `handleToggleFullscreen`

#### Components
- **PascalCase**: `App`, `Viewer`, `SidePanel`, `AssetGallery`
- **File names**: Match component name: `App.jsx`, `Viewer.jsx`

#### CSS Classes
- **kebab-case**: `bottom-controls`, `panel-open`, `immersive-toggle`
- **BEM-like structure**: `bottom-controls-left`, `bottom-controls-center`

#### Constants
- **UPPER_SNAKE_CASE**: `PANEL_TRANSITION_MS`, `SOURCE_TIERS`

### Code Structure

#### Component Structure
```jsx
/**
 * Component description with JSDoc
 */
function ComponentName(props) {
  // Store hooks at top
  const state = useStore((state) => state.value);
  const action = useStore((state) => state.action);

  // Local state
  const [localState, setLocalState] = useState(initialValue);

  // Refs
  const elementRef = useRef(null);

  // Effects (useEffect, useCallback, etc.)
  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // Event handlers
  const handleEvent = useCallback(() => {
    // Handler logic
  }, [dependencies]);

  // Render
  return (
    <div className="component">
      {/* JSX */}
    </div>
  );
}

export default ComponentName;
```

#### Function Documentation
Use JSDoc for all exported functions and complex internal functions:

```javascript
/**
 * Handles reset view with immersive mode support.
 * Uses shared function that handles immersive mode state.
 */
const handleResetView = useCallback(() => {
  resetViewWithImmersive();
}, []);
```

#### Module Documentation
```javascript
/**
 * Storage Module Index
 *
 * Re-exports all storage-related functionality for convenient imports.
 */
```

### Error Handling

#### Async Operations
```javascript
const handleAsyncOperation = async () => {
  try {
    await someAsyncFunction();
  } catch (err) {
    console.error('Operation failed:', err?.message || err);
    // Handle error appropriately
  }
};
```

#### User-Facing Errors
```javascript
try {
  await loadFromStorageSource(source);
} catch (err) {
  addLog('Failed to load from storage: ' + (err?.message || err));
}
```

#### Global Error Handling
```javascript
// In main.jsx - catch unhandled errors
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason, event);
  if (event.reason && event.reason.stack) console.error(event.reason.stack);
});

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.message, 'at', event.filename + ':' + event.lineno + ':' + event.colno);
  if (event.error && event.error.stack) console.error(event.error.stack);
});
```

### State Management

#### Zustand Store Usage
```javascript
// In components - selective state access
const panelOpen = useStore((state) => state.panelOpen);
const togglePanel = useStore((state) => state.togglePanel);

// In store definition - actions as functions
export const useStore = create((set, get) => ({
  panelOpen: false,
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
}));
```

### File Organization

#### Directory Structure
```
src/
├── components/          # React components (.jsx)
├── storage/            # Storage abstractions (.js)
├── formats/            # File format handlers (.js)
├── utils/              # Utility functions (.js)
├── [module].js         # Main module files
└── main.jsx           # Application entry point
```

#### File Naming
- Components: `ComponentName.jsx`
- Utilities: `utilityName.js`
- Modules: `moduleName.js`
- Types: `types.js`

### TypeScript Usage
- Use `.ts` extension for TypeScript files
- Use type imports: `import type * as THREE from "three";`
- Interface with Three.js objects when possible
- Use JSDoc for type documentation in JavaScript files

### CSS Guidelines

#### Structure
- Use CSS custom properties (CSS variables) for theming
- Modern CSS features: gradients, flexbox, grid
- Mobile-first responsive design
- Use `dvh` units for dynamic viewport height on mobile

#### Class Naming
```css
/* Component-specific classes */
.viewer-container {
  /* Styles */
}

/* State-based classes */
.panel-open .side-panel {
  /* Conditional styles */
}

/* Utility classes */
.bottom-controls {
  display: flex;
  justify-content: space-between;
}
```

#### Mobile Considerations
```css
/* Touch device optimizations */
@media (pointer: coarse) {
  button {
    min-height: 44px; /* Minimum touch target */
    -webkit-tap-highlight-color: transparent;
  }
}
```

### Performance Considerations

#### React/Preact Best Practices
- Use `useCallback` for event handlers passed to child components
- Use `useMemo` for expensive computations
- Avoid unnecessary re-renders with selective state access
- Use refs for direct DOM manipulation (Three.js integration)

#### Three.js Integration
- Initialize renderer/camera/controls once
- Use requestAnimationFrame for render loops
- Clean up event listeners and Three.js objects on unmount
- Use proper disposal methods for geometries/materials

### Security and Best Practices

#### Storage and APIs
- Use IndexedDB for client-side persistence
- Validate file inputs and storage sources
- Handle CORS and security restrictions gracefully
- Never store sensitive credentials in client code

#### Error Boundaries
```jsx
// Consider implementing error boundaries for Three.js components
class ViewerErrorBoundary extends Component {
  // Error boundary implementation
}
```

### Development Workflow

#### Git Workflow
- Follow conventional commit messages
- Use feature branches for new functionality
- Run build before committing
- Test on multiple browsers (Chrome, Firefox, Safari, Edge)

#### Code Review Checklist
- [ ] Imports organized correctly
- [ ] JSDoc comments for public APIs
- [ ] Error handling implemented
- [ ] Mobile responsiveness tested
- [ ] Performance impact considered
- [ ] No console.log statements in production code

### Tooling Configuration

#### Future Additions
When adding development tools, configure:

**ESLint Configuration**:
```javascript
// eslint.config.js (future)
export default [
  // ESLint rules for Preact/React
];
```

**Prettier Configuration**:
```javascript
// .prettierrc.js (future)
export default {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  // Preact/React formatting rules
};
```

**Testing Setup**:
```javascript
// jest.config.js or vitest.config.js (future)
// Testing configuration for component and utility testing
```

This document should be updated as the codebase evolves and new patterns emerge.
