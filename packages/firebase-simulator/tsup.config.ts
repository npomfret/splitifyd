import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'node18',
    external: ['firebase-admin', 'firebase-functions'],
    outExtension({ format }) {
        return {
            js: format === 'esm' ? '.mjs' : '.cjs',
        };
    },
});
