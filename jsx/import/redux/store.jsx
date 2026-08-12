/**
 * store.jsx: create consistent redux state tree.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 * Note: when debugging in this script, either implement 'middleware', or add
 *       the following after the 'store' definition:
 *
 *       // manual console trace
 *         store.subscribe(() => {
 *             console.log('store changed', store.getState());
 *         })
 *
 */

import { createStore, combineReducers } from 'redux';
import user from './reducer/login.jsx';
import layout from './reducer/layout.jsx';
import page from './reducer/page.jsx';
import article from './reducer/article.jsx';
import hide from './reducer/hide.jsx';
import amplifyCurrentUser from '../general/currentUser.js';

// username from sessionStorage
const username = !!amplifyCurrentUser ? sessionStorage.getItem('username') : 'anonymous';

// create and initialize redux
const store = createStore(combineReducers({user, page, layout, article, hide}), {
    user: {name: username},
    page: {status: 'default'}
});

// indicate which class can be exported, and instantiated via 'require'
export default store
