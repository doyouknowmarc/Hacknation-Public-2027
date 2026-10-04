#!/bin/sh
set -e
S=/Users/marc/.claude/skills/faceless-explainer/scripts
python3 build-frames.py >/dev/null
node $S/assemble-index.mjs --storyboard ./STORYBOARD.md --hyperframes . >/dev/null
node $S/transitions.mjs inject --storyboard ./STORYBOARD.md --hyperframes . >/dev/null
node $S/transitions.mjs verify --storyboard ./STORYBOARD.md --index ./index.html
