/**
 * cube-layout.js: where the cubes of a month's distribution sit.
 *
 * A wide screen draws a month's distribution as the stacked bars it was drawn as
 * before #154: one bar per group, each a stack of cubes worth a round
 * number of records. This lays them out -- the bars' order, the value axis, the
 * cubes' size, and where every cube sits -- from the tree distribution-tree.js
 * builds. It is pure, so the rules are held by tests without drawing anything.
 *
 * Note: the cubes are sized so a full row of them across a bar is worth exactly
 *       what the value axis says a row's height is worth, so a stack still reads
 *       against the axis the way a solid bar did.
 */

import { NO_SECTOR, SEVERITY_ORDER } from './distribution-tree.js';
import { colors_categorical } from './colors.js';

//
// past this many bars the largest keep their own and the rest share an 'Other'
// bar, last, as the stacked bars did: sec's forms run to the hundreds, which
// would draw a smear of bars too thin to point at
//
export const MAX_BARS = 20;

//
// the share of a bar's slot the bar takes, the rest being the gap between bars:
// recharts' default category gap of 10% on each side, which the old bars kept
//
const BAR_SHARE = 0.8;

//
// a cube's size: the page between neighboring cubes, the smallest a cube may
// draw, and the size the fit prefers, in px
//
const CUBE_GAP = 2;
const MIN_PITCH = 7;
const PREFERRED_PITCH = 10;

//
// the least of its bar a stack fills, wherever some fit can (#188)
//
const MIN_FILL = 0.5;

//
// how many cubes a stock-split day stands across, each still a split (#192)
//
export const SPLIT_ACROSS = 2;

//
// the round numbers of records a cube may stand for, as multiples of a power of
// ten: the first four read at a glance, the rest only where none of those fit
//
const ROUND = [1, 2, 2.5, 5];
const NEAR_ROUND = [1.5, 3, 4, 6, 8];

function severityRank(label) {
    const rank = SEVERITY_ORDER.indexOf(String(label).trim().toLowerCase());

    return rank === -1 ? SEVERITY_ORDER.length : rank;
}

//
// the old bars' order along the axis: a severity scale worst first, anything
// else by its label, with the numbers in a label compared by value -- 'Form 3'
// before 'Form 10-K', 'Day 5' before 'Day 12' -- and a label off the scale after
// every one on it
//
export function byLabel(a, b) {
    return (severityRank(a.name) - severityRank(b.name))
        || a.name.localeCompare(b.name, undefined, { numeric: true });
}

//
// the bars a tree draws, in axis order.
//
// A bar's parts are what its stack is made of:
//
//     members ranked in it    the S&P 500's industries, a severity's event
//                             types: largest first from the bottom, each in the
//                             color of its rank within the bar
//     a day's sectors         the stock splits, once the api names their
//                             companies: largest first, No sector last, each in
//                             its own color, holding its tickers (#190)
//     itself, as one series   a stream whose groups each hold one thing -- sec's
//                             filings, bls's reports -- and the stock splits
//                             the api sent without sectors, whose day is a count
//                             of the tickers that split
//
// `holds` is what clicking the bar lists, or null where there is nothing under
// it to list: a bar of one series with no tickers, or of one member alone. A
// day lists its tickers whatever its sectors, a day of one sector as well, and
// carries the sectors that hold them, for its list to head them with
//
export function barsOf(tree) {
    const groups = tree && Array.isArray(tree.groups) ? tree.groups : [];
    const noted = groups.some((group) => group.members.some((member) => member.note));
    const ranked = Boolean(tree && tree.nested) && !noted;

    const bars = groups.map((group) => {
        const tickers = group.members.filter((member) => member.note);
        const sectors = group.members.filter((member) => member.tickers && member.tickers.length);
        const held = sectors.reduce((all, member) => all.concat(member.tickers), []);
        const parts = ranked
            ? group.members.map((member) => ({
                key: member.key,
                name: member.name,
                value: member.value,
                color: member.shade,
                ...(member.sector === undefined ? {} : { sector: member.sector, tickers: member.tickers }),
            }))
            : [{ key: group.key, name: group.name, value: group.value, color: colors_categorical[0] }];

        let holds = null;
        if (held.length) {
            holds = { kind: 'tickers', items: held, sectors: sectors };
        } else if (ranked && group.members.length > 1) {
            holds = { kind: 'members', items: group.members };
        } else if (tickers.length) {
            holds = { kind: 'tickers', items: tickers };
        }

        return { key: group.key, name: group.name, value: group.value, parts: parts, holds: holds };
    });

    if (bars.length <= MAX_BARS) {
        return { ranked: ranked, bars: bars.sort(byLabel) };
    }

    const by_size = bars.slice().sort((a, b) => (b.value - a.value) || byLabel(a, b));
    const rest = by_size.slice(MAX_BARS - 1);
    const value = rest.reduce((sum, bar) => sum + bar.value, 0);

    //
    // keyed apart from every group, since a stream may hold a group named 'Other'
    // of its own
    //
    const other = {
        key: '\u0000other',
        name: 'Other',
        value: value,
        parts: sectorParts(rest) || [{ key: '\u0000other', name: 'Other', value: value, color: colors_categorical[0] }],
        holds: { kind: 'groups', items: rest },
    };

    return { ranked: ranked, bars: by_size.slice(0, MAX_BARS - 1).sort(byLabel).concat([other]) };
}

//
// Other's parts, where the days it rolls up are banded by sector: each sector's
// splits in all of them, largest first and No sector last, as a day's are, so a
// color means one sector across the whole chart (#190). Nothing for bars of
// anything else, which Other draws as one series
//
function sectorParts(bars) {
    const by_sector = new Map();

    bars.forEach((bar) => bar.parts.forEach((part) => {
        if (part.sector === undefined) {
            return;
        }

        const held = by_sector.get(part.sector)
            || { key: `\u0000other\u0000${part.sector}`, name: part.name, value: 0, color: part.color, sector: part.sector };

        held.value += part.value;
        by_sector.set(part.sector, held);
    }));

    if (!by_sector.size) {
        return null;
    }

    return Array.from(by_sector.values()).sort((a, b) => (
        ((a.sector === NO_SECTOR) - (b.sector === NO_SECTOR)) || (b.value - a.value) || a.name.localeCompare(b.name)
    ));
}

//
// the value axis as recharts drew it for the old bars: five ticks from zero,
// the step a quarter of the largest bar rounded up to the next twentieth of its
// power of ten -- a tenth, for a step under ten
//
export function ticksOf(max) {
    if (!(max > 0)) {
        return [0, 1, 2, 3, 4];
    }

    const rough = max / 4;
    const digits = Math.floor(Math.log10(rough)) + 1;
    const power = Math.pow(10, digits);
    const scale = digits === 1 ? 0.1 : 0.05;
    const step = Number((Math.ceil((rough / power / scale) - 1e-9) * scale * power).toPrecision(12));

    return [0, 1, 2, 3, 4].map((index) => Number((index * step).toPrecision(12)));
}

//
// the cubes of a chart whose axis runs to `top` over `height` px, in bars
// `width` px wide: how many records a cube stands for, how many sit across a
// bar, and the pitch from one cube to the next.
//
// A row of cubes is one pitch tall and worth `across` cubes, so the axis and the
// stacks agree when pitch = unit * across * height / top. Of the round units and
// counts across that fit the bar, the fit takes the one nearest a 10px pitch
// that fills the most of the bar, and a round unit before a near-round one.
// Where that one fills under half its bar, it takes the best that fills at
// least half instead, of those whose cube is worth no more than its own.
//
// Note: the half is #188's. Held near 10px alone, a month of few records stood
//       in thin stacks: the stock splits' busiest month, 24 in a day, stood a
//       cube wide, a fifth of each bar, where two across fit. A month whose
//       stacks fill most of their bars already -- the S&P 500's, sec's, the
//       weather's -- keeps its fit.
//
// Note: and never by a cube worth more (#190). Without that, a quieter month
//       filled its bars with cubes of two splits each, and a day of 15 drew as
//       8 of them, 16: where nothing finer fills half the bar, the stacks stay
//       thin
//
export function fitCubes(top, height, width) {
    const units = [];

    for (let power = 1; power <= 1e9; power *= 10) {
        ROUND.forEach((step) => units.push({ unit: step * power, round: true }));
        NEAR_ROUND.forEach((step) => units.push({ unit: step * power, round: false }));
    }

    const fits = [];

    for (let across = 1; (across * MIN_PITCH) - CUBE_GAP <= width; across++) {
        units.forEach(({ unit, round }) => {
            if (!Number.isInteger(unit)) {
                return;
            }

            const pitch = (unit * height * across) / top;
            const used = (across * pitch) - CUBE_GAP;

            if (pitch < MIN_PITCH || used > width + 0.01) {
                return;
            }

            fits.push({
                unit: unit,
                across: across,
                pitch: pitch,
                used: used,
                score: (Math.abs(pitch - PREFERRED_PITCH) / PREFERRED_PITCH) + (round ? 0 : 0.3) + (1 - (used / width)),
            });
        });
    }

    if (!fits.length) {
        //
        // a month too small for any round unit to reach the axis -- a single
        // record, say -- draws one cube per record as large as the bar allows
        //
        return { unit: 1, across: 1, pitch: Math.min(width + CUBE_GAP, height) };
    }

    const lowest = (kept, fit) => (fit.score < kept.score ? fit : kept);
    const nearest = fits.reduce(lowest);
    const filling = fits.filter((fit) => fit.used >= width * MIN_FILL && fit.unit <= nearest.unit);
    const best = nearest.used < width * MIN_FILL && filling.length ? filling.reduce(lowest) : nearest;

    return { unit: best.unit, across: best.across, pitch: best.pitch };
}

//
// `count` cubes split across `values` in proportion, the largest remainders
// taking what is left over. A remainder is under one cube, so the leftovers
// never outnumber the parts that have one, and a part with nothing in it gets
// none
//
export function apportion(values, count) {
    const total = values.reduce((sum, value) => sum + value, 0);

    if (!(total > 0)) {
        return values.map(() => 0);
    }

    const exact = values.map((value) => (value * count) / total);
    const shares = exact.map(Math.floor);
    let left = count - shares.reduce((sum, share) => sum + share, 0);

    exact
        .map((value, index) => ({ index: index, remainder: value - Math.floor(value) }))
        .sort((a, b) => (b.remainder - a.remainder) || (a.index - b.index))
        .forEach(({ index }) => {
            if (left > 0) {
                shares[index] += 1;
                left -= 1;
            }
        });

    return shares;
}

//
// every bar and cube of `tree` in a plot running from `plot.left` to
// `plot.right` and from `plot.top` down to `plot.bottom`, in px.
//
// A bar's cubes fill it row by row from the bottom left, its first part first,
// so each part is a band of the stack. `bands` holds each part's band: the bar
// it is in, its color, and how far up the stack it reaches
//
export default function cubeLayout(tree, plot) {
    const { ranked, bars } = barsOf(tree);
    const width = Math.max(1, plot.right - plot.left);
    const height = Math.max(1, plot.bottom - plot.top);
    const slot = width / Math.max(1, bars.length);
    const room = slot * BAR_SHARE;
    const largest = Math.max(0, ...bars.map((bar) => bar.value));
    let ticks = ticksOf(largest);
    let fit = fitCubes(ticks[ticks.length - 1], height, room);

    //
    // a month of stock splits stands two cubes across, each still a split
    // (#192). Where its fit stands one across, its axis runs twice as high, so
    // two cubes of today's size stand side by side and its busiest day reaches
    // about halfway up. Where two of those are wider than a bar, the axis runs
    // just high enough for two smaller ones to fit. A month that stands two
    // across already -- 24 splits in a day -- keeps its fit
    //
    if (fit.across === 1 && fit.unit === 1 && bars.some((bar) => bar.holds && bar.holds.kind === 'tickers')) {
        const fits = (pitch) => pitch >= MIN_PITCH && (SPLIT_ACROSS * pitch) - CUBE_GAP <= room + 0.01;
        let next = ticks.map((tick) => tick * SPLIT_ACROSS);

        if (!fits((SPLIT_ACROSS * height) / next[next.length - 1])) {
            next = ticksOf((SPLIT_ACROSS * SPLIT_ACROSS * height) / (room + CUBE_GAP));
        }

        const pitch = (SPLIT_ACROSS * height) / next[next.length - 1];

        if (fits(pitch)) {
            ticks = next;
            fit = { unit: 1, across: SPLIT_ACROSS, pitch: pitch };
        }
    }

    const top = ticks[ticks.length - 1];
    const { unit, across, pitch } = fit;
    const size = pitch - CUBE_GAP;

    const cubes = [];
    const bands = new Map();

    bars.forEach((bar, index) => {
        bar.center = plot.left + ((index + 0.5) * slot);
        bar.x0 = bar.center - (((across * pitch) - CUBE_GAP) / 2);

        const count = Math.max(1, Math.round(bar.value / unit));
        const shares = apportion(bar.parts.map((part) => part.value), count);
        let at = 0;

        bar.parts.forEach((part, rank) => {
            const band = { key: part.key, bar: bar, part: part, color: part.color, cubes: shares[rank], top: null, bottom: null };
            bands.set(part.key, band);

            for (let cube = 0; cube < shares[rank]; cube++, at++) {
                const x = bar.x0 + ((at % across) * pitch);
                const y = plot.bottom - ((Math.floor(at / across) + 1) * pitch) + CUBE_GAP;

                cubes.push({ key: part.key, bar: bar.key, x: x, y: y, color: part.color });
                band.top = band.top === null ? y : Math.min(band.top, y);
                band.bottom = band.bottom === null ? y + size : Math.max(band.bottom, y + size);
            }
        });

        bar.rows = Math.ceil(at / across);
        bar.cubes = at;
    });

    return {
        plot: plot,
        ranked: ranked,
        bars: bars,
        ticks: ticks,
        top: top,
        unit: unit,
        across: across,
        pitch: pitch,
        size: size,
        slot: slot,
        cubes: cubes,
        bands: bands,
    };
}
