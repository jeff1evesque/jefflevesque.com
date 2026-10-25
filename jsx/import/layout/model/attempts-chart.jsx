/**
 * attempts-chart.jsx: each nightly attempt against the live version, on a
 * model's own page (#243).
 *
 * Every night the trainer builds a new version, and scores it and the live
 * version on the same held-out days -- the newest few, see scores.js's HELD_OUT.
 * The upper chart draws the live version's score as a line and each night's
 * attempt as a mark on it, in the site's blue (#300):
 *
 *     a filled dot      an attempt that went live
 *     a hollow dot      one kept back
 *     a diamond         a weekly retrain, filled or hollow the same way
 *
 * with the live version's line in green and the know-nothing baseline's dashed
 * in amber (#251). The second draws, for the same nights, how far each attempt
 * beat or missed the live version: a bar up in the site's blue where it was
 * better, and down in its red where it was worse, the axis saying which is which.
 *
 * The third draws how long each attempt took (#247): a bar of its training, with
 * the scoring after it stacked on top as a lighter teal. Its axis is in seconds,
 * minutes or hours, by its longest night (#251), and the line under its title
 * says which part is which, and why a weekly retrain's bar stands taller. The
 * trainer has kept these times since 2026-10-15, so an older night has no bar,
 * and the chart is left out while no night has one.
 *
 * The three share their nights and one axis of them, under the last chart drawn
 * (#300). A night's numbers are in a popup by the night pointed at on a wide
 * screen, or tapped on a phone, on the chart it is over -- see parts.jsx's
 * usePopup. A panel under the charts had held them, where a reader on a phone did
 * not know it was there. On a phone their values sit inside each chart, so it
 * has the card's whole width. The card's title folds the whole card, as each
 * section of the page folds; the two charts under the first have headings of
 * their own, and no fold.
 *
 * A stock model with holds is still judged on its 1-day hold alone (#300), so
 * its attempts are the 1-day hold's scores, and the line under the title says the
 * hold picker does not move them.
 *
 * Note: what goes live is decided by loss alone. On another score, an attempt
 *       kept back can still be better than the live version, and the chart
 *       says so under its second title rather than leaving it to look wrong.
 */

import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Scatter,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import { FoldTitle, Legend, Mark, Numbers, axisNote, axisStyle, popupOf, tickGap, useFolds, usePopup, valueAxis } from './parts.jsx';
import {
    HELD_OUT,
    PAGE_DASH,
    SCORING_OPACITY,
    betterBy,
    chartColors,
    formatDuration,
    formatGap,
    formatScore,
    formatStarted,
    formatTick,
    scoreIn,
    scoreOf,
    shortDay,
    standing,
} from './scores.js';

//
// the charts' heights, in px (#300): the attempts, the bars under them, and how
// long each attempt took -- and the room the nights' axis takes under the last
// of them drawn
//
export const HEIGHT = 200;
const GAP_HEIGHT = 90;
const TOOK_HEIGHT = 120;
const AXIS_HEIGHT = 30;

//
// the card's title. It and the first chart's height are its placeholder's as
// well, while the history is on its way (#274) -- see pending.jsx
//
export const TITLE = 'Each attempt against the live version';

//
// what the charts are tied by: pointing at a night on one points at it on the
// others
//
const SYNC = 'model-attempts';

//
// the three charts, in the order they are drawn
//
const CHARTS = ['attempts', 'gap', 'took'];

//
// the axis of how long each attempt took is in seconds until its longest night
// passes two minutes, and in hours once it passes two hours
//
const MINUTES_PAST = 2 * 60;
const HOURS_PAST = 2 * 60 * 60;

/**
 * an attempt's mark, as the chart draws it at (cx, cy): a dot, or a diamond for
 * a weekly retrain, in the better color, filled where it went live and hollow
 * where it was kept back (#300). A ring of the page's color round it keeps it
 * clear of the line it sits on. Nothing where the night has no score.
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
 * each night as the charts draw it: its scores on `score`, how much better than
 * the live version the attempt was -- positive where it was better, whichever
 * way the score runs -- and when it started, as the history wrote it. A score
 * the history has no column for is none (#279).
 *
 * Where the night has times, `training` and `scoring` split how long it took,
 * in seconds: the training, and the rest of the attempt after it. Both are null
 * where it has none, or a total shorter than its training, which no attempt
 * can take.
 */
export function attemptPoints(rows, score) {
    return rows.map((row) => {
        const training = row.training_seconds;
        const total = row.total_seconds;
        const timed = Number.isFinite(training) && Number.isFinite(total) && training >= 0 && total >= training;
        const attempt = scoreIn(row.attempt, score);
        const live = scoreIn(row.live, score);

        return {
            day: row.day,
            kind: row.kind,
            went_live: row.went_live,
            attempt: attempt,
            live: live,
            baseline: scoreIn(row.baseline, score),
            gap: betterBy(attempt, live, score),
            started: row.started || null,
            training: timed ? training : null,
            scoring: timed ? total - training : null,
        };
    });
}

//
// how long a night's attempt took in all, in seconds, or null where it has no
// times
//
function tookOf(point) {
    return point.training === null ? null : point.training + point.scoring;
}

/**
 * the unit of the axis of how long each attempt took: seconds, minutes once the
 * longest night of `points` passes two of them, or hours once it passes two
 * hours. A model whose attempts take seconds would draw bars no taller than a
 * line on an axis of whole minutes.
 */
export function durationUnit(points) {
    const longest = Math.max(0, ...points.map((point) => tookOf(point) || 0));

    if (longest > HOURS_PAST) {
        return { seconds: 60 * 60, label: 'h' };
    }

    return longest > MINUTES_PAST ? { seconds: 60, label: 'min' } : { seconds: 1, label: 's' };
}

/**
 * the mark a night's attempt is drawn with, as the legend draws it too: a dot
 * for a nightly update and a diamond for a weekly retrain, filled where it went
 * live and hollow where it was kept back.
 */
export function attemptKind(point) {
    if (point.kind === 'weekly') {
        return point.went_live ? 'diamond' : 'hollow';
    }

    return point.went_live ? 'dot' : 'ring';
}

/**
 * what the card says under its title (#300): that each night's attempt and the
 * live version are scored on the same held-out days, and for a stock model with
 * holds, `held`, that these are its 1-day hold's scores, which the hold picker
 * does not move.
 */
export function attemptsAbout(held) {
    const days = `Every night’s attempt and the live version, scored on the same ${HELD_OUT} held-out days.`;

    return held
        ? `${days} These are the 1-day hold’s scores, since the held-out days have no 5 or 20-day results yet, so the hold picker doesn’t move this card.`
        : days;
}

/**
 * what became of a night's attempt, beside how far it beat or missed the live
 * version on `score` (#300): 'Went live: 0.003 better than live version', or
 * a first version's, which had none to beat.
 */
export function verdictOf(point, score) {
    const went = point.went_live ? 'Went live' : 'Kept back';
    const stands = standing(point.gap, score);

    if (point.live === null) {
        return `${went}: the model’s first version`;
    }

    return stands === 'level'
        ? `${went}: level with live version`
        : `${went}: ${formatGap(point.gap, score)} ${stands} than live version`;
}

//
// the largest difference either way, rounded out, so the bars' axis is the same
// height above zero as below it and zero sits in the middle
//
function gapReach(points) {
    const largest = Math.max(0, ...points.map((point) => Math.abs(point.gap || 0)));

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

function AttemptsChart({ rows, score, held = false }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const lower = scoreOf(score).lower;
    const label = scoreOf(score).label;
    const points = attemptPoints(rows, score);
    const went = rows.filter((row) => row.went_live).length;
    const reach = gapReach(points);
    const timed = points.filter((point) => tookOf(point) !== null);
    const unit = durationUnit(points);
    const inUnit = (seconds) => (seconds === null ? null : seconds / unit.seconds);

    //
    // which chart shows its popup of a night's numbers, and for which night: the
    // chart pointed at on a computer, and on a phone the one tapped -- see
    // usePopup (#300)
    //
    const popup = usePopup();

    //
    // what a chart's popup says of a night (#300): the night and its kind, what
    // that chart draws of it, each after its mark, and what became of the attempt
    // -- or under the time chart, how long it took. None for a night not drawn
    //
    const tipOf = (chart, day) => {
        const point = points.find((each) => each.day === day);

        if (!point) {
            return null;
        }

        const title = `${shortDay(point.day)} · ${point.kind === 'weekly' ? 'weekly retrain' : 'nightly update'}`;

        if (chart === 'attempts') {
            return {
                title: title,
                rows: [
                    { key: 'attempt', mark: <Mark kind={attemptKind(point)} color={colors.better} />, name: 'This attempt', value: formatScore(point.attempt, score) },
                    ...(point.live === null ? [] : [
                        { key: 'live', mark: <Mark kind='line' color={colors.live} />, name: 'Live version', value: formatScore(point.live, score) },
                    ]),
                    { key: 'baseline', mark: <Mark kind='dashed' color={colors.baseline} />, name: 'Baseline', value: formatScore(point.baseline, score) },
                ],
                foot: verdictOf(point, score),
            };
        }

        if (chart === 'gap') {
            const stands = standing(point.gap, score);

            return {
                title: title,
                rows: [{
                    key: 'gap',
                    mark: point.gap === null || stands === 'level' ? null : <Mark kind='bar' color={stands === 'better' ? colors.better : colors.worse} />,
                    name: point.gap === null
                        ? 'No live version to compare with'
                        : (stands === 'level' ? 'Level with live version' : `${formatGap(point.gap, score)} ${stands} than live version`),
                    value: null,
                }],
                foot: point.went_live ? 'Went live' : 'Kept back',
            };
        }

        const took = tookOf(point);
        const started = formatStarted(point.started);

        if (took === null) {
            return { title: title, rows: [], foot: 'No times: they are kept from Oct 15, 2026 on' };
        }

        return {
            title: title,
            rows: [
                { key: 'training', mark: <Mark kind='bar' color={colors.took} />, name: 'Training', value: formatDuration(point.training) },
                { key: 'scoring', mark: <Mark kind='fade' color={colors.took} />, name: 'Scoring', value: formatDuration(point.scoring) },
            ],
            foot: `${formatDuration(took)} in all${started ? `, started ${started}` : ''}`,
        };
    };

    //
    // a chart's tooltip: its popup, and the line or band over the night it is of
    //
    const tooltipOf = (chart, cursor) => (
        <Tooltip
            content={popupOf(popup, chart, (day) => tipOf(chart, day))}
            cursor={cursor}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 10, pointerEvents: 'none' }}
            {...popup.tooltip(chart)}
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
    // the charts drawn, and the one the nights' axis goes under: the last of
    // them, as the three share their nights (#300). The third is drawn only
    // where a night has times
    //
    const drawnCharts = CHARTS.filter((chart) => chart !== 'took' || timed.length);
    const axisUnder = drawnCharts[drawnCharts.length - 1];
    const nightAxis = (chart) => (chart === axisUnder
        ? { tickFormatter: shortDay, minTickGap: tickGap(popup.phone), ...axisStyle(colors) }
        : { hide: true });
    const heightOf = (chart, height) => height + (chart === axisUnder ? AXIS_HEIGHT : 0);

    //
    // the legend's marks: each one the chart draws, in the better color, filled
    // or hollow, and a diamond for a weekly retrain either way (#300)
    //
    const drawn = (...kinds) => points.some((each) => each.attempt !== null && kinds.includes(attemptKind(each)));
    const attemptItems = [
        ...(drawn('dot', 'diamond') ? [{ key: 'went', kind: 'dot', color: colors.better, label: 'Went live' }] : []),
        ...(drawn('ring', 'hollow') ? [{ key: 'kept', kind: 'ring', color: colors.better, label: 'Kept back' }] : []),
        ...(drawn('diamond', 'hollow') ? [{ key: 'weekly', kind: 'diamond', color: colors.better, label: 'Weekly retrain' }] : []),
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
                <FoldTitle as='h5' id='model-attempts-title' title={TITLE} folded={false} onFold={() => toggle('attempts')} />
                <p className='model-card-sub'>{attemptsAbout(held)}</p>
                <Legend
                    items={[
                        ...(points.some((each) => each.live !== null)
                            ? [{ key: 'live', kind: 'line', color: colors.live, label: 'Live version' }]
                            : []),
                        { key: 'baseline', kind: 'dashed', color: colors.baseline, label: 'Baseline' },
                        ...attemptItems,
                    ]}
                    note={axisNote(score)}
                />
            </div>
            <ClickAwayListener onClickAway={popup.away('attempts')}>
                <div
                    className='model-chart'
                    role='img'
                    aria-label={`${label} of ${rows.length} nightly attempts and the live version. ${went} went live. The numbers are in the table below.`}
                >
                    <ResponsiveContainer width='100%' height={heightOf('attempts', HEIGHT)}>
                        <ComposedChart data={points} syncId={SYNC} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} {...popup.events('attempts')}>
                            <CartesianGrid stroke={colors.grid} vertical={false} />
                            <XAxis dataKey='day' {...nightAxis('attempts')} />
                            <YAxis
                                {...valueAxis(popup.phone, colors)}
                                domain={['auto', 'auto']}
                                reversed={lower}
                                tickFormatter={(value) => formatTick(value, score)}
                            />
                            {tooltipOf('attempts', { stroke: colors.muted, strokeWidth: 1 })}
                            <Line dataKey='baseline' stroke={colors.baseline} strokeWidth={2} strokeDasharray={PAGE_DASH} dot={false} isAnimationActive={false} />
                            <Line dataKey='live' stroke={colors.live} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                            <Scatter
                                dataKey='attempt'
                                isAnimationActive={false}
                                shape={(props) => <AttemptMark {...props} colors={colors} />}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </ClickAwayListener>
            <h6 className='model-card-minor'>How far each attempt beat or missed the live version</h6>
            {score === 'loss'
                ? null
                : (
                    <p className='model-card-sub'>
                        Going live is decided by loss, so on this score an attempt kept back can still show as better.
                    </p>
                )}
            <ClickAwayListener onClickAway={popup.away('gap')}>
                <div
                    className='model-chart model-chart-gap'
                    role='img'
                    aria-label={`How much better or worse each attempt scored than the live version on ${label}. ${points.filter((each) => standing(each.gap, score) === 'better').length} of ${rows.length} were better.`}
                >
                    <ResponsiveContainer width='100%' height={heightOf('gap', GAP_HEIGHT)}>
                        <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...popup.events('gap')}>
                            <CartesianGrid stroke={colors.grid} vertical={false} />
                            <XAxis dataKey='day' {...nightAxis('gap')} />
                            <YAxis
                                {...valueAxis(popup.phone, colors)}
                                domain={[-reach, reach]}
                                ticks={[-reach, 0, reach]}
                                interval={0}
                                tickFormatter={gapTick}
                            />
                            {tooltipOf('gap', { fill: colors.grid, fillOpacity: 0.4 })}
                            <ReferenceLine y={0} stroke={colors.muted} />
                            <Bar dataKey='gap' maxBarSize={24} radius={2} isAnimationActive={false}>
                                {points.map((each) => (
                                    <Cell
                                        key={each.day}
                                        className={`model-gap-bar model-gap-bar-${standing(each.gap, score)}`}
                                        fill={each.gap !== null && each.gap < 0 ? colors.worse : colors.better}
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
                        <p className='model-card-sub'>
                            Training, then scoring the held-out days in a lighter teal. A weekly retrain starts from scratch, so its bar stands taller.
                        </p>
                        <ClickAwayListener onClickAway={popup.away('took')}>
                            <div
                                className='model-chart model-chart-took'
                                role='img'
                                aria-label={`How long each attempt took, training and then scoring, on the ${timed.length} ${timed.length === 1 ? 'night' : 'nights'} with times. The longest took ${formatDuration(Math.max(...timed.map(tookOf)))}.`}
                            >
                                <ResponsiveContainer width='100%' height={heightOf('took', TOOK_HEIGHT)}>
                                    <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...popup.events('took')}>
                                        <CartesianGrid stroke={colors.grid} vertical={false} />
                                        <XAxis dataKey='day' {...nightAxis('took')} />
                                        <YAxis
                                            {...valueAxis(popup.phone, colors)}
                                            allowDecimals={false}
                                            interval={0}
                                            tickFormatter={(value) => (value ? `${value} ${unit.label}` : '0')}
                                        />
                                        {tooltipOf('took', { fill: colors.grid, fillOpacity: 0.4 })}
                                        <Bar dataKey={(each) => inUnit(each.training)} stackId='took' maxBarSize={24} isAnimationActive={false}>
                                            {points.map((each) => (
                                                <Cell
                                                    key={each.day}
                                                    className={`model-took-bar model-took-training model-took-${each.kind}`}
                                                    fill={colors.took}
                                                />
                                            ))}
                                        </Bar>
                                        <Bar
                                            dataKey={(each) => inUnit(each.scoring)}
                                            stackId='took'
                                            maxBarSize={24}
                                            radius={[2, 2, 0, 0]}
                                            isAnimationActive={false}
                                        >
                                            {points.map((each) => (
                                                <Cell
                                                    key={each.day}
                                                    className={`model-took-bar model-took-scoring model-took-${each.kind}`}
                                                    fill={colors.took}
                                                    fillOpacity={SCORING_OPACITY}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ClickAwayListener>
                    </>
                ) : null}
            <Numbers
                label={`${label}, each attempt against the live version`}
                columns={[
                    { key: 'day', label: 'Night', text: true },
                    { key: 'kind', label: 'Kind', text: true },
                    { key: 'attempt', label: 'Attempt' },
                    { key: 'live', label: 'Live version' },
                    { key: 'baseline', label: 'Baseline' },
                    { key: 'gap', label: 'Better or worse' },
                    { key: 'result', label: 'Result', text: true },
                    { key: 'took', label: 'Took' },
                ]}
                rows={points.slice().reverse().map((each) => {
                    const stands = standing(each.gap, score);

                    return {
                        key: each.day,
                        day: shortDay(each.day),
                        kind: each.kind === 'weekly' ? 'Weekly retrain' : 'Nightly update',
                        attempt: formatScore(each.attempt, score),
                        live: formatScore(each.live, score),
                        baseline: formatScore(each.baseline, score),
                        gap: each.gap === null ? '' : (stands === 'level' ? 'level' : `${stands} by ${formatGap(each.gap, score)}`),
                        result: each.went_live ? 'Went live' : 'Kept back',
                        took: formatDuration(tookOf(each)),
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
        kind: PropTypes.string.isRequired,
        went_live: PropTypes.bool.isRequired,
        started: PropTypes.string,
        training_seconds: PropTypes.number,
        total_seconds: PropTypes.number,
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
