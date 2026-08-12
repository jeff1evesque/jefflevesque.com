/**
 *
 * boundary_error.jsx, boundary error fallback for react components
 *
 */

import React from 'react';

function ErrorFallback({error}) {
    return (
        <div role='alert'>
            <p>Something went wrong:</p>
            <pre>{error.message}</pre>
        </div>
    );
}

// indicate which class can be exported, and instantiated via 'require'
export default ErrorFallback;
