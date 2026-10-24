/**
 * attempts-chart.jsx: each nightly attempt against the live version, on a
 * model's own page (#243).
 *
 * Every night the trainer builds a new version, and scores it and the live
 * version on the same held-out days. The upper chart draws the live version's
 * score as a line and each night's attempt as a mark on it:
 *
 *     a filled dot      an attempt that went live
 *     a hollow dot      one kept back
 *     a diamond         a weekly retrain, filled or hollow the same way
 *
 * with the live version's line in green and the know-nothing baseline's dashed
 * in amber (#251). The second draws, for the same nights, how far each attempt
 * beat or missed the live version: a bar up in the site's blue where it was
 * better, and down in its red where it was worse.
 *
 * The third draws how long each attempt took (#247): a bar of its training, with
 * the scoring after it stacked on top as a lighter teal. Its axis is in seconds,
 * minutes or hours, by its longest night (#251), and the line under its title
 * says why a weekly retrain's bar stands taller. The trainer has kept these
 * times since 2026-10-15, so an older night has no bar, and the chart is left
 * out while no night has one.
 *
 * A night's numbers are in a panel under each chart rather than a box over it
 * (#251): on a wide screen a slim line across the chart, on the latest night
 * until the reader points at another, and on a phone a panel of rows that opens
 * for the night tapped. The charts share their nights, so pointing at any of
 * them marks the night on all three, and moves all three panels to it.
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
import { FoldTitle, Legend, Mark, NoBox, Numbers, Readout, axisStyle, tickGap, useFolds, usePanelDay } from './parts.jsx';
import {
    BASELINE_DASH,
    SCORING_OPACITY,
    betterBy,
    chartColors,
    formatDuration,
    formatGap,
    formatScore,
    formatSignedTick,
    formatStarted,
    formatTick,
    longDay,
    scoreIn,
    scoreOf,
    shortDay,
    standing,
} from './scores.js';

//
// the charts' heights, in px: the attempts, the bars under them, and how long
// each attempt took
//
export const HEIGHT = 280;
const GAP_HEIGHT = 140;
const TOOK_HEIGHT = 140;

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
// the axis of how long each attempt took is in seconds until its longest night
// passes two minutes, and in hours once it passes two hours
//
const MINUTES_PAST = 2 * 60;
const HOURS_PAST = 2 * 60 * 60;

/**
 * an attempt's mark, as the chart draws it at (cx, cy): a dot, or a diamond for
 * a weekly retrain, filled in the better color where it went live and hollow in
 * the worse one where it was kept back. A ring of the page's color round it
 * keeps it clear of the line it sits on. Nothing where the night has no score.
 */
export function AttemptMark({ cx, cy, payload, colors }) {
    if (!payload || payload.attempt === null || !Number.isFinite(cx) || !Number.isFinite(cy)) {
        return null;
    }

    const went = payload.went_live;
    const paint = went
        ? { fill: colors.better }
        : { fill: colors.page, stroke: colors.worse, strokeWidth: 2 };

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
 * what became of a night's attempt, in words: whether it went live, and why --
 * by loss, whichever score is on screen.
 */
export function outcome(point) {
    if (point.went_live) {
        return point.live === null
            ? 'Went live: the model’s first version'
            : 'Went live: its loss was no higher than the live version’s';
    }

    return 'Kept back: its loss was higher than the live version’s';
}

/**
 * the mark a night's attempt is drawn with, as the legend and a panel draw it
 * too: a dot for a nightly update and a diamond for a weekly retrain, filled
 * where it went live and hollow where it was kept back.
 */
export function attemptKind(point) {
    if (point.kind === 'weekly') {
        return point.went_live ? 'diamond' : 'hollow';
    }

    return point.went_live ? 'dot' : 'ring';
}

//
// the largest difference either way, rounded out, so the bars' axis is the same
// height above zero as below it and zero sits in the middle
//
function gapReach(points) {
    const largest = Math.max(0, ...points.map((point) => Math.abs(point.gap || 0)));

    return largest > 0 ? largest * 1.1 : 0.01;
}

function AttemptsChart({ rows, score }) {
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
    // the night each chart's panel shows: one night for all three on a wide
    // screen, the latest until the reader points at another, and on a phone the
    // night tapped on one of them -- see usePanelDay
    //
    const panel = usePanelDay(points.length ? points[points.length - 1].day : null);

    //
    // the charts the reader has folded down to their titles, kept between
    // visits on every model's page -- see useFolds
    //
    const [folds, toggle] = useFolds('model-page');

    //
    // what a chart's panel says of a night: the night, what that chart draws of
    // it, in words, and what became of the attempt
    //
    const tipOf = (chart, day) => {
        const point = points.find((each) => each.day === day);

        if (!point) {
            return null;
        }

        const title = `${longDay(point.day)} · ${point.kind === 'weekly' ? 'weekly retrain' : 'nightly update'}`;
        let tipRows;
        let foot = outcome(point);

        if (chart === 'attempts') {
            tipRows = [
                {
                    key: 'attempt',
                    mark: <Mark kind={attemptKind(point)} color={point.went_live ? colors.better : colors.worse} />,
                    name: 'This attempt',
                    value: formatScore(point.attempt, score),
                },
                ...(point.live === null ? [] : [
                    { key: 'live', mark: <Mark kind='line' color={colors.live} />, name: 'Live version', value: formatScore(point.live, score) },
                ]),
                { key: 'baseline', mark: <Mark kind='dashed' color={colors.baseline} />, name: 'Know-nothing baseline', value: formatScore(point.baseline, score) },
            ];
        } else if (chart === 'gap') {
            const stands = standing(point.gap, score);

            tipRows = [{
                key: 'gap',
                mark: point.gap === null || stands === 'level' ? null : <Mark kind='bar' color={stands === 'better' ? colors.better : colors.worse} />,
                name: point.gap === null
                    ? 'No live version to compare with'
                    : (stands === 'level' ? 'Level with the live version' : `${formatGap(point.gap, score)} ${stands} than the live version`),
                value: null,
            }];
        } else if (tookOf(point) === null) {
            tipRows = [];
            foot = 'No times: they are kept from Oct 15, 2026 on';
        } else {
            const started = formatStarted(point.started);

            tipRows = [
                { key: 'training', mark: <Mark kind='bar' color={colors.took} />, name: 'Training', value: formatDuration(point.training) },
                { key: 'scoring', mark: <Mark kind='fade' color={colors.took} />, name: 'Scoring', value: formatDuration(point.scoring) },
            ];
            foot = `${formatDuration(tookOf(point))} in all${started ? `, started ${started}` : ''}`;
        }

        return { title: title, rows: tipRows, foot: foot };
    };

    const readout = (chart) => <Readout tip={tipOf(chart, panel.dayFor(chart))} line={!panel.phone} />;

    //
    // the legend's marks: each one the chart draws, as it draws it, and only
    // those it draws
    //
    const drawn = (kind) => points.some((point) => point.attempt !== null && attemptKind(point) === kind);
    const attemptItems = [
        { key: 'went', kind: 'dot', color: colors.better, label: 'Attempt went live' },
        { key: 'kept', kind: 'ring', color: colors.worse, label: 'Attempt kept back' },
        { key: 'weekly-went', kind: 'diamond', color: colors.better, label: 'Weekly retrain, went live' },
        { key: 'weekly-kept', kind: 'hollow', color: colors.worse, label: 'Weekly retrain, kept back' },
    ].filter((item) => drawn(item.kind));

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
                        <p className='model-card-sub'>
                            {'Every night a new version is trained, then it and the live version are scored on the same held-out days, so an easy or hard stretch moves both. Up is better'}
                            {lower ? ', so the loss axis is flipped: lower is better.' : '.'}
                        </p>
                        <Legend
                            items={[
                                ...(points.some((point) => point.live !== null)
                                    ? [{ key: 'live', kind: 'line', color: colors.live, label: 'Live version' }]
                                    : []),
                                { key: 'baseline', kind: 'dashed', color: colors.baseline, label: 'Know-nothing baseline' },
                                ...attemptItems,
                            ]}
                        />
                    </>
                )}
            </div>
            {folds.attempts ? null : (
                <>
                    <div
                        className='model-chart'
                        role='img'
                        aria-label={`${label} of ${rows.length} nightly attempts and the live version. ${went} went live. The numbers are in the table below.`}
                    >
                        <ResponsiveContainer width='100%' height={HEIGHT}>
                            <ComposedChart data={points} syncId={SYNC} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} {...panel.events('attempts')}>
                                <CartesianGrid stroke={colors.grid} vertical={false} />
                                <XAxis dataKey='day' tickFormatter={shortDay} minTickGap={tickGap(panel.phone)} {...axisStyle(colors)} />
                                <YAxis
                                    width={56}
                                    domain={['auto', 'auto']}
                                    reversed={lower}
                                    tickFormatter={(value) => formatTick(value, score)}
                                    {...axisStyle(colors)}
                                />
                                <Tooltip content={NoBox} cursor={{ stroke: colors.muted, strokeWidth: 1 }} />
                                <Line dataKey='baseline' stroke={colors.baseline} strokeWidth={2} strokeDasharray={BASELINE_DASH} dot={false} isAnimationActive={false} />
                                <Line dataKey='live' stroke={colors.live} strokeWidth={2} dot={false} isAnimationActive={false} />
                                <Scatter
                                    dataKey='attempt'
                                    isAnimationActive={false}
                                    shape={(props) => <AttemptMark {...props} colors={colors} />}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    {readout('attempts')}
                </>
            )}
            <FoldTitle
                className='model-card-minor'
                title='Better or worse than the live version'
                folded={Boolean(folds.gap)}
                onFold={() => toggle('gap')}
            />
            {folds.gap ? null : (
                <>
                    <Legend
                        label='Legend, better or worse'
                        items={[
                            { key: 'better', kind: 'bar', color: colors.better, label: 'Better on this score' },
                            { key: 'worse', kind: 'bar', color: colors.worse, label: 'Worse on this score' },
                        ]}
                    />
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
                        aria-label={`How much better or worse each attempt scored than the live version on ${label}. ${points.filter((point) => standing(point.gap, score) === 'better').length} of ${rows.length} were better.`}
                    >
                        <ResponsiveContainer width='100%' height={GAP_HEIGHT}>
                            <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...panel.events('gap')}>
                                <CartesianGrid stroke={colors.grid} vertical={false} />
                                <XAxis dataKey='day' hide />
                                <YAxis
                                    width={56}
                                    domain={[-reach, reach]}
                                    ticks={[-reach, 0, reach]}
                                    interval={0}
                                    tickFormatter={(value) => formatSignedTick(value, score)}
                                    {...axisStyle(colors)}
                                />
                                <Tooltip content={NoBox} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
                                <ReferenceLine y={0} stroke={colors.muted} />
                                <Bar dataKey='gap' maxBarSize={24} radius={2} isAnimationActive={false}>
                                    {points.map((point) => (
                                        <Cell
                                            key={point.day}
                                            className={`model-gap-bar model-gap-bar-${standing(point.gap, score)}`}
                                            fill={point.gap !== null && point.gap < 0 ? colors.worse : colors.better}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {readout('gap')}
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
                                <p className='model-card-sub'>A weekly retrain starts from scratch, so it takes longer than a nightly update. Times are kept from 2026-10-15 on.</p>
                                <Legend
                                    label='Legend, how long each attempt took'
                                    items={[
                                        { key: 'training', kind: 'bar', color: colors.took, label: 'Training' },
                                        { key: 'scoring', kind: 'fade', color: colors.took, label: 'Scoring, the lighter top' },
                                    ]}
                                />
                                <div
                                    className='model-chart model-chart-took'
                                    role='img'
                                    aria-label={`How long each attempt took, training and then scoring, on the ${timed.length} ${timed.length === 1 ? 'night' : 'nights'} with times. The longest took ${formatDuration(Math.max(...timed.map(tookOf)))}.`}
                                >
                                    <ResponsiveContainer width='100%' height={TOOK_HEIGHT}>
                                        <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} {...panel.events('took')}>
                                            <CartesianGrid stroke={colors.grid} vertical={false} />
                                            <XAxis dataKey='day' hide />
                                            <YAxis
                                                width={56}
                                                allowDecimals={false}
                                                interval={0}
                                                tickFormatter={(value) => (value ? `${value} ${unit.label}` : '0')}
                                                {...axisStyle(colors)}
                                            />
                                            <Tooltip content={NoBox} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
                                            <Bar dataKey={(point) => inUnit(point.training)} stackId='took' maxBarSize={24} isAnimationActive={false}>
                                                {points.map((point) => (
                                                    <Cell
                                                        key={point.day}
                                                        className={`model-took-bar model-took-training model-took-${point.kind}`}
                                                        fill={colors.took}
                                                    />
                                                ))}
                                            </Bar>
                                            <Bar
                                                dataKey={(point) => inUnit(point.scoring)}
                                                stackId='took'
                                                maxBarSize={24}
                                                radius={[2, 2, 0, 0]}
                                                isAnimationActive={false}
                                            >
                                                {points.map((point) => (
                                                    <Cell
                                                        key={point.day}
                                                        className={`model-took-bar model-took-scoring model-took-${point.kind}`}
                                                        fill={colors.took}
                                                        fillOpacity={SCORING_OPACITY}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {readout('took')}
                            </>
                        )}
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
                rows={points.slice().reverse().map((point) => {
                    const stands = standing(point.gap, score);

                    return {
                        key: point.day,
                        day: shortDay(point.day),
                        kind: point.kind === 'weekly' ? 'Weekly retrain' : 'Nightly update',
                        attempt: formatScore(point.attempt, score),
                        live: formatScore(point.live, score),
                        baseline: formatScore(point.baseline, score),
                        gap: point.gap === null ? '' : (stands === 'level' ? 'level' : `${stands} by ${formatGap(point.gap, score)}`),
                        result: point.went_live ? 'Went live' : 'Kept back',
                        took: formatDuration(tookOf(point)),
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
};

export default AttemptsChart;
