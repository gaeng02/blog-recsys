import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '@/services/api';
import { tagNamesToObjects, tagIdsToObjects, extractErrorMessage } from '../utils/tagUtils';
import './CreatePost.css';

function CreatePost() {
  const navigate = useNavigate();
  // 2단계 분리: step 1(글작성), step 2(태그), step 3(벡터기반 추천 태그)
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image: '',
    category: 'study'
  });
  const [recommendedTags, setRecommendedTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]); // 실제 저장될 태그
  const [tagInput, setTagInput] = useState(''); // 직접 입력 태그
  const [loading, setLoading] = useState(false);
  const [tagRecommendLoading, setTagRecommendLoading] = useState(false); // 태그 추천 로딩 상태
  const [error, setError] = useState(null);
  const [tags, setTags] = useState([]);
  const tagInputRef = useRef(null);
  const [createdPostId, setCreatedPostId] = useState(null); // 새로 생성된 post_id

  // 태그 목록 로드
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags');
        const data = await res.json();
        setTags(data);
      } catch (e) {
        console.error('태그 로드 실패:', e);
      }
    };
    fetchTags();
  }, []);

  // step2 진입 시 태그 추천 요청
  useEffect(() => {
    if (step === 2 && formData.content.length > 10) {
      (async () => {
        try {
          setTagRecommendLoading(true); // 로딩 시작
          const response = await fetch('/api/posts/suggest-tags', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: formData.content }),
          });
          if (response.ok) {
            const data = await response.json();
            setRecommendedTags(data.tags || []);
            setSelectedTags(data.tags || []);
          }
        } catch (e) {
          console.error('태그 추천 실패:', e);
        } finally {
          setTagRecommendLoading(false); // 로딩 완료
        }
      })();
    }
    // eslint-disable-next-line
  }, [step]);

  // 3단계: post_id로 벡터 기반 태그 추천
  useEffect(() => {
    if (step === 3 && createdPostId) {
      (async () => {
        try {
          setTagRecommendLoading(true);
          const res = await fetch(`/api/posts/${createdPostId}/recommend-tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            setRecommendedTags(data.tags || []);
            setSelectedTags(data.tags || []);
          }
        } catch (e) {
          console.error('벡터 기반 태그 추천 실패:', e);
        } finally {
          setTagRecommendLoading(false);
        }
      })();
    }
  }, [step, createdPostId]);

  // 추천 태그 클릭 시 선택/해제 (5개 초과 불가)
  const handleRecommendTagClick = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      if (selectedTags.length >= 5) return;
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // 직접 입력 태그 추가 (5개 초과 불가, 2글자 이상, 중복/부분문자열 방지)
  const handleTagInputChange = (e) => {
    setTagInput(e.target.value);
  };
  const handleTagInputKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim().length >= 2) {
      e.preventDefault(); // 폼 제출 방지
      const newTag = tagInput.trim();
      if (
        newTag.length >= 2 &&
        !selectedTags.includes(newTag) &&
        !selectedTags.some(t => t === newTag || newTag.includes(t) || t.includes(newTag)) &&
        selectedTags.length < 5
      ) {
        setSelectedTags([...selectedTags, newTag]);
      }
      setTagInput(''); // 항상 비움
    }
  };

  // 선택된 태그 X로 삭제
  const handleRemoveTag = (tag) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 1단계: 글작성 → 다음
  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }
    setError(null);
    setStep(2);
  };

  // 2단계: 태그 선택 → 작성 완료(벡터 기반 추천)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedTags.length === 0) {
      setError('최소 1개 이상의 태그를 선택하거나 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const postData = {
        ...formData,
        member_id: 1,
        tags: selectedTags
      };
      const response = await postsAPI.createPost(postData);
      if (response && response.post_id) {
        setCreatedPostId(response.post_id);
        setStep(3); // 3단계로 이동(벡터 기반 태그 추천)
      } else {
        setError('글 작성에 실패했습니다.');
      }
    } catch (err) {
      console.error('글 작성 에러:', err);
      setError('글 작성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 3단계: 벡터 기반 태그 추천 후 최종 확정
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (selectedTags.length === 0) {
      setError('최소 1개 이상의 태그를 선택하거나 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 태그만 업데이트(put)
      await postsAPI.updatePost(createdPostId, { tags: selectedTags });
      alert('글이 성공적으로 작성되었습니다!');
      navigate(`/post/${createdPostId}`);
    } catch (err) {
      setError('최종 태그 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('작성을 취소하시겠습니까?')) {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="create-post-bg">
        <div className="create-post-card">
          <div className="loading-message">글을 저장 중입니다...</div>
        </div>
      </div>
    );
  }
  if (tagRecommendLoading) {
    return (
      <div className="create-post-bg">
        <div className="create-post-card">
          <div className="loading-message">태그를 추천 중입니다...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-post-bg">
      <div className="create-post-card">
        <div className="create-post-header">
          <h1>새 글 작성</h1>
          <button className="cancel-button" onClick={handleCancel}>
            취소
          </button>
        </div>

        <div className="step-indicator">
          <div className={`step ${step === 1 ? 'active' : 'completed'}`}>글 작성</div>
          <div className={`step ${step === 2 ? 'active' : step > 2 ? 'completed' : 'inactive'}`}>태그 선택</div>
          <div className={`step ${step === 3 ? 'active' : 'inactive'}`}>추천 태그 확정</div>
        </div>

        {step === 1 && (
          <form onSubmit={handleNext} className="create-post-form">
            <div className="form-group">
              <label htmlFor="title">제목 *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="글 제목을 입력하세요"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">카테고리</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                <option value="study">스터디</option>
                <option value="project">프로젝트</option>
                <option value="notice">공지사항</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="image">이미지 URL</label>
              <input
                type="url"
                id="image"
                name="image"
                value={formData.image}
                onChange={handleInputChange}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="form-group">
              <label htmlFor="content">내용 *</label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                placeholder="글 내용을 입력하세요..."
                rows="18"
                required
                style={{ minHeight: '260px', fontSize: '1.13rem' }}
              />
            </div>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                다음
              </button>
            </div>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="create-post-form">
            <div className="form-group">
              <label>태그 *</label>
              {/* 추천 태그 */}
              {tagRecommendLoading ? (
                <div className="recommended-tags">
                  <span>추천 태그: </span>
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    태그 추천 중... 잠시만 기다려주세요.
                  </span>
                </div>
              ) : recommendedTags.length > 0 && (
                <div className="recommended-tags">
                  <span>추천 태그: </span>
                  {recommendedTags.map((tag, idx) => (
                    <span
                      key={tag}
                      className={`recommended-tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
                      onClick={() => handleRecommendTagClick(tag)}
                      style={{ opacity: selectedTags.length >= 5 && !selectedTags.includes(tag) ? 0.4 : 1, pointerEvents: selectedTags.length >= 5 && !selectedTags.includes(tag) ? 'none' : 'auto' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* 직접 입력 */}
              <div className="tag-input-row">
                <input
                  type="text"
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={selectedTags.length >= 5 ? "최대 5개까지 선택 가능합니다" : "태그를 입력 후 Enter 또는 , (쉼표)로 추가"}
                  className="tag-input"
                  disabled={selectedTags.length >= 5}
                />
              </div>
              {/* 선택된 태그 목록 */}
              <div className="selected-tags">
                {selectedTags.map((tag, idx) => (
                  <span key={tag} className="selected-tag">
                    {tag}
                    <button type="button" className="remove-tag" onClick={() => handleRemoveTag(tag)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <small>최대 5개까지, 추천 태그를 클릭하거나 직접 입력해 추가할 수 있습니다.</small>
            </div>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setStep(1)}
              >
                이전 단계
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? '작성 중...' : '작성 완료'}
              </button>
            </div>
          </form>
        )}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit} className="create-post-form">
            <div className="form-group">
              <label>추천 태그(벡터 기반)</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                {recommendedTags.map(tag => (
                  <button
                    type="button"
                    key={tag}
                    className={`recommend-tag-btn${selectedTags.includes(tag) ? ' selected' : ''}`}
                    onClick={() => handleRecommendTagClick(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {selectedTags.map(tag => (
                  <span key={tag} className="selected-tag">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} style={{ marginLeft: 4 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ color: '#64748b', fontSize: 14, marginBottom: 8 }}>
                최대 5개까지, 추천 태그를 클릭하거나 직접 입력해 추가할 수 있습니다.
              </div>
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="submit-button">최종 저장</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreatePost; 