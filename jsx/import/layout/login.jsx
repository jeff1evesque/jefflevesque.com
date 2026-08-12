/**
 * login.jsx: general login layout.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import LoginState from '../redux/container/login.jsx';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../formatter/boundary-error.jsx';

class LoginLayout extends Component {
    render() {
        return (
            <div className='login-form'>
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                    <LoginState />
                </ErrorBoundary>
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default LoginLayout;
