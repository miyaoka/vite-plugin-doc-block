import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  // Test fixtures are intentionally edge-case SFC inputs (e.g. duplicate
  // imports across <script> and <script setup>, which compileScript dedupes)
  ignores: ['test/fixtures/**'],
}, {
  // Disable optimization rules inside markdown code blocks (README etc.)
  files: ['**/*.md/**'],
  rules: {
    'e18e/prefer-static-regex': 'off',
  },
})
