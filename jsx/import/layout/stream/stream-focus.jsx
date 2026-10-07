/**
 * stream-focus.jsx: one stream on its own (#161) -- what a stream's name on
 * /stream opens.
 *
 * Its Health, Coverage and Total Records are one ruled row as wide as the graph,
 * over a taller graph than a row has room for (#208), and nothing stands beside
 * the graph, so it runs the page's width. They were three boxes, centered on
 * the page, then at its left (#206). The way back to every stream is the
 * page's, over the title -- see '.stream-back' in stream.jsx. It was a green
 * rail down the graph's left side, as /graph's columns fold, which read oddly
 * as a way back and cost the graph its width (#167).
 *
 * Each value is drawn in a color that says how it stands, and each name is
 * followed by an info icon whose note says what the figure counts (#206). See
 * figureTone and figureNote. The boxes themselves are /data's too, since a
 * dataset opened on its own on a phone draws its month in them (#230) -- see
 * general/figure-boxes.jsx.
 *
 * Everything the rows do, this does to the one stream: the bars, what they say
 * when pointed at, a bar opening its interval one rate finer, and the line it
 * shows while its report is not in. The window, the refresh and the requests
 * are the page's, and stay as they were -- see stream.jsx.
 *
 * Note: on a phone the same view is one column (#161): the graph first, then
 *       the figures in three boxes side by side (#206), then the line that
 *       describes a bar, and the color key folded under its button. The way
 *       back there is the same '.stream-back', as a bar across the phone, and
 *       the stylesheet hides the dates under the graph, which a phone has no
 *       room for. A wide screen hides the dates over it instead, which repeat
 *       the first date under the bars and the line under the title (#208).
 *
 * Note: a phone shortens two things so the three figures keep to one line:
 *       'Records' for 'Total Records', and the count itself, '137M' for
 *       '136,963,495'. This hands the boxes both forms, and they draw both for
 *       the stylesheet to show the one that fits.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import FigureBoxes, { shortCount } from '../../general/figure-boxes.jsx';
import { COLUMNS, StreamBars, StreamLegend, StreamReadout } from './stream-rows.jsx';

//
// a count in a few characters, as the boxes draw one on a phone -- see
// figure-boxes.jsx, where it moved with them (#230)
//
export { shortCount };

//
// about how many dates the graph is labeled with: few enough that each has
// room under a minute's sixty bars, and every so many bars from the first
//
const TICKS = 6;

//
// a date under the graph, as short as its rate allows: 'Sep 14', '4 PM',
// '4:05 PM', 'Sep'
//
export function tickLabel(date, rate) {
    const r = String(rate).toLowerCase();

    if (r === 'month') {
        return date.toLocaleString('en-US', { month: 'short' });
    }

    if (r === 'day') {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    }

    return date.toLocaleString('en-US', { hour: 'numeric', minute: r === 'minute' ? '2-digit' : undefined });
}

//
// what each figure counts, in the few words its info icon shows (#206).
// Coverage's unit follows the rate: a month counts as covered by any one run in
// it, so 'runs' alone would be wrong by the month
//
const NOTES = {
    health: () => 'Percent of records that succeeded',
    coverage: (rate) => `Percent of scheduled ${String(rate).toLowerCase()}s with a run`,
    total: () => 'Records that succeeded, all bars added up',
};

export function figureNote(key, rate) {
    return NOTES[key] ? NOTES[key](rate) : null;
}

//
// the color a figure's value is drawn in, as the last word of its class, or
// null for the page's own text (#206):
//
//   - Health and Coverage are 'good' at GOOD percent or more;
//   - Health under it is 'bad', in the bars' red: records failed;
//   - Coverage under it is neither. It counts every interval a run was due in
//     since the window began, those before a stream's first row too, which the
//     graph leaves empty -- so a stream whose rows start partway through the
//     window reads low with nothing failed. S&P 500 read 41.67% by the month on
//     2026-10-04, and red there would be a false alarm;
//   - Total Records is 'total', in the bars' darkest blue, since it is the bars
//     added up.
//
// A figure with no number -- 'n/a' -- has no color.
//
// Note: read from the figure as it is shown, so a phone's whole percent is the
//       one read: a Health of 94.6% shows as 95% there, and is green.
//
const GOOD = 95;

export function figureTone(key, figure) {
    const value = parseFloat(String(figure).replace(/,/g, ''));

    if (!Number.isFinite(value) || !NOTES[key]) {
        return null;
    }

    if (key === 'total') {
        return 'total';
    }

    if (value >= GOOD) {
        return 'good';
    }

    return key === 'health' ? 'bad' : null;
}

function StreamFocus({ row, rate, first, last, onOpen = null }) {
    const [pointed, setPointed] = useState(null);
    const every = Math.max(1, Math.ceil(row.bars.length / TICKS));

    return (
        <div className='stream-focus' data-stream={row.stream}>
            <FigureBoxes
                figures={COLUMNS.map((column) => ({
                    key: column.key,
                    label: column.label,
                    short: column.short,
                    note: figureNote(column.key, rate),
                    value: row.figures[column.key],
                    shortValue: column.key === 'total' ? shortCount(row.figures.total) : row.figures[column.key],
                    tone: figureTone(column.key, row.figures[column.key]),
                }))}
            />

            <div className='stream-focus-axis'>
                <span>{first}</span>
                <span>{last}</span>
            </div>

            <div className='stream-focus-body'>
                <div className='stream-focus-main'>
                    <StreamBars
                        row={row}
                        rate={rate}
                        onPoint={setPointed}
                        pointed={pointed ? pointed.key : null}
                        onOpen={onOpen}
                        className='stream-focus-bars'
                    />
                    <div className={`stream-focus-ticks${row.bars.length > 30 ? ' stream-focus-ticks-dense' : ''}`} aria-hidden='true'>
                        {row.bars.map((bar, index) => (
                            <span key={bar.start.valueOf()}>
                                {index % every === 0 ? tickLabel(bar.start, rate) : ''}
                            </span>
                        ))}
                    </div>
                    <StreamReadout pointed={pointed} />
                    <StreamLegend />
                </div>
            </div>
        </div>
    );
}

StreamFocus.propTypes = {
    //
    // the stream's row, as stream.jsx builds one for stream-rows.jsx
    //
    row: PropTypes.shape({
        stream: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        status: PropTypes.oneOf(['loading', 'slow', 'failed', 'done']),
        retry: PropTypes.func,
        bars: PropTypes.array.isRequired,
        figures: PropTypes.shape({
            health: PropTypes.node,
            coverage: PropTypes.node,
            total: PropTypes.node,
        }).isRequired,
    }).isRequired,
    rate: PropTypes.string.isRequired,
    first: PropTypes.string,
    last: PropTypes.string,
    //
    // what a bar opens, as for a row
    //
    onOpen: PropTypes.func,
};

export default StreamFocus;
