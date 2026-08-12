#!/usr/bin/env python3
"""
coverage_badge.py: build the shields.io endpoint payload for the coverage badge.

shields.io renders a static badge from whatever text sits in its URL, so the figure in
README.md is hardcoded and stale the moment coverage moves -- it read 28% for a long
stretch after coverage had passed 80%. An 'endpoint' badge fixes that: shields.io
fetches a small JSON document at render time and draws whatever it finds, so the number
follows CI instead of memory.

This script produces that document, and nothing else:

    {"schemaVersion": 1, "label": "coverage", "message": "90%", "color": "brightgreen"}

Usage:

    python3 scripts/coverage_badge.py jsx/coverage-summary.json

Note: the payload carries the OVERALL statement percentage and no other field. Coverage
      reports are full of absolute paths to source files -- 'coverage-summary.json' has
      one key per .jsx in the tree -- and the document this writes is published to a
      PUBLIC gist. So the file name of every source file, and the shape of the tree, must
      not travel with it. The check below enforces that rather than trusting this
      docstring: it refuses to emit a payload containing a path separator or a source
      extension, whatever the input looked like.
"""

import json
import re
import sys


#
# the usual shields.io ladder. Coverage is a proportion, so the colour carries the
# reading a reviewer takes at a glance and the number carries the detail.
#
COLORS = [
    (90, 'brightgreen'),
    (80, 'green'),
    (70, 'yellowgreen'),
    (60, 'yellow'),
    (50, 'orange'),
    (0, 'red'),
]

#
# anything that would leak a file name, a directory or the tree's shape. Applied to the
# SERIALISED payload, so it catches a leak through any field rather than a field this
# script currently happens to set.
#
FORBIDDEN = re.compile(r'[/\\]|\.jsx?\b|\.tsx?\b|node_modules|import\b|__tests__')


def color_for(pct):
    for floor, color in COLORS:
        if pct >= floor:
            return color
    return 'red'


def payload_from(summary):
    """The badge document for a jest json-summary, overall statements only."""
    pct = summary['total']['statements']['pct']

    return {
        'schemaVersion': 1,
        'label': 'coverage',
        'message': f'{round(pct)}%',
        'color': color_for(pct),
    }


def main(argv):
    if len(argv) != 2:
        sys.stderr.write('usage: coverage_badge.py <coverage-summary.json>\n')
        return 2

    with open(argv[1], encoding='utf-8') as handle:
        summary = json.load(handle)

    payload = payload_from(summary)
    serialised = json.dumps(payload, separators=(',', ':'), sort_keys=True)

    #
    # the guard that makes this safe to publish. A future change that widened the
    # payload -- a per-file breakdown, a link back to the report -- would fail here
    # rather than quietly publishing the tree to a public gist.
    #
    leak = FORBIDDEN.search(serialised)
    if leak:
        sys.stderr.write(
            f'refusing to publish: payload contains {leak.group(0)!r}, which could '
            f'identify a source file.\n{serialised}\n'
        )
        return 1

    #
    # the four keys shields.io reads, and no others -- an unexpected key is a sign the
    # payload was built from something other than payload_from().
    #
    expected = {'schemaVersion', 'label', 'message', 'color'}
    if set(payload) != expected:
        sys.stderr.write(f'refusing to publish: unexpected keys {set(payload) ^ expected}\n')
        return 1

    print(serialised)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
