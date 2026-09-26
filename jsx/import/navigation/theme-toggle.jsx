/**
 * theme-toggle.jsx: the light and dark switch in the header.
 *
 * One button, showing where it would take the page: a moon while the page is
 * light, and a sun while it is dark. That is the convention mui's own pages
 * keep, and the one a reader is most likely to have met.
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
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { ThemeModeContext } from '../general/theme-mode.jsx';

function ThemeToggle({ className }) {
    const { theme, scheduled, toggle } = useContext(ThemeModeContext);
    const dark = theme === 'dark';
    const next = dark ? 'light' : 'dark';
    const Icon = dark ? LightModeOutlinedIcon : DarkModeOutlinedIcon;
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
