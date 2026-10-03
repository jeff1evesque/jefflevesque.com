/**
 * cube-layout.test.js: where the cubes of a month's distribution sit.
 *
 * The rules the bars of cubes are drawn by, held without drawing anything: the
 * bars' order and their cap, the value axis, the size of a cube and what it is
 * worth, and where each cube lands. The trees are built by distribution-tree.js
 * from rows shaped as the workers answer them.
 */

import cubeLayout, {
    MAX_BARS,
    byLabel,
    barsOf,
    ticksOf,
    fitCubes,
    apportion,
} from '../../import/general/cube-layout.js';
import distributionTree from '../../import/general/distribution-tree.js';
import { colors_categorical, color_other, color_tail } from '../../import/general/colors.js';

const PLOT = { left: 62, right: 1275, top: 20, bottom: 304 };

const SECTORS = [
    { sector: 'Information Technology', Semiconductors: 3125430, 'Application Software': 2437128, Hardware: 1977616 },
    { sector: 'Energy', 'Integrated Oil & Gas': 900000, Refining: 741196 },
    { sector: 'Utilities', 'Electric Utilities': 1276399 },
    { sector: 'Financials', Banks: 4000000, Insurance: 2296980 },
];

const SEVERITIES = [
    { severity: 'Minor', 'Coastal Flood Advisory': 71, 'Frost Advisory': 30 },
    { severity: 'Unknown', 'Test Message': 12 },
    { severity: 'Extreme', 'Tornado Warning': 85, 'Extreme Heat Warning': 15 },
    { severity: 'Moderate', 'Heat Advisory': 941, 'Special Weather Statement': 8266 },
    { severity: 'Severe', 'Flash Flood Warning': 1390 },
];

const SPLITS = [
    { split_date: 'Day 19', splits: 4, tickers: 'banl 1:13, ccg 1:35, prpl 1:25, tomz 1:3' },
    { split_date: 'Day 5', splits: 1, tickers: 'cris 1:20' },
];

//
// the same, once the api names each split's company: Day 8 of three sectors,
// and Day 9 of one (#190)
//
const SECTORED = [
    { split_date: 'Day 8', sectors: {
        other: { splits: 3, tickers: 'ucar 1:10, aurwf 1:10, ucar 1:20' },
        'Office of Trade & Services': { splits: 2, tickers: 'phge 1:10, jmpld 3:4' },
        'Office of Life Sciences': { splits: 1, tickers: 'cycn 1:7' },
    } },
    { split_date: 'Day 9', sectors: { 'Office of Manufacturing': { splits: 2, tickers: 'qbtz 1:5, stsm 1:2' } } },
];

//
// sec's forms, one series each, more of them than the axis has bars for
//
function forms(count) {
    return Array.from({ length: count }, (ignored, index) => ({ form: `Form ${index + 1}`, Filings: (count - index) * 10 }));
}

const layoutOf = (rows, key, plot = PLOT) => cubeLayout(distributionTree(rows, key), plot);
const names = (bars) => bars.map((bar) => bar.name);

describe('the order the bars run in', () => {
    it('runs a severity scale worst first', () => {
        expect(names(barsOf(distributionTree(SEVERITIES, 'severity')).bars))
            .toEqual(['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown']);
    });

    it('runs anything else by its label, not by its size', () => {
        expect(names(barsOf(distributionTree(SECTORS, 'sector')).bars))
            .toEqual(['Energy', 'Financials', 'Information Technology', 'Utilities']);
    });

    it('compares the numbers in a label by value', () => {
        const order = ['Form 10-K', 'Form 4', 'Form 3', 'Form 13F-HR'].map((name) => ({ name })).sort(byLabel);

        expect(names(order)).toEqual(['Form 3', 'Form 4', 'Form 10-K', 'Form 13F-HR']);
    });

    it('puts a label off the severity scale after every one on it', () => {
        const order = [{ name: 'Advisory' }, { name: 'Severe' }, { name: 'Extreme' }].sort(byLabel);

        expect(names(order)).toEqual(['Extreme', 'Severe', 'Advisory']);
    });
});

describe('the cap on bars', () => {
    it('keeps every bar up to the cap', () => {
        const { bars } = barsOf(distributionTree(forms(MAX_BARS), 'form'));

        expect(bars).toHaveLength(MAX_BARS);
        expect(names(bars)).not.toContain('Other');
    });

    it('past the cap keeps the largest, in label order, and rolls the rest into Other, last', () => {
        const { bars } = barsOf(distributionTree(forms(30), 'form'));
        const kept = bars.slice(0, -1);

        expect(bars).toHaveLength(MAX_BARS);
        expect(bars[bars.length - 1].name).toBe('Other');
        expect(names(kept)).toEqual(names(kept.slice().sort(byLabel)));
        expect(names(kept)).toContain('Form 1');
        expect(names(kept)).not.toContain('Form 20');
    });

    it('gives Other the rest\'s total, as one series, and lists the rest largest first', () => {
        const { bars } = barsOf(distributionTree(forms(30), 'form'));
        const other = bars[bars.length - 1];

        expect(other.value).toBe([...Array(11)].reduce((sum, ignored, index) => sum + ((11 - index) * 10), 0));
        expect(other.parts).toEqual([{ key: '\u0000other', name: 'Other', value: other.value, color: colors_categorical[0] }]);
        expect(other.holds.kind).toBe('groups');
        expect(names(other.holds.items)).toEqual(['Form 20', 'Form 21', 'Form 22', 'Form 23', 'Form 24', 'Form 25',
            'Form 26', 'Form 27', 'Form 28', 'Form 29', 'Form 30']);
    });

    it('breaks a tie in size by label, so the same bars are kept every time', () => {
        const rows = Array.from({ length: 25 }, (ignored, index) => ({ form: `Form ${25 - index}`, Filings: 10 }));
        const { bars } = barsOf(distributionTree(rows, 'form'));

        expect(names(bars.slice(0, -1))).toEqual(Array.from({ length: 19 }, (ignored, index) => `Form ${index + 1}`));
    });

    it('bands Other by the sectors of the days it rolled up, each sector\'s splits added up (#190)', () => {
        const rows = Array.from({ length: 19 }, (ignored, at) => ({
            split_date: `Day ${at + 1}`,
            sectors: { 'Office of Life Sciences': { splits: 10 + at } },
        })).concat([
            { split_date: 'Day 20', sectors: { 'Office of Finance': { splits: 1 }, other: { splits: 1 } } },
            { split_date: 'Day 21', sectors: { 'Office of Technology': { splits: 2 } } },
            { split_date: 'Day 22', sectors: { other: { splits: 1 }, 'Office of Finance': { splits: 1 } } },
        ]);
        const other = barsOf(distributionTree(rows, 'split_date')).bars.find((bar) => bar.name === 'Other');

        expect(other.value).toBe(6);
        expect(other.parts.map((part) => [part.name, part.value, part.color])).toEqual([
            ['Finance', 2, colors_categorical[4]],
            ['Technology', 2, colors_categorical[1]],
            ['No sector', 2, color_other],
        ]);
        expect(new Set(other.parts.map((part) => part.key)).size).toBe(3);
        expect(other.holds.kind).toBe('groups');
    });

    it('keys Other apart from a group of its own named Other', () => {
        const rows = forms(25).concat([{ form: 'Other', Filings: 1000 }]);
        const { bars } = barsOf(distributionTree(rows, 'form'));

        expect(bars.filter((bar) => bar.name === 'Other').map((bar) => bar.key)).toEqual(['Other', '\u0000other']);
    });
});

describe('what a bar is made of, and what it lists', () => {
    it('stacks a group\'s members largest first, each in its rank\'s color', () => {
        const { ranked, bars } = barsOf(distributionTree(SECTORS, 'sector'));
        const tech = bars.find((bar) => bar.name === 'Information Technology');

        expect(ranked).toBe(true);
        expect(names(tech.parts)).toEqual(['Semiconductors', 'Application Software', 'Hardware']);
        expect(tech.parts.map((part) => part.color)).toEqual(colors_categorical.slice(0, 3));
        expect(tech.holds.kind).toBe('members');
        expect(tech.holds.items).toHaveLength(3);
    });

    it('colors the members past the eighth from the long tail, for the page\'s theme', () => {
        const row = { sector: 'Industrials' };
        for (let index = 0; index < 10; index++) {
            row[`Industry ${index}`] = 100 - index;
        }
        const light = barsOf(distributionTree([row, SECTORS[1]], 'sector', 'light')).bars[1];
        const dark = barsOf(distributionTree([row, SECTORS[1]], 'sector', 'dark')).bars[1];

        expect(light.parts[8].color).toBe(color_tail(0, 2, 'light'));
        expect(dark.parts[9].color).toBe(color_tail(1, 2, 'dark'));
    });

    it('lists nothing under a group of one member', () => {
        const { bars } = barsOf(distributionTree(SECTORS, 'sector'));

        expect(bars.find((bar) => bar.name === 'Utilities').holds).toBeNull();
    });

    it('draws a stream of one series in the first color, with nothing under its bars', () => {
        const { ranked, bars } = barsOf(distributionTree(forms(3), 'form'));

        expect(ranked).toBe(false);
        bars.forEach((bar) => {
            expect(bar.parts).toEqual([{ key: bar.key, name: bar.name, value: bar.value, color: colors_categorical[0] }]);
            expect(bar.holds).toBeNull();
        });
    });

    it('draws a day of splits as one series, and lists its tickers', () => {
        const { ranked, bars } = barsOf(distributionTree(SPLITS, 'split_date'));
        const day = bars.find((bar) => bar.name === 'Day 19');

        expect(ranked).toBe(false);
        expect(day.value).toBe(4);
        expect(day.parts).toHaveLength(1);
        expect(day.holds.kind).toBe('tickers');
        expect(day.holds.items.map((member) => `${member.name} ${member.note}`))
            .toEqual(['banl 1:13', 'ccg 1:35', 'prpl 1:25', 'tomz 1:3']);
    });

    it('bands a day by its sectors, largest first and No sector last, each in its own color (#190)', () => {
        const { ranked, bars } = barsOf(distributionTree(SECTORED, 'split_date'));
        const day = bars.find((bar) => bar.name === 'Day 8');

        expect(ranked).toBe(true);
        expect(day.value).toBe(6);
        expect(day.parts.map((part) => [part.name, part.value, part.color])).toEqual([
            ['Trade & Services', 2, colors_categorical[3]],
            ['Life Sciences', 1, colors_categorical[0]],
            ['No sector', 3, color_other],
        ]);
    });

    it('carries each sector\'s tickers on its band, for the tooltip (#190)', () => {
        const day = barsOf(distributionTree(SECTORED, 'split_date')).bars.find((bar) => bar.name === 'Day 8');

        expect(day.parts.map((part) => part.tickers.map((ticker) => ticker.name)))
            .toEqual([['jmpld', 'phge'], ['cycn'], ['aurwf', 'ucar', 'ucar']]);
    });

    it('lists a day\'s tickers in its sectors\' order, with the sectors that hold them (#190)', () => {
        const day = barsOf(distributionTree(SECTORED, 'split_date')).bars.find((bar) => bar.name === 'Day 8');

        expect(day.holds.kind).toBe('tickers');
        expect(day.holds.items.map((ticker) => ticker.name)).toEqual(['jmpld', 'phge', 'cycn', 'aurwf', 'ucar', 'ucar']);
        expect(day.holds.sectors.map((sector) => sector.name)).toEqual(['Trade & Services', 'Life Sciences', 'No sector']);
    });

    it('lists the tickers of a day of one sector, so every day opens (#190)', () => {
        const day = barsOf(distributionTree(SECTORED, 'split_date')).bars.find((bar) => bar.name === 'Day 9');

        expect(day.parts).toHaveLength(1);
        expect(day.holds.items.map((ticker) => ticker.name)).toEqual(['qbtz', 'stsm']);
    });

    it('lists a day\'s sectors where the api sent none of their tickers (#190)', () => {
        const [day] = barsOf(distributionTree([
            { split_date: 'Day 3', sectors: { 'Office of Finance': { splits: 2 }, other: { splits: 1 } } },
        ], 'split_date')).bars;

        expect(day.holds.kind).toBe('members');
        expect(day.holds.items.map((member) => member.name)).toEqual(['Finance', 'No sector']);
    });

    it('draws no bars for a tree with no groups', () => {
        expect(barsOf(distributionTree([], 'sector')).bars).toEqual([]);
        expect(barsOf(null).bars).toEqual([]);
    });
});

describe('the value axis', () => {
    it.each([
        [12827224, [0, 3500000, 7000000, 10500000, 14000000]],
        [15230, [0, 4000, 8000, 12000, 16000]],
        [9868, [0, 2500, 5000, 7500, 10000]],
        [3410, [0, 900, 1800, 2700, 3600]],
        [4, [0, 1, 2, 3, 4]],
        [1, [0, 0.25, 0.5, 0.75, 1]],
    ])('runs from zero in five ticks, as recharts did, for a largest bar of %s', (max, ticks) => {
        expect(ticksOf(max)).toEqual(ticks);
    });

    it('still draws five ticks for an empty month', () => {
        expect(ticksOf(0)).toEqual([0, 1, 2, 3, 4]);
    });
});

describe('the cube', () => {
    it('is worth a round number of records', () => {
        expect(fitCubes(14000000, 284, 81.7).unit).toBe(50000);
        expect(fitCubes(16000, 284, 49).unit).toBe(100);
        expect(fitCubes(10000, 284, 196).unit).toBe(20);
    });

    it('is sized so a full row of cubes is worth what the axis says', () => {
        [[14000000, 81.7], [3600, 122.5], [16000, 49], [10000, 196], [4, 98]].forEach(([top, width]) => {
            const { unit, across, pitch } = fitCubes(top, 284, width);

            expect(unit * across).toBeCloseTo((top * pitch) / 284, 6);
            expect((across * pitch) - 2).toBeLessThanOrEqual(width + 0.01);
        });
    });

    it('takes a near-round unit only where no round one fits', () => {
        //
        // a 10px cube across one 8px-wide bar would need 3.3 records a cube
        //
        expect(fitCubes(28.4, 284, 8).unit).toBe(1);
        expect(fitCubes(85.2, 284, 9)).toEqual(expect.objectContaining({ unit: 3, across: 1 }));
    });

    it('fills at least half the bar where some fit can: a day of 24 splits stands two cubes across (#188)', () => {
        //
        // held near 10px, a split a cube, the stack was one cube wide: 11.7 of
        // a 60.5px bar. Two across, each cube still a split, it is 44.8
        //
        const { unit, across, pitch } = fitCubes(24, 281, 60.5);

        expect([unit, across]).toEqual([1, 2]);
        expect(pitch).toBeCloseTo(23.42, 2);
        expect((across * pitch) - 2).toBeGreaterThanOrEqual(60.5 / 2);
    });

    it.each([
        ['September\'s, 15 at most in a day, in 20 narrow bars', 16, 51.4],
        ['October\'s, 7 at most in a day, in 8 wide bars', 8, 129.3],
    ])('never fills a bar with cubes worth more: %s stays a split a cube, thin (#190)', (month, top, width) => {
        //
        // a cube of two splits each filled the bar, and drew a day of 15 as 8
        // cubes, 16 splits
        //
        expect(fitCubes(top, 281, width)).toEqual(expect.objectContaining({ unit: 1, across: 1 }));
    });

    it('keeps the fit of a month whose stacks fill most of their bars already (#188)', () => {
        expect(fitCubes(14000000, 281, 84.4)).toEqual(expect.objectContaining({ unit: 50000, across: 9 }));
        expect(fitCubes(16000, 281, 51)).toEqual(expect.objectContaining({ unit: 100, across: 5 }));
    });

    it('takes the best of the thin fits where none fills half the bar', () => {
        //
        // a record a 21.5px cube: one fills 19.5 of a 40px bar, and two
        // across would not fit in it
        //
        const fit = fitCubes(284 / 21.5, 284, 40);

        expect([fit.unit, fit.across]).toEqual([1, 1]);
        expect(fit.pitch).toBeCloseTo(21.5, 6);
    });

    it('falls back to a cube per record as large as the bar allows, where nothing reaches the axis', () => {
        expect(fitCubes(1, 284, 40)).toEqual({ unit: 1, across: 1, pitch: 42 });
        expect(fitCubes(1, 30, 40)).toEqual({ unit: 1, across: 1, pitch: 30 });
    });
});

describe('sharing a bar\'s cubes among its parts', () => {
    it('splits them in proportion, the largest remainders taking the leftovers', () => {
        expect(apportion([50, 30, 20], 10)).toEqual([5, 3, 2]);
        expect(apportion([1, 1, 1], 4)).toEqual([2, 1, 1]);
        expect(apportion([2, 1], 2)).toEqual([1, 1]);
    });

    it('always hands out exactly the bar\'s cubes', () => {
        [[[3125430, 2437128, 1977616], 151], [[7, 5, 3, 1], 3], [[1], 9]].forEach(([values, count]) => {
            expect(apportion(values, count).reduce((sum, share) => sum + share, 0)).toBe(count);
        });
    });

    it('hands nothing to parts with nothing in them', () => {
        expect(apportion([5, 0, 5], 3)).toEqual([2, 0, 1]);
        expect(apportion([0, 0], 3)).toEqual([0, 0]);
        expect(apportion([], 0)).toEqual([]);
    });
});

describe('where the cubes sit', () => {
    it('gives every bar a stack that reaches its value on the axis, within one row', () => {
        [[SECTORS, 'sector'], [SEVERITIES, 'severity'], [SPLITS, 'split_date'], [forms(30), 'form']].forEach(([rows, key]) => {
            const layout = layoutOf(rows, key);
            const height = PLOT.bottom - PLOT.top;

            layout.bars.forEach((bar) => {
                const drawn = (bar.cubes / layout.across) * layout.pitch;
                const axis = (bar.value / layout.top) * height;

                expect(Math.abs(drawn - axis)).toBeLessThanOrEqual(layout.pitch);
                expect(bar.cubes).toBe(Math.max(1, Math.round(bar.value / layout.unit)));
            });
        });
    });

    it('centers each stack in its slot, no wider than its bar', () => {
        const layout = layoutOf(SECTORS, 'sector');

        layout.bars.forEach((bar, index) => {
            expect(bar.center).toBeCloseTo(PLOT.left + ((index + 0.5) * layout.slot), 6);
            expect((layout.across * layout.pitch) - 2).toBeLessThanOrEqual(layout.slot * 0.8 + 0.01);
        });
    });

    it('fills a stack row by row from the bottom left, its largest part first', () => {
        const layout = layoutOf(SECTORS, 'sector');
        const tech = layout.bars.find((bar) => bar.name === 'Information Technology');
        const mine = layout.cubes.filter((cube) => cube.bar === tech.key);

        expect(mine[0]).toEqual(expect.objectContaining({ x: tech.x0, y: PLOT.bottom - layout.pitch + 2 }));
        expect(mine[1].x).toBeCloseTo(tech.x0 + layout.pitch, 6);
        expect(mine[layout.across].y).toBeCloseTo(PLOT.bottom - (2 * layout.pitch) + 2, 6);
        expect(mine[0].key).toBe('Information Technology\u0000Semiconductors');
        expect(mine[mine.length - 1].key).toBe('Information Technology\u0000Hardware');
    });

    it('holds each band\'s bar, color and reach up the stack', () => {
        const layout = layoutOf(SECTORS, 'sector');
        const band = layout.bands.get('Information Technology\u0000Application Software');
        const mine = layout.cubes.filter((cube) => cube.key === band.key);

        expect(band.bar.name).toBe('Information Technology');
        expect(band.color).toBe(colors_categorical[1]);
        expect(band.cubes).toBe(mine.length);
        expect(band.top).toBe(Math.min(...mine.map((cube) => cube.y)));
        expect(band.bottom).toBe(Math.max(...mine.map((cube) => cube.y)) + layout.size);
    });

    it('leaves a band that rounds to no cubes without a reach', () => {
        const rows = [{ sector: 'Energy', Big: 1000000, Tiny: 1 }];
        const band = layoutOf(rows, 'sector').bands.get('Energy\u0000Tiny');

        expect(band.cubes).toBe(0);
        expect(band.top).toBeNull();
    });

    it('lays out an empty month without a cube', () => {
        const layout = layoutOf([], 'sector', { left: 0, right: 0, top: 0, bottom: 0 });

        expect(layout.bars).toEqual([]);
        expect(layout.cubes).toEqual([]);
        expect(layout.ticks).toEqual([0, 1, 2, 3, 4]);
    });
});
