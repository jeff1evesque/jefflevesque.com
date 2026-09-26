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
    readTheme,
    systemQuery,
    writeTheme,
} from './theme-preference.js';

//
// what a component reads when nothing above it provides a theme: the light one,
// with nothing to toggle. Every page is drawn under the provider; this is for a
// component drawn on its own, as the test suites draw them.
//
const ThemeModeContext = React.createContext({ theme: 'light', toggle: () => {} });

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

class ThemeMode extends Component {
    static propTypes = {
        children: PropTypes.node,
    }

    constructor(props) {
        super(props);

        this.state = { theme: currentTheme() };

        this.toggle = this.toggle.bind(this);
        this.followSystem = this.followSystem.bind(this);
        this.value = this.value.bind(this);
    }

    //
    // the system can change its mind while the page is open -- an evening
    // schedule, a reader flipping it in their settings -- and a page that is
    // following it should follow it then too. A page following the READER's
    // choice ignores it.
    //
    // Note: 'addListener' where 'addEventListener' is missing, which is Safari
    //       before 14 on a MediaQueryList.
    //
    componentDidMount() {
        applyTheme(this.state.theme);

        this.query = systemQuery();

        if (this.query) {
            if (typeof this.query.addEventListener === 'function') {
                this.query.addEventListener('change', this.followSystem);
            } else if (typeof this.query.addListener === 'function') {
                this.query.addListener(this.followSystem);
            }
        }
    }

    componentWillUnmount() {
        if (this.query) {
            if (typeof this.query.removeEventListener === 'function') {
                this.query.removeEventListener('change', this.followSystem);
            } else if (typeof this.query.removeListener === 'function') {
                this.query.removeListener(this.followSystem);
            }
        }
    }

    followSystem(event) {
        if (readTheme()) {
            return;
        }

        this.show(event.matches ? 'dark' : 'light');
    }

    /**
     * the other theme, kept as the reader's choice from now on.
     *
     * Note: the page changes whether or not the choice could be stored. Storage
     *       that refuses is a reader who will be asked again next visit, which is
     *       no reason to refuse them this one.
     */
    toggle() {
        const next = this.state.theme === 'dark' ? 'light' : 'dark';

        writeTheme(next);
        this.show(next);
    }

    show(theme) {
        applyTheme(theme);
        this.setState({ theme: theme });
    }

    //
    // one object per theme, so a component reading the context draws again when
    // the theme changes and not on every render of this one.
    //
    value() {
        const { theme } = this.state;

        if (!this.provided || this.provided.theme !== theme) {
            this.provided = { theme: theme, toggle: this.toggle };
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

export { ThemeModeContext, MUI_THEMES };
