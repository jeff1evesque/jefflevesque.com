/**
 * distribution-tree.test.js: the groups a month's charts draw, from a worker's
 * rows.
 *
 * The rules live here rather than in the charts, so each is pinned without
 * drawing anything: which rows become groups and members, when the groups
 * nest, the order they run in, the colors the members wear, and how a share is
 * written.
 */

import distributionTree, {
    NO_SECTOR,
    SECTORS,
    SEVERITY_ORDER,
    byName,
    sectorName,
    sectorOf,
    sectorShade,
    share,
    splitTickerPairs,
} from '../../import/general/distribution-tree.js';
import {
    colors_categorical,
    color_other,
    color_other_dark,
    color_sector_tail,
    color_tail,
} from '../../import/general/colors.js';

const names = (tree) => tree.groups.map((group) => group.name);

//
// how far apart two colors look: their distance in OKLab, times 100, the measure
// colors.js holds its chart colors apart by. A color is '#rrggbb' or the
// 'hsl(h, s%, l%)' color_tail writes
//
function oklab(color) {
    const hsl = /^hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)$/.exec(color);
    let rgb;

    if (hsl) {
        const [h, s, l] = [Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100];
        const k = (n) => (n + (h / 30)) % 12;
        const a = s * Math.min(l, 1 - l);
        rgb = [0, 8, 4].map((n) => l - (a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
    } else {
        rgb = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16) / 255);
    }

    const [r, g, b] = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const l = Math.cbrt((0.4122214708 * r) + (0.5363325363 * g) + (0.0514459929 * b));
    const m = Math.cbrt((0.2119034982 * r) + (0.6806995451 * g) + (0.1073969566 * b));
    const s = Math.cbrt((0.0883024619 * r) + (0.2817188376 * g) + (0.6299787005 * b));

    return [
        (0.2104542553 * l) + (0.7936177850 * m) - (0.0040720468 * s),
        (1.9779984951 * l) - (2.4285922050 * m) + (0.4505937099 * s),
        (0.0259040371 * l) + (0.7827717662 * m) - (0.8086757660 * s),
    ];
}

function deltaE(a, b) {
    const [x, y] = [oklab(a), oklab(b)];

    return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

describe('splitTickerPairs', () => {
    it('splits the api\'s run-on ticker string into pairs', () => {
        expect(splitTickerPairs('nvdl 3:1, mull 25:1')).toEqual([
            { ticker: 'nvdl', ratio: '3:1' },
            { ticker: 'mull', ratio: '25:1' },
        ]);
    });

    it('tolerates extra whitespace', () => {
        expect(splitTickerPairs('  nvdl   3:1 ,  mull 25:1 ')).toEqual([
            { ticker: 'nvdl', ratio: '3:1' },
            { ticker: 'mull', ratio: '25:1' },
        ]);
    });

    it('keeps a ticker with no ratio, with an empty one', () => {
        expect(splitTickerPairs('nvdl')).toEqual([{ ticker: 'nvdl', ratio: '' }]);
    });

    it('joins a ratio that arrives in several parts', () => {
        expect(splitTickerPairs('nvdl 3 : 1')).toEqual([{ ticker: 'nvdl', ratio: '3 : 1' }]);
    });

    it('drops empty entries rather than emitting blank members', () => {
        expect(splitTickerPairs('nvdl 3:1, , mull 25:1')).toHaveLength(2);
    });

    it.each([
        ['an empty string', ''],
        ['null', null],
        ['undefined', undefined],
        ['a number', 42],
    ])('returns nothing for %s', (name, value) => {
        expect(splitTickerPairs(value)).toEqual([]);
    });
});

describe('the groups and what they hold', () => {
    const ROWS = [
        { sector: 'Energy', 'Oil & Gas Refining': 30, 'Integrated Oil & Gas': 50 },
        { sector: 'Utilities', 'Water Utilities': 5, 'Electric Utilities': 70, 'Gas Utilities': 0 },
    ];

    it('makes a group of each row, named by the aggregate key', () => {
        expect(names(distributionTree(ROWS, 'sector')).sort()).toEqual(['Energy', 'Utilities']);
    });

    it('counts a group as the sum of what it holds', () => {
        const tree = distributionTree(ROWS, 'sector');

        expect(tree.groups.find((group) => group.name === 'Energy').value).toBe(80);
        expect(tree.total).toBe(155);
    });

    it('lists a group\'s members largest first, and drops the empty ones', () => {
        const utilities = distributionTree(ROWS, 'sector').groups.find((group) => group.name === 'Utilities');

        expect(utilities.members.map((member) => member.name)).toEqual(['Electric Utilities', 'Water Utilities']);
    });

    it('keys each member by its group as well as its name, so two groups can share a member', () => {
        const tree = distributionTree([
            { form: '4', Filings: 3, Amendments: 1 },
            { form: '8-K', Filings: 2, Amendments: 1 },
        ], 'form');
        const keys = tree.groups.flatMap((group) => group.members.map((member) => member.key));

        expect(new Set(keys).size).toBe(4);
    });

    it('points each member back at its group', () => {
        const [group] = distributionTree(ROWS, 'sector').groups;

        group.members.forEach((member) => expect(member.group).toBe(group));
    });

    it('merges two rows naming the same group', () => {
        const tree = distributionTree([
            { form: '4', Filings: 3 },
            { form: '4', Amendments: 2 },
        ], 'form');

        expect(tree.groups).toHaveLength(1);
        expect(tree.groups[0].value).toBe(5);
    });

    it('ignores the aggregate key itself, and anything that is not a count', () => {
        const [group] = distributionTree([
            { sector: 'Energy', total: 4, note: 'text', missing: NaN },
        ], 'sector').groups;

        expect(group.members.map((member) => member.name)).toEqual(['total']);
    });

    it.each([
        ['a row without the aggregate key', [{ other: 'x', total: 3 }]],
        ['a row whose key is null', [{ sector: null, total: 3 }]],
        ['a row that is not an object', ['Energy', 7, null]],
        ['a row that counts nothing', [{ sector: 'Energy', total: 0 }]],
    ])('draws nothing for %s', (name, rows) => {
        expect(distributionTree(rows, 'sector')).toEqual({ groups: [], total: 0, nested: false, sectors: [] });
    });

    it.each([
        ['nothing at all', undefined],
        ['an object in place of rows', { sector: 'Energy' }],
    ])('draws nothing from %s', (name, rows) => {
        expect(distributionTree(rows, 'sector').groups).toEqual([]);
    });
});

describe('when the groups nest', () => {
    it('does not nest when every group holds the same one thing', () => {
        //
        // sec's rows each count 'Filings', and bls's 'Reports': opening a group
        // would only show it again
        //
        const tree = distributionTree([
            { form: '4', Filings: 30 },
            { form: '8-K', Filings: 10 },
        ], 'form');

        expect(tree.nested).toBe(false);
    });

    it('nests when the groups hold different things', () => {
        const tree = distributionTree([
            { severity: 'Severe', 'Flood Warning': 3 },
            { severity: 'Minor', 'Flood Advisory': 5 },
        ], 'severity');

        expect(tree.nested).toBe(true);
    });

    it('nests on tickers, even a month with one of them', () => {
        const tree = distributionTree([{ sector: 'Day 8', splits: 1, tickers: 'enlv 1:15' }], 'sector');

        expect(tree.nested).toBe(true);
    });
});

describe('a day\'s tickers', () => {
    const ROWS = [
        { sector: 'Day 1', splits: 2, tickers: 'crwd 4:1, svc 1:5' },
        { sector: 'Day 5', splits: 1, tickers: 'cris' },
    ];

    it('makes each ticker a member counted once, carrying its ratio', () => {
        const day = distributionTree(ROWS, 'sector').groups[0];

        expect(day.members.map((member) => [member.name, member.value, member.note])).toEqual([
            ['crwd', 1, '4:1'],
            ['svc', 1, '1:5'],
        ]);
    });

    it('carries no ratio for a ticker the api sent without one', () => {
        const day = distributionTree(ROWS, 'sector').groups[1];

        expect(day.members[0].note).toBeNull();
    });

    it('counts a day by its tickers', () => {
        expect(distributionTree(ROWS, 'sector').total).toBe(3);
    });

    it('keys a ticker a day lists twice apart, so each is drawn on its own', () => {
        const [day] = distributionTree([
            { sector: 'Day 8', splits: 3, tickers: 'ucar 1:10, nvdl 3:1, ucar 1:20' },
        ], 'sector').groups;
        const keys = day.members.map((member) => member.key);

        expect(day.members.map((member) => [member.name, member.note])).toEqual([
            ['nvdl', '3:1'],
            ['ucar', '1:10'],
            ['ucar', '1:20'],
        ]);
        expect(new Set(keys).size).toBe(3);
        expect(keys).toContain('Day 8\u0000ucar');
    });

    it('keys a ticker apart when two rows of one day each list it', () => {
        const [day] = distributionTree([
            { sector: 'Day 8', splits: 1, tickers: 'ucar 1:10' },
            { sector: 'Day 8', splits: 1, tickers: 'ucar 1:20' },
        ], 'sector').groups;

        expect(new Set(day.members.map((member) => member.key)).size).toBe(2);
    });
});

describe('a day\'s sectors (#190)', () => {
    //
    // a day as the stock-split worker answers it once the api names each
    // split's company: its sectors, each with its splits and its tickers
    //
    const DAY = {
        sector: 'Day 8',
        splits: 6,
        tickers: 'ucar 1:10, aurwf 1:10, ucar 1:20, phge 1:10, jmpld 3:4, cycn 1:7',
        sectors: {
            other: { splits: 3, tickers: 'ucar 1:10, aurwf 1:10, ucar 1:20' },
            'Office of Trade & Services': { splits: 2, tickers: 'phge 1:10, jmpld 3:4' },
            'Office of Life Sciences': { splits: 1, tickers: 'cycn 1:7' },
        },
    };

    it('makes its sectors its members, largest first, and No sector last', () => {
        const [day] = distributionTree([DAY], 'sector').groups;

        expect(day.members.map((member) => [member.name, member.value, member.sector])).toEqual([
            ['Trade & Services', 2, 'Office of Trade & Services'],
            ['Life Sciences', 1, 'Office of Life Sciences'],
            ['No sector', 3, 'other'],
        ]);
        expect(day.value).toBe(6);
    });

    it('holds each sector\'s tickers alphabetically, with their ratios, and keys a ticker listed twice apart', () => {
        const [day] = distributionTree([DAY], 'sector').groups;
        const none = day.members[2];

        expect(day.members[0].tickers.map((ticker) => [ticker.name, ticker.value, ticker.note]))
            .toEqual([['jmpld', 1, '3:4'], ['phge', 1, '1:10']]);
        expect(none.tickers.map((ticker) => `${ticker.name} ${ticker.note}`)).toEqual(['aurwf 1:10', 'ucar 1:10', 'ucar 1:20']);
        expect(none.tickers.map((ticker) => ticker.key)).toEqual([
            'Day 8\u0000No sector\u0000aurwf',
            'Day 8\u0000No sector\u0000ucar',
            'Day 8\u0000No sector\u0000ucar\u00001',
        ]);
    });

    it('reads the day\'s tickers from its sectors, never as members of their own', () => {
        const [day] = distributionTree([DAY], 'sector').groups;

        expect(day.members).toHaveLength(3);
        expect(day.members.every((member) => member.note === null)).toBe(true);
    });

    it('makes a sector two rows of one day name one band, holding both rows\' tickers', () => {
        const [day] = distributionTree([
            { sector: 'Day 3', sectors: { 'Office of Technology': { splits: 1, tickers: 'ccc 1:4' } } },
            { sector: 'Day 3', sectors: { 'Office of Technology': { splits: 2, tickers: 'aaa 1:2, bbb 1:3' } } },
        ], 'sector').groups;

        expect(day.members).toHaveLength(1);
        expect(day.members[0].value).toBe(3);
        expect(day.members[0].tickers.map((ticker) => ticker.name)).toEqual(['aaa', 'bbb', 'ccc']);
    });

    it('counts a sector the api sent no tickers for, holding none, and drops one of no splits', () => {
        const [day] = distributionTree([
            { sector: 'Day 4', sectors: { 'Office of Finance': { splits: 2 }, 'Office of Technology': { splits: 0 } } },
        ], 'sector').groups;

        expect(day.members.map((member) => [member.name, member.value, member.tickers])).toEqual([['Finance', 2, []]]);
    });

    it('carries no ratio for a sector\'s ticker the api sent without one, and skips a sector sent empty', () => {
        const [day] = distributionTree([
            { sector: 'Day 4', sectors: { 'Office of Finance': { splits: 1, tickers: 'cris' }, other: null } },
        ], 'sector').groups;

        expect(day.members).toHaveLength(1);
        expect(day.members[0].tickers.map((ticker) => [ticker.name, ticker.note])).toEqual([['cris', null]]);
    });

    it('reads a day without sectors as it did, its tickers its members', () => {
        const [day] = distributionTree([{ sector: 'Day 1', splits: 1, tickers: 'aph 2:1', sectors: null }], 'sector').groups;

        expect(day.members.map((member) => [member.name, member.note])).toEqual([['aph', '2:1']]);
    });

    it('nests a month of one sector, whose days still open to their tickers', () => {
        const tree = distributionTree([{ sector: 'Day 1', sectors: { other: { splits: 1, tickers: 'aph 2:1' } } }], 'sector');

        expect(tree.nested).toBe(true);
    });

    it('names a sector without its \'Office of\', and the api\'s other as No sector', () => {
        expect(sectorName('Office of Industrial Applications and Services')).toBe('Industrial Applications and Services');
        expect(sectorName(NO_SECTOR)).toBe('No sector');
        expect(sectorName('Division of Corporation Finance')).toBe('Division of Corporation Finance');
    });
});

describe('a sector spelled without its Office of (#192)', () => {
    it('is the office SECTORS writes, as the SEC writes Industrial Applications and Services', () => {
        expect(sectorOf('Industrial Applications and Services')).toBe('Office of Industrial Applications and Services');
        expect(sectorShade('Industrial Applications and Services')).toBe(colors_categorical[6]);
    });

    it('keeps a sector it does not know, and No sector, as the api wrote them', () => {
        expect(sectorOf('Office of Zoning')).toBe('Office of Zoning');
        expect(sectorOf(NO_SECTOR)).toBe(NO_SECTOR);
    });

    it('makes the two spellings one band of a day, in its place, and one entry of the legend', () => {
        const tree = distributionTree([{ sector: 'Day 1', sectors: {
            'Industrial Applications and Services': { splits: 1, tickers: 'aaa 1:2' },
            'Office of Industrial Applications and Services': { splits: 2, tickers: 'bbb 1:2, ccc 1:3' },
            'Office of Crypto Assets': { splits: 1 },
        } }], 'sector');

        expect(tree.groups[0].members.map((member) => [member.name, member.value, member.tickers.length]))
            .toEqual([['Industrial Applications and Services', 3, 3], ['Crypto Assets', 1, 0]]);
        expect(tree.sectors.map((sector) => sector.name)).toEqual(['Industrial Applications and Services', 'Crypto Assets']);
    });
});

describe('byName (#192)', () => {
    it('puts names in order with the numbers in them by value', () => {
        const names = ['Day 12', 'Form 10-K', 'Day 2', 'Form 3'].map((name) => ({ name: name }));

        expect(names.sort(byName).map((item) => item.name)).toEqual(['Day 2', 'Day 12', 'Form 3', 'Form 10-K']);
    });
});

describe('the sectors\' colors (#190)', () => {
    it('gives the first eight sectors the chart colors, in a fixed order', () => {
        expect(SECTORS.slice(0, 8).map((sector) => sectorShade(sector))).toEqual(colors_categorical);
        expect(sectorShade('Office of Life Sciences', 'dark')).toBe(colors_categorical[0]);
    });

    it('gives a sector the same color on every day, whatever its rank, and in another month', () => {
        const september = distributionTree([
            { sector: 'Day 1', sectors: { 'Office of Finance': { splits: 5 }, 'Office of Technology': { splits: 1 } } },
            { sector: 'Day 2', sectors: { 'Office of Technology': { splits: 4 }, 'Office of Finance': { splits: 1 } } },
        ], 'sector');
        const october = distributionTree([
            { sector: 'Day 9', sectors: { 'Office of Life Sciences': { splits: 7 }, 'Office of Finance': { splits: 2 } } },
        ], 'sector');
        const finance = [...september.groups, ...october.groups]
            .map((group) => group.members.find((member) => member.sector === 'Office of Finance').shade);

        expect(finance).toEqual([colors_categorical[4], colors_categorical[4], colors_categorical[4]]);
    });

    it('shades the sectors past the eighth in the long tail\'s hue, a step each, and one it does not know after them', () => {
        expect(SECTORS.slice(8).map((sector) => sectorShade(sector))).toEqual([
            color_sector_tail(0),
            color_sector_tail(1),
            color_sector_tail(2),
        ]);
        expect(sectorShade('Office of Something New')).toBe(color_sector_tail(3));
        expect(sectorShade('Office of Crypto Assets', 'dark')).toBe(color_sector_tail(0, 'dark'));
    });

    it.each(['light', 'dark'])('tells the rarer sectors apart, neighbors at least 10 apart, on a %s page', (theme) => {
        const rarer = SECTORS.slice(8).map((sector) => sectorShade(sector, theme));

        rarer.slice(1).forEach((shade, at) => {
            expect(deltaE(shade, rarer[at])).toBeGreaterThanOrEqual(10);
        });
    });

    it('grays No sector for the page\'s theme', () => {
        expect(sectorShade(NO_SECTOR)).toBe(color_other);
        expect(sectorShade(NO_SECTOR, 'dark')).toBe(color_other_dark);
    });

    it.each(['light', 'dark'])('keeps No sector\'s gray clear of every sector\'s color on a %s page', (theme) => {
        const gray = sectorShade(NO_SECTOR, theme);

        SECTORS.forEach((sector) => {
            expect(deltaE(gray, sectorShade(sector, theme))).toBeGreaterThanOrEqual(15);
        });
    });

    it('colors a day\'s members by their sectors, for the page\'s theme', () => {
        const [day] = distributionTree([{ sector: 'Day 8', sectors: {
            other: { splits: 3 },
            'Office of Structured Finance': { splits: 1 },
        } }], 'sector', 'dark').groups;

        expect(day.members.map((member) => member.shade)).toEqual([color_sector_tail(2, 'dark'), color_other_dark]);
    });
});

describe('the month\'s sectors, for the legend (#190)', () => {
    it('lists each sector the month holds once, in the order of their colors, and No sector last', () => {
        const tree = distributionTree([
            { sector: 'Day 1', sectors: { other: { splits: 4 }, 'Office of Finance': { splits: 1 } } },
            { sector: 'Day 2', sectors: { 'Office of Life Sciences': { splits: 1 }, 'Office of Finance': { splits: 2 } } },
        ], 'sector', 'dark');

        expect(tree.sectors).toEqual([
            { key: 'Office of Life Sciences', name: 'Life Sciences', shade: colors_categorical[0] },
            { key: 'Office of Finance', name: 'Finance', shade: colors_categorical[4] },
            { key: 'other', name: 'No sector', shade: color_other_dark },
        ]);
    });

    it('lists an office it does not know after the ones it does, by name, and before No sector', () => {
        const tree = distributionTree([{ sector: 'Day 1', sectors: {
            other: { splits: 1 },
            'Office of Zoning': { splits: 1 },
            'Office of Aviation': { splits: 1 },
            'Office of Structured Finance': { splits: 1 },
        } }], 'sector');

        expect(tree.sectors.map((sector) => sector.name)).toEqual(['Structured Finance', 'Aviation', 'Zoning', 'No sector']);
    });

    it('lists none for a month the api sent without sectors, or for another stream', () => {
        expect(distributionTree([{ sector: 'Day 1', splits: 1, tickers: 'aph 2:1' }], 'sector').sectors).toEqual([]);
        expect(distributionTree([{ sector: 'Energy', Refining: 3 }], 'sector').sectors).toEqual([]);
    });
});

describe('the order the groups run in', () => {
    it('runs largest first', () => {
        const tree = distributionTree([
            { sector: 'Small', total: 1 },
            { sector: 'Large', total: 9 },
            { sector: 'Middle', total: 5 },
        ], 'sector');

        expect(names(tree)).toEqual(['Large', 'Middle', 'Small']);
    });

    it('breaks a tie by name', () => {
        const tree = distributionTree([
            { sector: 'Beta', total: 4 },
            { sector: 'Alpha', total: 4 },
        ], 'sector');

        expect(names(tree)).toEqual(['Alpha', 'Beta']);
    });

    it('runs a severity scale worst first, whatever the counts, with unknown last', () => {
        const tree = distributionTree([
            { severity: 'Minor', a: 50 },
            { severity: 'Unknown', b: 70 },
            { severity: 'Extreme', c: 1 },
            { severity: 'Severe', d: 30 },
            { severity: 'Moderate', e: 90 },
        ], 'severity');

        expect(names(tree)).toEqual(['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown']);
    });

    it('runs numbered days in number order, not digit by digit', () => {
        const tree = distributionTree([
            { sector: 'Day 12', splits: 9 },
            { sector: 'Day 2', splits: 1 },
            { sector: 'Day 1', splits: 3 },
        ], 'sector');

        expect(names(tree)).toEqual(['Day 1', 'Day 2', 'Day 12']);
    });

    it('runs labels that share no prefix largest first', () => {
        const tree = distributionTree([
            { form: 'Form 4', Filings: 2 },
            { form: 'Form 8-K', Filings: 9 },
            { form: 'Form 10', Filings: 5 },
        ], 'form');

        expect(names(tree)).toEqual(['Form 8-K', 'Form 10', 'Form 4']);
    });

    it('keeps the scale order in the list of what the scale names', () => {
        expect(SEVERITY_ORDER).toEqual(['extreme', 'severe', 'moderate', 'minor', 'unknown']);
    });
});

describe('the colors', () => {
    function wide(theme) {
        const row = { sector: 'Wide' };
        for (let at = 0; at < 10; at += 1) {
            row[`member ${at}`] = 100 - at;
        }

        return distributionTree([row, { sector: 'Other', thing: 1 }], 'sector', theme).groups[0];
    }

    it('gives a group\'s members colors by their rank in it, largest first, then the tail', () => {
        const group = wide();

        expect(group.members.slice(0, 8).map((member) => member.shade)).toEqual(colors_categorical);
        expect(group.members[8].shade).toBe(color_tail(0, 2, 'light'));
        expect(group.members[9].shade).toBe(color_tail(1, 2, 'light'));
    });

    it('shades the tail for the page\'s theme', () => {
        expect(wide('dark').members[9].shade).toBe(color_tail(1, 2, 'dark'));
    });

    it('gives a group no color of its own, which only the sunburst drew (#188)', () => {
        const [group] = distributionTree([{ severity: 'Severe', 'Flood Warning': 3, 'Wind Warning': 1 }], 'severity').groups;

        expect(group.color).toBeUndefined();
        expect(group.members[0].color).toBeUndefined();
    });
});

describe('members a stream names in order (#211)', () => {
    //
    // the company facts' forms, each a row per status it holds, as the sec worker
    // stacks them: 10-Q mostly new, 10-K mostly repeated
    //
    const STATUSES = ['new', 'repeated', 'changed'];
    const rows = [
        { form: 'Form 10-Q', new: 41970, repeated: 37190, changed: 900 },
        { form: 'Form 10-K', repeated: 6949, new: 6563 },
        { form: 'Form 424B2', changed: 1876 },
    ];
    const shades = (group) => Object.fromEntries(group.members.map((member) => [member.name, member.shade]));

    it('gives each the same color in every group, whatever its size there', () => {
        const tree = distributionTree(rows, 'form', 'light', STATUSES);
        const by = Object.fromEntries(tree.groups.map((group) => [group.name, shades(group)]));

        expect(by['Form 10-Q']).toEqual({ new: colors_categorical[0], repeated: colors_categorical[1], changed: colors_categorical[2] });
        expect(by['Form 10-K']).toEqual({ new: colors_categorical[0], repeated: colors_categorical[1] });
        expect(by['Form 424B2']).toEqual({ changed: colors_categorical[2] });
    });

    it('stacks them in the order named, not by size', () => {
        const tree = distributionTree(rows, 'form', 'light', STATUSES);
        const tenK = tree.groups.find((group) => group.name === 'Form 10-K');

        expect(tenK.members.map((member) => member.name)).toEqual(['new', 'repeated']);
    });

    it('colors a member it does not name after all the named ones, and runs it after them', () => {
        const [group] = distributionTree([{ form: 'Form 8-K', new: 3, other: 9 }], 'form', 'light', STATUSES).groups;

        expect(group.members.map((member) => [member.name, member.shade])).toEqual([
            ['new', colors_categorical[0]],
            ['other', colors_categorical[3]],
        ]);
    });

    it('changes nothing without an order: a member is colored by its rank', () => {
        const tree = distributionTree(rows, 'form');
        const tenK = tree.groups.find((group) => group.name === 'Form 10-K');

        expect(tenK.members.map((member) => [member.name, member.shade])).toEqual([
            ['repeated', colors_categorical[0]],
            ['new', colors_categorical[1]],
        ]);
    });

    it('nests, so a form opens to its statuses', () => {
        expect(distributionTree(rows, 'form', 'light', STATUSES).nested).toBe(true);
    });
});

describe('share', () => {
    it.each([
        [32, 100, '32%'],
        [1.5, 100, '1.5%'],
        [2, 100, '2%'],
        [0.5, 100, 'under 1%'],
        [5, 0, 'under 1%'],
    ])('writes %s of %s as %s', (part, whole, written) => {
        expect(share(part, whole)).toBe(written);
    });
});
