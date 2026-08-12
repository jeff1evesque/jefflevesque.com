/**
 * account.jsx: general account layout.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 */

import React, { Component } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';

class AccountLayout extends Component {
    render() {
        return(
            <div className='account'>
                <h1>My Profile</h1>
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                    Content
                </ErrorBoundary>
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default AccountLayout;
