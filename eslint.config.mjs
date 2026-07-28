import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

/** Flat config. The ignores block matters: `eslint .` would otherwise walk the generated build
 *  output (.next, .next-verify) and report thousands of problems in code we don't own. */
const config = [
  { ignores: ['.next/**', '.next-verify/**', 'node_modules/**', 'out/**', 'build/**', '_import/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default config
