// Builds utilities.css: the Tailwind classes this git-ignored folder uses (the app's Tailwind does not scan it).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../../../package.json', import.meta.url))
const postcss = require('postcss')
const tw = require('@tailwindcss/postcss')

const dir = path.dirname(new URL(import.meta.url).pathname)
const input = `@import 'tailwindcss/theme' theme(reference);\n@import 'tailwindcss/utilities' layer(utilities) source(none);\n@source '..';\n`
const from = path.join(dir, '__in.css')

// Scope every utility to the landing root: this file stays loaded after client navigation to /login or the
// dashboard, and unscoped copies (e.g. `.hidden`) would override the app's own responsive classes there.
const SCOPE = '.lx-landing'

const scope = () => ({
  postcssPlugin: 'lx-scope',
  OnceExit(root) {
    root.walkRules(rule => {
      const parent = rule.parent

      if (parent?.type === 'atrule' && /keyframes/.test(parent.name)) return
      if (rule.selectors.some(sel => sel.startsWith(':root') || sel.startsWith('*') || sel.startsWith('::'))) return

      rule.selectors = rule.selectors.map(sel => `${SCOPE} ${sel}`)
    })
  }
})

scope.postcss = true

const out = await postcss([tw({ base: dir, optimize: { minify: false } }), scope()]).process(input, { from })
const header = '/* Generated from the Tailwind classes used in this folder (Tailwind skips git-ignored folders, so the app build\n   does not see them). Regenerate after changing classes: node "src/app/(landing)/landing/gen-css.mjs". */\n'

fs.writeFileSync(path.join(dir, 'utilities.css'), header + out.css)
console.log('utilities.css', out.css.length, 'bytes')
