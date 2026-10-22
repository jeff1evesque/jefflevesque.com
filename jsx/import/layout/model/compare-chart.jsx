/**
 * compare-chart.jsx: two or three models of one task, compared over /model's
 * lists (#243): their 20-day track records on one chart, each beside its own
 * know-nothing baseline, dashed in its color (#263).
 *
 * Models of different tasks are compared on a score of what each one's picks
 * would have made, which both tasks name (#279): the top 10's gain, or how many
 * of them won. The chart then has a picker of its own, of those scores alone,
 * where with one task it follows that task's, and the line under its title says
 * the trades are not alike. An options model is drawn on its 1-day hold's, as
 * the listing scores it.
 *
 * Each model is drawn in the color it was given when it was ticked, which it
 * keeps for as long as it stays ticked -- see ModelLayout.pick -- so unticking
 * one does not repaint the others. The legend names each in the page's own text
 * beside a swatch of its line.
 *
 * Note: a baseline for each model, from its own record's 20-day averages. Each
 *       record carries the baseline's scores on its own model's days, and they
 *       differ -- on 2026-10-15 the baseline's loss was 1.733 in tables-gnn's and
 *       1.702 in pt-gnn's -- and the trainer judges each model against its own.
 *       One line for them all could draw a model ahead of the baseline on the day
 *       it was taken down for being behind its own.
 *
 * Note: the days are every day any of them was scored on. A day one of them was
 *       not running is a gap in its line, and the tooltip says why: it had not
 *       started, it had retired, or it has no score for the day.
 */

import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import { Legend, Mark, NoBox, Numbers, Readout, ScorePicker, axisStyle, usePanelDay } from './parts.jsx';
import {
    BASELINE_DASH,
    COMPARE_COLORS,
    WINDOW,
    alignDays,
    chartColors,
    formatScore,
    formatTick,
    longDay,
    scoreIn,
    scoreOf,
    sharedScores,
    shortDay,
    tradesOptions,
} from './scores.js';

//
// how long the trades compared last, where a task of stocks is compared with
// one of options (#279): a stock's top 10 is bought and sold the same day
//
const LENGTHS = 'These trades last different lengths: the stocks are held from 9:40 to 3:40 the same day, the options’ 1-day hold until 3:40 the next day. Options also swing far more than stocks.';

//
// the chart's height, in px, at every width: a phone's chart is as tall as a
// wide screen's, and narrower
//
const HEIGHT = 300;

//
// why a model has no point on a day: before it started, after it retired, or a
// day it was running and has no score for
//
function absence(model, day) {
    if (model.started && day < model.started) {
        return 'not started yet';
    }

    if (model.retired && day > model.retired) {
        return 'retired';
    }

    return 'no score this day';
}

//
// a list of names as a sentence says it: 'a and b', 'a, b and c'
//
function together(names) {
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
}

//
// what a model's baseline is called in the legend, the panel and the table
//
function baselineOf(name) {
    return `${name}’s baseline`;
}

function CompareChart({ picks, records, score, task, tasks = [task], onScore = null, onClear }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);
    const names = picks.map((pick) => pick.model.name);
    const lower = scoreOf(score).lower;
    const waiting = picks.filter((pick) => records[pick.model.name] === undefined);
    const missing = picks.filter((pick) => records[pick.model.name] === null);

    //
    // models of more than one task (#279): what each predicts, the scores the
    // chart can be picked on, and how long each one's trades last, where a task
    // of stocks meets one of options
    //
    const across = tasks.length > 1;
    const lengths = across && tasks.some(tradesOptions) && !tasks.every(tradesOptions);

    const held = {};

    names.forEach((name) => {
        held[name] = records[name] || [];
    });

    const aligned = alignDays(held);
    const data = aligned.map((entry) => {
        const point = { day: entry.day };

        picks.forEach((pick) => {
            const row = entry[pick.model.name];

            point[`slot${pick.slot}`] = row ? scoreIn(row.average, score) : null;
            point[`base${pick.slot}`] = row ? scoreIn(row.baseline_average, score) : null;
        });

        return point;
    });

    //
    // the day its panel shows, as the model page's panels do: the day pointed
    // at, the latest until then, or on a phone the day tapped -- see
    // usePanelDay
    //
    const panel = usePanelDay(aligned.length ? aligned[aligned.length - 1].day : null);

    const tipOf = (label) => {
        const entry = aligned.find((each) => each.day === label);

        if (!entry) {
            return null;
        }

        //
        // a model whose record has no column for the score, as a stock model's
        // written before the top 10's had, comes after the rest (#279)
        //
        const scored = picks
            .filter((pick) => entry[pick.model.name])
            .sort((a, b) => {
                const x = scoreIn(entry[a.model.name].average, score);
                const y = scoreIn(entry[b.model.name].average, score);

                if (x === null || y === null) {
                    return (x === null) - (y === null);
                }

                return lower ? x - y : y - x;
            });

        //
        // the models best first, then each one's own baseline, in the same order
        //
        const rows = scored.map((pick) => {
            const row = entry[pick.model.name];

            return {
                key: pick.model.name,
                mark: <Mark kind='line' color={COMPARE_COLORS[pick.slot]} />,
                name: row.days < WINDOW ? `${pick.model.name} (${row.days} days)` : pick.model.name,
                value: formatScore(scoreIn(row.average, score), score),
            };
        }).concat(scored
            .filter((pick) => scoreIn(entry[pick.model.name].baseline_average, score) !== null)
            .map((pick) => ({
                key: `base-${pick.model.name}`,
                mark: <Mark kind='dashed' color={COMPARE_COLORS[pick.slot]} />,
                name: baselineOf(pick.model.name),
                value: formatScore(scoreIn(entry[pick.model.name].baseline_average, score), score),
            })));

        const absent = picks
            .filter((pick) => !entry[pick.model.name])
            .map((pick) => `${pick.model.name}: ${absence(pick.model, entry.day)}`);

        return { title: longDay(entry.day), rows: rows, foot: absent.length ? absent.join(' · ') : null };
    };

    //
    // a value as a cell of the table holds it: blank on a day it has none
    //
    const cell = (value) => (value === null ? '' : formatScore(value, score));

    return (
        <section className='model-card model-compare' aria-label='Comparison'>
            <div className='model-card-head'>
                <div className='model-card-title'>
                    <h5>{`Comparing ${together(names)}`}</h5>
                    <button type='button' className='model-clear' onClick={onClear}>Clear</button>
                </div>
                {across && onScore
                    ? (
                        <div className='model-controls model-compare-controls'>
                            <ScorePicker score={score} onScore={onScore} offered={sharedScores(tasks)} />
                        </div>
                    ) : null}
                <p className='model-card-sub'>
                    {`${together(tasks.map((each) => each.name))}, scored on the same days. `}
                    {lengths ? `${LENGTHS} ` : ''}
                    {'Lines are averages of the last 20 days, and each model’s own know-nothing baseline is dashed in its color. Up is better'}
                    {lower ? ', so the loss axis is flipped: lower is better.' : '.'}
                </p>
                <Legend
                    items={[
                        ...picks.map((pick) => ({
                            key: pick.model.name,
                            kind: 'line',
                            color: COMPARE_COLORS[pick.slot],
                            label: <span className='model-legend-name'>{pick.model.name}</span>,
                        })),
                        ...picks.map((pick) => ({
                            key: `base-${pick.model.name}`,
                            kind: 'dashed',
                            color: COMPARE_COLORS[pick.slot],
                            label: baselineOf(pick.model.name),
                        })),
                    ]}
                />
            </div>
            {missing.length
                ? (
                    <p className='model-note'>
                        {`The track record of ${together(missing.map((pick) => pick.model.name))} could not be loaded.`}
                    </p>
                ) : null}
            {waiting.length
                ? <p className='model-status'>Loading the track records&hellip;</p>
                : (
                    <div className='model-chart' role='img' aria-label={`${scoreOf(score).label}, 20-day averages of ${together(names)}, each beside its own know-nothing baseline. The numbers are in the table below.`}>
                        <ResponsiveContainer width='100%' height={HEIGHT}>
                            <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} {...panel.events()}>
                                <CartesianGrid stroke={colors.grid} vertical={false} />
                                <XAxis
                                    dataKey='day'
                                    tickFormatter={shortDay}
                                    minTickGap={24}
                                    {...axisStyle(colors)}
                                />
                                <YAxis
                                    width={56}
                                    domain={['auto', 'auto']}
                                    reversed={lower}
                                    tickFormatter={(value) => formatTick(value, score)}
                                    {...axisStyle(colors)}
                                />
                                <Tooltip content={NoBox} cursor={{ stroke: colors.muted, strokeWidth: 1 }} />
                                {picks.map((pick) => (
                                    <Line
                                        key={`base-${pick.model.name}`}
                                        dataKey={`base${pick.slot}`}
                                        name={baselineOf(pick.model.name)}
                                        stroke={COMPARE_COLORS[pick.slot]}
                                        strokeWidth={1.5}
                                        strokeDasharray={BASELINE_DASH}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                ))}
                                {picks.map((pick) => (
                                    <Line
                                        key={pick.model.name}
                                        dataKey={`slot${pick.slot}`}
                                        name={pick.model.name}
                                        stroke={COMPARE_COLORS[pick.slot]}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            {waiting.length ? null : <Readout tip={tipOf(panel.dayFor())} line={!panel.phone} />}
            <Numbers
                label={`${scoreOf(score).label}, 20-day averages`}
                columns={[
                    { key: 'day', label: 'Day', text: true },
                    ...picks.map((pick) => ({ key: `slot${pick.slot}`, label: pick.model.name })),
                    ...picks.map((pick) => ({ key: `base${pick.slot}`, label: baselineOf(pick.model.name) })),
                ]}
                rows={data.slice().reverse().map((point) => {
                    const row = { key: point.day, day: shortDay(point.day) };

                    picks.forEach((pick) => {
                        row[`slot${pick.slot}`] = cell(point[`slot${pick.slot}`]);
                        row[`base${pick.slot}`] = cell(point[`base${pick.slot}`]);
                    });

                    return row;
                })}
            />
        </section>
    );
}

CompareChart.propTypes = {
    //
    // the models compared, each with the color slot it keeps while it is ticked
    //
    picks: PropTypes.arrayOf(PropTypes.shape({
        model: PropTypes.shape({
            name: PropTypes.string.isRequired,
            started: PropTypes.string,
            retired: PropTypes.string,
        }).isRequired,
        slot: PropTypes.number.isRequired,
    })).isRequired,
    //
    // every model's track record, by name: undefined while one is on its way,
    // null where it could not be had
    //
    records: PropTypes.object.isRequired,
    score: PropTypes.string.isRequired,
    task: PropTypes.shape({
        name: PropTypes.string.isRequired,
    }).isRequired,
    //
    // every task the models compared predict, the first ticked's first (#279):
    // its `task` alone unless they are of more than one, and then the way the
    // chart's own picker picks the score they are compared on
    //
    tasks: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        scores: PropTypes.arrayOf(PropTypes.string),
    })),
    onScore: PropTypes.func,
    onClear: PropTypes.func.isRequired,
};

export default CompareChart;
