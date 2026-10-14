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
 * with the know-nothing baseline as a line. The lower one draws, for the same
 * nights, how far each attempt beat or missed the live version: a bar up in the
 * site's blue where it was better, and down in its red where it was worse. The
 * two share their days, and pointing at either shows the night on both.
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
import { Legend, Mark, Numbers, TipBox, axisStyle } from './parts.jsx';
import {
    betterBy,
    chartColors,
    formatGap,
    formatScore,
    formatSignedTick,
    formatTick,
    longDay,
    scoreOf,
    shortDay,
    standing,
} from './scores.js';

//
// the two charts' heights, in px: the attempts, and the bars under them
//
const HEIGHT = 280;
const GAP_HEIGHT = 140;

//
// what the two charts are tied by: pointing at a night on one points at it on
// the other
//
const SYNC = 'model-attempts';

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
 * each night as both charts draw it: its scores on `score`, and how much better
 * than the live version the attempt was -- positive where it was better,
 * whichever way the score runs.
 */
export function attemptPoints(rows, score) {
    return rows.map((row) => ({
        day: row.day,
        kind: row.kind,
        went_live: row.went_live,
        attempt: row.attempt[score],
        live: row.live[score],
        baseline: row.baseline[score],
        gap: betterBy(row.attempt[score], row.live[score], score),
    }));
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

    const tip = ({ active, label: day }) => {
        const point = points.find((each) => each.day === day);

        if (!active || !point) {
            return null;
        }

        const stands = standing(point.gap, score);
        const tipRows = [
            {
                key: 'attempt',
                mark: <Mark kind={point.kind === 'weekly' ? 'diamond' : (point.went_live ? 'dot' : 'ring')} color={point.went_live ? colors.better : colors.worse} />,
                name: 'Attempt',
                value: formatScore(point.attempt, score),
            },
            { key: 'live', mark: <Mark kind='line' color={colors.ink} />, name: 'Live version', value: formatScore(point.live, score) },
            { key: 'baseline', mark: <Mark kind='line' color={colors.muted} />, name: 'Baseline', value: formatScore(point.baseline, score) },
        ];

        if (point.gap !== null) {
            tipRows.push({
                key: 'gap',
                mark: stands === 'level' ? null : <Mark kind='bar' color={stands === 'better' ? colors.better : colors.worse} />,
                name: stands === 'level' ? 'Level with the live version' : (stands === 'better' ? 'Better by' : 'Worse by'),
                value: stands === 'level' ? null : formatGap(point.gap, score),
            });
        }

        const result = point.went_live ? 'Went live' : 'Kept back';

        return (
            <TipBox
                title={`${longDay(point.day)} · ${point.kind === 'weekly' ? 'weekly retrain' : 'nightly update'}`}
                rows={tipRows}
                foot={score === 'loss' ? result : `${result} (decided by loss)`}
            />
        );
    };

    return (
        <section className='model-card model-attempts' aria-labelledby='model-attempts-title'>
            <div className='model-card-head'>
                <h5 id='model-attempts-title'>Each attempt against the live version</h5>
                <p className='model-card-sub'>
                    {'Every night a new version is trained, then it and the live version are scored on the same held-out days, so an easy or hard stretch moves both. Up is better'}
                    {lower ? ', so the loss axis is flipped: lower is better.' : '.'}
                </p>
                <Legend
                    items={[
                        { key: 'live', kind: 'line', color: colors.ink, label: 'Live version' },
                        { key: 'went', kind: 'dot', color: colors.better, label: 'Attempt went live' },
                        { key: 'kept', kind: 'ring', color: colors.worse, label: 'Attempt kept back' },
                        { key: 'weekly', kind: 'diamond', color: colors.muted, label: 'Weekly retrain' },
                        { key: 'baseline', kind: 'line', color: colors.muted, label: 'Know-nothing baseline' },
                    ]}
                />
            </div>
            <div
                className='model-chart'
                role='img'
                aria-label={`${label} of ${rows.length} nightly attempts and the live version. ${went} went live. The numbers are in the table below.`}
            >
                <ResponsiveContainer width='100%' height={HEIGHT}>
                    <ComposedChart data={points} syncId={SYNC} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke={colors.grid} vertical={false} />
                        <XAxis dataKey='day' tickFormatter={shortDay} minTickGap={24} {...axisStyle(colors)} />
                        <YAxis
                            width={56}
                            domain={['auto', 'auto']}
                            reversed={lower}
                            tickFormatter={(value) => formatTick(value, score)}
                            {...axisStyle(colors)}
                        />
                        <Tooltip content={tip} cursor={{ stroke: colors.muted, strokeWidth: 1 }} />
                        <Line dataKey='baseline' stroke={colors.muted} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line dataKey='live' stroke={colors.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Scatter
                            dataKey='attempt'
                            isAnimationActive={false}
                            shape={(props) => <AttemptMark {...props} colors={colors} />}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <h6 className='model-card-minor'>Better or worse than the live version</h6>
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
                    <BarChart data={points} syncId={SYNC} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
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
                        <Tooltip content={tip} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
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
        attempt: PropTypes.object.isRequired,
        live: PropTypes.object.isRequired,
        baseline: PropTypes.object.isRequired,
    })).isRequired,
    score: PropTypes.string.isRequired,
};

export default AttemptsChart;
