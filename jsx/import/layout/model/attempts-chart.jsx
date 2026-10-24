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
 * The three share their nights and one axis of them, under the last chart drawn,
 * and one panel under them all holds a night's numbers (#300): the latest until
 * the reader points at another on a wide screen, or taps one on a phone.
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
import { FoldTitle, Legend, NoBox, Numbers, axisNote, axisStyle, tickGap, useFolds, usePanelDay } from './parts.jsx';
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
 * version on `score` (#300): 'Went live: 0.003 better than the live version', or
 * a first version's, which had none to beat.
 */
export function verdictOf(point, score) {
    const went = point.went_live ? 'Went live' : 'Kept back';
    const stands = standing(point.gap, score);

    if (point.live === null) {
        return `${went}: the model’s first version`;
    }

    return stands === 'level'
        ? `${went}: level with the live version`
        : `${went}: ${formatGap(point.gap, score)} ${stands} than the live version`;
}

/**
 * a night's numbers, in one panel under the three charts (#300), where each
 * chart had a panel of its own: the night and its kind, the attempt's score on
 * `score` beside the live version's and the baseline's, what became of it after
 * the list's arrow, and how long it took.
 */
export function AttemptPanel({ point, score }) {
    const stands = point.live === null ? 'level' : standing(point.gap, score);
    const took = tookOf(point);
    const started = formatStarted(point.started);

    return (
        <div className='model-attempt-panel'>
            <span className='model-attempt-panel-title'>{`${shortDay(point.day)} · ${point.kind === 'weekly' ? 'weekly retrain' : 'nightly update'}`}</span>
            <span className='model-attempt-panel-scores'>
                {[
                    `Attempt ${formatScore(point.attempt, score)}`,
                    point.live === null ? '' : `live version ${formatScore(point.live, score)}`,
                    `baseline ${formatScore(point.baseline, score)}`,
                ].filter(Boolean).join(' · ')}
            </span>
            <span className={`model-attempt-panel-verdict model-gap-${stands}`}>
                {stands === 'level' ? null : <span className='model-gap-arrow'>{stands === 'better' ? '▲ ' : '▼ '}</span>}
                {verdictOf(point, score)}
            </span>
            <span className='model-attempt-panel-took'>
                {took === null
                    ? 'No times: they are kept from Oct 15, 2026 on'
                    : `${formatDuration(took)} in all: training ${formatDuration(point.training)}, scoring ${formatDuration(point.scoring)}${started ? `, started ${started}` : ''}`}
            </span>
        </div>
    );
}

AttemptPanel.propTypes = {
    point: PropTypes.shape({
        day: PropTypes.string.isRequired,
        kind: PropTypes.string.isRequired,
        went_live: PropTypes.bool.isRequired,
        attempt: PropTypes.number,
        live: PropTypes.number,
        baseline: PropTypes.number,
        gap: PropTypes.number,
        started: PropTypes.string,
        training: PropTypes.number,
        scoring: PropTypes.number,
    }).isRequired,
    score: PropTypes.string.isRequired,
};

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
    // the night the panel shows: on a wide screen the one pointed at on any of
    // the three, and the latest until then; on a phone the one tapped, and the
    // latest until a tap, or after a second tap on the same night -- see
    // usePanelDay
    //
    const latest = points.length ? points[points.length - 1].day : null;
    const panel = usePanelDay(latest);
    const day = panel.phone ? CHARTS.map((chart) => panel.dayFor(chart)).find(Boolean) || latest : panel.dayFor();
    const point = points.find((each) => each.day === day);

    //
    // the charts the reader has folded down to their titles, kept between
    // visits on every model's page -- see useFolds
    //
    const [folds, toggle] = useFolds('model-page');

    //
    // the charts drawn, and the one the nights' axis goes under: the last of
    // them, as the three share their nights (#300). The third is drawn only
    // where a night has times
    //
    const drawnCharts = CHARTS.filter((chart) => !folds[chart] && (chart !== 'took' || timed.length));
    const axisUnder = drawnCharts[drawnCharts.length - 1];
    const nightAxis = (chart) => (chart === axisUnder
        ? { tickFormatter: shortDay, minTickGap: tickGap(panel.phone), ...axisStyle(colors) }
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

    return (
        <section className='model-card model-attempts' aria-labelledby='model-attempts-title'>
            <div className='model-card-head'>
                <FoldTitle
                    as='h5'
                    id='model-attempts-title'
                    title={TITLE}
                    folded={Boolean(folds.attempts)}
                    onFold={() => toggle('attempts')}
                />
                {folds.attempts ? null : (
                    <>
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
                    </>
                )}
            </div>
            {folds.attempts ? null : (
                <div
                    className='model-chart'
                    role='img'
                    aria-label={`${label} of ${rows.length} nightly attempts and the live version. ${went} went live. The numbers are in the table below.`}
                >
                    <ResponsiveContainer width='100%' height={heightOf('attempts', HEIGHT)}>
                        <ComposedChart data={points} syncId={SYNC} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} {...panel.events('attempts')}>
                            <CartesianGrid stroke={colors.grid} vertical={false} />
                            <XAxis dataKey='day' {...nightAxis('attempts')} />
                            <YAxis
                                width={56}
                                domain={['auto', 'auto']}
                                reversed={lower}
                                tickFormatter={(value) => formatTick(value, score)}
                                {...axisStyle(colors)}
                            />
                            <Tooltip content={NoBox} cursor={{ stroke: colors.muted, strokeWidth: 1 }} />
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
            )}
            <FoldTitle
                className='model-card-minor'
                title='How far each attempt beat or missed the live version'
                folded={Boolean(folds.gap)}
                onFold={() => toggle('gap')}
            />
            {folds.gap ? null : (
                <>
                    {score === 'loss'
                        ? null
                        : (
                            <p className='model-card-sub'>
                                Going live is decided by loss, so on this score an attempt kept back can still show as better.
                            </p>
                        )}
                    <div
                        className='model-chart model-chart-gap'
                        role='img'
                        aria-label={`How much better or worse each attempt scored than the live version on ${label}. ${points.filter((each) => standing(each.gap, score) === 'better').length} of ${rows.length} were better.`}
                    >
                        <ResponsiveContainer width='100%' height={heightOf('gap', GAP_HEIGHT)}>
                            <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...panel.events('gap')}>
                                <CartesianGrid stroke={colors.grid} vertical={false} />
                                <XAxis dataKey='day' {...nightAxis('gap')} />
                                <YAxis
                                    width={56}
                                    domain={[-reach, reach]}
                                    ticks={[-reach, 0, reach]}
                                    interval={0}
                                    tickFormatter={gapTick}
                                    {...axisStyle(colors)}
                                />
                                <Tooltip content={NoBox} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
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
                </>
            )}
            {timed.length
                ? (
                    <>
                        <FoldTitle
                            className='model-card-minor'
                            title='How long each attempt took'
                            folded={Boolean(folds.took)}
                            onFold={() => toggle('took')}
                        />
                        {folds.took ? null : (
                            <>
                                <p className='model-card-sub'>
                                    Training, then scoring the held-out days in a lighter teal. A weekly retrain starts from scratch, so its bar stands taller.
                                </p>
                                <div
                                    className='model-chart model-chart-took'
                                    role='img'
                                    aria-label={`How long each attempt took, training and then scoring, on the ${timed.length} ${timed.length === 1 ? 'night' : 'nights'} with times. The longest took ${formatDuration(Math.max(...timed.map(tookOf)))}.`}
                                >
                                    <ResponsiveContainer width='100%' height={heightOf('took', TOOK_HEIGHT)}>
                                        <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...panel.events('took')}>
                                            <CartesianGrid stroke={colors.grid} vertical={false} />
                                            <XAxis dataKey='day' {...nightAxis('took')} />
                                            <YAxis
                                                width={56}
                                                allowDecimals={false}
                                                interval={0}
                                                tickFormatter={(value) => (value ? `${value} ${unit.label}` : '0')}
                                                {...axisStyle(colors)}
                                            />
                                            <Tooltip content={NoBox} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
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
                            </>
                        )}
                    </>
                ) : null}
            {drawnCharts.length && point ? <AttemptPanel point={point} score={score} /> : null}
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
