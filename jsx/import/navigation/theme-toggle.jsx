/**
 * theme-toggle.jsx: the light and dark switch in the header.
 *
 * One button, showing where it would take the page: a moon while the page is
 * light, and a sun while it is dark. That is the convention mui's own pages
 * keep, and the one a reader is most likely to have met.
 *
 * Solid rather than outlined. The outlines were a line under 2px thick at this
 * size, beside the header's solid house, and a reader could pass over them: their
 * gray was never the trouble -- it clears 4.5:1 on every surface the switch sits
 * on -- their weight was. The solid glyphs carry about twice the ink in the same
 * grays. A disc behind the outline was the other way to add weight, and fails on
 * one surface or another: black vanishes on the black bars, white on the white
 * page, and yellow would read as part of the construction banner.
 *
 * Its name says what it IS, 'Dark theme', and 'aria-pressed' says whether that
 * is on, so a screen reader hears one control with a state rather than a label
 * that changes under it. The tooltip says what pressing it will do, which is
 * the question a sighted reader has of an icon -- and, where pressing it asks
 * for the theme the clock does not give, for how long: the rest of the day, or
 * of the night.
 *
 * Note: what it changes is kept until the clock's next switch, and pressing it
 *       back to the clock's theme puts the page back on the clock -- see
 *       theme-preference.js, and theme-mode.jsx, which does the changing.
 *
 * Note: drawn in every header -- the phone's and the wide one, signed in or
 *       not, and the bare one the sign-in pages carry -- beside the control that
 *       ends each of them. `className` places it there.
 */

import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { ThemeModeContext } from '../general/theme-mode.jsx';

function ThemeToggle({ className }) {
    const { theme, scheduled, toggle } = useContext(ThemeModeContext);
    const dark = theme === 'dark';
    const next = dark ? 'light' : 'dark';
    const Icon = dark ? LightModeIcon : DarkModeIcon;
    const title = next === scheduled
        ? `Switch to the ${next} theme`
        : `Switch to the ${next} theme for the rest of the ${scheduled === 'light' ? 'day' : 'night'}`;

    return (
        <button
            type='button'
            className={className ? `theme-toggle ${className}` : 'theme-toggle'}
            aria-label='Dark theme'
            aria-pressed={dark}
            title={title}
            onClick={toggle}
        >
            <Icon fontSize='inherit' />
        </button>
    );
}

ThemeToggle.propTypes = {
    className: PropTypes.string,
};

export default ThemeToggle;
