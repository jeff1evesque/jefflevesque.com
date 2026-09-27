/**
 * stylesheet.test.js: what the graph page's stylesheet promises about the legend,
 * the reference columns and the page's title, read out of '_graph.scss'.
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

describe('the namespaces, laid out', () => {
    const [namespaces] = blocks(source, '.graph-legend-namespaces');
    const [row] = namespaces ? blocks(namespaces, 'li') : [];
    const [entry] = namespaces ? blocks(namespaces, '.graph-legend-entry') : [];
    const [swatch] = entry ? blocks(entry, '.graph-legend-swatch') : [];

    it('fill their columns top to bottom, so a wrapped name lengthens only its own', () => {
        //
        // a grid fills row by row, and one wrapped name made its whole row two
        // lines tall, over a blank line under the name beside it
        //
        expect(namespaces).toMatch(/columns\s*:\s*8\.5rem\s*;/);
        expect(namespaces).not.toMatch(/display\s*:\s*grid/);
    });

    it('keep each entry whole, and carry no margin over into the next column', () => {
        expect(row).toMatch(/break-inside\s*:\s*avoid\s*;/);
        expect(row).toMatch(/margin-bottom\s*:\s*0\s*;/);
        expect(row).toMatch(/padding-bottom\s*:\s*0\.15rem\s*;/);
    });

    it('sit each swatch level with the first line of its name', () => {
        expect(entry).toMatch(/align-items\s*:\s*flex-start\s*;/);
        expect(swatch).toMatch(/margin-top\s*:\s*calc\(\(1\.5em - 0\.75rem\) \/ 2\)\s*;/);
    });
});

describe('the reference columns beside the graph', () => {
    //
    // the three-column layout, where they ARE side columns. Below it they are
    // bands stacked over the graph, and carry no tint.
    //
    const [wide] = blocks(source, '@media (min-width: $graph-columns)');
    const [panel] = wide ? blocks(wide, '.graph-panel') : [];
    const tinted = wide ? blocks(wide, '.graph-panel-open').find((block) => /background-color/.test(block)) : undefined;
    const tint = tinted ? blocks(tinted, '@include dark').find((block) => /background-color/.test(block)) : undefined;
    const [label] = tinted ? blocks(tinted, '.graph-legend-note') : [];
    const [night] = label ? blocks(label, '@include dark') : [];
    const [hover] = tinted ? blocks(tinted, ".graph-legend-entry:not([aria-pressed='true']):hover") : [];

    it('are tinted a step off the page, in either theme', () => {
        expect(tinted).toMatch(/background-color\s*:\s*\$graph-panel\s*;/);
        expect(tint).toMatch(/background-color\s*:\s*\$dark-graph-panel\s*;/);
    });

    it('run the full height of the row, which is the graph\'s', () => {
        expect(tinted).toMatch(/align-self\s*:\s*stretch\s*;/);
    });

    it('take no padding at the foot, where measureColumns could not see it', () => {
        expect(tinted).not.toMatch(/padding-bottom/);
        expect(tinted).not.toMatch(/padding\s*:/);
    });

    it('take their labels a shade darker by day, and the theme\'s own gray by night', () => {
        expect(label).toMatch(/color\s*:\s*\$graph-panel-label\s*;/);
        expect(night).toMatch(/color\s*:\s*\$gray-6\s*;/);
    });

    it('show a legend row under the pointer a step darker, and leave a held one green', () => {
        expect(hover).toMatch(/background-color\s*:\s*\$gray-2\s*;/);
    });

    it('add the outer padding to their width, so the body keeps $graph-side', () => {
        expect(panel).toMatch(/calc\(#\{\$graph-side\} \+ #\{\$graph-rail-pad\} \+ #\{\$graph-panel-pad\}\)/);
    });
});

describe('a day\'s totals, in the side column', () => {
    //
    // two abreast, a pair to a line, where the column has room for two -- and one
    // to a line where it has been dragged too narrow. No suite can drag a column,
    // so what is held is the rule that decides it. See the note above
    // '.graph-details' in the three-column layout.
    //
    const [wide] = blocks(source, '@media (min-width: $graph-columns)');
    const [details] = wide ? blocks(wide, '.graph-details') : [];
    const [value] = details ? blocks(details, 'dd') : [];
    const [row] = wide ? blocks(wide, '.graph-details-row') : [];
    const [pair] = wide ? blocks(wide, '.graph-details-pair') : [];

    it('lie on a grid of two columns at most, each at least 6.25rem', () => {
        //
        // a 6.25rem track, or half the list where that is wider: two halves fit
        // exactly, and where they are narrower than 6.25rem only one track does
        //
        expect(details).toMatch(/display\s*:\s*grid\s*;/);
        expect(details).toMatch(
            /grid-template-columns\s*:\s*repeat\(auto-fill, minmax\(max\(6\.25rem, calc\(\(100% - [\d.]+rem\) \/ 2\)\), 1fr\)\)\s*;/
        );
    });

    it('halve the list less the gap between its columns', () => {
        //
        // a half that left the gap in would never fit twice, and the totals would
        // never sit two abreast at all
        //
        const [, gap] = details.match(/column-gap\s*:\s*([\d.]+rem)\s*;/) || [];
        const [, halved] = details.match(/calc\(\(100% - ([\d.]+rem)\) \/ 2\)/) || [];

        expect(gap).toBeDefined();
        expect(halved).toBe(gap);
    });

    it('give a row the whole width unless it pairs', () => {
        expect(row).toMatch(/grid-column\s*:\s*1 \/ -1\s*;/);
        expect(pair).toMatch(/grid-column\s*:\s*auto\s*;/);

        // the two weigh the same, so a row that pairs takes the later of them
        expect(wide.indexOf('.graph-details-pair')).toBeGreaterThan(wide.indexOf('.graph-details-row'));
    });

    it('space their rows by the grid, leaving no margin at the foot over the body\'s padding', () => {
        expect(details).toMatch(/row-gap\s*:\s*0\.6rem\s*;/);
        expect(value).toMatch(/margin-bottom\s*:\s*0\s*;/);
    });

    it('pair only in the side column, and keep a row to a line below the breakpoint', () => {
        //
        // a row there is its label at the left and its value at the right, and
        // two abreast would set a value nearer the next label than its own
        //
        const [base] = blocks(source, '.graph-details');

        expect(base).not.toMatch(/display\s*:\s*grid/);
        expect(source.replace(wide, '')).not.toMatch(/graph-details-pair/);
    });
});

//
// a block's value for one property, in rem, as a number
//
function rem(block, property) {
    const [, value] = (block || '').match(new RegExp(`(?:^|[\\s;{])${property}\\s*:\\s*([\\d.]+)rem\\s*;`)) || [];

    return value === undefined ? undefined : Number(value);
}

describe('the foot of each side column', () => {
    //
    // room under each column's last line, for when the column is the tallest
    // thing in the row and would otherwise end flush with its text
    //
    const [wide] = blocks(source, '@media (min-width: $graph-columns)');
    const [body] = wide ? blocks(wide, '.graph-panel-open > .graph-panel-body') : [];
    const [last] = wide ? blocks(wide, '.graph-legend ul:last-child') : [];

    it('is the body\'s own padding, which measureColumns reads down to', () => {
        expect(body).toMatch(/padding-bottom\s*:\s*0\.75rem\s*;/);
    });

    it('is the same in both columns, the legend\'s last list giving up its margin', () => {
        expect(last).toMatch(/margin-bottom\s*:\s*0\s*;/);
    });
});

describe('the rule dividing each side column', () => {
    //
    // under Sources in either page's details, and between the legend's
    // namespaces and its edges: an accent hairline that fades out toward both
    // ends, 1rem clear either side
    //
    const [wide] = blocks(source, '@media (min-width: $graph-columns)');
    const [ruled] = wide ? blocks(wide, '.graph-details-ruled') : [];
    const [legend] = wide ? blocks(wide, '.graph-legend .graph-legend-namespaces') : [];
    const [details] = wide ? blocks(wide, '.graph-details') : [];
    const [heading] = wide ? blocks(wide, '.graph-panel-open > .graph-panel-heading') : [];
    const [namespaces] = blocks(source, '.graph-legend-namespaces');
    const [entry] = namespaces ? blocks(namespaces, 'li') : [];

    it('fades out toward both ends, in the gray of the rule under the column\'s heading', () => {
        expect(wide).toMatch(
            /\$graph-divider\s*:\s*linear-gradient\(to right, transparent, \$gray-2 20%, \$gray-2 80%, transparent\)\s*;/
        );
        expect(heading).toMatch(/border-bottom\s*:\s*1px solid \$gray-2\s*;/);
    });

    it.each([['details', ruled], ['legend', legend]])('closes the first part of the %s with it, as a hairline', (name, block) => {
        expect(block).toMatch(/border-bottom\s*:\s*1px solid\s*;/);
        expect(block).toMatch(/border-image\s*:\s*\$graph-divider 1\s*;/);
    });

    it('stands 1rem clear of the details either side, the row gap giving most of the room below', () => {
        expect(rem(ruled, 'padding-bottom')).toBe(1);
        expect(rem(ruled, 'margin-bottom') + rem(details, 'row-gap')).toBeCloseTo(1);
    });

    it('stands 1rem clear of the legend either side, each namespace\'s padding giving some of the room above', () => {
        expect(rem(legend, 'padding-bottom') + rem(entry, 'padding-bottom')).toBeCloseTo(1);
        expect(rem(legend, 'margin-bottom')).toBe(1);
    });
});

describe('the tint, against the labels on it', () => {
    //
    // small text wants 4.5:1. The page's own '$gray-6' falls short of it on the
    // day's tint, which is the reason the labels change at all.
    //
    const VARIABLES = path.resolve(__dirname, '../../../../scss/_variables.scss');
    const variables = fs.readFileSync(VARIABLES, 'utf8');

    const value = (name) => (variables.match(new RegExp(`^\\$${name}\\s*:\\s*(#[0-9a-f]{3,6})\\s*;`, 'im')) || [])[1];

    //
    // the WCAG relative luminance of '#rgb' or '#rrggbb', and the ratio of two
    //
    const luminance = (hex) => {
        const digits = hex.slice(1);
        const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;
        const [r, g, b] = [0, 2, 4].map((at) => {
            const c = parseInt(full.slice(at, at + 2), 16) / 255;

            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => {
        const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

        return (light + 0.05) / (dark + 0.05);
    };

    it('holds the day\'s labels at 4.5:1 or better', () => {
        expect(contrast(value('graph-panel-label'), value('graph-panel'))).toBeGreaterThanOrEqual(4.5);
    });

    it('holds the night\'s labels at 4.5:1 or better, in the theme\'s own gray', () => {
        expect(contrast(value('dark-gray-6'), value('dark-graph-panel'))).toBeGreaterThanOrEqual(4.5);
    });

    it('is where the page\'s own gray falls short by day', () => {
        expect(contrast(value('gray-6'), value('graph-panel'))).toBeLessThan(4.5);
    });
});

describe('the page\'s title', () => {
    //
    // on a phone it stood 35px under the signed-out header and 7px over the
    // picker under it. No suite can see either gap, so what is held is where
    // each comes from -- see the notes above '.anonymous .graph-page' and
    // '.graph-header'.
    //
    const NAVIGATION = path.resolve(__dirname, '../../../../scss/_navigation_anonymous.scss');
    const navigation = fs.readFileSync(NAVIGATION, 'utf8').replace(/\/\/.*$/gm, '');

    const [page] = blocks(source, '.graph-page');
    const [signedOut] = blocks(source, '.anonymous .graph-page');
    const header = blocks(source, '.graph-header').find((block) => /display\s*:\s*flex/.test(block));

    const [phone] = blocks(navigation, '.small-viewport');
    const [wide] = blocks(navigation, '.large-viewport');
    const underPhone = phone ? blocks(phone, '.main-navigation').find((block) => /margin-bottom/.test(block)) : undefined;
    const [underWide] = wide ? blocks(wide, '.main-navigation') : [];

    it('keeps 1rem over it under the signed-in header, which leaves no room of its own', () => {
        expect(rem(page, 'padding-top')).toBe(1);
    });

    it('takes no room of the page\'s own under the signed-out header', () => {
        expect(signedOut).toMatch(/padding-top\s*:\s*0\s*;/);
    });

    it('is left room by the signed-out header itself, on a phone and wider', () => {
        //
        // the rule above holds only while this does: without it, a signed-out
        // reader's title would sit against the header
        //
        expect(rem(underPhone, 'margin-bottom')).toBe(1.5);
        expect(underWide).toMatch(/margin\s*:\s*0\.75rem 0\s*;/);
    });

    it('stands as far over the picker on a phone as the picker stands over the panels', () => {
        expect(rem(header, 'gap')).toBe(1);
        expect(rem(header, 'gap')).toBe(rem(header, 'margin-bottom'));
    });
});
