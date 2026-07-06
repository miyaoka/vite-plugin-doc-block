import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
}, {
  // Disable optimization rules inside markdown code blocks (README etc.)
  files: ['**/*.md/**'],
  rules: {
    'e18e/prefer-static-regex': 'off',
  },
})
