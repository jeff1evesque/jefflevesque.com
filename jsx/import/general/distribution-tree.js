/**
 * distribution-tree.js: a month's distribution, as the groups a sunburst draws.
 *
 * The workers under worker/data/distribution/ answer one row per group -- a
 * sector, a severity, a form, a series or a day -- keyed by the stream's
 * aggregate key, with a count for each thing the group holds:
 *
 *     { sector: 'Energy', 'Integrated Oil & Gas': 236384, ... }
 *     { severity: 'Severe', 'Flash Flood Warning': 1390, ... }
 *     { sector: 'Day 12', splits: 3, tickers: 'crwd 4:1, svc 1:5, muu 20:1' }
 *
 * This turns those rows into the groups and members the ring draws, each with
 * its color and its place around the ring. It is pure, so the rules are held by
 * tests without drawing anything.
 */

import checkValidString from '../validator/valid-string.js';
import { colors_categorical, color_tail, severityColors } from './colors.js';

//
// nws severity is an ordered scale, so it is drawn worst first rather than
// largest first. 'unknown' closes the scale rather than sitting on it, and
// takes a gray rather than a step of the ramp
//
export const SEVERITY_ORDER = ['extreme', 'severe', 'moderate', 'minor', 'unknown'];

function severityRank(label) {
    return SEVERITY_ORDER.indexOf(String(label).trim().toLowerCase());
}

//
// split the api's 'nvdl 3:1, mull 25:1' into [{ticker, ratio}], so each ticker
// that split can be a member of its day, carrying its ratio
//
export function splitTickerPairs(tickers) {
    if (!checkValidString(tickers)) {
        return [];
    }

    return tickers
        .split(',')
        .map((entry) => {
            const parts = entry.trim().split(/\s+/);
            return { ticker: parts[0], ratio: parts.slice(1).join(' ') };
        })
        .filter((entry) => entry.ticker);
}

function byName(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function bySize(a, b) {
    return (b.value - a.value) || byName(a, b);
}

//
// the order the ring runs in, clockwise from twelve o'clock, and the list reads
// in:
//
//     a severity scale      worst first, the way the scale reads
//     numbered labels       'Day 1', 'Day 5', 'Day 12' -- in number order, since
//                           they share one prefix and differ only by a number
//     anything else         largest first
//
function ringOrder(groups) {
    if (groups.length && groups.every((group) => severityRank(group.name) !== -1)) {
        return groups.slice().sort((a, b) => severityRank(a.name) - severityRank(b.name));
    }

    const numbered = groups.map((group) => /^(.*?)(\d+)$/.exec(group.name));

    if (
        groups.length > 1
        && numbered.every((match) => match && match[1] === numbered[0][1])
    ) {
        return groups.slice().sort((a, b) => Number(/(\d+)$/.exec(a.name)[1]) - Number(/(\d+)$/.exec(b.name)[1]));
    }

    return groups.slice().sort(bySize);
}

//
// a group's color, by what its groups are:
//
//     a severity scale    one hue, darkest for the most severe, and a gray for
//                         anything off the scale -- see severityColors
//     anything else       the site's eight chart colors, largest first, and the
//                         shades of the long tail past them, as the bars were
//
// Note: a stream that counts one thing in each group -- sec's filings, bls's
//       reports, the stock splits -- takes the chart colors as well (#167). It
//       was one blue for the whole ring, so its slices were told apart only by
//       the thin gaps between them. The bars of cubes on a wide screen still
//       draw such a stream in one color, a bar to a group -- see cube-layout.js
//       -- since there the bars stand apart and the names under them say which
//       is which.
//
function paint(groups, theme) {
    if (groups.length && groups.every((group) => severityRank(group.name) !== -1)) {
        const ramp = severityColors(theme);

        groups.forEach((group) => {
            const rank = severityRank(group.name);
            group.color = rank < ramp.length ? ramp[rank] : color_tail(0, 1, theme);
        });
        return;
    }

    const ranked = groups.slice().sort(bySize);
    const tail = Math.max(ranked.length - colors_categorical.length, 0);

    ranked.forEach((group, rank) => {
        group.color = rank < colors_categorical.length
            ? colors_categorical[rank]
            : color_tail(rank - colors_categorical.length, tail, theme);
    });
}

//
// the tree: every group with its members, in ring order, and the total.
//
// 'nested' is whether the ring has a second, outer ring at all. A stream whose
// groups each hold the same one thing -- sec's 'Filings', bls's 'Reports' -- has
// nothing to draw outside the groups, so it draws them as a single ring. Tickers
// always nest, since a day's tickers are exactly what a reader opens it for.
//
export default function distributionTree(rows, aggregate_key, theme = 'light') {
    const by_name = new Map();
    const names = new Set();
    let noted = false;

    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (!row || typeof row !== 'object' || row[aggregate_key] === undefined || row[aggregate_key] === null) {
            return;
        }

        const name = String(row[aggregate_key]);
        const counted = Object.keys(row).filter(
            (key) => key !== aggregate_key && typeof row[key] === 'number' && Number.isFinite(row[key])
        );

        const pairs = splitTickerPairs(row.tickers);
        const found = pairs.length
            ? pairs.map((pair) => ({ name: pair.ticker, value: 1, note: pair.ratio || null }))
            : counted
                .filter((key) => row[key] > 0)
                .map((key) => ({ name: key, value: row[key], note: null }));

        if (!found.length) {
            return;
        }

        noted = noted || pairs.length > 0;

        if (!by_name.has(name)) {
            by_name.set(name, { key: name, name: name, value: 0, members: [] });
        }

        const group = by_name.get(name);
        found.forEach((member) => {
            names.add(member.name);
            group.members.push({ ...member, key: `${name}\u0000${member.name}`, group: group });
            group.value += member.value;
        });
    });

    const groups = ringOrder(Array.from(by_name.values()));
    groups.forEach((group) => group.members.sort(bySize));

    paint(groups, theme);

    //
    // on the ring a member wears its group's color, so the outer ring reads as
    // belonging to the inner one. Opened, the group is the whole ring, and its
    // members take colors of their own the way the groups do: the chart colors,
    // largest first, then the shades of the long tail
    //
    groups.forEach((group) => {
        const tail = Math.max(group.members.length - colors_categorical.length, 0);

        group.members.forEach((member, rank) => {
            member.color = group.color;
            member.shade = rank < colors_categorical.length
                ? colors_categorical[rank]
                : color_tail(rank - colors_categorical.length, tail, theme);
        });
    });

    return {
        groups: groups,
        total: groups.reduce((sum, group) => sum + group.value, 0),
        nested: noted || names.size > 1,
    };
}
