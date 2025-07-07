import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Item from './Item';
import Pagination from './Pagination';
import { postsAPI } from '@/services/api';
import './Home.css';

function PostsList() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 9;

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags');
        const data = await res.json();
        setTags(data);
      } catch (e) {
        setTags([]);
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        setLoading(true);
        const allPosts = await postsAPI.getAllPosts();
        setPosts(
          allPosts
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(p => ({ ...p, id: p.post_id, tags: p.tags || [] }))
        );
        setError(null);
      } catch (err) {
        setError('게시글을 불러오는데 실패했습니다.');
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };
    loadPosts();
  }, []);

  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const endIndex = startIndex + postsPerPage;
  const currentPosts = posts.slice(startIndex, endIndex);

  const handleItemClick = (id) => {
    navigate(`/post/${id}`);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return <div className="home"><div className="loading-message">게시글을 불러오는 중...</div></div>;
  }
  if (error) {
    return <div className="home"><div className="error-message">{error}</div></div>;
  }
  if (currentPosts.length === 0) {
    return <div className="home"><div className="empty-message">게시글이 없습니다.</div></div>;
  }

  return (
    <div className="home">
      <div className="posts-section" style={{ marginTop: 36 }}>
        <h2 className="posts-title">전체 게시글</h2>
        <div className="item-container">
          {currentPosts.map((item) => (
            <Item
              key={item.id}
              {...item}
              onClick={() => handleItemClick(item.id)}
              allTags={tags}
            />
          ))}
        </div>
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}

export default PostsList; 