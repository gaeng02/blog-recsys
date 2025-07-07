import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Item from '@/components/Item';
import Tag from '@/components/Tag';
import { dashboardAPI } from '@/services/api';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTag, setSelectedTag] = useState(null);
  const [recommendedPosts, setRecommendedPosts] = useState([]);
  const [latestPosts, setLatestPosts] = useState([]);
  const [popularPosts, setPopularPosts] = useState([]);
  const [recommendLoading, setRecommendLoading] = useState(true);
  const [latestLoading, setLatestLoading] = useState(true);
  const [popularLoading, setPopularLoading] = useState(true);
  const [tags, setTags] = useState([]);
  const [similarity, setSimilarity] = useState(null);
  const [similarTag, setSimilarTag] = useState(null);
  const [postSimilarities, setPostSimilarities] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 9;
  
  // 현재 사용자 ID (실제로는 로그인 시스템에서 가져와야 함)
  const userId = 1;

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

  // 모든 추천 데이터를 한 번에 로드
  useEffect(() => {
    const loadAllRecommendations = async () => {
      try {
        setRecommendLoading(true);
        setLatestLoading(true);
        setPopularLoading(true);
        
        // 추천 시스템 사용 (한 번만 호출)
        try {
          const recommendations = await fetch(`/api/recommendations/${userId}`);
          const data = await recommendations.json();
          
          // 사용자 기반 추천 3개
          const userBasedPosts = (data.user_based || []).slice(0, 3);
          const fallbackPosts = (data.latest || []).slice(0, 3);
          const finalPosts = userBasedPosts.length > 0 ? userBasedPosts : fallbackPosts;
          
          setRecommendedPosts(finalPosts.map((p, idx) => ({
            ...p,
            id: p.post_id,
            tags: p.tags || [],
            similarity: data.post_similarities ? data.post_similarities[idx] : null
          })));
          setSimilarity(data.similarity);
          setSimilarTag(data.tag_name);
          setPostSimilarities(data.post_similarities || []);
          // 최신 게시글 3개
          const latest = (data.latest || []).slice(0, 3);
          setLatestPosts(latest.map(p => ({
            ...p,
            id: p.post_id,
            tags: p.tags || []
          })));
          
          // 인기 게시글 3개
          const popular = (data.popular || []).slice(0, 3);
          setPopularPosts(popular.map(p => ({
            ...p,
            id: p.post_id,
            tags: p.tags || []
          })));
          
        } catch (recError) {
          console.log('추천 시스템 오류, 대시보드 API 사용:', recError);
          // 추천 시스템 실패 시 기존 대시보드 API 사용
          const dashboardData = await dashboardAPI.getDashboard(userId);
          const userBasedPosts = (dashboardData.user_recs || []).slice(0, 3);
          
          setRecommendedPosts(userBasedPosts.map((p, idx) => ({
            ...p,
            id: p.post_id,
            tags: p.tags || [],
            similarity: null
          })));
          setPostSimilarities([]);
          
          setLatestPosts((dashboardData.latest || []).map(p => ({
            ...p,
            id: p.post_id,
            tags: p.tags || []
          })));
          
          setPopularPosts((dashboardData.popular || []).map(p => ({
            ...p,
            id: p.post_id,
            tags: p.tags || []
          })));
          setSimilarity(null);
          setSimilarTag(null);
        }
      } catch (err) {
        console.log('추천 게시글 로드 실패:', err);
        setRecommendedPosts([]);
        setLatestPosts([]);
        setPopularPosts([]);
        setSimilarity(null);
        setSimilarTag(null);
      } finally {
        setRecommendLoading(false);
        setLatestLoading(false);
        setPopularLoading(false);
      }
    };
    
    loadAllRecommendations();
  }, [userId]);

  // URL 파라미터에서 태그 ID 가져오기
  useEffect(() => {
    const tagParam = searchParams.get('tag');
    if (tagParam) {
      setSelectedTag(parseInt(tagParam));
    } else {
      setSelectedTag(null);
    }
  }, [searchParams]);

  // 태그 클릭 시 해당 태그 게시글만 API로 불러오기
  useEffect(() => {
    if (selectedTag) {
      console.log('태그별 게시글 불러오기:', selectedTag);
      fetch(`/api/posts?tag=${selectedTag}`)
        .then(res => res.json())
        .then(data => {
          console.log('태그별 게시글 데이터:', data);
          setFilteredPosts(data);
          setCurrentPage(1); // 태그 바뀌면 1페이지로
        })
        .catch(err => {
          console.error('태그별 게시글 불러오기 실패:', err);
        });
    }
  }, [selectedTag]);

  const handleItemClick = (id) => {
    console.log('게시글 클릭:', id);
    navigate(`/post/${id}`);
  };

  const handleTagClick = (tagId) => {
    setSelectedTag(selectedTag === tagId ? null : tagId);
    // URL 업데이트
    if (selectedTag === tagId) {
      navigate('/');
    } else {
      navigate(`/?tag=${tagId}`);
    }
  };

  // 태그 목록을 count 기준 내림차순 정렬
  const sortedTags = [...tags].sort((a, b) => (b.count || 0) - (a.count || 0));

  // 페이지네이션 계산
  const postsToShow = selectedTag ? filteredPosts : [...recommendedPosts, ...latestPosts, ...popularPosts];
  const totalPages = Math.ceil(postsToShow.length / postsPerPage);
  const startIdx = (currentPage - 1) * postsPerPage;
  const endIdx = startIdx + postsPerPage;
  const currentPosts = postsToShow.slice(startIdx, endIdx);

  // 페이지네이션 버튼 생성
  const getPagination = () => {
    let pages = [];
    if (totalPages <= 5) {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (currentPage <= 3) {
      pages = [1, 2, 3, 4, 5];
    } else if (currentPage >= totalPages - 2) {
      pages = [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }
    // 중복 제거 (특히 currentPage가 1, totalPages와 겹칠 때)
    return pages.filter((v, i, arr) => arr.indexOf(v) === i);
  };

  const pagination = getPagination();

  return (
    <div className="home">
      <Tag onTagClick={handleTagClick} selectedTag={selectedTag} tags={sortedTags} />
      {/* Posts 제목과 모두보기 버튼 */}
      {!selectedTag && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
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
      )}

      {/* 태그 필터링된 게시글만 3x3+페이지네이션 */}
      {selectedTag ? (
        <div className="filtered-section">
          <h2 className="posts-title" style={{ fontSize: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '999px',
              padding: '4px 18px',
              fontWeight: 700,
              fontSize: 24,
              marginRight: 8,
              letterSpacing: '0.5px',
              boxShadow: '0 1px 4px #e0e7ef44',
              verticalAlign: 'middle',
              lineHeight: '32px'
            }}>
              #{tags.find(t => t.id === selectedTag)?.name}
            </span>
            태그가 포함된 게시글
          </h2>
          <div className="item-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {currentPosts.length > 0 ? (
              currentPosts.map(item => (
                <Item
                  key={item.post_id || item.id}
                  {...item}
                  onClick={() => handleItemClick(item.post_id || item.id)}
                  allTags={tags}
                />
              ))
            ) : (
              <div className="empty-message">해당 태그의 게시글이 없습니다.</div>
            )}
          </div>
          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '32px 0 0 0' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: currentPage === 1 ? '#f1f5f9' : '#fff', color: '#2563eb', fontWeight: 600, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                이전
              </button>
              {pagination.map(page =>
                page === '...'
                  ? (
                    <span
                      key={`ellipsis-${Math.random()}`}
                      style={{
                        display: 'inline-block',
                        minWidth: 32,
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontWeight: 700,
                        fontSize: 18,
                        lineHeight: '32px'
                      }}
                    >…</span>
                  )
                  : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        background: currentPage === page ? '#2563eb' : '#fff',
                        color: currentPage === page ? '#fff' : '#2563eb',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {page}
                    </button>
                  )
              )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: currentPage === totalPages ? '#f1f5f9' : '#fff', color: '#2563eb', fontWeight: 600, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                다음
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 추천 3개 */}
          <div className="recommended-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <h2 className="posts-title">
                당신을 위한 추천
                {similarTag && similarity !== null && (
                  <span style={{ fontSize: 15, color: '#e0e7ef', marginLeft: 12 }}>
                    ({similarTag} 태그와 유사도: {similarity?.toFixed(4)})
                  </span>
                )}
              </h2>
              {recommendLoading && (
                <span style={{ color: '#64748b', fontSize: 14 }}>추천 중...</span>
              )}
            </div>
            {recommendLoading ? (
              <div className="loading-message">추천 게시글을 불러오는 중...</div>
            ) : recommendedPosts.length > 0 ? (
              <div className="item-container recommended-container">
                {recommendedPosts.map((item, idx) => (
                  <div key={item.id} style={{ width: '100%' }}>
                    {item.similarity !== null && (
                      <div style={{ color: '#222', fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
                        유사도: {item.similarity?.toFixed(4)}
                      </div>
                    )}
                    <Item 
                      {...item} 
                      onClick={() => handleItemClick(item.id)} 
                      allTags={tags}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-message">추천할 게시글이 없습니다.</div>
            )}
          </div>
          {/* 최신 게시글 3개 */}
          <div className="latest-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <h2 className="posts-title">최신 게시글</h2>
              {latestLoading && (
                <span style={{ color: '#64748b', fontSize: 14 }}>로딩 중...</span>
              )}
            </div>
            {latestLoading ? (
              <div className="loading-message">최신 게시글을 불러오는 중...</div>
            ) : latestPosts.length > 0 ? (
              <div className="item-container latest-container">
                {latestPosts.map((item) => (
                  <Item 
                    key={item.id} 
                    {...item} 
                    onClick={() => handleItemClick(item.id)} 
                    allTags={tags}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-message">최신 게시글이 없습니다.</div>
            )}
          </div>
          {/* 인기 게시글 3개 */}
          <div className="popular-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <h2 className="posts-title">인기 게시글</h2>
              {popularLoading && (
                <span style={{ color: '#64748b', fontSize: 14 }}>로딩 중...</span>
              )}
            </div>
            {popularLoading ? (
              <div className="loading-message">인기 게시글을 불러오는 중...</div>
            ) : popularPosts.length > 0 ? (
              <div className="item-container popular-container">
                {popularPosts.map((item) => (
                  <Item 
                    key={item.id} 
                    {...item} 
                    onClick={() => handleItemClick(item.id)} 
                    allTags={tags}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-message">인기 게시글이 없습니다.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Home; 