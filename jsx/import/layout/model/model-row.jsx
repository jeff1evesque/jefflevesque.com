/**
 * model-row.jsx: one model in /model's list (#243): a box to tick it for the
 * comparison, its name, status, address and description, its bell, which leads to
 * its alarm page (#255), its latest 20-day score against the know-nothing baseline,
 * a trend line of that score, when its live version went live, and how many of its
 * nightly attempts did. A retired model has no bell. A model whose live version
 * the trainer took down for doing worse than the baseline says when, and which
 * check did it, in place of when it went live (#263).
 *
 * The bell comes after the name, as a stream's comes after the stream's name on
 * /stream, so the two pages put it on one side (#259).
 *
 * A row across a wide screen, under the list's headings, and a card on a phone,
 * where each figure carries its own name instead -- see '_model.scss'. There the
 * score's name carries a note on what the score measures, as the heading over
 * its column does on a wide screen (#265).
 *
 * Note: the trend line is drawn on the axis the list hands every row: the last
 *       60 days any model was scored on. A model that started a fortnight ago
 *       draws a fortnight at the right of it, and one retired before them draws
 *       nothing, so every row's line lines up with the row above it.
 */

import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis } from 'recharts';
import Tooltip from '@mui/material/Tooltip';
import { ThemeModeContext } from '../../general/theme-mode.jsx';
import InfoNote from '../../general/info-note.jsx';
import { AlarmBell, StatusPill } from './parts.jsx';
import {
    COMPARE_COLORS,
    TREND_DAYS,
    WINDOW,
    betterBy,
    chartColors,
    checkWords,
    formatGap,
    formatScore,
    liveKind,
    scoreOf,
    shortDay,
    standing,
    statusOf,
    takenDown,
} from './scores.js';

//
// the trend line's size, in px: as wide as its column, and about a row's text
// tall
//
const TREND_WIDTH = 132;
const TREND_HEIGHT = 36;

/**
 * a model's 20-day score over the days on `axis`, beside the baseline's.
 *
 * `rows` is the model's track record: undefined while it is on its way, null
 * where it could not be had.
 */
export function TrendLine({ name, rows, axis, score }) {
    const { theme } = useContext(ThemeModeContext);
    const colors = chartColors(theme);

    if (rows === undefined) {
        return <span className='model-trend-pending' aria-label='Loading the trend' />;
    }

    const byDay = {};

    (rows || []).forEach((row) => {
        byDay[row.day] = row;
    });

    const data = axis.map((day) => ({
        day: day,
        value: byDay[day] ? byDay[day].average[score] : null,
        baseline: byDay[day] ? byDay[day].baseline_average[score] : null,
    }));

    if (!data.some((point) => point.value !== null)) {
        return (
            <span className='model-trend-none' title={rows ? `Not scored in the last ${TREND_DAYS} days` : 'Could not be loaded'}>
                {'–'}
            </span>
        );
    }

    return (
        <span
            className='model-trend'
            role='img'
            aria-label={`${name}'s 20-day ${scoreOf(score).label}, over the last ${TREND_DAYS} days`}
        >
            <LineChart width={TREND_WIDTH} height={TREND_HEIGHT} data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis dataKey='day' hide />
                <YAxis hide domain={['dataMin', 'dataMax']} reversed={scoreOf(score).lower} />
                <Line
                    dataKey='baseline'
                    stroke={colors.grid}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                />
                <Line
                    dataKey='value'
                    stroke={colors.muted}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                />
            </LineChart>
        </span>
    );
}

TrendLine.propTypes = {
    name: PropTypes.string.isRequired,
    rows: PropTypes.array,
    axis: PropTypes.arrayOf(PropTypes.string).isRequired,
    score: PropTypes.string.isRequired,
};

//
// what the score's figure is called on a phone's card, where there are no
// headings: over the last 20 days, before it retired for a retired one, and so
// far for one with fewer than 20 scored days -- a new model, or one taken down
// before it had them (#263)
//
function scoreLabel(model, score) {
    const label = scoreOf(score).label;

    if (statusOf(model) === 'retired') {
        return `${label}, last 20 days before retiring`;
    }

    return model.scored_days < WINDOW
        ? `${label}, ${model.scored_days} ${model.scored_days === 1 ? 'day' : 'days'} so far`
        : `${label}, last 20 days`;
}

//
// the Live version cell's figure, and the line under it: when the live version
// went live and how, when a retired model retired, or when a model's live
// version was taken down and the check that did it (#263)
//
function liveCell(model, status) {
    if (status === 'retired') {
        return { figure: `Retired ${shortDay(model.retired)}`, detail: 'no longer trained' };
    }

    if (status === 'down') {
        return { figure: takenDown(model.down.since), detail: checkWords(model.down) };
    }

    return { figure: shortDay(model.live.since) || '–', detail: liveKind(model.live.kind) };
}

//
// how the score stands against the baseline's, in words: '▲ 0.034 better than
// the baseline'. The arrow in a span of its own, so it alone takes the color
// of better or worse -- see '.model-gap-arrow' in '_model.scss'
//
function gapText(gap, score) {
    const stands = standing(gap, score);

    if (gap === null) {
        return '';
    }

    if (stands === 'level') {
        return 'level with the baseline';
    }

    return (
        <>
            <span className='model-gap-arrow'>{stands === 'better' ? '▲' : '▼'}</span>
            {` ${formatGap(gap, score)} ${stands} than the baseline`}
        </>
    );
}

function ModelRow({ model, score, rows, axis, picked, blocked, onPick, held = false }) {
    const status = statusOf(model);
    const live = liveCell(model, status);
    const value = model.score ? model.score[score] : null;
    const gap = betterBy(value, model.baseline ? model.baseline[score] : null, score);
    const ticked = picked !== null;
    const address = `/model/${encodeURIComponent(model.name)}`;

    //
    // the box, in a span so its tooltip still shows while it is disabled -- a
    // disabled input hears no pointer, and says why it cannot be ticked only
    // through what is around it
    //
    const box = (
        <span className='model-compare-box'>
            <input
                type='checkbox'
                checked={ticked}
                disabled={Boolean(blocked)}
                aria-label={`Compare ${model.name}`}
                onChange={() => onPick(model)}
            />
        </span>
    );

    return (
        <div className={`model-row${status === 'retired' ? ' model-row-retired' : ''}`} role='listitem'>
            <div className='model-cell model-cell-compare'>
                {blocked ? <Tooltip title={blocked}>{box}</Tooltip> : box}
                {ticked
                    ? <span className='model-swatch' style={{ backgroundColor: COMPARE_COLORS[picked] }} aria-hidden='true' />
                    : null}
            </div>
            <div className='model-cell model-cell-model'>
                <div className='model-name-line'>
                    <Link className='model-name' to={address}>{model.name}</Link>
                    <StatusPill model={model} />
                </div>
                <span className='model-address'>{address}</span>
                {model.description ? <p className='model-description'>{model.description}</p> : null}
            </div>
            <div className='model-cell model-cell-alarm'>
                <AlarmBell model={model} held={held} />
            </div>
            <div className='model-cell model-cell-score'>
                <InfoNote note={scoreOf(score).note} className='model-cell-label model-noted'>{scoreLabel(model, score)}</InfoNote>
                <span className='model-score-value'>{formatScore(value, score)}</span>
                <span className={`model-gap model-gap-${standing(gap, score)}`}>{gapText(gap, score)}</span>
            </div>
            <div className='model-cell model-cell-trend'>
                <span className='model-cell-label'>{`Last ${TREND_DAYS} days`}</span>
                <TrendLine name={model.name} rows={rows} axis={axis} score={score} />
            </div>
            <div className='model-cell model-cell-live'>
                <span className='model-cell-label'>Live version</span>
                <span className='model-figure'>{live.figure}</span>
                <span className='model-figure-detail'>{live.detail}</span>
            </div>
            <div className='model-cell model-cell-went'>
                <span className='model-cell-label'>Went live</span>
                <span className='model-figure'>{`${model.attempts.went_live} of ${model.attempts.total}`}</span>
                <span className='model-figure-detail'>attempts</span>
            </div>
        </div>
    );
}

ModelRow.propTypes = {
    model: PropTypes.shape({
        name: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        description: PropTypes.string,
        retired: PropTypes.string,
        scored_days: PropTypes.number.isRequired,
        live: PropTypes.shape({
            since: PropTypes.string,
            kind: PropTypes.string,
        }).isRequired,
        attempts: PropTypes.shape({
            total: PropTypes.number.isRequired,
            went_live: PropTypes.number.isRequired,
        }).isRequired,
        score: PropTypes.object,
        baseline: PropTypes.object,
        //
        // the night the trainer took its live version down, and the check that
        // did it, or null while it is live -- see worker/model/report.js
        //
        down: PropTypes.shape({
            since: PropTypes.string.isRequired,
            days: PropTypes.number.isRequired,
            in_a_row: PropTypes.number.isRequired,
        }),
    }).isRequired,
    score: PropTypes.string.isRequired,
    //
    // the model's track record: undefined while it is on its way, null where it
    // could not be had
    //
    rows: PropTypes.array,
    axis: PropTypes.arrayOf(PropTypes.string).isRequired,
    //
    // the color slot it holds in the comparison, or null where it is not ticked
    //
    picked: PropTypes.number,
    //
    // why it cannot be ticked, or null where it can
    //
    blocked: PropTypes.string,
    onPick: PropTypes.func.isRequired,
    //
    // whether the reader holds the model's alarm, which rings its bell
    //
    held: PropTypes.bool,
};

export default ModelRow;
