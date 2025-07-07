import PostTags from './PostTags';
import './Item.css'

function Item({ id, image, title, created_at, views = 0, tags = [], onClick, allTags = [] }) {
    return <div className="item" onClick={onClick}>
        <div className="item-image">
            <img src={image} alt={title} />
        </div>
        <div className="item-info">
            <div className="item-title">
                {title}
            </div>
            <div className="item-bottom">
                <div className="item-meta">
                    <div className="item-date">
                        {created_at}
                    </div>
                    <div className="item-views">
                        👁️ {views}
                    </div>
                </div>
                <PostTags tagIds={tags} clickable={false} tags={allTags} />
            </div>
        </div>
    </div>
}

export default Item;