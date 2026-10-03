/**
 * sunburst-stylesheet.test.js: what '_sunburst.scss' promises about the list
 * under the ring on a phone.
 *
 * jsdom lays nothing out, so no suite can see where the list stops. What can be
 * held is the rule that decides it: on a phone the list runs its whole length
 * with the page, rather than scrolling in a box of its own -- which, with no
 * scrollbar on a phone to say there was more, read as the end of the list six
 * days into a month of twenty.
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

describe('the list on a phone', () => {
    const [phone] = blocks(read('_sunburst.scss'), '.sunburst-phone');
    const [list] = phone ? blocks(phone, '.sunburst-list') : [];

    it('is laid out by a rule of its own', () => {
        expect(list).toBeDefined();
    });

    it('runs its whole length with the page, in no box of its own', () => {
        expect(list).toMatch(/overflow-y\s*:\s*visible\s*;/);
        expect(list).not.toMatch(/max-height/);
    });
});
