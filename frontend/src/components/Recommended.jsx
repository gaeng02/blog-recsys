import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Item.css';

function getItemId(item) {
  return item.id !== undefined ? item.id : item.post_id;
}

function getRandomItems(data, excludeId, count) {
  const filtered = data.filter(item => getItemId(item) !== excludeId);
  const shuffled = filtered.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getTagNames(tagIds, allTags) {
  if (!Array.isArray(tagIds) || !Array.isArray(allTags)) return [];
  return tagIds.map(id => {
    const tag = allTags.find(t => t.id === id);
    return tag ? tag.name : id;
  });
}

function Recommended({ data, excludeId, count, allTags }) {
  const items = getRandomItems(data, excludeId, count);
  const navigate = useNavigate();
  if (!items.length) return <div style={{color:'#888',margin:'16px 0'}}>추천 게시글이 없습니다.</div>;
  return (
    <div className="recommended-list" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)', 
      gap: '16px',
      maxWidth: '100%'
    }}>
      {items.map(item => {
        const id = getItemId(item);
        return (
          <div
            key={id}
            className="item"
            onClick={() => {
              try {
                navigate(`/post/${id}`);
              } catch (e) {
                window.location.href = `/post/${id}`;
              }
            }}
            style={{ minWidth: 0 }}
          >
            <div className="item-image">
              <img src={item.image || 'https://via.placeholder.com/320x180'} alt={item.title} />
            </div>
            <div className="item-info">
              <div className="item-title">{item.title}</div>
              <div className="item-bottom">
                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {getTagNames(item.tags, allTags).map(tagName => (
                      <span key={tagName} style={{
                        background: '#e0e7ef',
                        color: '#2563eb',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        padding: '2px 6px',
                        fontWeight: '500'
                      }}>
                        #{tagName}
                      </span>
                    ))}
                  </div>
                )}
                <div className="item-date">{item.created_at}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Recommended; 