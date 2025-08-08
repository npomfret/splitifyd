// Prerender entry point for SSG
// This file is used during build time to generate static HTML

import {prerender as ssr} from 'preact-iso';
import {App} from './App';

// Simplified app without auth for prerendering
function PrerenderApp() {
  return <App />;
}

export async function prerender(data: any) {
  // Skip auth provider for SSG - just render the app directly
  // Return the generated HTML
  return await ssr(<PrerenderApp {...data} />);
}