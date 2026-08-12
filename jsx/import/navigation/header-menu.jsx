/**
 * header-menu.jsx: anonymous users.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import SvgHome from '../svg/svg-home.jsx';
import SvgBooks from '../svg/svg-books.jsx';
import SvgUser from '../svg/svg-user.jsx';
import SvgPencilNote from '../svg/svg-pencil-note.jsx';
import { Link, NavLink } from 'react-router-dom'
import HomeLink from './menu-items/home.jsx';
import LoginLinkState from '../redux/container/login-link.jsx';
import RegisterLinkState from '../redux/container/register-link.jsx';
import { Navbar, Nav, NavDropdown } from 'react-bootstrap';
import { BreakpointRender } from 'rearm/lib/Breakpoint';
import { breakpoints } from '../general/breakpoints.js';
import PropTypes from 'prop-types';

class HeaderMenu extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        layout: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.shape({
                type: PropTypes.string,
            })
        ])
    }

    showDesktopHeader() {
        return (
            <Navbar collapseOnSelect expand='lg' className='main-navigation menu-home-desktop'>
                <div className='row main-navigation-row'>
                    <div className='col-sm-2 home'>
                        <Navbar.Brand><Link to='/'><SvgHome /></Link></Navbar.Brand>
                    </div>
                    <div className='col'>
                        <div className='row'>
                            <div className='col'>
                                <Nav>
                                    <div>
                                        <span className='border-oval-radius'>
                                            <NavLink className='main-navigation-large' to='/data'>Data</NavLink>
                                        </span>
                                        <span className='horizontal-spacer'>|</span>
                                        <span className='border-oval-radius'>
                                            <NavLink className='main-navigation-large' to='/stream'>Stream</NavLink>
                                        </span>
                                        <span className='horizontal-spacer'>|</span>
                                        <span className='border-oval-radius'>
                                            <NavLink className='main-navigation-large' to='/model'>Model</NavLink>
                                        </span>
                                    </div>
                                </Nav>
                            </div>
                            <div className='col-sm-5'>
                                <LoginLinkState />
                                <RegisterLinkState />
                            </div>
                        </div>
                    </div>
                </div>
            </Navbar>
        )
    }

    showMobileHeader() {
        const session = (
            <span>
                <span><SvgBooks /></span>
                <span className='menu-label'>{'Session'}</span>
            </span>
        );

        return (
            <Navbar collapseOnSelect expand='lg' className='main-navigation menu-home menu-home-mobile'>
                <Navbar.Brand><Link to='/'><SvgHome /></Link></Navbar.Brand>
                <Navbar.Toggle aria-controls='basic-navbar-nav' />
                <Navbar.Collapse id='mr-auto'>
                    <NavDropdown
                        id='basic-nav-dropdown'
                        className='session'
                        title={session}
                    >
                        <NavDropdown.Item href='/data'>{'Data'}</NavDropdown.Item>
                        <NavDropdown.Item href='/stream'>{'Stream'}</NavDropdown.Item>
                        <NavDropdown.Item href='/model'>{'Model'}</NavDropdown.Item>
                    </NavDropdown>
                    <Nav>
                        <Link to='/login' className='login'>
                            <div className='nav-item'>
                                <span><SvgUser /></span>
                                <span className='menu-label'>{'Login'}</span>
                            </div>
                        </Link>
                        <Link to='/register' className='register'>
                            <div className='nav-item'>
                                <span><SvgPencilNote /></span>
                                <span className='menu-label'>{'Register'}</span>
                            </div>
                        </Link>
                    </Nav>
                </Navbar.Collapse>
            </Navbar>
        )
    }
    renderContent() {
        const desktopMenu = this.showDesktopHeader();
        const mobileMenu = this.showMobileHeader();

        if (
            !!this.props &&
            !!this.props.layout &&
            !!this.props.layout.type &&
            this.props.layout.type == 'login'
        ) {
            return (
                <nav className='main-navigation menu-login'>
                    <div className='col-sm-12'><HomeLink /></div>
                </nav>
            );
        } else if (
            !!this.props &&
            !!this.props.layout &&
            !!this.props.layout.type &&
            this.props.layout.type == 'register'
        ) {
            return (
                <nav className='main-navigation menu-register'>
                    <div className='col-sm-12'>
                        <HomeLink />
                        <LoginLinkState />
                    </div>
                </nav>
            );
        }
        return (
            <BreakpointRender
                breakpoints={breakpoints}
                type='viewport'
            >
                {bp => ( bp.isGt('small') ? desktopMenu : mobileMenu )}
            </BreakpointRender>
        );
    }
    // display result
    render() {
        const selectedContent = this.renderContent();
        return (selectedContent);
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default HeaderMenu;
