/**
 * theme-mode.jsx: which theme the page is drawn in, for everything that draws.
 *
 * Most of the page follows the theme without being told. Its stylesheet reads
 * the `data-theme` attribute this keeps on the root element -- see
 * '_theme.scss' -- and a rule written against the light theme's colors draws the
 * dark one too.
 *
 * Two kinds of drawing cannot follow an attribute, and read the theme from here
 * instead:
 *
 *   - mui's components, which color themselves from a theme object of their
 *     own. This hands them the dark one while the page is dark.
 *   - whatever computes a color in script -- the graphs' palettes and the
 *     charts', a node mixed toward the page, a line drawn in the page's gray.
 *     These read `theme` from ThemeModeContext, and draw again when it changes.
 *
 * The theme follows the reader's own clock -- light by day, dark in the evening
 * -- and a choice they make with the switch holds until the clock's next switch.
 * See theme-preference.js. While the page is open it keeps time itself, and
 * looks again at each switch without being asked.
 *
 * Note: a class with a context rather than a hook, like the rest of this
 *       codebase's stateful components. The page's classes read it as their
 *       static contextType.
 *
 * Note: the theme starts as the one the script in the head of index.html
 *       already put on the page, read the same way -- so the first render is in
 *       the theme the first paint was.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { colors_dark } from './colors.js';
import {
    applyTheme,
    currentTheme,
    nextSwitch,
    scheduledTheme,
    writeTheme,
} from './theme-preference.js';

//
// what a component reads when nothing above it provides a theme: the light one,
// on the schedule, with nothing to toggle. Every page is drawn under the
// provider; this is for a component drawn on its own, as the test suites draw
// them.
//
// `scheduled` is the theme the clock gives now, which the switch reads to say
// whether pressing it asks for the rest of the day, or of the night, or goes back
// to the schedule.
//
const ThemeModeContext = React.createContext({ theme: 'light', scheduled: 'light', toggle: () => {} });

//
// mui's two themes. The light one is mui's own default, which is what every mui
// component on the site drew in before there was a dark one.
//
// The dark one takes the page's own colors, so a menu or a table mui draws sits
// on the page rather than on a slightly different black: its surfaces are the
// page's, and mui lightens a raised one -- a menu, a date picker -- by its
// elevation, as it would anywhere. Its text is the stylesheet's.
//
const MUI_THEMES = {
    light: createTheme(),
    dark: createTheme({
        palette: {
            mode: 'dark',
            background: { default: colors_dark['white-1'], paper: colors_dark['white-1'] },
            text: { primary: colors_dark['gray-8'], secondary: colors_dark['gray-6'] },
        },
    }),
};

//
// how long after a change is due the page looks again, in ms. A timer can fire a
// moment early, and one that did would find the old theme still due and wait out
// another twelve hours.
//
const SWITCH_SLACK = 1000;

//
// the theme, what the schedule gives, and when both could next change, at `now`
//
function standing(now) {
    return { theme: currentTheme(now), scheduled: scheduledTheme(now), until: nextSwitch(now) };
}

class ThemeMode extends Component {
    static propTypes = {
        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.state = standing(new Date());

        this.toggle = this.toggle.bind(this);
        this.recheck = this.recheck.bind(this);
        this.value = this.value.bind(this);
    }

    //
    // Note: a page left open in a tab the browser has put to sleep, or on a
    //       laptop that was closed, hears its timer late or not at all. It looks
    //       again whenever it is shown, as well as at the switch.
    //
    componentDidMount() {
        applyTheme(this.state.theme);
        this.schedule();
        document.addEventListener('visibilitychange', this.recheck);
    }

    componentWillUnmount() {
        clearTimeout(this.timer);
        document.removeEventListener('visibilitychange', this.recheck);
    }

    //
    // wake when the theme could next change, which is the schedule's next switch:
    // a choice lapses there too
    //
    schedule() {
        clearTimeout(this.timer);
        this.timer = setTimeout(this.recheck, Math.max(0, this.state.until.getTime() - Date.now()) + SWITCH_SLACK);
    }

    //
    // the theme as it stands now, put on the page where it has changed
    //
    recheck() {
        const now = standing(new Date());

        if (now.theme !== this.state.theme) {
            applyTheme(now.theme);
        }

        this.setState(now, () => this.schedule());
    }

    /**
     * the other theme, until the schedule's next switch -- or back to the
     * schedule, where the other theme is the one it gives.
     *
     * Note: the page changes whether or not the choice could be stored. Storage
     *       that refuses is a reader whose choice lasts only as long as this
     *       page, which is no reason to refuse them this one.
     */
    toggle() {
        const now = new Date();
        const next = this.state.theme === 'dark' ? 'light' : 'dark';

        writeTheme(next, now);
        applyTheme(next);
        this.setState({ theme: next });
    }

    //
    // one object per theme and schedule, so a component reading the context
    // draws again when either changes and not on every render of this one.
    //
    value() {
        const { theme, scheduled } = this.state;

        if (!this.provided || this.provided.theme !== theme || this.provided.scheduled !== scheduled) {
            this.provided = { theme: theme, scheduled: scheduled, toggle: this.toggle };
        }

        return this.provided;
    }

    render() {
        return (
            <ThemeModeContext.Provider value={this.value()}>
                <ThemeProvider theme={MUI_THEMES[this.state.theme]}>
                    {this.props.children}
                </ThemeProvider>
            </ThemeModeContext.Provider>
        );
    }
}

export default ThemeMode;

export { ThemeModeContext, MUI_THEMES, SWITCH_SLACK };
