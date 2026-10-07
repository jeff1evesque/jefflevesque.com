/**
 * cube-rows.jsx: a month's distribution on a phone, as rows of cubes (#188).
 *
 * The wide screen's bars of cubes, laid on their side: a row for each group of
 * a distribution -- a stream's sectors, severities, forms, series or days -- in
 * the order distribution-tree.js gives them, each with its name, its count and
 * its share over a bar of cubes worth a round number of records. A bar's cubes
 * take its members' colors by rank, as its stack does on a wide screen, so a
 * sector's bar shows what it is made of.
 *
 * A tap on a group that holds more than itself opens it in place of the groups:
 * its members, each a row and a bar of its own, or the tickers that split that
 * day. Its head names it, and its × goes back to every group.
 *
 * A day of stock splits the api names the companies of is banded by sector,
 * each in its own color, which a legend over the rows names, and opens to its
 * tickers under their sectors' heads (#190). A form of company facts is banded
 * by status, each status in one color on every form, which a legend names too
 * (#230). Each folds away under its name, as the page keeps it.
 *
 * A long list shows its first rows and a button for the rest, so a sector of
 * twenty industries, or a month of a hundred forms, is not a page of scrolling.
 *
 * The rows sit under titles that say what each column is, and a tap on one
 * sorts the rows by it, as the listing's titles sort the listing (#192).
 *
 * Note: it took the place of a sunburst (#154), whose names fit only the slices
 *       wide enough for them, at a slant, so a list under the ring did all the
 *       reading. A row's name is always there, and level.
 *
 * Note: a phone's chart. A wide screen draws the bars of cubes standing up --
 *       see cube-chart.jsx.
 */

import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { apportion } from './cube-layout.js';
import { useWidth } from './cube-chart.jsx';
import { byName, share } from './distribution-tree.js';
import scrollMargin from './scroll-margin.js';
import { colors_categorical } from './colors.js';

//
// a cube, the page between neighboring cubes, and how many cubes deep a bar
// is, in px
//
const CUBE = 7;
const GAP = 2;
const PITCH = CUBE + GAP;
const DEPTH = 2;

//
// the room a row's arrow takes at its end, in px, and the width the rows lay
// out at until the page has measured them
//
const ARROW_ROOM = 30;
const FALLBACK_WIDTH = 358;

//
// how many rows a list shows before its button for the rest, and how many more
// it may hold before that button is worth a row of its own
//
const SHOWN = 8;
const SPARE = 2;

//
// a day's tickers, three to a line, and how many lines show before the rest
//
const TICKER_COLUMNS = 3;
const TICKER_LINES = 3;

//
// the numbers of records a cube may stand for, as multiples of a power of ten
//
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

function fmt(value) {
    return Number(value).toLocaleString('en-US');
}

function noun(count, pair) {
    return count === 1 ? pair[0] : pair[1];
}

function capitalized(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

//
// a share in a row's narrow column, where 'under 1%' does not fit
//
function rowShare(part, whole) {
    const text = share(part, whole);

    return text === 'under 1%' ? '<1%' : text;
}

//
// the fewest records a cube can stand for, of the round numbers, for the
// largest row's cubes to fit `columns` columns of them, DEPTH deep
//
export function rowUnit(largest, columns) {
    const room = Math.max(1, columns) * DEPTH;

    for (let power = 1; power <= 1e15; power *= 10) {
        for (const step of STEPS) {
            const unit = step * power;

            if (Number.isInteger(unit) && Math.round(largest / unit) <= room) {
                return unit;
            }
        }
    }

    return Math.max(1, largest);
}

//
// how the rows' cubes are cut: a cube to a thing, one deep, where the largest
// row's count fits a line -- a day's splits, counted one by one -- and else two
// deep, each cube worth the fewest round records that fit
//
export function rowCut(largest, columns) {
    if (largest <= columns) {
        return { unit: 1, depth: 1 };
    }

    return { unit: rowUnit(largest, columns), depth: DEPTH };
}

//
// how many of `count` rows a list shows: every one, unless more than a couple
// would be left over
//
export function shownOf(count, limit = SHOWN) {
    return count > limit + SPARE ? limit : count;
}

//
// a bar's cubes: `count` of them shared among its parts in proportion, filled a
// column at a time from the left, so each part is a band along the bar
//
export function cubesOf(parts, count, depth = DEPTH) {
    const shares = apportion(parts.map((part) => part.value), count);
    const cubes = [];
    let at = 0;

    parts.forEach((part, rank) => {
        for (let cube = 0; cube < shares[rank]; cube++, at++) {
            cubes.push({ x: Math.floor(at / depth) * PITCH, y: (at % depth) * PITCH, color: part.color });
        }
    });

    return cubes;
}

//
// what each of the rows' titles sorts by (#192): the name, with the numbers in
// it by value, as the rows' own order compares names, and the count -- which
// the percent sorts by too, since it is the count's share
//
const SORTS = {
    name: byName,
    count: (a, b) => a.value - b.value,
    share: (a, b) => a.value - b.value,
};

export const SORT_KEYS = Object.keys(SORTS);

//
// the sort a title's tap leaves, as the listing's titles sort: ascending, then
// descending, then back to the rows' own order, as null
//
export function nextSort(sort, key) {
    if (!sort || sort.key !== key) {
        return { key: key, direction: 'ascending' };
    }

    return sort.direction === 'ascending' ? { key: key, direction: 'descending' } : null;
}

//
// `rows` in `sort`'s order, or in their own where there is none. A tie keeps
// the rows' own order, either way round
//
export function sortRows(rows, sort) {
    if (!sort || !SORTS[sort.key]) {
        return rows;
    }

    const compare = SORTS[sort.key];

    return rows.slice().sort((a, b) => (sort.direction === 'descending' ? compare(b, a) : compare(a, b)));
}

export default function CubeRows({
    tree,
    names,
    caption,
    actions,
    overlay,
    sort = null,
    onSort = () => {},
    folds = {},
    onFold = () => {},
}) {
    const box = useRef(null);
    const width = useWidth(box, FALLBACK_WIDTH);
    const [open, setOpen] = useState(null);
    const [whole, setWhole] = useState(false);

    //
    // the order the reader put the rows in from their titles, or null for the
    // rows' own (#192). It starts as the page kept it, and goes back out to the
    // page, which keeps it for the next month -- see 'sort' and 'onSort'
    //
    const [sorting, setSorting] = useState(sort);

    function sortBy(key) {
        const next = nextSort(sorting, key);

        setSorting(next);
        onSort(next);
    }

    //
    // which legends are folded away under their line, by name, and the page
    // told, so it can keep which (#192, #230). Each starts shown
    //
    const [folded, setFolded] = useState(folds);

    function fold(name, value) {
        setFolded((held) => ({ ...held, [name]: value }));
        onFold(name, value);
    }

    //
    // where the keyboard goes once a group opens or closes, since the button
    // pressed is gone: the open group's ×, or the row of the group just closed
    //
    const focus_next = useRef(null);
    const close_button = useRef(null);

    //
    // whether the groups were shown whole when one was opened, so they come
    // back as they were left, with the row of a group opened past the first 8
    // still there to go back to
    //
    const was_whole = useRef(false);

    const unit = names.unit;
    const groups = tree.groups;
    const noted = groups.some((group) => group.members.some((member) => member.note));
    const ranked = tree.nested && !noted;
    const opened = open ? groups.find((group) => group.key === open) || null : null;

    useEffect(() => {
        const next = focus_next.current;
        focus_next.current = null;

        if (next === 'close' && close_button.current) {
            close_button.current.focus({ preventScroll: true });
        } else if (next && box.current) {
            const row = [...box.current.querySelectorAll('button.cube-rows-row')].find((button) => button.dataset.key === next);

            if (row) {
                row.focus({ preventScroll: true });
            }
        }
    }, [open]);

    //
    // a group opened, or every group again, from the top of the rows: the list
    // it leaves may have been scrolled well past it. The top is out of sight
    // above the screen, or under a phone's pinned header, whose height the
    // rows' scroll margin holds -- as the page does for a dataset (#177)
    //
    // Note: scrollIntoView is guarded, since jsdom has none
    //
    function choose(key) {
        if (key) {
            was_whole.current = whole;
        }

        focus_next.current = key ? 'close' : open;
        setOpen(key);
        setWhole(key ? false : was_whole.current);

        const node = box.current;
        if (node && typeof node.scrollIntoView === 'function' && node.getBoundingClientRect().top < scrollMargin(node)) {
            node.scrollIntoView({ block: 'start' });
        }
    }

    let rows = [];
    let tickers = null;
    let sectors = null;

    if (!opened) {
        rows = groups.map((group) => {
            //
            // a group opens to its members, or to a day's tickers: from its
            // sectors, where it is banded by them, whatever their number, so a
            // day of one sector opens as well (#190)
            //
            const held = ranked && group.members.length > 1 ? group.members.length : 0;
            const listed = group.members.reduce(
                (sum, member) => sum + (member.tickers ? member.tickers.length : 0) + (member.note ? 1 : 0), 0
            );
            const opens = listed || held;

            return {
                key: group.key,
                name: group.name,
                value: group.value,
                share: rowShare(group.value, tree.total),
                parts: ranked
                    ? group.members.map((member) => ({ value: member.value, color: member.shade }))
                    : [{ value: group.value, color: colors_categorical[0] }],
                open: opens ? () => choose(group.key) : null,
                aria: `${group.name}, ${fmt(group.value)} ${noun(group.value, unit)}, `
                    + `${share(group.value, tree.total)} of all`
                    + (opens ? `. Opens its ${opens} ${noun(opens, names.member)}` : ''),
            };
        });
    } else if (noted) {
        tickers = opened.members;
    } else if (opened.members.some((member) => member.tickers && member.tickers.length)) {
        //
        // a day banded by sector: its tickers under their sectors' heads, in the
        // bar's order (#190)
        //
        sectors = opened.members.filter((member) => member.tickers && member.tickers.length);
        tickers = sectors.reduce((all, member) => all.concat(member.tickers), []);
    } else {
        rows = opened.members.map((member) => ({
            key: member.key,
            name: member.name,
            value: member.value,
            share: rowShare(member.value, opened.value),
            parts: [{ value: member.value, color: member.shade }],
            open: null,
        }));
    }

    //
    // the groups, or an open group's members, in the order the titles put
    // them in, if any (#192)
    //
    rows = sortRows(rows, sorting);

    const opening = rows.some((row) => row.open);
    const columns = Math.max(1, Math.floor((width - (opening ? ARROW_ROOM : 0) + GAP) / PITCH));

    //
    // the legend over the rows, where a color means one thing on every row: the
    // sectors a month of stock splits is banded by (#190), or the members a
    // stream keeps in one color in every group, the company facts' statuses
    // (#230). None while a group is open, or where a color means only a rank
    // in its row, as an industry's in its sector does
    //
    let swatches = null;
    if (!opened && tree.sectors && tree.sectors.length) {
        swatches = { name: 'sectors', items: tree.sectors };
    } else if (!opened && tree.ordered && tree.ordered.length) {
        swatches = { name: names.member[1], items: tree.ordered };
    }
    const swatches_shown = Boolean(swatches) && folded[swatches.name] !== true;
    const { unit: per_cube, depth } = rowCut(Math.max(1, ...rows.map((row) => row.value)), columns);
    const legend = per_cube === 1 ? `Each cube is 1 ${unit[0]}` : `Each cube ≈ ${fmt(per_cube)} ${unit[1]}`;

    //
    // only a list that runs largest first is cut short, since only there is the
    // rest the least of it. Days, and a severity scale, run in their own order,
    // and cut short they would hide whichever came last: November 2025's
    // busiest day, the 19th, was the 11th of its 17
    //
    // Note: and so is a list sorted from its titles (#192). Sorted largest
    //       first, it shows its first 8, and sorted any other way, every row
    //
    const largest_first = rows.every((row, index) => index === 0 || rows[index - 1].value >= row.value);
    const items = tickers || rows;
    let cut = items.length;
    if (tickers) {
        cut = shownOf(items.length, TICKER_COLUMNS * TICKER_LINES);
    } else if (largest_first) {
        cut = shownOf(items.length);
    }
    const shown = whole ? items.length : cut;
    const rest = items.length - shown;
    const pair = opened ? names.member : names.group;

    //
    // the open group's head: its name, what it holds, and the way back to every
    // group. A day's splits are its tickers, so it counts them once
    //
    let head = null;
    if (opened) {
        const meta = [`${fmt(opened.value)} ${noun(opened.value, unit)}`];
        if (!tickers) {
            meta.push(`${opened.members.length} ${noun(opened.members.length, names.member)}`);
        }
        meta.push(`${share(opened.value, tree.total)} of all`);

        head = (
            <div className='cube-rows-head'>
                <div className='cube-rows-heading'>
                    <span className='cube-rows-title'>{opened.name}</span>
                    <span className='cube-rows-meta'>{meta.join(' · ')}</span>
                </div>
                <button
                    type='button'
                    className='cube-rows-close'
                    ref={close_button}
                    aria-label={`Back to all ${names.group[1]}`}
                    title={`Back to all ${names.group[1]}`}
                    onClick={() => choose(null)}
                >
                    <CloseIcon fontSize='inherit' />
                </button>
            </div>
        );
    }

    const bar = (row) => {
        const count = Math.max(1, Math.round(row.value / per_cube));
        const across = Math.ceil(count / depth);

        return (
            <svg className='cube-rows-bar' width={(across * PITCH) - GAP} height={(depth * PITCH) - GAP} aria-hidden='true'>
                {cubesOf(row.parts, count, depth).map((cube, index) => (
                    <rect key={index} x={cube.x} y={cube.y} width={CUBE} height={CUBE} rx={1.5} fill={cube.color} />
                ))}
            </svg>
        );
    };

    //
    // a title that sorts: its name, and an arrow for the way the rows are sorted
    // by it, or a faint pair of them while they are not, as the listing's
    // titles are (#192)
    //
    const title = (key, text, className) => {
        const on = !!sorting && sorting.key === key;
        let Arrow = UnfoldMoreIcon;

        if (on) {
            Arrow = sorting.direction === 'ascending' ? ArrowUpwardIcon : ArrowDownwardIcon;
        }

        return (
            <button
                type='button'
                className={`cube-rows-sort ${className}${on ? ' is-sorted' : ''}`}
                aria-label={on ? `${text}, sorted ${sorting.direction}` : `Sort by ${text}`}
                onClick={() => sortBy(key)}
            >
                {text}
                <Arrow className='cube-rows-sort-arrow' aria-hidden='true' />
            </button>
        );
    };

    const tickerList = (held, label) => (
        <ul className='cube-rows-tickers' aria-label={label}>
            {held.map((member) => (
                <li key={member.key} className='cube-rows-ticker'>
                    <span className='cube-rows-ticker-name'>{member.name}</span>
                    <span className='cube-rows-ticker-ratio'>{member.note}</span>
                </li>
            ))}
        </ul>
    );

    //
    // a day's tickers, three to a line. Where the day is banded by sector, each
    // sector heads its own with its swatch, name and count, as far as the
    // tickers shown reach (#190)
    //
    let listed = null;
    if (sectors) {
        let left = shown;

        listed = (
            <div className='cube-rows-sectors' role='group' aria-label={`${opened.name}: its ${names.member[1]}`}>
                {sectors.map((member) => {
                    const held = member.tickers.slice(0, Math.max(0, left));
                    left -= held.length;

                    return held.length ? (
                        <div key={member.key} className='cube-rows-sector'>
                            <div className='cube-rows-sector-head'>
                                <span className='cube-rows-swatch' style={{ background: member.shade }} />
                                <span className='cube-rows-sector-name'>{member.name}</span>
                                <span className='cube-rows-sector-count'>{fmt(member.value)}</span>
                            </div>
                            {tickerList(held, member.name)}
                        </div>
                    ) : null;
                })}
            </div>
        );
    } else if (tickers) {
        listed = tickerList(tickers.slice(0, shown), `${opened.name}: its ${names.member[1]}`);
    }

    return (
        <div
            className='cube-rows'
            ref={box}
            role='group'
            aria-label={`${capitalized(unit[1])} by ${names.group[0]}, ${caption}`}
        >
            {actions ? <div className='cube-rows-actions'>{actions}</div> : null}
            {head}
            {/*

                what a cube is worth, and, beside it, the fold for the legend
                under it, named for what it names: 'Sectors' (#192) or
                'Statuses' (#230)

            */}
            {rows.length ? (
                <div className='cube-rows-key-row'>
                    <p className='cube-rows-key'>{legend}</p>
                    {swatches ? (
                        <button
                            type='button'
                            className='cube-rows-legend-fold'
                            aria-expanded={swatches_shown}
                            onClick={() => fold(swatches.name, swatches_shown)}
                        >
                            {capitalized(swatches.name)}
                            {swatches_shown
                                ? <ExpandLessIcon fontSize='inherit' aria-hidden='true' />
                                : <ExpandMoreIcon fontSize='inherit' aria-hidden='true' />}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {/*

                the sectors a month of stock splits is banded by (#190), or the
                statuses a month of company facts is (#230), each in its color,
                over the rows they band, unless folded away

            */}
            {swatches_shown ? (
                <ul className='cube-rows-legend' aria-label={capitalized(swatches.name)}>
                    {swatches.items.map((item) => (
                        <li key={item.key} className='cube-rows-legend-item'>
                            <span className='cube-rows-swatch' style={{ background: item.shade }} />
                            {item.name}
                        </li>
                    ))}
                </ul>
            ) : null}
            {/*

                the rows' titles: what a row is, what it counts, and its share,
                each over its own column, and each a button that sorts by it
                (#192). An open day's tickers have none

            */}
            {!listed && rows.length ? (
                <div className={`cube-rows-titles${opening ? ' has-arrows' : ''}`}>
                    {title('name', capitalized(pair[0]), 'cube-rows-title-name')}
                    {title('count', capitalized(unit[1]), 'cube-rows-title-count')}
                    {title('share', 'Percent', 'cube-rows-title-share')}
                </div>
            ) : null}
            {listed || (
                <ul className={`cube-rows-list${opening ? ' has-arrows' : ''}`}>
                    {rows.slice(0, shown).map((row) => {
                        const inner = (
                            <>
                                <span className='cube-rows-name'>{row.name}</span>
                                <span className='cube-rows-count'>{fmt(row.value)}</span>
                                <span className='cube-rows-share'>{row.share}</span>
                                {bar(row)}
                                {row.open ? (
                                    <span className='cube-rows-arrow' aria-hidden='true'>
                                        <ChevronRightIcon fontSize='inherit' />
                                    </span>
                                ) : null}
                            </>
                        );

                        return (
                            <li key={row.key}>
                                {row.open ? (
                                    <button
                                        type='button'
                                        className='cube-rows-row is-opening'
                                        data-key={row.key}
                                        aria-label={row.aria}
                                        onClick={row.open}
                                    >
                                        {inner}
                                    </button>
                                ) : (
                                    <div className='cube-rows-row'>{inner}</div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {rest > 0 ? (
                <button type='button' className='cube-rows-more' onClick={() => setWhole(true)}>
                    <ExpandMoreIcon fontSize='inherit' aria-hidden='true' />
                    {`Show ${rest} more ${noun(rest, pair)}`}
                </button>
            ) : null}
            {whole && items.length > cut ? (
                <button type='button' className='cube-rows-more' onClick={() => setWhole(false)}>
                    <ExpandLessIcon fontSize='inherit' aria-hidden='true' />
                    Show fewer
                </button>
            ) : null}
            {/*

                the loader, over the top of the rows rather than their middle,
                which on a long list is off the bottom of the screen

            */}
            {overlay ? <div className='cube-rows-overlay'>{overlay}</div> : null}
        </div>
    );
}

CubeRows.propTypes = {
    tree: PropTypes.shape({
        groups: PropTypes.arrayOf(PropTypes.object).isRequired,
        total: PropTypes.number.isRequired,
        nested: PropTypes.bool.isRequired,
        sectors: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            shade: PropTypes.string.isRequired,
        })),
        ordered: PropTypes.arrayOf(PropTypes.shape({
            key: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            shade: PropTypes.string.isRequired,
        })),
    }).isRequired,
    names: PropTypes.shape({
        group: PropTypes.arrayOf(PropTypes.string).isRequired,
        member: PropTypes.arrayOf(PropTypes.string).isRequired,
        unit: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    caption: PropTypes.string.isRequired,
    actions: PropTypes.node,
    overlay: PropTypes.node,
    //
    // the order the rows start in, from their titles, and what is told when it
    // changes -- the page keeps it for the next month (#192)
    //
    sort: PropTypes.shape({
        key: PropTypes.oneOf(SORT_KEYS).isRequired,
        direction: PropTypes.oneOf(['ascending', 'descending']).isRequired,
    }),
    onSort: PropTypes.func,
    //
    // which legends start folded away, by name ('sectors', 'statuses'), and
    // what is told when one is folded or shown -- the page keeps it for the next
    // visit (#192, #230)
    //
    folds: PropTypes.objectOf(PropTypes.bool),
    onFold: PropTypes.func,
};
