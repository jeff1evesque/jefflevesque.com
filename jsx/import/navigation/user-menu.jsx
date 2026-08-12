/**
 * user-menu.jsx: menu for logged-in, and anonymous users.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import Auth from '@aws-amplify/auth';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Navbar, Nav, NavDropdown } from 'react-bootstrap';
import { BreakpointRender } from 'rearm/lib/Breakpoint';
import SvgHome from '../svg/svg-home.jsx';
import SvgUser from '../svg/svg-user.jsx';
import SvgBooks from '../svg/svg-books.jsx';
import { Link } from 'react-router-dom';
import setLogoutState from '../redux/action/logout.jsx';
import { breakpoints } from '../general/breakpoints.js';

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
            ajax_fail_error: null
        };

      // bind allows 'this' object reference
        this.handleClick = this.handleClick.bind(this);
        this.render = this.render.bind(this);
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
                <Navbar.Brand><Link to='/'><SvgHome /></Link></Navbar.Brand>
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
