/**
 * user-menu.jsx: menu for logged-in, and anonymous users.
 *
 * The menu under a signed-in reader's name links to each options model's picks,
 * under an "Option picks" heading (#290): one item for every options model the
 * model api's listing has that is still trained, by its name, so one added or
 * retired comes or goes on its own. The picks are for signed-in readers, and this
 * menu is drawn only for them.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import Auth from '@aws-amplify/auth';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Navbar, Nav, NavDropdown } from 'react-bootstrap';
import { BreakpointRender } from 'rearm/lib/Breakpoint';
import SvgUser from '../svg/svg-user.jsx';
import SvgBooks from '../svg/svg-books.jsx';
import { HomeBrand } from './menu-items/home.jsx';
import ThemeToggle from './theme-toggle.jsx';
import setLogoutState from '../redux/action/logout.jsx';
import { breakpoints } from '../general/breakpoints.js';
import { loadListing } from '../layout/model/source.js';
import { statusOf, tradesOptions } from '../layout/model/scores.js';

/**
 * the options models whose picks the menu links to (#290): every one the listing
 * has that is still trained and not taken down, by name. A model taken down
 * makes no picks, and its last ones are not this night's (#295). None where the
 * listing could not be had.
 */
export function pickModels(listing) {
    if (!listing) {
        return [];
    }

    return listing.models
        .filter((model) => statusOf(model) !== 'retired' && statusOf(model) !== 'down'
            && tradesOptions(listing.tasks.find((task) => task.id === model.task) || { id: model.task }))
        .map((model) => model.name)
        .sort();
}

class UserMenu extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        dispatchLogout: PropTypes.func,
        history: PropTypes.shape({
            push: PropTypes.func.isRequired,
        }),
        location: PropTypes.shape({
            pathname: PropTypes.string.isRequired,
        }),
        user: PropTypes.shape({
            name: PropTypes.string.isRequired,
        }),
    }

    constructor(props) {
      //
      // @super is required when constructor defined
      // @props argument is fed into super, only if 'this.props' used in constructor
      // @this.props, works throughout class, regardless of above 'props' argument
      //     - requires callback to be binded to 'this'
      //
        super(props);
        this.state = {
            ajax_done_error: null,
            ajax_fail_error: null,
            // the options models whose picks the menu links to (#290): none
            // until the listing names them
            pick_models: [],
        };

      // bind allows 'this' object reference
        this.handleClick = this.handleClick.bind(this);
        this.render = this.render.bind(this);
    }

    componentDidMount() {
        this.alive = true;

        //
        // the options models, for the links to their picks (#290): asked once,
        // when the menu is first drawn
        //
        loadListing().then((listing) => {
            if (this.alive) {
                this.setState({ pick_models: pickModels(listing) });
            }
        });
    }

    componentWillUnmount() {
        this.alive = false;
    }

    //
    // the links to each options model's picks (#290), under their heading and
    // after a rule, and on a phone's menu, which has no rule before signing out,
    // `closed` with one after them too. Nothing until the listing names one
    //
    optionPicks(closed = false) {
        const names = this.state.pick_models;

        if (!names.length) {
            return null;
        }

        return [
            <NavDropdown.Divider key='picks-rule' />,
            <NavDropdown.Header key='picks-heading'>Option picks</NavDropdown.Header>,
        ].concat(
            names.map((name) => (
                <NavDropdown.Item key={`picks-${name}`} href={`/model/${encodeURIComponent(name)}/picks`}>{name}</NavDropdown.Item>
            )),
            closed ? [<NavDropdown.Divider key='picks-end' />] : [],
        );
    }

    async handleClick(event) {
        {/*

            Note: allow override '/logout' with '/login' via window.location.href

        */}

        event.preventDefault();

        const action = setLogoutState();
        this.props.dispatchLogout(action);
        sessionStorage.removeItem('username');

        try {
            await Auth.signOut();
            window.location.href = '/login';
        } catch (error) {
            console.log('error signing out: ', error);
        }
    }

    getCurrentUser() {
        if (
            this.props &&
            this.props.user &&
            !!this.props.user.name &&
            this.props.user.name != 'anonymous'
        ) {
            var user = this.props.user.name;
        }
        else {
            var user = 'anonymous';
        }

        return user;
    }

    getSessionDropdown(title) {
        return (
            <Nav className='justify-content-end'>
                <NavDropdown
                    id='basic-nav-dropdown'
                    title={title}
                >
                    <NavDropdown.Item href='/session/data-new'>Add new data</NavDropdown.Item>
                    <NavDropdown.Item href='/session/data-append'>Append data</NavDropdown.Item>
                    <NavDropdown.Item href='/session/model-generate'>Generate model</NavDropdown.Item>
                    <NavDropdown.Item href='/session/model-predict'>Make prediction</NavDropdown.Item>
                </NavDropdown>
            </Nav>
        )
    }

    showDesktopUserDropdown() {
        const user = this.getCurrentUser();
        const sessionDropdown = this.getSessionDropdown(<SvgBooks />);

        return (
            <Navbar.Collapse className='justify-content-end'>
                <ThemeToggle className='theme-toggle-bar' />
                <Nav>
                    <NavDropdown
                        className='svg-dropdown-user'
                        id='basic-nav-dropdown'
                        title={<SvgUser />}
                    >
                        <Nav.Link eventKey='disabled' disabled>{`Welcome ${user}!`}</Nav.Link>
                        <NavDropdown.Divider />
                        <NavDropdown.Item href={`/${user}`}>My Profile</NavDropdown.Item>
                        <NavDropdown.Item href={`/${user}/settings`}>Account Settings</NavDropdown.Item>
                        {this.optionPicks()}
                        <NavDropdown.Divider />
                        <NavDropdown.Item
                            onClick={this.handleClick}
                            href='/logout'
                        >
                            Sign out
                        </NavDropdown.Item>
                    </NavDropdown>
                </Nav>
                {sessionDropdown}
            </Navbar.Collapse>
        )
    }

    showMobileUserDropdown() {
        const user = this.getCurrentUser();
        const title = (
            <span>
                <span><SvgUser /></span>
                <span className='menu-label'>{user}</span>
            </span>
        );
        const session = (
            <span>
                <span><SvgBooks /></span>
                <span className='menu-label'>{'Session'}</span>
            </span>
        );
        const sessionDropdown = this.getSessionDropdown(session);

        return (
            <Navbar.Collapse className='justify-content-end responsive-navbar-nav'>
                <Nav>
                    <NavDropdown id='basic-nav-dropdown' title={title}>
                        <NavDropdown.Item href={`/${user}`}>My Profile</NavDropdown.Item>
                        <NavDropdown.Item href={`/${user}/settings`}>Account Settings</NavDropdown.Item>
                        {this.optionPicks(true)}
                        <NavDropdown.Item
                            onClick={this.handleClick}
                            href='/logout'
                        >
                            Sign out
                        </NavDropdown.Item>
                    </NavDropdown>
                </Nav>
                {sessionDropdown}
            </Navbar.Collapse>
        )
    }

    render() {
        const userDesktopDropdown = this.showDesktopUserDropdown();
        const userMobileDropdown = this.showMobileUserDropdown();

        return(
            <Navbar collapseOnSelect expand='lg' variant='light'>
                <Navbar.Brand><HomeBrand /></Navbar.Brand>
                {/*

                    the theme switch sits on the bar beside the button that
                    opens the menu, where a narrow screen has one. A wide one
                    has no such button, and draws it beside the user's menu
                    instead -- see showDesktopUserDropdown.

                */}
                <BreakpointRender breakpoints={breakpoints} type='viewport'>
                    {bp => (bp.isGt('medium') ? null : <ThemeToggle className='theme-toggle-bar' />)}
                </BreakpointRender>
                <Navbar.Toggle aria-controls='basic-navbar-nav' />
                <BreakpointRender breakpoints={breakpoints} type='viewport'>
                    {bp => (
                        bp.isGt('medium')
                            ? userDesktopDropdown
                            : userMobileDropdown
                    )}
                </BreakpointRender>
            </Navbar>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default UserMenu;
