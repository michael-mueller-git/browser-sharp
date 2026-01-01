/**
 * Log panel component.
 * Collapsible debug console displaying timestamped log messages.
 * Shows most recent logs at the top.
 */

import { useRef, useEffect } from 'preact/hooks';
import { useStore } from '../store';

function LogPanel() {
  // Store state
  const logs = useStore((state) => state.logs);
  const logExpanded = useStore((state) => state.logExpanded);
  
  // Store actions
  const toggleLogExpanded = useStore((state) => state.toggleLogExpanded);

  return (
    <div class={`log-panel ${logExpanded ? 'expanded' : ''}`}>
      {/* Collapsible header */}
      <button
        class="log-toggle"
        type="button"
        aria-expanded={logExpanded}
        onClick={toggleLogExpanded}
      >
        <span class="settings-eyebrow">Debug console</span>
        <span class="chevron" aria-hidden="true" />
      </button>
      
      {/* Log content */}
      <div 
        class="log" 
        style={{ display: logExpanded ? 'block' : 'none' }}
      >
        {logs.length > 0 ? logs.join('\n') : 'No logs yet'}
      </div>
    </div>
  );
}

export default LogPanel;
