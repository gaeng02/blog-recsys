import { useState } from 'react';
// import tagsData from '@/mock-data/tags';
import './PostTags.css';

function PostTags({ tagIds = [], onTagClick, clickable = true, tags = [] }) {
    // const [tags] = useState(tagsData);
    
    // tagIds 배열에서 실제 태그 객체들을 찾기
    const postTags = tags.filter(tag => tagIds.includes(tag.id));
    
    if (!postTags.length) {
        return null;
    }

    return (
        <div className="post-tags">
            {postTags.map((tag) => (
                <span
                    key={tag.id}
                    className={`post-tag ${clickable ? 'clickable' : ''}`}
                    onClick={() => clickable && onTagClick && onTagClick(tag.id)}
                >
                    {tag.name}
                </span>
            ))}
        </div>
    );
}

export default PostTags; 