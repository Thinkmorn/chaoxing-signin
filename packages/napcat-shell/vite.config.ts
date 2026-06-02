import cp from 'vite-plugin-cp';
import { defineConfig, PluginOption, UserConfig } from 'vite';
import path, { resolve } from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import { builtinModules } from 'module';

const external = [
  'ws',
  'express',
  'electron',
];

const nodeModules = [...builtinModules, builtinModules.map((m) => `node:${m}`), 'node:sqlite'].flat();
const ShellBaseConfigPlugin: PluginOption[] = [
  nodeResolve(),
  cp({
    targets: [
      { src: '../napcat-native/', dest: 'dist/native', flatten: false },
      { src: '../napcat-webui-backend/src/assets/sw_template.js', dest: 'dist/static/' },
      { src: '../napcat-core/external/napcat.json', dest: 'dist/config/' },
      { src: '../../package.json', dest: 'dist' },
    ],
  }),
];
const ShellBaseConfig = (source_map: boolean = false) =>
  defineConfig({
    resolve: {
      conditions: ['node', 'default'],
      alias: {
        '@/napcat-core': resolve(__dirname, '../napcat-core'),
        '@/napcat-common': resolve(__dirname, '../napcat-common'),
        '@/napcat-onebot': resolve(__dirname, '../napcat-onebot'),
        '@/napcat-pty': resolve(__dirname, '../napcat-pty'),
        '@/napcat-dpapi': resolve(__dirname, '../napcat-dpapi'),
        '@/napcat-webui-backend': resolve(__dirname, '../napcat-webui-backend'),
        '@/napcat-image-size': resolve(__dirname, '../napcat-image-size'),
        '@/napcat-protocol': resolve(__dirname, '../napcat-protocol'),
      },
    },
    build: {
      sourcemap: source_map,
      target: 'esnext',
      minify: false,
      lib: {
        entry: {
          napcat: path.resolve(__dirname, 'napcat.ts'),
          'worker/conoutSocketWorker': path.resolve(__dirname, '../napcat-pty/worker/conoutSocketWorker.ts'),
        },
        formats: ['es'],
        fileName: (_, entryName) => `${entryName}.mjs`,
      },
      rollupOptions: {
        external: [...nodeModules, ...external],
      },
    },
  });
export default defineConfig(({ mode }): UserConfig => {
  if (mode === 'development') {
    return {
      ...ShellBaseConfig(true),
      plugins: [...ShellBaseConfigPlugin],
    };
  }
  return {
    ...ShellBaseConfig(),
    plugins: [...ShellBaseConfigPlugin],
  };
});
