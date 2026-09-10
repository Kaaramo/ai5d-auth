/**
 * Preparation commune a tous les fichiers de test.
 *
 * Elle ajoute les matcheurs de `@testing-library/jest-dom` — `toBeInTheDocument`,
 * `toHaveAttribute` et les autres. L import est sans effet dans un environnement node :
 * il etend `expect`, il ne touche a aucun DOM.
 */
import '@testing-library/jest-dom/vitest';
