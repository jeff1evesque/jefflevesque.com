/**
 * page.jsx: send current support vector 'submit button' boolean, indication
 *           whether it should be displayed to the redux store.
 *
 */

function setLayout(action) {
    return {
        type: 'SET-LAYOUT',
        layout: action.layout
    };
}

function setContentType(action) {
    return {
        type: 'SET-CONTENT-TYPE',
        content_type: action.layout
    };
}

function setSpinner(action) {
    return {
        type: 'SET-SPINNER',
        spinner: action.spinner
    };
}

// indicate which class can be exported, and instantiated via 'require'
export {
    setLayout,
    setContentType,
    setSpinner
}
