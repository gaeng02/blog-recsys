import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tag from '@/components/Tag';
import post from '@/mock-data/posts';
import Item from '@/components/Item';

const PAGE_SIZE = 9;

function Home() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);

  const startIdx = (page - 1) * PAGE_SIZE;
  const pagedItems = post.slice(startIdx, startIdx + PAGE_SIZE);

  const totalPages = Math.ceil(post.length / PAGE_SIZE);

  const handleItemClick = (id) => {
    navigate(`/post/${id}`);
  };

  return (
    <div className="home">
      <Tag />
      <div className="posts-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="posts-title">Posts</h2>
          <button
            style={{
              background: '#f1f5f9',
              color: '#2563eb',
              border: 'none',
              borderRadius: 8,
              padding: '7px 18px',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              marginLeft: 8
            }}
            onClick={() => navigate('/posts')}
          >
            모두 보기
          </button>
        </div>
      </div>
      <div className="item-container">
        {pagedItems.map((item) => (
          <Item key={item.id} {...item} onClick={() => handleItemClick(item.id)} />
        ))}
      </div>


      <div className="pagination">
        <button
          onClick={() => setPage(prev => Math.max(prev - 1, 1))}
          disabled={page === 1}
        >
          이전
        </button>

        <span>{page} / {totalPages}</span>

        <button
          onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
          disabled={page === totalPages}
        >
          다음
        </button>
      </div>

    </div>
  );
}

export default Home;