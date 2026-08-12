/**
 * error-page.jsx: fallback error page for entire application.
 *
 * @HomePage, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import ErrorFallback from '../formatter/boundary-error.jsx';
import { ErrorBoundary } from 'react-error-boundary';

class ErrorPage extends Component {
    render() {
        return(
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <h3>404 - Not found</h3>
            </ErrorBoundary>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default ErrorPage;
