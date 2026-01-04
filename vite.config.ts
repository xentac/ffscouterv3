import path from 'node:path';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/index.ts',
      build: {
        fileName: 'base.user.js',
      },
      userscript: {
        name: 'Just A Base Script',
        author: 'MAVRI [2402357]',
        description: 'It does what it says on the tin (maybe).',
        copyright: '2025, diicot.cc',
        namespace: 'mavri',
        license: 'GPLv3',
        match: ['https://www.torn.com/*'],
        'run-at': 'document-start', // This has to be "document-start" to intercept http & ws
      },
    }),
  ],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@features': path.resolve(__dirname, 'src/features'),
    },
  },
  build: {
    minify: false,
  },
});
