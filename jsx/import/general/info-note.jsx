/**
 * info-note.jsx: a name, a small info icon after it, and a note saying what the
 * name means, shown wherever a reader reaches for it (#206).
 *
 * The name and its icon are one focusable span, so the note shows under the
 * pointer, over either of them, from the keyboard, and at a tap. A tap shows it
 * at once: by default a touch has to be held for most of a second. And it stays
 * until the next tap, on the name or anywhere else: by default it is gone a
 * second and a half after the finger lifts, which is too soon to read it (#281).
 *
 * The note DESCRIBES the name rather than replacing it, so a screen reader still
 * reads the name, and the note after it. The icon is hidden from one, since it
 * says nothing the note does not.
 *
 * The note is drawn over the icon rather than over the middle of the name, so it
 * points at what said there was a note to find. How it is drawn is every
 * tooltip's -- see theme-mode.jsx -- but for its width: see fitNote.
 *
 * Note: /graph's first, on a source outside the graph (#147, #149), and then a
 *       stream's figures on /stream (#206), and a build's Variant where it reads
 *       Multi-D (#237).
 */

import React, { useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

//
// the note's box, drawn as wide as the note's widest line (#237).
//
// A note too long for one line fills its box to the theme's 340px, and each line
// stops short of the right edge by however much of the next word did not fit.
// So the box stood further from the text on its right than on its left, which
// the theme pads alike. Once the browser has broken the note into lines, the box
// is set to the width of the widest, and stands as far from the text on either
// side.
//
// Note: measured as the box is put on the page, which is before the popper
//       places it, so the arrow is centered on the box it ends up as.
//
// Note: the box opens growing out of a smaller scale, and its lines are measured
//       at that scale. They are put back at full size by the scale the box
//       itself is drawn at.
//
// Note: half a pixel to spare, at least, so a line measured a fraction short
//       does not lose its last word to the line below.
//
// Note: jsdom lays nothing out, so under test the box is left as the theme
//       draws it.
//
function fitNote(box) {
    if (!box || !box.firstChild || !box.offsetWidth) {
        return;
    }

    box.style.width = '';

    const range = document.createRange();

    range.selectNodeContents(box.firstChild);

    const lines = [...range.getClientRects()].map((line) => line.width);
    const scale = box.getBoundingClientRect().width / box.offsetWidth;

    if (lines.length < 2 || !scale) {
        return;
    }

    //
    // the box's own padding and border, where its width includes them, as it
    // does under the site's stylesheet
    //
    const style = window.getComputedStyle(box);
    const sides = style.boxSizing === 'border-box'
        ? ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
            .reduce((sum, side) => sum + (parseFloat(style[side]) || 0), 0)
        : 0;

    box.style.width = `${Math.ceil(Math.max(...lines) / scale + 0.5) + sides}px`;
}

//
// the note's box, as mui is handed it: measured as it is put on the page, with
// its lines of about one length rather than as many words as fit on each.
//
// Measured in Safari's engine on the Variant's note (#237). Each line filled,
// the box was 340px and ran 308px, 284px and then 'below.' alone, 14px from the
// text on its left and 18.4px on its right. Balanced and fitted, it is 259px and
// runs 230px, 187px and 216px, 14px from the text on its left and 15px on its
// right -- the 14px padding, and fitNote's spare.
//
// Note: one object for every note, as the callback is the same for every note.
//       A browser that cannot balance lines fills them, and fitNote still
//       closes the box in around the widest. Balanced and not fitted, the box
//       would stand far further from the text on its right than it ever did.
//
const NOTE_SLOTS = { tooltip: { ref: fitNote, style: { textWrap: 'balance' } } };

function InfoNote({ note, className = null, children = null }) {
    const icon = useRef(null);
    const touched = useRef(false);

    //
    // the note is shown for either of two reasons: the pointer or the keyboard,
    // which mui opens and closes it for as it always has, or a tap, which holds
    // it until the next tap
    //
    const [shown, setShown] = useState(false);
    const [held, setHeld] = useState(false);

    //
    // mui anchors a tooltip on the element it wraps, the whole span; this anchors
    // it on the icon. One object for the note's life, since a new one each render
    // would have mui build its popper again each time
    //
    const popper = useMemo(() => ({ anchorEl: () => icon.current }), []);

    //
    // a tap is a click that a touch began. A click from a mouse holds nothing:
    // the pointer is already showing the note, and takes it away as it leaves
    //
    const tap = () => {
        if (touched.current) {
            touched.current = false;
            setHeld((was) => !was);
        }
    };

    //
    // Note: the listener listens only while a tap holds the note, rather than on
    //       every note on the page for every click anywhere.
    //
    return (
        <ClickAwayListener
            onClickAway={() => setHeld(false)}
            mouseEvent={held ? 'onClick' : false}
            touchEvent={held ? 'onTouchEnd' : false}
        >
            <Tooltip
                title={note}
                describeChild
                open={shown || held}
                onOpen={() => setShown(true)}
                onClose={() => setShown(false)}
                disableTouchListener
                PopperProps={popper}
                slotProps={NOTE_SLOTS}
            >
                <span
                    className={className}
                    tabIndex={0}
                    onTouchStart={() => { touched.current = true; }}
                    onClick={tap}
                >
                    {children}
                    <InfoOutlinedIcon ref={icon} fontSize='inherit' />
                </span>
            </Tooltip>
        </ClickAwayListener>
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

export { fitNote };
