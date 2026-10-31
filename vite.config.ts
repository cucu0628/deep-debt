import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** AdSense needs /ads.txt on the site root: generate it for the web build once a real publisher ID is set. */
function adsTxt(client: string | undefined): Plugin {
  return {
    name: 'ads-txt',
    apply: 'build',
    generateBundle() {
      if (!client || !/^ca-pub-\d{10,}$/.test(client)) return;
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), env.VITE_ADS === 'adsense' ? adsTxt(env.VITE_ADSENSE_CLIENT) : null],
    // Relative paths work on GitHub Pages (/repo-name/) and inside the CrazyGames iframe alike.
    base: './',
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
