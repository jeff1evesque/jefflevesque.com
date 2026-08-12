/**
 * content.jsx: generate main content.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import Amplify from '@aws-amplify/core';
import awsconfig from './aws-exports';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import PageLayoutState from './import/redux/container/page.jsx';
import store from './import/redux/store.jsx';

// load react + amplify
Amplify.configure(awsconfig);

//
// An Object.entries polyfill guard was removed here. It read:
//
//     if (!Object.entries) { entries.shim(); }
//
// but `entries` was never imported and no object.entries package is in
// package.json, so on any engine actually missing Object.entries this threw a
// ReferenceError instead of polyfilling. Object.entries is ES2017 and is
// supported by every browser this app targets (it already relies on React 18),
// so the guard was dead on every engine that runs it and broken on the ones it
// was written for. If a polyfill is genuinely needed, add the `object.entries`
// package and import it here.
//

// render application
//
// @Provider, allows a common redux state tree, be accessible to all
//     connected react components, when integrated with a common 'store'. This
//     eliminates the hassle associated with passing properites between parent,
//     and children react components.
//
const root = createRoot(document.getElementById('bootstrap-override'));
root.render(
    <Provider store={store}>
        <React.StrictMode>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <PageLayoutState />
            </BrowserRouter>
        </React.StrictMode>
    </Provider>
);
