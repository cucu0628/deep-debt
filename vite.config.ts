import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** AdSense: /ads.txt and the ownership meta tag, for the web build once a real publisher ID is set. */
function adsense(client: string | undefined): Plugin | null {
  if (!client || !/^ca-pub-\d{10,}$/.test(client)) return null;
  return {
    name: 'adsense',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` });
    },
    // Site ownership tag that AdSense asks for.
    transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'google-adsense-account', content: client! }, injectTo: 'head' }],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), env.VITE_ADS === 'adsense' ? adsense(env.VITE_ADSENSE_CLIENT) : null],
    // Relative paths work on GitHub Pages (/repo-name/) and inside the CrazyGames iframe alike.
    base: './',
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
