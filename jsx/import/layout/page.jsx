/**
 * page.jsx: general page layout.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import Spinner from '../general/spinner.jsx';
import MainRoute from '../route/main-route.jsx';
import UserMenuState from '../redux/container/user-menu.jsx';
import HeaderMenuState from '../redux/container/header-menu.jsx';
import { BreakpointRender } from 'rearm/lib/Breakpoint';
import { breakpoints } from '../general/breakpoints.js';
import { isMobile } from 'react-device-detect';
import PropTypes from 'prop-types';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../formatter/boundary-error.jsx';
import { DOCUMENTATION, TERMS } from '../general/api-url.js';

//
// whose site this is, as the footer's copyright line names it (#202). One
// string, so a company formed later is a change here alone
//
const OWNER = 'Jeff Levesque';

//
// the year the site was first published, and the copyright's years from it to
// this one: '2026' while they are the same, '2026\u20132027' once they are not
// (#202)
//
const FIRST_YEAR = 2026;

export function copyrightYears(year = new Date().getFullYear()) {
    return year > FIRST_YEAR ? `${FIRST_YEAR}\u2013${year}` : `${FIRST_YEAR}`;
}

class PageLayout extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        effects: PropTypes.shape({
            spinner: PropTypes.bool.isRequired,
        }),
        user: PropTypes.shape({
            name: PropTypes.string.isRequired,
        }),
    }

    constructor() {
        super();
        this.getSpinner = this.getSpinner.bind(this);
    }

    getSpinner() {
        if (this.props && this.props.effects && this.props.effects.spinner) {
            return <Spinner />;
        }
        return null;
    }

    renderContent(bpoint) {
        // local variables
        const spinner = this.getSpinner();

        // validate username
        if (
            this.props &&
            this.props.user &&
            !!this.props.user.name &&
            this.props.user.name != 'anonymous'
        ) {
            var sideBar = <UserMenuState />;
            var authStatus = 'authenticated';
        } else {
            var sideBar = <div className={isMobile ? '' : 'container'}><HeaderMenuState /></div>;
            var authStatus = 'anonymous';
        }

        const device = isMobile ? 'mobile' : 'not-mobile';

        return (
            <div className={`${bpoint}-viewport container-fluid ${device}`}>
                <div className={authStatus}>
                    <div className='menu-container'>
                        {sideBar}
                    </div>
                    <div className='content'>
                        <MainRoute/>
                    </div>
                    {/*

                        every page's last line: the copyright, its years read from
                        the clock so they never need a hand, and the documentation
                        and the terms, each in a tab of its own as the api icons'
                        links are (#202)

                    */}
                    <footer className='site-footer'>
                        <span>{`\u00A9 ${copyrightYears()} ${OWNER}`}</span>
                        <a href={`${DOCUMENTATION}/`} target='_blank' rel='noopener noreferrer'>Docs</a>
                        <a href={TERMS} target='_blank' rel='noopener noreferrer'>Terms</a>
                    </footer>
                    {spinner}
                </div>
            </div>
        );
    }

    render() {
        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <BreakpointRender breakpoints={breakpoints} type='viewport'>
                    {bp => (
                        bp.isGt('medium')
                            ? this.renderContent('large')
                            : (
                                bp.isGt('small') && bp.isLte('medium')
                                    ? this.renderContent('medium')
                                    : this.renderContent('small')
                            )
                    )}
                </BreakpointRender>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default PageLayout;
