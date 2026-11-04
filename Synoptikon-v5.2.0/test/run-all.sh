#!/bin/sh
# Runs every test that only needs the public sample files in ../samples
# (cuibonobo/procreate-rs reference_files + alcor6502/Procreate-Exporter example, see README).
set -e
cd "$(dirname "$0")/.."
python3 build.py
node test/t1.js parse-reference rgb rgb-appearance neon
node test/t2.js parse-reference rgb rgb-appearance neon
node test/t6_plist_roundtrip.js parse-reference rgb rgb-appearance rgb-preference-display-class neon
node test/t7_lz4.js
node test/t8_writer.js parse-reference rgb neon
node test/make_grouped.js ../samples/rgb.procreate /tmp/grouped.procreate
node test/t9_writer_groups.js
node test/t10_toimage.js parse-reference rgb neon
node test/t11_codecs.js neon rgb parse-reference rgb-appearance
node test/make_many.js ../samples/rgb.procreate /tmp/many.procreate 60
node test/e2e.js /tmp/shots
