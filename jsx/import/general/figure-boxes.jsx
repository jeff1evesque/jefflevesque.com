/**
 * figure-boxes.jsx: a few figures side by side, each its name, an info icon whose
 * note says what the figure counts, and its value: three boxes across a phone,
 * and one ruled row on a wider screen (#206, #208).
 *
 * /stream's stream on its own draws its Health, Coverage and Total Records in
 * them, and /data's dataset on its own, on a phone, its month's total, its rows
 * and its partitions (#230). One component and one set of rules draw both, so the
 * two cannot drift apart -- see '_figure-boxes.scss'. Where each page puts them
 * is its own. The classes keep the names /stream gave them, where the boxes were
 * drawn first.
 *
 * Each figure brings its own name, note, value and color, as the page that draws
 * it reads them. A figure with an empty note has no icon (#315).
 *
 * A figure may bring a line to go under its value, too (#334): a model's Live
 * version box says 'in charge' under its day, where a wide screen's card says
 * "the version in charge". A line a reader has to tap an icon to find is a line
 * nobody reads, so it is drawn, small, in the box itself. /stream's figures and
 * /data's bring none, and draw nothing under their values.
 *
 * Note: a phone shortens what would not fit a third of its line: a name,
 *       'Records' for 'Total Records', and a count, '137M' for '136,963,495'.
 *       Both forms are drawn, and the stylesheet shows the one that fits.
 */

import React from 'react';
import PropTypes from 'prop-types';
import InfoNote from './info-note.jsx';

//
// a count in a few characters -- '137M', '4.2M', '282' -- or whatever stands in
// for one while there is no count, as it is
//
export function shortCount(figure) {
    const value = parseFloat(String(figure).replace(/,/g, ''));

    if (!Number.isFinite(value)) {
        return figure;
    }

    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

//
// both forms of a name or a value, where a phone draws a shorter one
//
function Fitted({ long, short }) {
    if (long === short) {
        return long;
    }

    return (
        <>
            <span className='stream-focus-long'>{long}</span>
            <span className='stream-focus-short'>{short}</span>
        </>
    );
}

Fitted.propTypes = {
    long: PropTypes.node,
    short: PropTypes.node,
};

//
// a form a phone draws, or the one form there is, where a figure has no shorter
//
function shorter(short, long) {
    return short === undefined ? long : short;
}

//
// a figure's name, with an info icon after it that opens its note, or its name
// alone where it has no note, rather than an icon that opens nothing (#315)
//
function Label({ figure }) {
    const name = <Fitted long={figure.label} short={shorter(figure.short, figure.label)} />;

    return figure.note
        ? <InfoNote note={figure.note} className='stream-focus-figure-label stream-focus-noted'>{name}</InfoNote>
        : <span className='stream-focus-figure-label'>{name}</span>;
}

Label.propTypes = {
    figure: PropTypes.shape({
        label: PropTypes.string.isRequired,
        short: PropTypes.string,
        note: PropTypes.string.isRequired,
    }).isRequired,
};

function FigureBoxes({ figures }) {
    return (
        <div className='stream-focus-figures'>
            {figures.map((figure) => (
                <div key={figure.key} className='stream-focus-figure'>
                    <Label figure={figure} />
                    <span className={`stream-focus-figure-value${figure.tone ? ` stream-focus-figure-${figure.tone}` : ''}`}>
                        <Fitted long={figure.value} short={shorter(figure.shortValue, figure.value)} />
                    </span>
                    {figure.sub ? <span className='stream-focus-figure-sub'>{figure.sub}</span> : null}
                </div>
            ))}
        </div>
    );
}

FigureBoxes.propTypes = {
    //
    // each figure: its name and a phone's shorter one, what its note says, its
    // value and a phone's shorter one, the line under its value, where it has
    // one (#334), and the last word of the class its value is colored by, or
    // none for the page's own text
    //
    figures: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        short: PropTypes.string,
        note: PropTypes.string.isRequired,
        value: PropTypes.node,
        shortValue: PropTypes.node,
        sub: PropTypes.string,
        tone: PropTypes.string,
    })).isRequired,
};

export default FigureBoxes;
