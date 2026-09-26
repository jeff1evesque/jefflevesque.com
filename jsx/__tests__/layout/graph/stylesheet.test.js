/**
 * stylesheet.test.js: what the graph page's stylesheet promises about the legend,
 * read out of '_graph.scss'.
 *
 * jsdom lays nothing out, so no suite can see a name run past the edge of its
 * column. What can be held is the rule that decides it: a namespace's name wraps
 * at its hyphen when its column is too narrow, rather than being clipped. The
 * legend showed 'noaa-cap-mode' and 'market-enrichm' cut off at the edge of the
 * side column when every namespace began to name its source -- see the note above
 * '.graph-legend-namespaces'.
 *
 * Note: read the way breath.test.js reads '_animation.scss': comments taken out,
 *       and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

const SCSS = path.resolve(__dirname, '../../../../scss/_graph.scss');

const source = fs.readFileSync(SCSS, 'utf8').replace(/\/\/.*$/gm, '');

//
// the text between the braces of every block opened by `header`, at any depth
//
function blocks(text, header) {
    const found = [];
    const opener = new RegExp(`(^|\\s)${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');
    let match;

    while ((match = opener.exec(text)) !== null) {
        const start = match.index + match[0].length;
        let depth = 1;
        let at = start;

        while (depth > 0 && at < text.length) {
            if (text[at] === '{') depth += 1;
            if (text[at] === '}') depth -= 1;
            at += 1;
        }

        found.push(text.slice(start, at - 1));
    }

    return found;
}

describe('a namespace in the legend', () => {
    const [namespaces] = blocks(source, '.graph-legend-namespaces');
    const [entry] = namespaces ? blocks(namespaces, '.graph-legend-entry') : [];

    it('is laid out by a rule of its own', () => {
        expect(entry).toBeDefined();
    });

    it('is never clipped at the edge of its column', () => {
        expect(entry).not.toMatch(/text-overflow\s*:/);
        expect(entry).not.toMatch(/overflow\s*:\s*hidden/);
        expect(entry).not.toMatch(/white-space\s*:\s*nowrap/);
    });

    it('wraps a name too long for its column, with its swatch beside it', () => {
        expect(entry).toMatch(/overflow-wrap\s*:\s*anywhere\s*;/);
        expect(entry).toMatch(/flex-wrap\s*:\s*nowrap\s*;/);
    });
});
