const API_BASE_URL = 'http://localhost:8000/api';

// API 호출 헬퍼 함수
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API 호출 오류:', error);
    throw error;
  }
}

// 게시글 관련 API
export const postsAPI = {
  // 단일 게시글 조회
  getPost: (postId) => apiCall(`/posts/${postId}`),
  
  // 게시글 생성
  createPost: (postData) => apiCall('/posts/', {
    method: 'POST',
    body: JSON.stringify(postData),
  }),
  
  // 전체 게시글 목록
  getAllPosts: () => apiCall('/posts/'),
  
  // 게시글 본 후 추천
  getPostRecommendations: (userId, postId) => apiCall(`/posts/${userId}/${postId}/recs`),
  
  // 게시글 삭제
  deletePost: (postId) => apiCall(`/posts/${postId}`, {
    method: 'DELETE',
  }),
};

// 대시보드 API
export const dashboardAPI = {
  // 사용자별 대시보드 데이터
  getDashboard: (userId) => apiCall(`/dashboard/${userId}`),
};

// 검색 API
export const searchAPI = {
  // 일반 검색
  search: (query) => apiCall(`/search/?q=${encodeURIComponent(query)}`),
  
  // 하이브리드 검색
  hybridSearch: (query, userId) => apiCall(`/search/hybrid/?q=${encodeURIComponent(query)}&user_id=${userId}`),
};

// 사용자 인터랙션 API
export const interactionAPI = {
  // 인터랙션 로깅
  logInteraction: (interactionData) => apiCall('/interactions/', {
    method: 'POST',
    body: JSON.stringify(interactionData),
  }),
};

// 주간 이메일 API
export const emailAPI = {
  // 주간 이메일 생성
  generateWeeklyEmail: (userId) => apiCall(`/weekly-email/${userId}`, {
    method: 'POST',
  }),
};

// 인터랙션 타입 상수
export const INTERACTION_TYPES = {
  VIEW: 'view',
  DWELL: 'dwell',
  LIKE: 'like',
  COMMENT: 'comment',
};

// 인터랙션 가중치
export const INTERACTION_WEIGHTS = {
  [INTERACTION_TYPES.VIEW]: 1.0,
  [INTERACTION_TYPES.DWELL]: 2.0,
  [INTERACTION_TYPES.LIKE]: 3.0,
  [INTERACTION_TYPES.COMMENT]: 5.0,
}; 