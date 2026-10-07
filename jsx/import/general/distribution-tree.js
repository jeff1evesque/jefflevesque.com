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
 * and a day of stock splits, once the datalake api names each split's company,
 * with its sectors as well, each holding its own splits and tickers (#190):
 *
 *     { sector: 'Day 12', splits: 3, tickers: '...', sectors: {
 *         'Office of Technology': { splits: 2, tickers: 'crwd 4:1, muu 20:1' },
 *         'other': { splits: 1, tickers: 'svc 1:5' } } }
 *
 * This turns those rows into the groups and members the charts draw -- the bars
 * of cubes on a wide screen, and their rows on a phone -- each with its colors
 * and its place in the order. It is pure, so the rules are held by tests
 * without drawing anything.
 */

import checkValidString from '../validator/valid-string.js';
import { colors_categorical, color_other, color_other_dark, color_sector_tail, color_tail } from './colors.js';

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

//
// two names in order, the numbers in them by value: 'Day 2' before 'Day 12',
// 'Form 3' before 'Form 10-K'. A phone's rows sort their names by it (#192)
//
export function byName(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function bySize(a, b) {
    return (b.value - a.value) || byName(a, b);
}

//
// the SEC offices that review a split company's industry -- the api's
// stock-split 'sector' -- in the order they take the chart's colors (#190). The
// order is fixed, so an office keeps its color every day of every month: the
// first eight take the chart colors, and the rest steps of the long tail's hue
//
export const SECTORS = [
    'Office of Life Sciences',
    'Office of Technology',
    'Office of Manufacturing',
    'Office of Trade & Services',
    'Office of Finance',
    'Office of Energy & Transportation',
    'Office of Industrial Applications and Services',
    'Office of Real Estate & Construction',
    'Office of Crypto Assets',
    'Office of International Corp Fin',
    'Office of Structured Finance',
];

//
// what the api calls the sector of a split with no company on file
//
export const NO_SECTOR = 'other';

//
// a sector as SECTORS writes it, where it is one of them spelled another way:
// the SEC writes one office without its 'Office of' -- 'Industrial
// Applications and Services' -- so a sector is matched by its name without it
// (#192). A sector SECTORS does not know is kept as the api wrote it
//
const SECTOR_BY_NAME = new Map(SECTORS.map((sector) => [sectorName(sector), sector]));

export function sectorOf(sector) {
    return SECTOR_BY_NAME.get(sectorName(sector)) || sector;
}

function sectorRank(sector) {
    if (sector === NO_SECTOR) {
        return SECTORS.length + 1;
    }

    const at = SECTORS.indexOf(sectorOf(sector));
    return at === -1 ? SECTORS.length : at;
}

//
// a sector's name on the page: the office without its 'Office of', which a
// legend and a tooltip have no room for, and 'No sector' for the api's 'other'
//
export function sectorName(sector) {
    return sector === NO_SECTOR ? 'No sector' : String(sector).replace(/^Office of\s+/i, '');
}

//
// a sector's color, the same on every day of every month: the chart colors in
// SECTORS' order, then the long tail's hue a step at a time, each office its
// own step, and an office SECTORS does not know the step after theirs. No
// sector is a neutral gray, which recedes behind the named ones
//
export function sectorShade(sector, theme = 'light') {
    if (sector === NO_SECTOR) {
        return theme === 'dark' ? color_other_dark : color_other;
    }

    const rank = sectorRank(sector);
    return rank < colors_categorical.length
        ? colors_categorical[rank]
        : color_sector_tail(rank - colors_categorical.length, theme);
}

//
// a day's sectors largest first, and No sector last, on top of its stack
//
function bySector(a, b) {
    return ((a.sector === NO_SECTOR) - (b.sector === NO_SECTOR)) || bySize(a, b);
}

//
// members in the order a stream names, ahead of the rest, which run as they
// always have -- see the `order` the tree takes. Named by the column the api
// counts them in, whatever the page calls them (#230)
//
function byOrder(order) {
    const at = (member) => {
        const place = order.indexOf(member.field);
        return place === -1 ? order.length : place;
    };

    return (a, b) => (at(a) - at(b)) || bySector(a, b);
}

//
// the sectors a worker's row carries, each with its count and its tickers, or
// none for a row without them
//
function sectorsOf(held) {
    if (!held || typeof held !== 'object') {
        return [];
    }

    return Object.keys(held)
        .map((sector) => ({
            sector: sectorOf(sector),
            value: Number(held[sector] && held[sector].splits),
            pairs: splitTickerPairs(held[sector] && held[sector].tickers),
        }))
        .filter((entry) => Number.isFinite(entry.value) && entry.value > 0);
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
// reader opens it for, and so do a day's sectors, which hold them.
//
// 'sectors' is every sector the month's stock splits fall in, in the order of
// their colors, for the charts' legend: none for a month the api sent without
// them, or for any other stream (#190). A day of them has its sectors as its
// members, each holding its tickers.
//
// 'order' names members that keep one place and one color in every group: the
// company facts' statuses, 'new', 'repeated' and 'changed' (#211). By rank, a
// status would take the color of its size in each form, and 'new' would be one
// color on a form of mostly new facts and another on a form of mostly repeated
// ones. A member it does not name runs after them, as it always has.
//
// 'ordered' is every member the order names that the month holds, in that
// order, each in the color it wears in every group, for a phone's legend of
// them, as 'sectors' is for the stock splits' (#230). None where there is no
// order.
//
// 'labels' names a member as the page shows it, where the api's column is not
// that name: the statuses, which the api writes in lower case, are 'New',
// 'Repeated' and 'Changed' wherever a chart names them (#230). The order and
// the colors still go by the api's column, which a member keeps as its 'field'.
//
export default function distributionTree(rows, aggregate_key, theme = 'light', order = [], labels = {}) {
    //
    // a member's name as the page shows it, by the api's column: its own name
    // where the page gives it none. Looked up as the labels' own, so a column
    // named 'constructor' is not named by the object's
    //
    const labelOf = (field) => (Object.prototype.hasOwnProperty.call(labels, field) ? labels[field] : field);

    const by_name = new Map();
    const names = new Set();
    const sectored = new Set();
    let noted = false;

    (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (!row || typeof row !== 'object' || row[aggregate_key] === undefined || row[aggregate_key] === null) {
            return;
        }

        const name = String(row[aggregate_key]);
        const counted = Object.keys(row).filter(
            (key) => key !== aggregate_key && typeof row[key] === 'number' && Number.isFinite(row[key])
        );

        const sectors = sectorsOf(row.sectors);
        const pairs = sectors.length ? [] : splitTickerPairs(row.tickers);
        let found;

        if (sectors.length) {
            found = sectors.map((entry) => ({
                name: sectorName(entry.sector),
                value: entry.value,
                note: null,
                sector: entry.sector,
                pairs: entry.pairs,
            }));
        } else if (pairs.length) {
            found = pairs.map((pair) => ({ name: pair.ticker, value: 1, note: pair.ratio || null }));
        } else {
            found = counted
                .filter((key) => row[key] > 0)
                .map((key) => ({ name: labelOf(key), field: key, value: row[key], note: null }));
        }

        if (!found.length) {
            return;
        }

        noted = noted || pairs.length > 0 || sectors.length > 0;

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
            names.add(member.name);
            group.value += member.value;

            //
            // a sector two rows of one day name is one band of it, holding the
            // tickers of both
            //
            if (member.sector !== undefined) {
                let held = group.members.find((kept) => kept.sector === member.sector);

                if (!held) {
                    held = {
                        name: member.name,
                        value: 0,
                        note: null,
                        sector: member.sector,
                        tickers: [],
                        key: `${name}\u0000${member.name}`,
                        group: group,
                    };
                    group.members.push(held);
                }

                sectored.add(member.sector);
                held.value += member.value;
                member.pairs.forEach((pair) => held.tickers.push({ name: pair.ticker, value: 1, note: pair.ratio || null }));
                return;
            }

            const repeat = group.members.filter((held) => held.name === member.name).length;

            group.members.push({
                ...member,
                key: `${name}\u0000${member.name}${repeat ? `\u0000${repeat}` : ''}`,
                group: group,
            });
        });
    });

    const groups = groupOrder(Array.from(by_name.values()));
    groups.forEach((group) => group.members.sort(byOrder(order)));

    //
    // a sector's tickers run alphabetically, as a day's do, each keyed by its
    // sector as well, and a ticker it lists twice keyed apart
    //
    groups.forEach((group) => group.members.forEach((member) => {
        if (member.tickers) {
            member.tickers.sort(byName);
            member.tickers.forEach((ticker, at) => {
                const repeat = member.tickers.slice(0, at).filter((held) => held.name === ticker.name).length;
                ticker.key = `${member.key}\u0000${ticker.name}${repeat ? `\u0000${repeat}` : ''}`;
            });
        }
    }));

    //
    // a member's color, by its rank in its group: the chart colors, largest
    // first, then the shades of the long tail. Its band of its group's bar wears
    // it, and so does its own row once the group is opened. A day's sector
    // wears its own, the same on every day (#190)
    //
    // Note: a group has no color of its own since #188. The sunburst's inner
    //       ring wore one, a severity scale down one red ramp, and nothing else
    //       draws a group whole
    //
    // Note: a member a stream names in its `order` wears the color of its place
    //       there, the same in every group, and the rest take the colors after
    //       all of those, so none of them wears a named member's color in a group
    //       that happens not to hold it. With no order, a member's place is its
    //       rank, as it always was
    //
    groups.forEach((group) => {
        const named = group.members.filter((member) => order.includes(member.field)).length;
        const tail = Math.max(group.members.length - named + order.length - colors_categorical.length, 0);

        group.members.forEach((member, rank) => {
            if (member.sector !== undefined) {
                member.shade = sectorShade(member.sector, theme);
                return;
            }

            const placed = order.indexOf(member.field);
            const slot = placed !== -1 ? placed : order.length + rank - named;

            member.shade = slot < colors_categorical.length
                ? colors_categorical[slot]
                : color_tail(slot - colors_categorical.length, tail, theme);
        });
    });

    //
    // the color each member the order names wears, from the first group that
    // holds it, since it wears the same in every one
    //
    const worn = new Map();
    groups.forEach((group) => group.members.forEach((member) => {
        if (order.includes(member.field) && !worn.has(member.field)) {
            worn.set(member.field, member.shade);
        }
    }));

    return {
        groups: groups,
        total: groups.reduce((sum, group) => sum + group.value, 0),
        nested: noted || names.size > 1,
        ordered: order
            .filter((field) => worn.has(field))
            .map((field) => ({ key: field, name: labelOf(field), shade: worn.get(field) })),
        sectors: Array.from(sectored)
            .sort((a, b) => (sectorRank(a) - sectorRank(b)) || a.localeCompare(b))
            .map((sector) => ({ key: sector, name: sectorName(sector), shade: sectorShade(sector, theme) })),
    };
}
