/**
 * sunburst.jsx: a month's distribution as a ring, with a list beside it.
 *
 * The groups of a distribution -- a stream's sectors, severities, forms, series
 * or days -- sit on the inner ring, and what each group holds on the outer one,
 * each sized by its count. The list beside the ring holds the same segments as
 * rows: every name, count and share, including a segment too thin to draw, and
 * it sorts by any of them the way the listing's table does. The groups, their
 * colors and their order come from distribution-tree.js.
 *
 * Pointing at a segment, or at its row, draws that segment a shade darker on a
 * light page and a shade brighter on a dark one, fades the rest, and names it in
 * the middle. Clicking a group opens it all the way round, where its members
 * take colors of their own; the middle, or any segment, closes it again. On a
 * phone the first tap on a segment describes it and the second opens it, since
 * there is no pointer to describe it first.
 *
 * Note: the ring is drawn in its own 400-unit box and scaled to whatever size
 *       the page gives it, so the radii, the gaps and the labels are fixed and
 *       only the box changes.
 */

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { ThemeModeContext } from './theme-mode.jsx';
import { compareFigures } from './listing-table.jsx';
import { themeColors, ink, mix, onFill } from './colors.js';

const BOX = 400;
const CENTER = BOX / 2;

//
// the radii, in the box's units: the hole, the inner ring, the page between the
// rings, and the outer ring
//
const R0 = 95;
const R1 = 155;
const RING_GAP = 4;
const R2 = 196;

//
// the page between neighboring segments, a label's size, and the room a label
// keeps from its segment's edges, in the box's units
//
const GAP = 2;
const LABEL = 12;
const CLEAR = 2;

//
// how long opening or closing a group takes, how far the other segments fade
// while one is pointed at, how far that one moves toward the ink, and how far
// the outer ring moves toward the page
//
const TWEEN_MS = 560;
const FADED = 0.2;
const SHADE = 0.25;
const TINT = 0.4;

//
// the middle's box, as a share of the ring's: the hole, less a margin
//
const HOLE = ((2 * (R0 - 10)) / BOX) * 100;

function fmt(value) {
    return Number(value).toLocaleString('en-US');
}

function noun(count, pair) {
    return count === 1 ? pair[0] : pair[1];
}

function capitalized(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

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
// how wide a label draws, in the box's units, from the widths of the letters it
// holds. An estimate rather than a measurement: the page's font is the reader's
// own system font, and a label only has to be known to fit, so each class of
// letter errs a little wide.
//
export function labelWidth(text, size = LABEL) {
    let em = 0;

    for (const letter of String(text)) {
        if (letter === ' ') {
            em += 0.28;
        } else if ('iljtfrI.,:;!|\'()'.includes(letter)) {
            em += 0.32;
        } else if ('mwMW@%&'.includes(letter)) {
            em += 0.86;
        } else if (/[A-Z]/.test(letter)) {
            em += 0.68;
        } else {
            em += 0.56;
        }
    }

    return em * size * 1.08;
}

//
// where a label of `width` sits on a segment from `r0` to `r1` and `a0` to `a1`,
// or null where it does not fit.
//
// A label is straight and runs along the segment, so it touches the circle only
// at its middle: its ends reach further out, to the hypotenuse of the radius and
// half its width. It is set inward by half that reach, so the band it covers sits
// in the middle of the ring, and it fits when that band, and the angle its ends
// span, both clear the segment's edges.
//
export function labelPlace(width, r0, r1, a0, a1) {
    const middle = (r0 + r1) / 2;
    const half = width / 2;
    const radius = middle - ((Math.hypot(middle, half) - middle) / 2);
    const band = Math.hypot(radius, half) - radius + LABEL;

    if (band + (2 * CLEAR) > r1 - r0 || (2 * Math.atan(half / radius)) + ((4 * CLEAR) / radius) > a1 - a0) {
        return null;
    }

    const toward = (a0 + a1) / 2;

    return {
        x: radius * Math.sin(toward),
        y: -radius * Math.cos(toward),
        //
        // along the segment, and turned over on the lower half of the ring so it
        // never reads upside down
        //
        rotate: ((toward * 180) / Math.PI) + (toward > Math.PI / 2 && toward < (3 * Math.PI) / 2 ? 180 : 0),
    };
}

//
// every group and member placed around the ring, as a share of the whole:
// d3's partition over the tree, which keeps the order the tree gives
//
function layoutOf(tree) {
    const children = (datum) => datum.children || (tree.nested && datum.members) || null;
    const root = d3.hierarchy({ children: tree.groups }, children)
        .sum((datum) => (children(datum) ? 0 : datum.value));

    d3.partition().size([1, 1])(root);

    const nodes = root.descendants().filter((node) => node.depth > 0);

    return {
        nested: tree.nested,
        top: root.children || [],
        nodes: nodes,
        byKey: new Map(nodes.map((node) => [node.data.key, node])),
    };
}

//
// the view the ring settles on: the whole month, or one group opened all the
// way round, with a sliver of a ring of its own inside its members
//
function frameFor(layout, open) {
    if (open) {
        return { d0: open.x0, d1: open.x1, r1: [R0, R0 + 8], r2: [R0 + 12, R2], tint: 0 };
    }
    if (!layout.nested) {
        return { d0: 0, d1: 1, r1: [R0, R2], r2: [R2, R2], tint: 0 };
    }
    return { d0: 0, d1: 1, r1: [R0, R1], r2: [R1 + RING_GAP, R2], tint: TINT };
}

function lerp(a, b, t) {
    return a + ((b - a) * t);
}

function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (Math.pow((-2 * t) + 2, 3) / 2);
}

function between(a, b, t) {
    const e = ease(t);

    return {
        d0: lerp(a.d0, b.d0, e),
        d1: lerp(a.d1, b.d1, e),
        r1: [lerp(a.r1[0], b.r1[0], e), lerp(a.r1[1], b.r1[1], e)],
        r2: [lerp(a.r2[0], b.r2[0], e), lerp(a.r2[1], b.r2[1], e)],
        tint: lerp(a.tint, b.tint, e),
    };
}

//
// whether opening a group glides: a browser that can, for a reader who has not
// asked for less motion
//
function glides() {
    if (typeof window.requestAnimationFrame !== 'function') {
        return false;
    }

    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

const arc = d3.arc()
    .startAngle((segment) => segment.a0)
    .endAngle((segment) => segment.a1)
    .innerRadius((segment) => segment.r0)
    .outerRadius((segment) => segment.r1)
    .padAngle((segment) => Math.min((segment.a1 - segment.a0) / 2, GAP / R1))
    .padRadius(R1);

//
// the list's columns that sort, by what each sorts on: the name as text, and
// the count and its share by the count
//
const SORTS = {
    name: (datum) => datum.name,
    count: (datum) => datum.value,
    share: (datum) => datum.value,
};

export default function Sunburst({ tree, names, caption, size, phone, actions, overlay }) {
    const { theme } = useContext(ThemeModeContext);
    const [open, setOpen] = useState(null);
    const [lit, setLit] = useState(null);
    const [sort, setSort] = useState(null);
    const [, setTick] = useState(0);
    const tween = useRef(null);
    const frame_id = useRef(null);

    const layout = useMemo(() => layoutOf(tree), [tree]);

    useEffect(() => () => {
        if (frame_id.current) {
            window.cancelAnimationFrame(frame_id.current);
        }
    }, []);

    //
    // the group open, if it is still one this tree holds
    //
    const opened = open ? layout.byKey.get(open) : null;
    const current = opened && opened.depth === 1 ? opened : null;
    const run = tween.current;
    const frame = run ? between(run.from, run.to, run.t) : frameFor(layout, current);
    const hot = lit ? layout.byKey.get(lit) || null : null;
    const page = themeColors(theme)['white-1'];

    function zoomTo(key) {
        const target = key ? layout.byKey.get(key) : null;
        const from = frame;

        setLit(null);
        setOpen(key);

        if (frame_id.current) {
            window.cancelAnimationFrame(frame_id.current);
            frame_id.current = null;
        }

        if (!glides()) {
            tween.current = null;
            return;
        }

        tween.current = { from: from, to: frameFor(layout, target), t: 0, start: null };

        const step = (now) => {
            const moving = tween.current;

            if (moving.start === null) {
                moving.start = now;
            }

            moving.t = Math.min(1, (now - moving.start) / TWEEN_MS);

            if (moving.t >= 1) {
                tween.current = null;
                frame_id.current = null;
            } else {
                frame_id.current = window.requestAnimationFrame(step);
            }

            setTick((tick) => tick + 1);
        };

        frame_id.current = window.requestAnimationFrame(step);
    }

    //
    // what a click on a segment does: open its group, or close the one open
    //
    function act(node) {
        if (current) {
            zoomTo(null);
        } else {
            zoomTo(node.depth === 1 ? node.data.key : node.parent.data.key);
        }
    }

    //
    // a header's click: ascending, then descending, then back to the ring's own
    // order, as the listing's table sorts
    //
    function sortBy(key) {
        if (!sort || sort.key !== key) {
            setSort({ key: key, direction: 'ascending' });
        } else if (sort.direction === 'ascending') {
            setSort({ key: key, direction: 'descending' });
        } else {
            setSort(null);
        }
    }

    const related = (node) => !hot || node === hot || node.parent === hot || hot.parent === node;
    const angle = (x) => Math.max(0, Math.min(1, (x - frame.d0) / (frame.d1 - frame.d0))) * 2 * Math.PI;

    const arcs = [];
    const labels = [];

    layout.nodes.forEach((node) => {
        const a0 = angle(node.x0);
        const a1 = angle(node.x1);
        const [r0, r1] = node.depth === 1 ? frame.r1 : frame.r2;

        if (a1 - a0 < 1e-6) {
            return;
        }

        //
        // an open group's members wear their own colors; on the whole ring they
        // wear their group's, moved toward the page
        //
        let base = node.data.color;
        if (node.depth === 2) {
            base = current ? node.data.shade : mix(node.data.color, page, frame.tint);
        }
        const fill = node === hot ? mix(base, ink(theme), SHADE) : base;
        const key = node.data.key;

        arcs.push({
            key: key,
            name: node.data.name,
            d: arc({ a0, a1, r0, r1 }),
            fill: fill,
            opacity: related(node) ? 1 : FADED,
            click: () => {
                if (phone && lit !== key) {
                    setLit(key);
                    return;
                }
                if (layout.nested) {
                    act(node);
                }
            },
        });

        //
        // a name rides its own segment where it fits, and is left to the list
        // where it does not. None while the ring is moving.
        //
        const place = run ? null : labelPlace(labelWidth(node.data.name), r0, r1, a0, a1);

        if (place) {
            labels.push({
                key: key,
                text: node.data.name,
                transform: `translate(${place.x.toFixed(2)},${place.y.toFixed(2)}) rotate(${place.rotate.toFixed(2)})`,
                fill: onFill(fill),
                opacity: related(node) ? 1 : FADED,
            });
        }
    });

    const whole = current ? current.value : tree.total;
    const unit = names.unit;

    //
    // the middle names what is pointed at, or else what the ring is showing,
    // and its last line says what a tap or a click does there: open a group,
    // open the one pointed at, or go back to them all. How to open a group
    // sat over the ring until #185, where it came and went as a group opened
    // and closed, moving the ring with it
    //
    let center;
    if (hot) {
        const datum = hot.data;
        const group = hot.depth === 2 ? hot.parent.data : null;
        let detail = `${noun(datum.value, unit)} · ${share(datum.value, group ? group.value : tree.total)} `
            + `of ${group ? group.name : 'all'}`;

        if (datum.note) {
            detail = `${group.name} · ${fmt(group.value)} ${noun(group.value, unit)}`;
        }

        center = {
            title: datum.name,
            value: datum.note || fmt(datum.value),
            detail: detail,
            hint: layout.nested ? `${phone ? 'Tap again' : 'Click'} to zoom ${current ? 'out' : 'in'}` : '',
        };
    } else if (current) {
        center = {
            title: current.data.name,
            value: fmt(current.value),
            detail: noun(current.value, unit),
            hint: `Back to all ${names.group[1]}`,
        };
    } else {
        center = {
            title: `All ${names.group[1]}`,
            value: fmt(tree.total),
            detail: noun(tree.total, unit),
            hint: layout.nested && layout.top.length ? `${phone ? 'Tap twice' : 'Click'} to zoom in` : '',
        };
    }

    let listed = current ? current.children : layout.top;

    if (sort) {
        listed = [...listed].sort((a, b) => compareFigures(SORTS[sort.key](a.data), SORTS[sort.key](b.data), sort.direction));
    }

    const rows = listed.map((node) => {
        const datum = node.data;
        const zoomable = layout.nested && !current;

        //
        // a ticker shows its ratio where a count would be, and its share of its
        // day as every row shows its share -- which was left blank for it
        //
        return {
            key: datum.key,
            name: datum.name,
            value: datum.note || fmt(datum.value),
            share: share(datum.value, whole),
            color: current ? datum.shade : datum.color,
            lit: hot === node,
            zoomable: zoomable,
            aria: `${datum.name}, ${datum.note || `${fmt(datum.value)} ${noun(datum.value, unit)}`}, `
                + `${share(datum.value, whole)} of ${current ? current.data.name : 'all'}`
                + (zoomable ? `. Zooms into ${datum.name}` : ''),
        };
    });

    //
    // a header that sorts: its name, and an arrow for the way it is sorted, or a
    // faint pair of them while it is not
    //
    const header = (key, text, className) => {
        const on = !!sort && sort.key === key;
        let Arrow = UnfoldMoreIcon;

        if (on) {
            Arrow = sort.direction === 'ascending' ? ArrowUpwardIcon : ArrowDownwardIcon;
        }

        return (
            <button
                type='button'
                className={`sunburst-sort${on ? ' sunburst-sorted' : ''}${className ? ` ${className}` : ''}`}
                aria-label={on ? `${text}, sorted ${sort.direction}` : `Sort by ${text}`}
                onClick={() => sortBy(key)}
            >
                {text}
                <Arrow className='sunburst-arrow' aria-hidden='true' />
            </button>
        );
    };

    const middle_lines = (
        <>
            <span className='sunburst-center-title'>{center.title}</span>
            <span className='sunburst-center-value'>{center.value}</span>
            <span className='sunburst-center-detail'>{center.detail}</span>
            {center.hint ? <span className='sunburst-center-hint'>{center.hint}</span> : null}
        </>
    );

    const middle_box = {
        left: `${(100 - HOLE) / 2}%`,
        top: `${(100 - HOLE) / 2}%`,
        width: `${HOLE}%`,
        height: `${HOLE}%`,
    };

    return (
        <div className={`sunburst${phone ? ' sunburst-phone' : ''}`}>
            {/*

                over the ring, the page's actions alone: what the ring shows,
                its total, the way back from an open group and how to open one
                are the middle's to say, and the month the page's, just above
                (#181). A breadcrumb over the ring said them again, and read
                like the page's own "All data" over it (#185). The month still
                names the ring to a screen reader, in its label (#183)

            */}
            {actions ? (
                <div className='sunburst-head'>
                    <div className='sunburst-actions'>{actions}</div>
                </div>
            ) : null}
            <div className='sunburst-body'>
                <div className='sunburst-ring' style={size ? { width: size, height: size } : undefined}>
                    <svg
                        viewBox={`0 0 ${BOX} ${BOX}`}
                        role='img'
                        aria-label={`${capitalized(unit[1])} by ${names.group[0]}`
                            + `${layout.nested ? ` and ${names.member[0]}` : ''}, ${caption}`}
                    >
                        <g transform={`translate(${CENTER},${CENTER})`}>
                            {arcs.map((segment) => (
                                <path
                                    key={segment.key}
                                    className={`sunburst-arc${layout.nested ? ' is-zoomable' : ''}`}
                                    data-name={segment.name}
                                    d={segment.d}
                                    fill={segment.fill}
                                    style={{ opacity: segment.opacity }}
                                    onClick={segment.click}
                                    onMouseEnter={phone ? undefined : () => setLit(segment.key)}
                                    onMouseLeave={phone ? undefined : () => setLit(null)}
                                />
                            ))}
                            {labels.map((label) => (
                                <text
                                    key={label.key}
                                    className='sunburst-label'
                                    transform={label.transform}
                                    fill={label.fill}
                                    textAnchor='middle'
                                    dy='0.35em'
                                    style={{ opacity: label.opacity }}
                                >
                                    {label.text}
                                </text>
                            ))}
                        </g>
                    </svg>
                    {current ? (
                        <button
                            type='button'
                            className='sunburst-center'
                            style={middle_box}
                            onClick={() => zoomTo(null)}
                            aria-label={`Back to all ${names.group[1]}`}
                        >
                            {middle_lines}
                        </button>
                    ) : (
                        <div className='sunburst-center' style={middle_box}>
                            {middle_lines}
                        </div>
                    )}
                    {overlay}
                </div>
                <div className='sunburst-list' style={size ? { maxHeight: size } : undefined}>
                    <div className='sunburst-list-head'>
                        <span />
                        {header('name', capitalized((current ? names.member : names.group)[0]))}
                        {header('count', capitalized(unit[1]), 'sunburst-count')}
                        {header('share', 'Share', 'sunburst-share')}
                    </div>
                    {rows.map((row) => (
                        <button
                            key={row.key}
                            type='button'
                            className={`sunburst-row${row.lit ? ' is-lit' : ''}${row.zoomable ? ' is-zoomable' : ''}`}
                            aria-label={row.aria}
                            onClick={() => {
                                if (row.zoomable) {
                                    zoomTo(row.key);
                                }
                            }}
                            onMouseEnter={() => setLit(row.key)}
                            onMouseLeave={() => setLit(null)}
                            onFocus={() => setLit(row.key)}
                            onBlur={() => setLit(null)}
                        >
                            <span className='sunburst-swatch' style={{ background: row.color }} />
                            <span className='sunburst-name'>{row.name}</span>
                            <span className='sunburst-count'>{row.value}</span>
                            <span className='sunburst-share'>{row.share}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

Sunburst.propTypes = {
    tree: PropTypes.shape({
        groups: PropTypes.arrayOf(PropTypes.object).isRequired,
        total: PropTypes.number.isRequired,
        nested: PropTypes.bool.isRequired,
    }).isRequired,
    names: PropTypes.shape({
        group: PropTypes.arrayOf(PropTypes.string).isRequired,
        member: PropTypes.arrayOf(PropTypes.string).isRequired,
        unit: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    caption: PropTypes.string.isRequired,
    size: PropTypes.number,
    phone: PropTypes.bool,
    actions: PropTypes.node,
    overlay: PropTypes.node,
};
