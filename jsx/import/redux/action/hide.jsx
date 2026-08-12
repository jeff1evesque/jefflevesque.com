/**
 * hide.jsx: send hide status to the redux store.
 *
 */


function setHide(obj) {
    if ('type' in obj && 'action' in obj) {
        if (obj['type'] === 'SET-HIDE-GRAPH') {
            return {
                type: obj['type'],
                hide_graph: obj['action']
            };
        } else if (obj['type'] === 'SET-HIDE-ALL') {
            return {
                type: obj['type'],
                hide_all: obj['action']
            };
        } else {
            return {
                type: 'SET-HIDE-ALL',
                hide_all: false
            };
        }
    } else {
        return {
            type: null
        };
    }
}

// indicate which class can be exported, and instantiated via 'require'
export {
    setHide
}
