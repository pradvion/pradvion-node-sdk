const fs = require('fs')
const path = require('path')
const distDir = path.join(__dirname, '..', 'dist')
const indexJs = path.join(distDir, 'index.js')
const indexMjs = path.join(distDir, 'index.mjs')
if (fs.existsSync(indexJs)) {
  fs.copyFileSync(indexJs, indexMjs)
  console.log('Built: dist/index.mjs')
}
console.log('Build complete.')
