/**
 * distribution-tree.js: a month's distribution, as the groups its charts draw.
 *
 * The workers under worker/data/distribution/ answer one row per group -- a
 * sector, a severity, a form, a series or a day -- keyed by the stream's
 * aggregate key, with a count for each thing the group holds:
 *
 *     { sector: 'Energy', 'Integrated Oil & Gas': 236384, ... }
 *     { severity: 'Severe', 'Flash Flood Warning': 1390, ... }
 *     { sector: 'Day 12', splits: 3, tickers: 'crwd 4:1, svc 1:5, muu 20:1' }
 *
 * This turns those rows into the groups and members the charts draw -- the bars
 * of cubes on a wide screen, and their rows on a phone -- each with its colors
 * and its place in the order. It is pure, so the rules are held by tests
 * without drawing anything.
 */

import checkValidString from '../validator/valid-string.js';
import { colors_categorical, color_tail } from './colors.js';

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
// the order the groups run in, down a phone's rows:
//
//     a severity scale      worst first, the way the scale reads
//     numbered labels       'Day 1', 'Day 5', 'Day 12' -- in number order, since
//                           they share one prefix and differ only by a number
//     anything else         largest first
//
// A wide screen sets its bars out in an order of its own -- see cube-layout.js
//
function groupOrder(groups) {
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
// a part as a share of its whole, in as few figures as read at a glance: '32%',
// '6.6%', and 'under 1%' for anything less, so a sliver never reads as nothing
//
export function share(part, whole) {
    const percent = whole > 0 ? (part / whole) * 100 : 0;

    if (percent >= 10) {
        return `${Math.round(percent)}%`;
    }
    if (percent >= 1) {
        return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
    }
    return 'under 1%';
}

//
// the tree: every group with its members, in order, and the total.
//
// 'nested' is whether the groups hold anything to show beyond themselves. A
// stream whose groups each hold the same one thing -- sec's 'Filings', bls's
// 'Reports' -- has nothing under a group, so each is a bar of one color that
// opens nothing. Tickers always nest, since a day's tickers are exactly what a
// reader opens it for.
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

        //
        // a member's key is its group's and its own name, and a name the group
        // already holds takes its place in the group as well: a day can list one
        // ticker twice -- ucar on September 8, at 1:10 and at 1:20 -- and two
        // members on one key left the sunburst a phone drew until #188 drawing
        // stale slices over each other each time a day opened and closed (#181)
        //
        const group = by_name.get(name);
        found.forEach((member) => {
            const repeat = group.members.filter((held) => held.name === member.name).length;

            names.add(member.name);
            group.members.push({
                ...member,
                key: `${name}\u0000${member.name}${repeat ? `\u0000${repeat}` : ''}`,
                group: group,
            });
            group.value += member.value;
        });
    });

    const groups = groupOrder(Array.from(by_name.values()));
    groups.forEach((group) => group.members.sort(bySize));

    //
    // a member's color, by its rank in its group: the chart colors, largest
    // first, then the shades of the long tail. Its band of its group's bar wears
    // it, and so does its own row once the group is opened
    //
    // Note: a group has no color of its own since #188. The sunburst's inner
    //       ring wore one, a severity scale down one red ramp, and nothing else
    //       draws a group whole
    //
    groups.forEach((group) => {
        const tail = Math.max(group.members.length - colors_categorical.length, 0);

        group.members.forEach((member, rank) => {
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
