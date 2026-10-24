/**
 * pending.jsx: what /model and a model's own page hold while the listing is
 * still on its way (#274), and an options model's picks page while its picks are
 * (#290).
 *
 * Both pages used to wait as a title over one line, 'Loading the models…' or
 * 'Loading the model…', and the whole page arrived with the listing. On a cold
 * start that is most of a phone's first screen left white. So, as /graph does
 * (see graph/pending.jsx), each page draws its own shape while it waits: the
 * pieces here wear the real elements' classes, so what arrives fills them
 * rather than pushing the page around underneath the reader.
 *
 * Note: nothing here invents a value. What is the same whatever the listing
 *       says is drawn as it will be -- the column headings, a figure's name, a
 *       chart's title, and on a model's page its name, which the address
 *       holds -- and every value is a gray bar, breathing as /graph's do.
 *
 * Note: two rows stand in for a list, as many as /model shows today. A list of
 *       more grows when it lands, under the first screen.
 *
 * Note: a score picker is a task's (#279), and which scores it offers is the
 *       listing's to say, so before it lands the picker is its name over bars
 *       -- see PendingPicker -- and the score named is loss, which every task
 *       opens on, drawn as its three parts, as a list of stock models shows it
 *       (#283).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { PendingBar } from '../graph/pending.jsx';
import { DEFAULT_SCORE, LOSS_PARTS, TREND_DAYS, WINDOW, scoreOf } from './scores.js';

//
// how far apart, in milliseconds, two neighboring bars breathe -- /graph's own
// beat, so a page of them reads as one thing waiting
//
export const STAGGER = 90;

/**
 * lines of text that have not arrived, a bar each, one under another, each at
 * most as wide as its line.
 *
 * Note: 'min()' rather than the bar's own 'max-width: 100%'. Each line lands in
 *       a grid item -- a card's head, the lede -- whose track is sized to what
 *       it holds, and a fixed width there widens the track past a phone's edge.
 *       A width with a percentage in it gives nothing to that sizing, and is
 *       resolved against the line once the track has its width.
 */
export function PendingLines({ widths, delay = 0 }) {
    return widths.map((width, at) => (
        <span key={at} className='model-pending-line'>
            <PendingBar width={`min(${width}, 100%)`} delay={delay + at * STAGGER} />
        </span>
    ));
}

PendingLines.propTypes = {
    widths: PropTypes.arrayOf(PropTypes.string).isRequired,
    delay: PropTypes.number,
};

/**
 * a score picker before the listing says whose task it is, and so which scores
 * it offers (#279): its name, and a bar for each of four buttons, laid out as a
 * picker is, and on a phone a bar where its menu will be. Hidden from a screen
 * reader, as it is not a control yet.
 */
export function PendingPicker() {
    return (
        <div className='model-scores model-picker-pending' aria-hidden='true'>
            <span className='model-control-label'>Score</span>
            <div className='model-score-buttons'>
                {['3.5rem', '6.5rem', '9rem', '8rem'].map((width, at) => (
                    <span key={width} className='model-score model-score-pending'>
                        <PendingBar width={width} delay={at * STAGGER} />
                    </span>
                ))}
            </div>
            <span className='model-score-menu'>
                <span className='model-score model-score-pending'>
                    <PendingBar width='6rem' />
                </span>
            </span>
        </div>
    );
}

/**
 * one of /model's rows, or a phone's card, before the listing says whose: its
 * figures' names, and a bar for every value, in a row's order, its score last
 * (#283). The box that ticks it is drawn disabled, and there is no bell, since a
 * retired model has none. With `parts`, loss's three parts stand in the score's
 * place, each named over a bar, as a row of a list that shows them has them.
 */
export function PendingRow({ score, at, parts = false }) {
    const delay = (step) => (at * 8 + step) * STAGGER;

    return (
        <div className='model-row model-row-pending'>
            <div className='model-cell model-cell-compare'>
                <span className='model-compare-box'>
                    <input type='checkbox' disabled />
                </span>
            </div>
            <div className='model-cell model-cell-model'>
                <div className='model-name-line'>
                    <PendingBar width='5.5rem' delay={delay(0)} />
                    <PendingBar width='5rem' delay={delay(1)} />
                </div>
                <span className='model-address'>
                    <PendingBar width='8rem' delay={delay(2)} />
                </span>
                <p className='model-description'>
                    <PendingLines widths={['17rem', '9rem']} delay={delay(3)} />
                </p>
            </div>
            <div className='model-cell model-cell-alarm' />
            <div className='model-cell model-cell-live'>
                <span className='model-cell-label'>Live version</span>
                <span className='model-figure'>
                    <PendingBar width='3.5rem' delay={delay(5)} />
                </span>
                <span className='model-figure-detail'>
                    <PendingBar width='6rem' delay={delay(6)} />
                </span>
            </div>
            <div className='model-cell model-cell-went'>
                <span className='model-cell-label'>Went live</span>
                <span className='model-figure'>
                    <PendingBar width='3rem' delay={delay(5)} />
                </span>
                <span className='model-figure-detail'>
                    <PendingBar width='4rem' delay={delay(6)} />
                </span>
            </div>
            <div className='model-cell model-cell-trend'>
                <span className='model-cell-label'>{`Last ${TREND_DAYS} days`}</span>
                <span className='model-trend-pending' style={{ animationDelay: `${delay(7)}ms` }} />
            </div>
            {parts
                ? (
                    <div className='model-cell model-cell-parts'>
                        <span className='model-cell-label'>{scoreOf(score).label}</span>
                        <ul className='model-part-cells'>
                            {LOSS_PARTS.map((part, step) => (
                                <li key={part.key} className='model-part-cell'>
                                    <span className='model-part-cell-name'>{part.label}</span>
                                    <span className='model-part-cell-value'>
                                        <PendingBar width='2.5rem' delay={delay(8 + step)} />
                                    </span>
                                    <span className='model-gap'>
                                        <PendingBar width='4.5rem' delay={delay(9 + step)} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className='model-cell model-cell-score'>
                        <span className='model-cell-label'>{scoreOf(score).label}</span>
                        <span className='model-score-value'>
                            <PendingBar width='3.5rem' delay={delay(8)} />
                        </span>
                        <span className='model-gap'>
                            <PendingBar width='8.5rem' delay={delay(9)} />
                        </span>
                    </div>
                )}
        </div>
    );
}

PendingRow.propTypes = {
    score: PropTypes.string.isRequired,
    at: PropTypes.number.isRequired,
    parts: PropTypes.bool,
};

/**
 * /model's list before the listing names its task and its models: the task's
 * heading, its score picker (#279), the list's own column headings, and two
 * rows. On loss, as its three parts (#283): a list opens on loss, and the first
 * list is of stock models, whose list shows them. The score's heading names the
 * days a listing averages where it does not say, WINDOW: the listing that says
 * otherwise is not in yet (#293).
 */
export function PendingGroup({ score = DEFAULT_SCORE }) {
    const parts = score === DEFAULT_SCORE;
    const scoreName = `${scoreOf(score).label}, last ${WINDOW} days`;

    return (
        <section className='model-group' aria-hidden='true'>
            <div className='model-group-head'>
                <h5><PendingBar width='7.5rem' /></h5>
                <span className='model-group-detail'>
                    <PendingLines widths={['26rem', '12rem']} delay={STAGGER} />
                </span>
                <span className='model-group-count'>
                    <PendingBar width='4rem' delay={2 * STAGGER} />
                </span>
            </div>
            <div className='model-controls model-group-controls'>
                <PendingPicker />
            </div>
            <div className={parts ? 'model-list model-list-parts' : 'model-list'}>
                <div className='model-list-head'>
                    <span>Compare</span>
                    <span>Model</span>
                    <span />
                    <span>Live version</span>
                    <span>Went live</span>
                    <span className='model-head-trend'>{`Last ${TREND_DAYS} days`}</span>
                    {parts
                        ? (
                            <div className='model-parts-head'>
                                <span className='model-noted'>{scoreName}</span>
                                {LOSS_PARTS.map((part) => <span key={part.key}>{part.label}</span>)}
                            </div>
                        ) : <span>{scoreName}</span>}
                </div>
                <div>
                    {[0, 1].map((at) => <PendingRow key={at} score={score} at={at} parts={parts} />)}
                </div>
            </div>
        </section>
    );
}

PendingGroup.propTypes = {
    score: PropTypes.string,
};

/**
 * a model page's three figures before the listing has them: a card each on a
 * wide screen, its name over a bar for its figure and one for its line, and two
 * rows under its rule, and on a phone the row of boxes, a name over a bar.
 */
export function PendingSummary({ score }) {
    const label = scoreOf(score).label;
    const cards = [
        { key: 'live', name: 'Live version', short: 'Live version' },
        { key: 'went', name: 'Attempts that went live', short: 'Went live' },
        { key: 'score', name: label, short: label },
    ];

    return (
        <section className='model-summary' aria-hidden='true'>
            <div className='model-summary-cards'>
                {cards.map((card, at) => (
                    <div key={card.key} className='model-stat'>
                        <div className='model-stat-head'>
                            <span className='model-stat-label'>{card.name}</span>
                            <span className='model-stat-value'>
                                <PendingBar width='5rem' delay={at * STAGGER} />
                            </span>
                            <span className='model-stat-detail'>
                                <PendingBar width='10rem' delay={(at + 1) * STAGGER} />
                            </span>
                        </div>
                        <div className='model-stat-body'>
                            <ul className='model-stat-rows'>
                                {[0, 1].map((row) => (
                                    <li key={row} className='model-stat-row'>
                                        <span className='model-stat-row-name'>
                                            <PendingBar width={row ? '6rem' : '8rem'} delay={(at + row + 2) * STAGGER} />
                                        </span>
                                        <span className='model-stat-row-value'>
                                            <PendingBar width='2.5rem' delay={(at + row + 3) * STAGGER} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
            <div className='model-summary-boxes'>
                <div className='stream-focus-figures'>
                    {cards.map((card, at) => (
                        <div key={card.key} className='stream-focus-figure'>
                            <span className='stream-focus-figure-label'>{card.short}</span>
                            <span className='stream-focus-figure-value'>
                                <PendingBar width='3.5rem' delay={at * STAGGER} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

PendingSummary.propTypes = {
    score: PropTypes.string.isRequired,
};

/**
 * a chart's card before its report is in: its title, which never changes, two
 * bars for the line under it, and the chart's frame, its grid's lines without
 * a mark on them, `height` tall, as the chart it stands in for is.
 */
export function PendingChart({ title, height }) {
    return (
        <section className='model-card' aria-hidden='true'>
            <div className='model-card-head'>
                <h5 className='model-fold-title'>
                    <span className='model-fold'>{title}</span>
                </h5>
                <p className='model-card-sub'>
                    <PendingLines widths={['40rem', '24rem']} />
                </p>
            </div>
            <div className='model-chart-pending' style={{ height: height }}>
                {[0, 1, 2, 3, 4].map((line) => (
                    <span key={line} className='model-chart-pending-line' style={{ animationDelay: `${line * STAGGER}ms` }} />
                ))}
            </div>
        </section>
    );
}

PendingChart.propTypes = {
    title: PropTypes.string.isRequired,
    height: PropTypes.number.isRequired,
};

/**
 * the record card's figures before the track record is in (#290): their lines'
 * words, which never change, over a bar for each figure.
 */
export function PendingRecord() {
    return (
        <div className='model-picks-figures' aria-hidden='true'>
            {['average gain', 'made money'].map((line, at) => (
                <div key={line} className='model-picks-figure'>
                    <span className='model-stat-value'>
                        <PendingBar width='5rem' delay={at * STAGGER} />
                    </span>
                    <span className='model-stat-detail'>{line}</span>
                </div>
            ))}
        </div>
    );
}

/**
 * an options model's picks page before its picks are in (#290): the hold picker's
 * name over a bar for each hold, the When card's names over bars for its days, the
 * record card over bars for its figures and its days, and the table's card, its
 * title and the line under it, with ten rows of bars where its picks will be.
 * Hidden from a screen reader, as none of it is the page yet.
 */
export function PendingPicks() {
    return (
        <div className='model-picks-pending' aria-hidden='true'>
            <div className='model-controls'>
                <div className='model-scores model-picker-pending'>
                    <span className='model-control-label'>Hold</span>
                    <div className='model-score-buttons'>
                        {['2.75rem', '3rem', '3.25rem'].map((width, at) => (
                            <span key={width} className='model-score model-score-pending'>
                                <PendingBar width={width} delay={at * STAGGER} />
                            </span>
                        ))}
                    </div>
                    <span className='model-score-menu'>
                        <span className='model-score model-score-pending'>
                            <PendingBar width='4rem' />
                        </span>
                    </span>
                </div>
            </div>
            <div className='model-picks-summary'>
                <div className='model-stat model-picks-when'>
                    <div className='model-stat-head'>
                        <span className='model-stat-label'>When</span>
                        <div className='model-picks-when-rows'>
                            {['From', 'Buy', 'Sell'].map((name, at) => (
                                <div key={name} className='model-picks-when-row'>
                                    <span className='model-picks-when-name'>{name}</span>
                                    <span className='model-picks-when-day'>
                                        <PendingBar width='6.5rem' delay={(at + 1) * STAGGER} />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className='model-stat model-picks-record'>
                    <div className='model-stat-head'>
                        <span className='model-stat-label'>How its top 10 has done</span>
                        <PendingRecord />
                    </div>
                    <div className='model-stat-body'>
                        <span className='model-picks-strip-pending' style={{ animationDelay: `${4 * STAGGER}ms` }} />
                    </div>
                </div>
            </div>
            <section className='model-card model-picks'>
                <div className='model-card-head'>
                    <div className='model-card-title'>
                        <h5>Top 10</h5>
                    </div>
                    <p className='model-card-sub'>
                        <PendingLines widths={['30rem']} />
                    </p>
                </div>
                <div className='model-picks-pending-rows'>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                        <span key={row} className='model-pending-line'>
                            <PendingBar width='100%' delay={(row + 5) * STAGGER} />
                        </span>
                    ))}
                </div>
            </section>
        </div>
    );
}
