import { useState } from 'react';
// import tagsData from '@/mock-data/tags';
import './Tag.css';

function Tag({ onTagClick, selectedTag, tags = [] }) {
    console.log('Tag 컴포넌트 tags:', tags); // 디버깅용
    if (!tags.length) {
        return <div className="tag">태그가 없습니다.</div>;
    }
    // const [tags] = useState(tagsData);
    return (
        <div className="tag">
            <div className="tag-title">
                Tags
            </div>
            <div className="tag-items">
                {tags.map((tag) => (
                    <button
                        key={tag.id}
                        className={`tag-item ${selectedTag === tag.id ? 'active' : ''}`}
                        onClick={() => onTagClick && onTagClick(tag.id)}
                    >
                        <span className="tag-name" style={{fontWeight:600, fontSize:'1.08rem'}}>{tag.name}</span>
                        {tag.count !== undefined && tag.count > 0 && (
                          <span className="tag-count" style={{marginLeft:6, color:'#94a3b8', fontSize:'0.98rem'}}>({tag.count})</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default Tag;