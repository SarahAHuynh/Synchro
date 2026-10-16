import type { NextConfig } from 'next';
const config: NextConfig = {
  // Browser checks use their own build output so they cannot interrupt local development.
  distDir: process.env.SYNCHRO_TEST_BUILD === '1' ? '.next-test' : '.next',
};
export default config;
