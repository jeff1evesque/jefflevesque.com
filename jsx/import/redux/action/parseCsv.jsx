/**
 * parse.jsx: store parsed csv to the redux store.
 *
 */

function setParsedCsv(key, content) {
    return {
        key: key,
        content: content
    };
}

// indicate which class can be exported, and instantiated via 'require'
export {
    setParsedCsv
}
