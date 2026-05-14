import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'English Lookup & Translation 2026',
  version: '0.1.0',
  description:
    'Click the toolbar icon, then highlight: 1 word = dictionary popup + target-language gloss; 2+ words = side panel translation (Azure or proxy).',
  action: {
    default_title: 'English Lookup — Bật chế độ bôi đen (chuột kính lúp)',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
  permissions: ['storage', 'sidePanel', 'tabs', 'contextMenus', 'scripting'],  host_permissions: [
    'https://api.dictionaryapi.dev/*',
    'https://api.cognitive.microsofttranslator.com/*',
    'https://*.cognitiveservices.azure.com/*',
    'http://*/*',
    'https://*/*',
  ],
})
