/**
 * attempts-chart.jsx: did each night's new version beat the one in charge, on a
 * model's own page (#243, #318).
 *
 * Every night the trainer builds a new version, and tests it and the version in
 * charge on the same days -- the newest few whose results are known, which the
 * new version never studied, see scores.js's HELD_OUT -- beside the simple guess
 * from averages, the baseline. From format 6 a new version takes over if it
 * beats the simple guess, and the version in charge's score is there to compare
 * (#315). The upper chart draws the version in charge's score as a line, the
 * simple guess's dashed, and each night's new version as a mark on them, in the
 * site's blue (#300):
 *
 *     a filled dot      a new version that took over
 *     a hollow dot      one kept back
 *     a diamond         a weekly full retrain, filled or hollow the same way
 *
 * with the version in charge in green and the simple guess dashed in amber
 * (#251). The second draws how far each new version beat or missed the simple
 * guess, which decides (#318): a bar up in the site's blue where it was better,
 * and down in its red where it was worse, the axis saying which is which.
 *
 * The third draws how long each attempt took (#247): a bar of its training, the
 * scoring of its test days stacked on top as a lighter teal, and from format 6 its
 * fine-tuning on top of both, in a teal of its own (#318), named as the Live
 * version card names its check (#324). Its
 * axis is in seconds, minutes or hours, by its longest night (#251). The trainer
 * has kept these times since 2026-10-15, so an older night has no bar, and the
 * chart is left out while no night has one.
 *
 * Each night is named for the morning its test ran, with the market day it was
 * tested after under it (#318): 'Tue Oct 27' over 'after Mon Oct 26'. Named for
 * the market day, a night read as a day behind, and as if its scores were of that
 * day. The three charts share their nights and one axis of them, under the last
 * chart drawn (#300).
 *
 * One night is picked, the newest at first (#318), tinted in all three charts and
 * shown in the panel under them -- see night-panel.jsx. Pointing at a night on any
 * of the charts picks it, as does tapping it on a phone, or tabbing to the nights'
 * axis and moving along it by the arrow keys. A chart's popup still gives its
 * numbers of the night pointed at, or tapped on a phone -- see parts.jsx's
 * usePopup. The card's title folds the whole card, as each section of the page
 * folds; the two charts under the first have headings of their own, and no fold.
 *
 * A stock model with holds is still judged on its 1-day hold alone (#300), so
 * its attempts are the 1-day hold's scores, and the line under the title says the
 * hold picker does not move them.
 *
 * Note: what takes over is decided by loss alone. On another score, a new
 *       version kept back can still be better than the simple guess, and the
 *       chart says so under its second title rather than leaving it to look
 *       wrong. The panel says what came of a night on loss whatever is picked.
 */

import React, { useContext, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Scatter,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import InfoNote from '../../general/info-note.jsx';
import NightPanel, { kindWords } from './night-panel.jsx';
import { FoldTitle, Legend, Mark, Numbers, axisNote, axisStyle, popupOf, tickGap, useFolds, usePopup, valueAxis } from './parts.jsx';
import {
    HELD_OUT,
    PAGE_DASH,
    SCORING_OPACITY,
    attemptSeconds,
    betterBy,
    chartColors,
    formatDuration,
    formatGap,
    formatScore,
    formatStarted,
    formatTick,
    newestTest,
    nightName,
    scoreIn,
    scoreOf,
    standing,
    twoPasses,
} from './scores.js';

//
// the charts' heights, in px (#300): the attempts, the bars under them, and how
// long each attempt took, the first and the last as #318 draws them -- and the
// room the nights' names take under the attempts, two lines: the morning a
// night's test ran, over the market day it was tested after, and under how long
// each took, the morning alone
//
export const HEIGHT = 280;
const GAP_HEIGHT = 90;
const TOOK_HEIGHT = 160;
const AXIS_HEIGHT = 40;
const TOOK_AXIS_HEIGHT = 24;

//
// the card's title. It and the first chart's height are its placeholder's as
// well, while the history is on its way (#274) -- see pending.jsx
//
export const TITLE = 'Did each night’s new version beat the one in charge?';

//
// what the charts are tied by: pointing at a night on one points at it on the
// others
//
const SYNC = 'model-attempts';

//
// the axis of how long each attempt took is in seconds until its longest night
// passes two minutes, and in hours once it passes two hours
//
const MINUTES_PAST = 2 * 60;
const HOURS_PAST = 2 * 60 * 60;

//
// how much of the better color tints the night picked, in each chart and under
// its name on the nights' axis (#318) -- see '.model-night' in '_model.scss'
//
const PICKED_OPACITY = 0.1;

//
// bars of nothing, under the attempts' lines and marks (#318). A chart of lines
// and marks lays its nights out as points from its left edge to its right, and
// the bars' charts as bands, so its nights stood out of line with theirs, and
// its night picked had no band to tint. With a chart's bars among them, its
// nights are bands too, and its names in their middles.
//
// Note: not recharts' band scale set on its axis, under which the names are
//       drawn 2px into each band rather than in its middle
//
const NO_BARS = <Bar dataKey='none' isAnimationActive={false} legendType='none' />;

/**
 * a new version's mark, as the chart draws it at (cx, cy): a dot, or a diamond
 * for a weekly retrain, in the better color, filled where it took over and
 * hollow where it was kept back (#300). A ring of the page's color round it
 * keeps it clear of the line it sits on. Nothing where the night has no score.
 */
export function AttemptMark({ cx, cy, payload, colors }) {
    if (!payload || payload.attempt === null || !Number.isFinite(cx) || !Number.isFinite(cy)) {
        return null;
    }

    const went = payload.went_live;
    const paint = went
        ? { fill: colors.better }
        : { fill: colors.page, stroke: colors.better, strokeWidth: 2 };

    if (payload.kind === 'weekly') {
        const at = (size) => `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;

        return (
            <g className={`model-attempt model-attempt-weekly model-attempt-${went ? 'live' : 'kept'}`}>
                <polygon points={at(8.5)} fill={colors.page} />
                <polygon points={at(went ? 6.5 : 5.5)} {...paint} />
            </g>
        );
    }

    return (
        <g className={`model-attempt model-attempt-nightly model-attempt-${went ? 'live' : 'kept'}`}>
            <circle cx={cx} cy={cy} r={6.5} fill={colors.page} />
            <circle cx={cx} cy={cy} r={went ? 4.5 : 3.5} {...paint} />
        </g>
    );
}

AttemptMark.propTypes = {
    cx: PropTypes.number,
    cy: PropTypes.number,
    payload: PropTypes.object,
    colors: PropTypes.object.isRequired,
};

/**
 * each night as the charts and the panel draw it: the morning its test ran,
 * `tested`, and for a nightly update the morning the version it started from
 * took over, `from` (#318) -- see worker/model/report.js -- its new version's
 * score on `score`, the version in charge's and the simple guess's, how much
 * better than each the new version was -- positive where it was better, whichever
 * way the score runs -- and the same on loss, `lossGaps`, which decides. A score
 * the history has no column for is none (#279). `first` is a model's first
 * version, which had no version in charge.
 *
 * `test` is its test days, and `studied` how many earlier days it studied or
 * used to decide when to stop, as the history gives them (#318), and `days` its
 * lists of days by kind, where the history lists them: studied, used to decide
 * when to stop, skipped, results not in yet and not picked, each none for one
 * that doesn't -- see night-panel.jsx.
 *
 * Where the night has times, `training` and `scoring` split the first pass, in
 * seconds: the training, and the rest of the attempt after it; `again` is its
 * fine-tuning, from format 6 (#318, #324), and `took` the whole
 * attempt -- see scores.js's attemptSeconds -- with `note` saying it is two
 * passes, where it is. Each is null where the night has no times, or a total
 * shorter than its training, which no attempt can take.
 */
export function attemptPoints(rows, score) {
    return rows.map((row) => {
        const training = row.training_seconds;
        const total = row.total_seconds;
        const timed = Number.isFinite(training) && Number.isFinite(total) && training >= 0 && total >= training;
        const again = row.trained_again_seconds;
        const attempt = scoreIn(row.attempt, score);
        const live = scoreIn(row.live, score);
        const baseline = scoreIn(row.baseline, score);
        const loss = (scores) => scoreIn(scores, 'loss');
        const listed = (field) => (Array.isArray(row[field]) ? row[field] : []);

        return {
            day: row.day,
            tested: row.tested || null,
            from: row.from || null,
            kind: row.kind,
            went_live: row.went_live,
            first: loss(row.live) === null,
            attempt: attempt,
            live: live,
            baseline: baseline,
            gap: betterBy(attempt, live, score),
            baselineGap: betterBy(attempt, baseline, score),
            lossGaps: {
                guess: betterBy(loss(row.attempt), loss(row.baseline), 'loss'),
                charge: betterBy(loss(row.attempt), loss(row.live), 'loss'),
            },
            test: Array.isArray(row.held_out_days) ? row.held_out_days : [],
            studied: Number.isInteger(row.training_days) ? row.training_days : null,
            days: {
                studied: listed('studied_days'),
                stopping: listed('stopping_days'),
                skipped: listed('skipped_days'),
                pending: listed('pending_days'),
                unpicked: listed('unpicked_days'),
            },
            started: row.started || null,
            training: timed ? training : null,
            scoring: timed ? total - training : null,
            again: timed && Number.isFinite(again) && again >= 0 ? again : null,
            took: timed ? attemptSeconds(row) : null,
            note: timed ? twoPasses(row) : '',
        };
    });
}

/**
 * the unit of the axis of how long each attempt took: seconds, minutes once the
 * longest night of `points` passes two of them, or hours once it passes two
 * hours, its fine-tuning counted in (#318). A model whose attempts take seconds
 * would draw bars no taller than a line on an axis of whole minutes.
 */
export function durationUnit(points) {
    const longest = Math.max(0, ...points.map((point) => point.took || 0));

    if (longest > HOURS_PAST) {
        return { seconds: 60 * 60, label: 'h' };
    }

    return longest > MINUTES_PAST ? { seconds: 60, label: 'min' } : { seconds: 1, label: 's' };
}

/**
 * the mark a night's new version is drawn with, as the legend draws it too: a
 * dot for a nightly update and a diamond for a weekly retrain, filled where it
 * took over and hollow where it was kept back.
 */
export function attemptKind(point) {
    if (point.kind === 'weekly') {
        return point.went_live ? 'diamond' : 'hollow';
    }

    return point.went_live ? 'dot' : 'ring';
}

/**
 * what the card says under its title (#318): what each night's test is, which
 * way `score` is better, and what decides; and for a stock model with holds,
 * `held` (#300), that these are its 1-day hold's scores, which the hold picker
 * does not move.
 */
export function attemptsAbout(score, held = false) {
    const test = [
        `Every night a new version takes a test: the ${HELD_OUT} newest days whose results are known, which it never studied.`,
        'The version in charge takes the same test, so you can compare.',
        `${scoreOf(score).lower ? 'Lower' : 'Higher'} is better.`,
        'The new version takes over if it beats the simple guess.',
    ].join(' ');

    return held
        ? `${test} These are the 1-day hold’s scores, since the test days have no 5 or 20-day results yet, so the hold picker doesn’t move this card.`
        : test;
}

/**
 * what the attempts' chart's axis is, over it (#318): the score, on the test
 * days, and which way it is better and where its best numbers sit -- 'Loss on
 * the 3 test days · lower is better, so the smallest numbers are at the top'.
 */
export function axisLabel(score) {
    const note = axisNote(score);

    return `${scoreOf(score).label} on the ${HELD_OUT} test days · ${note.charAt(0).toLowerCase()}${note.slice(1, -1)}`;
}

/**
 * what the line under how long each attempt took says (#318): which part of a
 * bar is which, and why a weekly retrain stands taller -- or, where a night was
 * fine-tuned, `again`, what the part on top is (#324). Its teals in words for the
 * theme they are drawn in: the scoring at half the training's teal is lighter
 * on a light page and darker on a dark one, and the fine-tuning is the darkest
 * teal by day and the lightest by night.
 */
export function tookAbout(again, dark = false) {
    const parts = `Training, then scoring the test days in a ${dark ? 'darker' : 'lighter'} teal.`;

    return again
        ? `${parts} On a night with fine-tuning, it sits on top in ${dark ? 'light' : 'dark'} teal.`
        : `${parts} A weekly retrain starts from scratch, so its bar stands taller.`;
}

//
// the largest difference from the simple guess either way, rounded out, so the
// bars' axis is the same height above zero as below it and zero sits in the
// middle
//
function gapReach(points) {
    const largest = Math.max(0, ...points.map((point) => Math.abs(point.baselineGap || 0)));

    return largest > 0 ? largest * 1.1 : 0.01;
}

//
// the bars' axis in words, as #300 draws it: 'better' at its top and 'worse' at
// its foot, and nothing at zero
//
function gapTick(value) {
    if (value > 0) {
        return 'better';
    }

    return value < 0 ? 'worse' : '';
}

/**
 * a night's name on a chart's axis (#318), centered on its band: the morning its
 * test ran, over the market day it was tested after -- or, `short`, the morning
 * alone, as under how long each attempt took. `nights` are the charts' points
 * by day.
 */
export function NightTick({ x, y, payload, nights, colors, short = false }) {
    const night = payload ? nights[payload.value] : null;

    if (!night || !Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
    }

    return (
        <g className='model-night-tick'>
            <text x={x} y={y} dy={11} textAnchor='middle' fill={colors.ink} fontSize={12} fontWeight={600}>
                {nightName(night.tested)}
            </text>
            {short
                ? null
                : (
                    <text x={x} y={y} dy={26} textAnchor='middle' fill={colors.muted} fontSize={11}>
                        {`after ${nightName(night.day)}`}
                    </text>
                )}
        </g>
    );
}

NightTick.propTypes = {
    x: PropTypes.number,
    y: PropTypes.number,
    payload: PropTypes.object,
    nights: PropTypes.object.isRequired,
    colors: PropTypes.object.isRequired,
    short: PropTypes.bool,
};

/**
 * the nights as buttons, over their names under the attempts' chart (#318):
 * each picks its night under the pointer, at a tap or a click, and from the
 * keyboard, which reaches the night picked by Tab and moves along them by the
 * arrow keys, Home and End -- one stop on the page's way through, however many
 * nights there are. Each is as wide as its night's band in the chart over it,
 * and the one picked is tinted under its name as its band is in each chart.
 */
export function NightAxis({ points, picked, onPick }) {
    const buttons = useRef([]);
    const at = points.findIndex((point) => point.day === picked);

    const move = (event) => {
        const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: points.length - 1 }[event.key];

        if (to === undefined) {
            return;
        }

        event.preventDefault();

        const next = Math.min(Math.max(to, 0), points.length - 1);

        onPick(points[next].day);

        if (buttons.current[next]) {
            buttons.current[next].focus();
        }
    };

    return (
        <div className='model-nights' role='group' aria-label='Nights'>
            {points.map((point, index) => (
                <button
                    key={point.day}
                    ref={(button) => {
                        buttons.current[index] = button;
                    }}
                    type='button'
                    className='model-night'
                    tabIndex={index === at ? 0 : -1}
                    aria-pressed={index === at}
                    aria-label={`${nightName(point.tested)}, after ${nightName(point.day)}: ${point.went_live ? 'took over' : 'kept back'}`}
                    onClick={() => onPick(point.day)}
                    onFocus={() => onPick(point.day)}
                    onMouseEnter={() => onPick(point.day)}
                    onKeyDown={move}
                />
            ))}
        </div>
    );
}

NightAxis.propTypes = {
    points: PropTypes.arrayOf(PropTypes.shape({
        day: PropTypes.string.isRequired,
        tested: PropTypes.string,
        went_live: PropTypes.bool.isRequired,
    })).isRequired,
    picked: PropTypes.string.isRequired,
    onPick: PropTypes.func.isRequired,
};

//
// how far a new version stood from one it was tested beside, on the score on
// screen, as a popup over the bars says it: '0.046 better than the simple
// guess', or 'Level with the simple guess'
//
function gapLine(gap, score, name) {
    const stands = standing(gap, score);

    return stands === 'level' ? `Level with ${name}` : `${formatGap(gap, score)} ${stands} than ${name}`;
}

//
// a night's name in the table of numbers: the morning its test ran, over the
// market day it was tested after
//
function NightName({ point }) {
    return (
        <>
            <span className='model-night-tested'>{nightName(point.tested)}</span>
            {' '}
            <span className='model-night-after'>{`after ${nightName(point.day)}`}</span>
        </>
    );
}

NightName.propTypes = {
    point: PropTypes.shape({
        day: PropTypes.string.isRequired,
        tested: PropTypes.string,
    }).isRequired,
};

/**
 * how long a night's attempt took, as the table and the Attempts card give it
 * (#318): its whole time, and where it trained again, the note on the info icon
 * after it that says it is two passes. Nothing where it has no times.
 */
export function TookValue({ seconds, note = '' }) {
    const took = formatDuration(seconds);

    return took && note ? <InfoNote note={note} className='model-noted model-took-noted'>{took}</InfoNote> : took;
}

TookValue.propTypes = {
    seconds: PropTypes.number,
    note: PropTypes.string,
};

function AttemptsChart({ rows, score, held = false }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const { lower, label } = scoreOf(score);
    const points = attemptPoints(rows, score);
    const nights = {};
    const went = rows.filter((row) => row.went_live).length;
    const reach = gapReach(points);
    const timed = points.filter((point) => point.took !== null);
    const again = points.some((point) => point.again !== null);
    const unit = durationUnit(points);
    const inUnit = (seconds) => (seconds === null ? null : seconds / unit.seconds);
    const newest = newestTest(rows);

    points.forEach((point) => {
        nights[point.day] = point;
    });

    //
    // which chart shows its popup of a night's numbers, and for which night: the
    // chart pointed at on a computer, and on a phone the one tapped -- see
    // usePopup (#300)
    //
    const popup = usePopup();

    //
    // the night picked (#318): the newest until the reader points at, taps or
    // tabs to another, in any of the three charts, and kept as the pointer
    // leaves, so the panel under the charts stays where it is
    //
    const [chosen, setChosen] = useState(null);
    const picked = nights[chosen] || points[points.length - 1];
    const pick = (day) => {
        if (day && nights[day] && day !== picked.day) {
            setChosen(day);
        }
    };

    //
    // a chart's events: its popup's, and the night under the pointer, or the
    // one tapped on a phone, picked
    //
    const eventsOf = (chart) => {
        const shown = popup.events(chart);
        const picks = (state) => pick(state && state.activeLabel);

        if (popup.phone) {
            return {
                onClick: (state) => {
                    shown.onClick(state);
                    picks(state);
                },
            };
        }

        return {
            ...shown,
            onMouseMove: (state) => {
                shown.onMouseMove(state);
                picks(state);
            },
        };
    };

    //
    // a night's three marks, as the charts draw them, for its popup and its
    // panel's boxes
    //
    const marksOf = (point) => ({
        attempt: <Mark kind={attemptKind(point)} color={colors.better} />,
        live: <Mark kind='line' color={colors.live} />,
        baseline: <Mark kind='dashed' color={colors.baseline} />,
    });

    //
    // what a chart's popup says of a night (#300): the night and its kind, and
    // what that chart draws of it, each after its mark -- the three numbers over
    // the attempts, now the panel says the rest (#318), how far the new version
    // stood from the simple guess and the version in charge over the bars, and
    // how long it took. None for a night not drawn
    //
    const tipOf = (chart, day) => {
        const point = nights[day];

        if (!point) {
            return null;
        }

        const title = `${nightName(point.tested)} · ${kindWords(point)}`;

        if (chart === 'attempts') {
            const marks = marksOf(point);

            return {
                title: title,
                rows: [
                    { key: 'attempt', mark: marks.attempt, name: 'New version', value: formatScore(point.attempt, score) },
                    ...(point.first ? [] : [
                        { key: 'live', mark: marks.live, name: 'Version in charge', value: formatScore(point.live, score) },
                    ]),
                    { key: 'baseline', mark: marks.baseline, name: 'Simple guess', value: formatScore(point.baseline, score) },
                ],
            };
        }

        if (chart === 'gap') {
            const stands = standing(point.baselineGap, score);

            return {
                title: title,
                rows: [
                    {
                        key: 'guess',
                        mark: point.baselineGap === null || stands === 'level' ? null : <Mark kind='bar' color={stands === 'better' ? colors.better : colors.worse} />,
                        name: point.baselineGap === null ? 'No simple guess to compare with' : gapLine(point.baselineGap, score, 'the simple guess'),
                        value: null,
                    },
                    {
                        key: 'charge',
                        mark: null,
                        name: point.gap === null ? 'No version in charge to compare with' : gapLine(point.gap, score, 'the version in charge'),
                        value: null,
                    },
                ],
                foot: point.went_live ? 'Took over' : 'Kept back',
            };
        }

        const started = formatStarted(point.started);

        if (point.took === null) {
            return { title: title, rows: [], foot: 'No times: they are kept from Oct 15, 2026 on' };
        }

        return {
            title: title,
            rows: [
                { key: 'training', mark: <Mark kind='bar' color={colors.took} />, name: 'Training', value: formatDuration(point.training) },
                { key: 'scoring', mark: <Mark kind='fade' color={colors.took} />, name: 'Scoring', value: formatDuration(point.scoring) },
                ...(point.again === null ? [] : [
                    { key: 'again', mark: <Mark kind='bar' color={colors.tookAgain} />, name: 'Fine-tuning', value: formatDuration(point.again) },
                ]),
            ],
            foot: `${formatDuration(point.took)} in all${started ? `, started ${started}` : ''}`,
        };
    };

    //
    // a chart's tooltip: its popup alone. The night picked is tinted in every
    // chart, so no band or line marks the one pointed at as well (#318)
    //
    const tooltipOf = (chart) => (
        <Tooltip
            content={popupOf(popup, chart, (day) => tipOf(chart, day))}
            cursor={false}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 10, pointerEvents: 'none' }}
            {...popup.tooltip(chart)}
        />
    );

    //
    // the night picked, as a tint across its band in a chart (#318)
    //
    const pickedBand = (
        <ReferenceArea
            className='model-night-picked'
            x1={picked.day}
            x2={picked.day}
            fill={colors.better}
            fillOpacity={PICKED_OPACITY}
            stroke='none'
        />
    );

    //
    // the card folded down to its title by the reader, kept between visits on
    // every model's page -- see useFolds. Its title alone folds it, all three
    // charts at once, as each section of the page folds (#300): the charts in it
    // folding on their own put a fold in a fold
    //
    const [folds, toggle] = useFolds('model-page');

    //
    // the nights' names (#318): under the attempts, each the morning its test
    // ran over the market day it was tested after, and the nights' buttons over
    // them; none under the bars of how far each beat or missed the simple guess,
    // just under them; and under how long each took, the morning alone. Each
    // chart's nights are bands of one width, so a night sits over its name, and
    // its band is tinted where it is picked -- see NO_BARS.
    //
    // A name is measured by its longer line, so a crowded axis leaves out as
    // many as it must for the rest to stand clear of each other
    //
    const nameAxis = (short) => ({
        ...axisStyle(colors),
        height: short ? TOOK_AXIS_HEIGHT : AXIS_HEIGHT,
        minTickGap: tickGap(popup.phone),
        tick: (props) => <NightTick {...props} nights={nights} colors={colors} short={short} />,
        tickFormatter: (day) => (short ? nightName(nights[day] ? nights[day].tested : null) : `after ${nightName(day)}`),
    });

    //
    // the legend's marks: each one the chart draws, in the better color, filled
    // or hollow, and a diamond for a weekly retrain either way (#300), then the
    // version in charge and the simple guess, each named in words (#318)
    //
    const drawn = (...kinds) => points.some((each) => each.attempt !== null && kinds.includes(attemptKind(each)));
    const legendItems = [
        ...(drawn('dot', 'diamond') ? [{ key: 'went', kind: 'dot', color: colors.better, label: 'New version, took over' }] : []),
        ...(drawn('ring', 'hollow') ? [{ key: 'kept', kind: 'ring', color: colors.better, label: 'New version, kept back' }] : []),
        ...(drawn('diamond', 'hollow') ? [{ key: 'weekly', kind: 'diamond', color: colors.better, label: 'Weekly full retrain' }] : []),
        ...(points.some((each) => each.live !== null)
            ? [{ key: 'live', kind: 'line', color: colors.live, label: 'Version in charge' }]
            : []),
        { key: 'baseline', kind: 'dashed', color: colors.baseline, label: 'Simple guess from averages (the baseline)' },
    ];

    if (folds.attempts) {
        return (
            <section className='model-card model-attempts' aria-labelledby='model-attempts-title'>
                <div className='model-card-head'>
                    <FoldTitle as='h5' id='model-attempts-title' title={TITLE} folded onFold={() => toggle('attempts')} />
                </div>
            </section>
        );
    }

    return (
        <section className='model-card model-attempts' aria-labelledby='model-attempts-title'>
            <div className='model-card-head'>
                <div className='model-attempts-top'>
                    <FoldTitle as='h5' id='model-attempts-title' title={TITLE} folded={false} onFold={() => toggle('attempts')} />
                    {newest ? <p className='model-attempts-newest'>{`Newest test: ${newest}`}</p> : null}
                </div>
                <p className='model-card-sub'>{attemptsAbout(score, held)}</p>
                <Legend items={legendItems} />
            </div>
            <p className='model-axis-label'>{axisLabel(score)}</p>
            <div className='model-chart-frame'>
                <ClickAwayListener onClickAway={popup.away('attempts')}>
                    <div
                        className='model-chart'
                        role='img'
                        aria-label={`${label} of each night’s new version, the version in charge and the simple guess, on ${rows.length} ${rows.length === 1 ? 'night' : 'nights'}. ${went} took over. The numbers are in the table below.`}
                    >
                        <ResponsiveContainer width='100%' height={HEIGHT + AXIS_HEIGHT}>
                            <ComposedChart data={points} syncId={SYNC} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} {...eventsOf('attempts')}>
                                <CartesianGrid stroke={colors.grid} vertical={false} />
                                <XAxis dataKey='day' {...nameAxis(false)} />
                                <YAxis
                                    {...valueAxis(popup.phone, colors)}
                                    domain={['auto', 'auto']}
                                    reversed={lower}
                                    tickFormatter={(value) => formatTick(value, score)}
                                />
                                {NO_BARS}
                                {pickedBand}
                                {tooltipOf('attempts')}
                                <Line
                                    dataKey='baseline'
                                    stroke={colors.baseline}
                                    strokeWidth={2}
                                    strokeDasharray={PAGE_DASH}
                                    dot={{ r: 3, fill: colors.page, stroke: colors.baseline, strokeWidth: 1.5, strokeDasharray: 'none' }}
                                    isAnimationActive={false}
                                />
                                <Line
                                    dataKey='live'
                                    stroke={colors.live}
                                    strokeWidth={2.5}
                                    dot={{ r: 3, fill: colors.live, stroke: 'none' }}
                                    isAnimationActive={false}
                                />
                                <Scatter
                                    dataKey='attempt'
                                    isAnimationActive={false}
                                    shape={(props) => <AttemptMark {...props} colors={colors} />}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </ClickAwayListener>
                <NightAxis points={points} picked={picked.day} onPick={pick} />
            </div>
            <h6 className='model-card-minor'>How far each new version beat or missed the simple guess</h6>
            {score === 'loss'
                ? null
                : (
                    <p className='model-card-sub'>
                        Taking over is decided by loss, so on this score a new version kept back can still show as better.
                    </p>
                )}
            <ClickAwayListener onClickAway={popup.away('gap')}>
                <div
                    className='model-chart model-chart-gap'
                    role='img'
                    aria-label={`How much better or worse each new version scored than the simple guess on ${label}. ${points.filter((each) => standing(each.baselineGap, score) === 'better').length} of ${rows.length} were better.`}
                >
                    <ResponsiveContainer width='100%' height={GAP_HEIGHT}>
                        <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...eventsOf('gap')}>
                            <CartesianGrid stroke={colors.grid} vertical={false} />
                            <XAxis dataKey='day' hide />
                            <YAxis
                                {...valueAxis(popup.phone, colors)}
                                domain={[-reach, reach]}
                                ticks={[-reach, 0, reach]}
                                interval={0}
                                tickFormatter={gapTick}
                            />
                            {pickedBand}
                            {tooltipOf('gap')}
                            <ReferenceLine y={0} stroke={colors.muted} />
                            <Bar dataKey='baselineGap' maxBarSize={24} radius={2} isAnimationActive={false}>
                                {points.map((each) => (
                                    <Cell
                                        key={each.day}
                                        className={`model-gap-bar model-gap-bar-${standing(each.baselineGap, score)}`}
                                        fill={each.baselineGap !== null && each.baselineGap < 0 ? colors.worse : colors.better}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ClickAwayListener>
            {timed.length
                ? (
                    <>
                        <h6 className='model-card-minor'>How long each attempt took</h6>
                        <p className='model-card-sub'>{tookAbout(again, theme === 'dark')}</p>
                        <Legend
                            label='Legend, how long each attempt took'
                            items={[
                                { key: 'training', kind: 'bar', color: colors.took, label: 'Training' },
                                { key: 'scoring', kind: 'fade', color: colors.took, label: 'Scoring the test days' },
                                ...(again ? [{ key: 'again', kind: 'bar', color: colors.tookAgain, label: 'Fine-tuning' }] : []),
                            ]}
                        />
                        <ClickAwayListener onClickAway={popup.away('took')}>
                            <div
                                className='model-chart model-chart-took'
                                role='img'
                                aria-label={[
                                    `How long each attempt took, training and then scoring${again ? ', and then fine-tuning where a night had it' : ''},`,
                                    `on the ${timed.length} ${timed.length === 1 ? 'night' : 'nights'} with times.`,
                                    `The longest took ${formatDuration(Math.max(...timed.map((point) => point.took)))}.`,
                                ].join(' ')}
                            >
                                <ResponsiveContainer width='100%' height={TOOK_HEIGHT + TOOK_AXIS_HEIGHT}>
                                    <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...eventsOf('took')}>
                                        <CartesianGrid stroke={colors.grid} vertical={false} />
                                        <XAxis dataKey='day' {...nameAxis(true)} />
                                        <YAxis
                                            {...valueAxis(popup.phone, colors)}
                                            allowDecimals={false}
                                            interval={0}
                                            tickFormatter={(value) => (value ? `${value} ${unit.label}` : '0')}
                                        />
                                        {pickedBand}
                                        {tooltipOf('took')}
                                        <Bar dataKey={(each) => inUnit(each.training)} stackId='took' maxBarSize={24} isAnimationActive={false}>
                                            {points.map((each) => (
                                                <Cell
                                                    key={each.day}
                                                    className={`model-took-bar model-took-training model-took-${each.kind}`}
                                                    fill={colors.took}
                                                />
                                            ))}
                                        </Bar>
                                        <Bar dataKey={(each) => inUnit(each.scoring)} stackId='took' maxBarSize={24} isAnimationActive={false}>
                                            {points.map((each) => (
                                                <Cell
                                                    key={each.day}
                                                    className={`model-took-bar model-took-scoring model-took-${each.kind}`}
                                                    fill={colors.took}
                                                    fillOpacity={SCORING_OPACITY}
                                                    radius={each.again === null ? [2, 2, 0, 0] : 0}
                                                />
                                            ))}
                                        </Bar>
                                        {again
                                            ? (
                                                <Bar dataKey={(each) => inUnit(each.again)} stackId='took' maxBarSize={24} isAnimationActive={false}>
                                                    {points.map((each) => (
                                                        <Cell
                                                            key={each.day}
                                                            className={`model-took-bar model-took-again model-took-${each.kind}`}
                                                            fill={colors.tookAgain}
                                                            radius={[2, 2, 0, 0]}
                                                        />
                                                    ))}
                                                </Bar>
                                            ) : null}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ClickAwayListener>
                    </>
                ) : null}
            <p className='model-attempts-hint'>
                {popup.phone
                    ? 'Tap a night in any of the charts to see which days it used and how long it took.'
                    : 'Point at a night in any of the charts, or tab to it, to see which days it used and how long it took.'}
            </p>
            <NightPanel point={picked} score={score} marks={marksOf(picked)} />
            <Numbers
                label={`${label}, each night’s test`}
                columns={[
                    { key: 'night', label: 'Night', text: true },
                    { key: 'kind', label: 'Kind', text: true },
                    { key: 'attempt', label: 'New version' },
                    { key: 'live', label: 'Version in charge' },
                    { key: 'baseline', label: 'Simple guess' },
                    { key: 'gap', label: 'Against the simple guess' },
                    { key: 'result', label: 'Result', text: true },
                    { key: 'took', label: 'Took' },
                ]}
                rows={points.slice().reverse().map((each) => {
                    const stands = standing(each.baselineGap, score);
                    const kind = kindWords(each);

                    return {
                        key: each.day,
                        night: <NightName point={each} />,
                        kind: `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`,
                        attempt: formatScore(each.attempt, score),
                        live: formatScore(each.live, score),
                        baseline: formatScore(each.baseline, score),
                        gap: each.baselineGap === null ? '' : (stands === 'level' ? 'level' : `${stands} by ${formatGap(each.baselineGap, score)}`),
                        result: each.went_live ? 'Took over' : 'Kept back',
                        took: <TookValue seconds={each.took} note={each.note} />,
                    };
                })}
            />
        </section>
    );
}

AttemptsChart.propTypes = {
    //
    // the model's history, oldest first: one row per nightly attempt -- see
    // worker/model/report.js
    //
    rows: PropTypes.arrayOf(PropTypes.shape({
        day: PropTypes.string.isRequired,
        tested: PropTypes.string,
        from: PropTypes.string,
        kind: PropTypes.string.isRequired,
        went_live: PropTypes.bool.isRequired,
        trained_again: PropTypes.bool,
        held_out_days: PropTypes.arrayOf(PropTypes.string),
        training_days: PropTypes.number,
        studied_days: PropTypes.arrayOf(PropTypes.string),
        stopping_days: PropTypes.arrayOf(PropTypes.string),
        skipped_days: PropTypes.arrayOf(PropTypes.string),
        pending_days: PropTypes.arrayOf(PropTypes.string),
        unpicked_days: PropTypes.arrayOf(PropTypes.string),
        started: PropTypes.string,
        training_seconds: PropTypes.number,
        total_seconds: PropTypes.number,
        trained_again_seconds: PropTypes.number,
        attempt: PropTypes.object.isRequired,
        live: PropTypes.object.isRequired,
        baseline: PropTypes.object.isRequired,
    })).isRequired,
    score: PropTypes.string.isRequired,
    //
    // whether the model is a stock model with holds, whose attempts are its
    // 1-day hold's (#300)
    //
    held: PropTypes.bool,
};

export default AttemptsChart;
