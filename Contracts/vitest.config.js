import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los tests de este paquete validan datos puros (JSON + fs): no necesitan DOM.
    // Sin config propia heredan el `environment: 'jsdom'` de la raíz, y este
    // paquete no declara jsdom (el paso de CI moría con «Cannot find dependency
    // 'jsdom'» antes de ejecutar un solo test).
    environment: 'node',
  },
});
