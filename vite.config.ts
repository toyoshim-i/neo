import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Ensures `hachiue`'s inline Blob Web Worker (`wasmWorkerEntrypoint`) receives
 * `createWasmCore` as a lexical parameter so production minification (which
 * renames `function createWasmCore` to a short identifier like `Fh`) does not
 * throw `ReferenceError: Fh is not defined` inside the isolated Worker scope
 * and fall back to the main UI thread.
 */
function hachiueWasmWorkerFix(): Plugin {
  return {
    name: 'hachiue-wasm-worker-fix',
    transform(code, id) {
      if (!id.includes('hachiue') || !code.includes('wasmWorkerEntrypoint')) {
        return null;
      }
      const patched = code
        .replace(
          'function wasmWorkerEntrypoint()',
          'function wasmWorkerEntrypoint(createWasmCore)'
        )
        .replace(
          'const src = `const createWasmCore = ${createWasmCore.toString()};\\n(${wasmWorkerEntrypoint.toString()})();`;',
          'const src = `(${wasmWorkerEntrypoint.toString()})(${createWasmCore.toString()});`;'
        );
      return patched !== code ? { code: patched, map: null } : null;
    },
    renderChunk(code) {
      const pattern =
        /const createWasmCore\s*=\s*\$\{([A-Za-z0-9_$]+)\.toString\(\)\};/g;
      if (!pattern.test(code)) return null;
      return {
        code: code.replace(
          pattern,
          'var createWasmCore = $1 = ${$1.toString()};'
        ),
        map: null,
      };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [hachiueWasmWorkerFix(), react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
