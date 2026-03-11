import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
}, {
  // README等のmarkdown内コードブロックでは最適化ルールを無効化
  files: ['**/*.md/**'],
  rules: {
    'e18e/prefer-static-regex': 'off',
  },
})
