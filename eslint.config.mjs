import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The React Compiler lint flags the standard "fetch on mount, then setState" effect
      // (used throughout, no data-fetching library) as a cascading render. Intentional here.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  { files: ['scripts/**'], rules: { '@typescript-eslint/no-unused-expressions': 'off' } },
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/sw.js'] },
];
export default config;
