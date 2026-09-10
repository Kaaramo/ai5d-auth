import { defineConfig } from 'vitest/config';

export default defineConfig({
  /**
   * Le JSX est transforme par esbuild, que Vitest embarque deja.
   *
   * `@vitejs/plugin-react` ferait le meme travail, mais sa version courante exige Vite 8 quand
   * Vitest 2 en apporte 5 : la dependance de pair n est pas satisfaite. Aucun test ici ne
   * demande le rafraichissement rapide ni le profileur React.
   */
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    // Par defaut node : la plupart des tests lisent des sources et ne touchent aucun DOM. Le
    // test des composants demande jsdom par une annotation en tete de fichier.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/preparation.ts'],
  },
});
