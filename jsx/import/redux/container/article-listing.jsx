/**
 * article-listing.jsx: redux store for articles.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { connect } from 'react-redux';
import ArticleListing from '../../general/article-listing.jsx';
import { setArticleProp } from '../action/article.jsx';

// wraps each function of the object to be dispatch callable
const mapDispatchToProps = (dispatch) => {
    return {
        dispatchArticleProp: dispatch.bind(setArticleProp)
    }
}

// pass selected properties from redux state tree to component
const ArticleListingState = connect(
    null,
    mapDispatchToProps
)(ArticleListing)

// indicate which class can be exported, and instantiated via 'require'
export default ArticleListingState
