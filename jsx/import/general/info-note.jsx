/**
 * info-note.jsx: a name, a small info icon after it, and a note saying what the
 * name means, shown wherever a reader reaches for it (#206).
 *
 * The name and its icon are one focusable span, so the note shows under the
 * pointer, over either of them, from the keyboard, and at a tap. A tap shows it
 * at once: by default a touch has to be held for most of a second.
 *
 * The note DESCRIBES the name rather than replacing it, so a screen reader still
 * reads the name, and the note after it. The icon is hidden from one, since it
 * says nothing the note does not.
 *
 * The note is drawn over the icon rather than over the middle of the name, so it
 * points at what said there was a note to find. How it is drawn is every
 * tooltip's -- see theme-mode.jsx.
 *
 * Note: /graph's first, on a source outside the graph (#147, #149), and then a
 *       stream's figures on /stream (#206).
 */

import React, { useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

function InfoNote({ note, className = null, children = null }) {
    const icon = useRef(null);

    //
    // mui anchors a tooltip on the element it wraps, the whole span; this anchors
    // it on the icon. One object for the note's life, since a new one each render
    // would have mui build its popper again each time
    //
    const popper = useMemo(() => ({ anchorEl: () => icon.current }), []);

    return (
        <Tooltip title={note} describeChild enterTouchDelay={0} PopperProps={popper}>
            <span className={className} tabIndex={0}>
                {children}
                <InfoOutlinedIcon ref={icon} fontSize='inherit' />
            </span>
        </Tooltip>
    );
}

InfoNote.propTypes = {
    //
    // what the name means, in a few words
    //
    note: PropTypes.string.isRequired,
    className: PropTypes.string,
    //
    // the name the note is about
    //
    children: PropTypes.node,
};

export default InfoNote;
