/**
 * Main entry point - Preact app initialization
 */

import { render } from 'preact';
import App from './components/App';
import './style.css';

// Render the Preact app
render(<App />, document.getElementById('app'));
