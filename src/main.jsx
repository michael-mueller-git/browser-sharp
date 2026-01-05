/**
 * Main entry point - Preact app initialization
 */

import { render } from 'preact';
import App from './components/App';
import './style.css';

// Render the Preact app
render(<App />, document.getElementById('app'));

// Global error handlers to capture unhandled rejections and errors
window.addEventListener('unhandledrejection', (event) => {
	console.error('Unhandled promise rejection:', event.reason, event);
	// Log stack if available
	if (event.reason && event.reason.stack) console.error(event.reason.stack);
});

window.addEventListener('error', (event) => {
	console.error('Uncaught error:', event.message, 'at', event.filename + ':' + event.lineno + ':' + event.colno);
	if (event.error && event.error.stack) console.error(event.error.stack);
});
