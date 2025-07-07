import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
// import data from '@/mock-data/posts';
import './PostDetail.css';
import Recommended from './Recommended';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useInteraction } from '@/hooks/useInteraction';
import { postsAPI } from '@/services/api';
import PostTags from './PostTags';

function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState([]);
  const [recs, setRecs] = useState([]);
  const [recTotal, setRecTotal] = useState(0);
  const [recPage, setRecPage] = useState(1);
  const recPageSize = 3;
  // 인터랙션 추적 훅 사용
  const { logLike, logComment } = useInteraction(parseInt(id));

  // 태그 목록 API 연동
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

  // 게시글 데이터 로드
  useEffect(() => {
    const loadPost = async () => {
      try {
        setLoading(true);
        console.log('게시글 불러오기 시작:', id);
        // 실제 API 사용
        const apiPost = await postsAPI.getPost(parseInt(id));
        console.log('API 응답:', apiPost);
        if (apiPost && Object.keys(apiPost).length > 0) {
          setPost({
            ...apiPost,
            id: apiPost.post_id,
            tags: apiPost.tags || []
          });
          
          // 조회수 증가 API 호출
          try {
            await fetch(`/api/posts/${id}/view`, { method: 'POST' });
          } catch (viewError) {
            console.log('조회수 증가 실패:', viewError);
          }
        } else {
          console.log('게시글을 찾을 수 없음:', id);
          setError('포스트를 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('게시글 불러오기 실패:', err);
        setError('포스트를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadPost();
  }, [id]);

  // 추천 포스트 API 연동 (페이지네이션)
  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const userId = 1; // 실제 로그인 사용자 ID로 대체
        // 관련 포스트 API (페이지네이션)
        const response = await fetch(`/api/posts/${id}/related?user_id=${userId}&page=${recPage}&page_size=${recPageSize}`);
        const related = await response.json();
        setRecs(related.posts || []);
        setRecTotal(related.total || 0);
      } catch (e) {
        setRecs([]);
        setRecTotal(0);
      }
    };
    fetchRecs();
  }, [id, recPage]);

  const handleLike = async () => {
    await logLike();
    // 여기에 UI 업데이트 로직 추가 가능
  };

  const handleComment = async () => {
    await logComment();
    // 여기에 댓글 작성 모달 또는 페이지로 이동 로직 추가 가능
  };

  const handleDelete = async () => {
    if (window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      try {
        await postsAPI.deletePost(parseInt(id));
        alert('게시글이 삭제되었습니다.');
        navigate('/');
      } catch (error) {
        alert('게시글 삭제에 실패했습니다.');
        console.error('삭제 오류:', error);
      }
    }
  };

  const handleTagClick = (tagId) => {
    // 태그 클릭 시 해당 태그로 필터링된 홈페이지로 이동
    navigate(`/?tag=${tagId}`);
  };

  // 추천 페이지네이션 렌더링 (이전/다음, ... 처리, 중복 제거)
  const recTotalPages = Math.ceil(recTotal / recPageSize);
  function getPagination(current, total) {
    let pages = [];
    if (total <= 5) {
      pages = Array.from({ length: total }, (_, i) => i + 1);
    } else if (current <= 3) {
      pages = [1, 2, 3, 4, 5, '...', total];
    } else if (current >= total - 2) {
      pages = [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    } else {
      pages = [1, '...', current - 1, current, current + 1, '...', total];
    }
    // 1~total 범위 내 숫자만, 중복 없이, 오름차순 정렬
    return pages.filter((v, i, arr) =>
      v === '...'
      || (typeof v === 'number' && v >= 1 && v <= total && arr.indexOf(v) === i)
    );
  }
  const recPages = getPagination(recPage, recTotalPages);

  if (loading) {
    return (
      <div className="post-detail">
        <div className="loading-message">포스트를 불러오는 중...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="post-detail">
        <div className="error-message">{error || '포스트를 찾을 수 없습니다.'}</div>
        <button onClick={() => navigate('/')} className="submit-button">홈으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="post-detail">
      <div className="post-header">
        <button className="back-button" onClick={() => navigate('/')}>← 뒤로가기</button>
        <h1>{post.title}</h1>
        <div className="post-meta">
          <p className="post-date">{post.created_at}</p>
          <p className="post-views">👁️ 조회수 {post.views || 0}</p>
        </div>
        {/* 인터랙션 버튼들 */}
        <div className="post-actions">
          <button className="action-button like-button" onClick={handleLike}>👍 좋아요</button>
          <button className="action-button comment-button" onClick={handleComment}>💬 댓글</button>
          <button 
            className="action-button edit-button" 
            onClick={() => navigate(`/edit/${id}`)}
          >
            ✏️ 수정
          </button>
          <button 
            className="action-button delete-button" 
            onClick={handleDelete}
          >
            🗑️ 삭제
          </button>
        </div>
      </div>
      <div className="post-content">
        <div className="post-image">
          <img src={post.image || 'https://via.placeholder.com/600x400'} alt={post.title} />
        </div>
        <div className="post-description">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>
        {/* 태그 표시 */}
        <PostTags tagIds={post.tags || []} onTagClick={handleTagClick} tags={tags} />
      </div>
      {/* 추천 게시글 */}
      <div style={{ marginTop: 40 }}>
        <Recommended data={recs} excludeId={Number(id)} count={3} allTags={tags} />
        {/* 페이지네이션 */}
        {recTotalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {recPage > 1 && (
              <button
                className="rec-page-btn"
                onClick={() => setRecPage(recPage - 1)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1.5px solid #e0e0e0',
                  background: '#fff',
                  color: '#333',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: 15,
                  transition: 'all 0.2s',
                }}
              >
                이전
              </button>
            )}
            {recPages.map((page, idx) =>
              page === '...'
                ? <span key={idx} style={{ padding: '6px 10px', color: '#aaa', fontSize: 15 }}>...</span>
                : <button
                    key={page}
                    className={`rec-page-btn${recPage === page ? ' active' : ''}`}
                    onClick={() => setRecPage(page)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: '1.5px solid #e0e0e0',
                      background: recPage === page ? '#3b82f6' : '#fff',
                      color: recPage === page ? '#fff' : '#333',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontSize: 15,
                      transition: 'all 0.2s',
                    }}
                  >
                    {page}
                  </button>
            )}
            {recPage < recTotalPages && (
              <button
                className="rec-page-btn"
                onClick={() => setRecPage(recPage + 1)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1.5px solid #e0e0e0',
                  background: '#fff',
                  color: '#333',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: 15,
                  transition: 'all 0.2s',
                }}
              >
                다음
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PostDetail; 