#!/bin/bash

# manually updates all of the emitted .js files to .cjs (including require statements)
# so that the output is compatible with CommonJS

OUTDIR=$1

if [[ $OUTDIR == ./dist* ]]; then
  find $OUTDIR -type f -exec sh -c '
    sed -r -i "s/require\((.+)\.js/require\(\1.cjs/g" $0
    mv -- "$0" "${0%.js}.cjs"
  ' {} \;
else
  echo "Invalid output directory: $OUTDIR"
  exit 1
fi
