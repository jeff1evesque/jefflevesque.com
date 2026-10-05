/**
 * fit-row-stylesheet.test.js: what '_fit-row.scss' promises a row of controls
 * that keeps to one line on a phone (#224), and where 'style.scss' reads it in.
 *
 * jsdom lays nothing out and resolves no container query, so no suite can see a
 * row shrink to fit a phone. What can be held is the rule that decides it: the
 * row is a size container, and what is in it is sized in '--fit-rem', which is
 * 1rem until the row is narrower than it needs, and shrinks with the row below
 * that.
 *
 * Note: read the way cube-stylesheet.test.js reads its partials: comments taken
 *       out, and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

//
// a partial's text, its comments taken out
//
function read(file) {
    return fs.readFileSync(path.resolve(__dirname, '../../../scss', file), 'utf8').replace(/\/\/.*$/gm, '');
}

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

describe('a row that keeps to one line on a phone (#224)', () => {
    const [mixin] = blocks(read('_fit-row.scss'), '@mixin fit-row($needs)');

    it('is a size container, which what is in it measures', () => {
        expect(mixin).toMatch(/container-type\s*:\s*inline-size\s*;/);
    });

    it('sizes what is in it in a rem that is 1rem until the row is short of its needs', () => {
        expect(mixin).toMatch(/--fit-rem\s*:\s*min\(1rem,\s*100cqi \/ #\{\$needs\}\)\s*;/);
    });

    it('is read in before every partial that uses it', () => {
        const style = read('style.scss');
        const at = (name) => style.indexOf(`@import '${name}';`);

        expect(at('fit-row')).toBeGreaterThan(at('theme'));
        ['article', 'graph', 'stream'].forEach((name) => {
            expect(at('fit-row')).toBeLessThan(at(name));
            expect(read(`_${name}.scss`)).toMatch(/@include fit-row\(/);
        });
    });
});
