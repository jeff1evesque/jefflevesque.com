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
    SEVERITY_ORDER,
    share,
    splitTickerPairs,
} from '../../import/general/distribution-tree.js';
import {
    colors_categorical,
    color_tail,
} from '../../import/general/colors.js';

const names = (tree) => tree.groups.map((group) => group.name);

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
        expect(distributionTree(rows, 'sector')).toEqual({ groups: [], total: 0, nested: false });
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
