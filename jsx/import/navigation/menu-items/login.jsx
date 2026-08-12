/**
 * login.jsx: login link markup.
 *
 * @LoginLink, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import { NavLink } from 'react-router-dom';
import checkValidString from '../../validator/valid-string.js';
import PropTypes from 'prop-types';

class LoginLink extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        path: PropTypes.string,
        text: PropTypes.string
    }

    constructor(props) {
        super(props);
        this.render = this.render.bind(this);

        if ('path' in this.props && checkValidString('path', this.props)) {
            var path = this.props.path;
        } else {
            var path = '/login';
        }

        if ('text' in this.props && checkValidString('text', this.props)) {
            var text = this.props.text;
        } else {
            var text = 'Login in';
        }

        this.state = {
            path: path,
            text: text
        }
    }

    // call back: return login button
    render() {
        return (
            <NavLink
                activeclassname='active'
                className='btn mn-2'
                to={this.state.path}
            >
                <span>{this.state.text}</span>
            </NavLink>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default LoginLink;
