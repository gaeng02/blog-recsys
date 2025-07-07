import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CreatePost.css';
import { tagNamesToObjects, tagIdsToObjects, extractErrorMessage } from '../utils/tagUtils';

function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '기술',
    image: ''
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [recommendedTags, setRecommendedTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [tagRecommendLoading, setTagRecommendLoading] = useState(false);
  const [error, setError] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [isComposing, setIsComposing] = useState(false);

  // 태그 목록 로드
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags');
        const tags = await response.json();
        setAllTags(tags);
      } catch (e) {
        console.error('태그 로드 실패:', e);
      }
    };
    fetchTags();
  }, []);

  // 기존 게시글 데이터 로드
  useEffect(() => {
    const loadPost = async () => {
      try {
        setLoading(true);
        if (!id) {
          setError('잘못된 접근입니다. (id 없음)');
          return;
        }
        const response = await fetch(`/api/posts/${id}`);
        const post = await response.json();
        console.log('EditPost id:', id, 'post:', post, 'allTags:', allTags);
        if (post && Object.keys(post).length > 0) {
          setFormData({
            title: post.title || '',
            content: post.content || '',
            category: post.category || '기술',
            image: post.image || ''
          });
          // 태그는 allTags가 로드된 후에 처리
          if (post.tags && post.tags.length > 0) {
            console.log('게시글 태그:', post.tags);
            // allTags가 이미 로드되어 있다면 바로 매핑
            if (allTags.length > 0) {
              const tagObjs = post.tags
                .map(tagId => {
                  const foundTag = allTags.find(t => t.id === tagId);
                  console.log(`태그 ID ${tagId} 매핑 결과:`, foundTag);
                  return foundTag;
                })
                .filter(Boolean);
              console.log('최종 매핑된 태그 객체들:', tagObjs);
              setSelectedTags(tagObjs);
            }
          } else {
            console.log('게시글에 태그가 없음');
            setSelectedTags([]);
          }
        } else {
          setError('게시글을 찾을 수 없습니다.');
        }
      } catch (err) {
        setError('게시글을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      loadPost();
    }
  }, [id, allTags]);

  // 실시간 태그 추천
  useEffect(() => {
    const suggestTags = async () => {
      if (formData.content.length > 10) {
        try {
          setTagRecommendLoading(true);
          const response = await fetch('/api/posts/suggest-tags', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: formData.content }),
          });
          const data = await response.json();
          setRecommendedTags(data.tags || []);
        } catch (e) {
          console.error('태그 추천 실패:', e);
        } finally {
          setTagRecommendLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(suggestTags, 1000);
    return () => clearTimeout(timeoutId);
  }, [formData.content]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTagSelect = (tagObj) => {
    let tag = tagObj;
    if (typeof tagObj === 'string') {
      tag = allTags.find(t => t.name === tagObj) || { id: Date.now(), name: tagObj };
    }
    // 중복 체크 (ID와 이름 모두 확인)
    const isDuplicate = selectedTags.some(t => t.id === tag.id || t.name === tag.name);
    if (!isDuplicate) {
      console.log('태그 추가:', tag);
      setSelectedTags(prev => [...prev, tag]);
    } else {
      console.log('중복 태그 무시:', tag);
    }
  };

  const handleTagRemove = (tagObj) => {
    setSelectedTags(prev => {
      if (tagObj.id) {
        // id가 있는 경우 id로만 삭제
        return prev.filter(t => t.id !== tagObj.id);
      } else {
        // id가 없는 경우 name으로만 삭제
        return prev.filter(t => t.name !== tagObj.name);
      }
    });
  };

  const handleTagInput = (e) => {
    if (e.key === 'Enter' && !isComposing) {
      e.preventDefault();
      const value = tagInput.trim();
      if (value && selectedTags.length < 5) {
        let tag = allTags.find(t => t.name === value);
        if (!tag) tag = { name: value };
        const isDuplicate = selectedTags.some(t => t.name === tag.name);
        if (!isDuplicate) setSelectedTags(prev => [...prev, tag]);
        setTagInput('');
      }
    }
  };

  const handleTagInputChange = (e) => {
    setTagInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    try {
      const payload = {
        ...formData,
        tags: selectedTags.map(tag => tag.id ? tag.id : tag.name)
      };
      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.error) {
        alert(result.error);
      } else {
        alert('게시글이 수정되었습니다.');
        navigate(`/post/${id}`);
      }
    } catch (err) {
      alert('게시글 수정에 실패했습니다.');
      console.error(err);
    }
  };

  const handleNext = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  if (loading) {
    return (
      <div className="create-post-bg">
        <div className="create-post-card">
          <div className="loading-message">글을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="create-post-bg">
        <div className="create-post-card">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/')} className="submit-button">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-post-bg">
      <div className="create-post-card">
        <div className="create-post-header">
          <h1>게시글 수정</h1>
          <button className="cancel-button" onClick={() => navigate(`/post/${id}`)}>
            취소
          </button>
        </div>

        <div className="step-indicator">
          <div className={`step ${step === 1 ? 'active' : 'completed'}`}>
            글 작성
          </div>
          <div className={`step ${step === 2 ? 'active' : 'inactive'}`}>
            태그 선택
          </div>
        </div>

        {step === 1 ? (
          <div className="create-post-form">
            <div className="form-group">
              <label htmlFor="title">제목</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="게시글 제목을 입력하세요"
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
                <option value="기술">기술</option>
                <option value="개발">개발</option>
                <option value="디자인">디자인</option>
                <option value="일상">일상</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="image">이미지 URL (선택사항)</label>
              <input
                type="text"
                id="image"
                name="image"
                value={formData.image}
                onChange={handleInputChange}
                placeholder="이미지 URL을 입력하세요"
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">내용</label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                placeholder="게시글 내용을 입력하세요"
              />
            </div>

            <div className="form-actions">
              <button className="submit-button" onClick={handleNext}>
                다음 단계
              </button>
            </div>
          </div>
        ) : (
          <div className="create-post-form">
            <div className="form-group">
              <label>추천 태그</label>
              <div className="recommended-tags">
                {tagRecommendLoading ? (
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    태그 추천 중... 잠시만 기다려주세요.
                  </span>
                ) : (
                  recommendedTags.map((tag, index) => {
                    const tagObj = typeof tag === 'object' ? tag : allTags.find(t => t.name === tag) || { id: Date.now() + index, name: tag };
                    if (!tagObj) return null;
                    return (
                      <button
                        key={tagObj.id}
                        className={`recommended-tag ${selectedTags.some(t => t.id === tagObj.id) ? 'selected' : ''}`}
                        onClick={() => handleTagSelect(tagObj)}
                      >
                        {tagObj.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="form-group">
              <label>태그 직접 입력</label>
              <div className="tag-input-row">
                <input
                  type="text"
                  className="tag-input"
                  value={tagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagInput}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder="태그를 입력하고 Enter를 누르세요"
                />
              </div>
            </div>

            <div className="form-group">
              <label>선택된 태그 ({selectedTags.length}/5)</label>
              <div className="selected-tags">
                {selectedTags.map((tag, index) => (
                  <span key={tag.id} className="selected-tag">
                    {tag.name}
                    <button
                      className="remove-tag"
                      onClick={() => handleTagRemove(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button className="cancel-button" onClick={handleBack}>
                이전 단계
              </button>
              <button className="submit-button" onClick={handleSubmit}>
                수정 완료
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditPost; 