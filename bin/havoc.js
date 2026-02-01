#!/usr/bin/env node

// CLI entry point - loads the compiled TypeScript
import('../dist/index.js').catch((err) => {
  console.error('Failed to start Havoc:', err.message);
  console.error('\nMake sure to build first: npm run build');
  process.exit(1);
});
