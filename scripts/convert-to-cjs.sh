#!/bin/bash

# manually updates all of the emitted .js files to .cjs (including require statements)
# so that the output is compatible with CommonJS

find ./dist/cjs -type f -exec sh -c '
  sed -r -i "s/require\((.+)\.js/require\(\1.cjs/g" $0
  mv -- "$0" "${0%.js}.cjs"
' {} \;