// Prettier is here for `.astro` files and nothing else — oxfmt formats the rest
// of the repo (.oxfmtrc.json) and has no astro parser. The options below are
// oxfmt's, spelled again because the two tools have to agree about the same
// codebase.
export default {
  plugins: ['prettier-plugin-astro'],
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
  proseWrap: 'always',
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
}
