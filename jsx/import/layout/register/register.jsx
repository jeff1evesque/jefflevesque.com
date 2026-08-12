/**
 * register.jsx: general register layout.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import RegisterState from '../../redux/container/register.jsx';
import AccountType from './content/account-type.jsx';
import { BreakpointRender } from 'rearm/lib/Breakpoint';
import { breakpoints } from '../../general/breakpoints.js';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';

class RegisterLayout extends Component {
    render() {
        return(
            <BreakpointRender breakpoints={breakpoints} type='viewport'>{
                bp => (
                    <div className='container'>
                        <div className={bp.isGt('small') ? 'register-form' : 'register-form register-form-mobile'}>
                            <h1>{'Create your account'}</h1>
                            <ErrorBoundary FallbackComponent={ErrorFallback}>
                                <RegisterState />
                            </ErrorBoundary>
                        </div>
                        <AccountType />
                    </div>
                )
            }</BreakpointRender>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default RegisterLayout;
