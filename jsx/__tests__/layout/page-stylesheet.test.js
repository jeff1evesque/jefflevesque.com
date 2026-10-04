/**
 * page-stylesheet.test.js: what '_layout.scss' promises about the footer every
 * page closes with (#202): no line over it, drawn over whatever a page lays
 * under it, and its text 10px higher than the line's footer held it (#204).
 *
 * jsdom lays nothing out and paints nothing, so no suite can see the front
 * page's graph drawn over the footer, or measure the room around its text. What
 * can be held is the rules that decide them.
 *
 * Note: read the way navigation/stylesheet.test.js reads its partials:
 *       comments taken out, and a block found by its header, whole.
 */

import fs from 'fs';
import path from 'path';

//
// a partial's text, its comments taken out
//
function read(file) {
    return fs.readFileSync(path.resolve(__dirname, '../../../scss', file), 'utf8').replace(/\/\/.*$/gm, '');
}

const source = read('_layout.scss');

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

//
// a block's own declarations, the blocks nested in it taken out
//
function own(text) {
    let out = text;
    let last;

    do {
        last = out;
        out = out.replace(/[^{};]*\{[^{}]*\}/g, '');
    } while (out !== last);

    return out;
}

describe('the footer (#204)', () => {
    const [footer] = blocks(source, '#bootstrap-override .site-footer');
    const [phone] = blocks(source, '.small-viewport').flatMap((block) => blocks(block, '.site-footer'));

    it('is laid out by a rule of its own, and a phone pins it by another', () => {
        expect(footer).toBeDefined();
        expect(phone).toBeDefined();
    });

    it('has no line over it, on any screen', () => {
        const all = blocks(source, '.site-footer');

        expect(all.length).toBeGreaterThanOrEqual(3);
        all.forEach((block) => expect(own(block)).not.toMatch(/border/));
    });

    it('stands over whatever a page lays under it, as the front page\'s graph', () => {
        expect(own(footer)).toMatch(/(^|[\s;])z-index\s*:\s*1\s*;/);
    });

    it('is placed on a wide screen, for the z-index to take, in a rule of its own', () => {
        expect(source).toMatch(/\.large-viewport,\s*\.medium-viewport\s*\{\s*\.site-footer\s*\{\s*position\s*:\s*relative\s*;\s*\}\s*\}/);
    });

    it('leaves a phone its absolute: the rule that outranks a phone\'s sets no position', () => {
        expect(own(footer)).not.toMatch(/(^|[\s;])position\s*:/);
        expect(own(phone)).toMatch(/(^|[\s;])position\s*:\s*absolute\s*;/);
    });

    it('moves 10px from over its text to under it, so the text stands 10px higher and the footer is no taller', () => {
        const padding = own(footer).match(
            /(^|[\s;])padding\s*:\s*calc\(([\d.]+)rem - (\d+)px\)\s+1rem\s+calc\(([\d.]+)rem \+ (\d+)px\)\s*;/
        );

        expect(padding).not.toBeNull();

        const [, , over, less, under, more] = padding;

        //
        // 1.25rem over the text and 1.5rem under it, as #202 laid them out
        //
        expect([Number(over), Number(under)]).toEqual([1.25, 1.5]);
        expect([Number(less), Number(more)]).toEqual([10, 10]);
    });
});
