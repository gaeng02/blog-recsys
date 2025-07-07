import { useEffect, useRef } from 'react';
import { interactionAPI, INTERACTION_TYPES, INTERACTION_WEIGHTS } from '@/services/api';

// 사용자 ID (실제로는 로그인 시스템에서 가져와야 함)
const DEFAULT_USER_ID = 1;

export const useInteraction = (postId, userId = DEFAULT_USER_ID) => {
  const startTimeRef = useRef(null);
  const isViewLoggedRef = useRef(false);

  // 페이지 뷰 로깅
  useEffect(() => {
    if (!postId || isViewLoggedRef.current) return;

    const logView = async () => {
      try {
        await interactionAPI.logInteraction({
          member_id: userId,
          post_id: postId,
          action_type: INTERACTION_TYPES.VIEW,
          weight: INTERACTION_WEIGHTS[INTERACTION_TYPES.VIEW],
        });
        isViewLoggedRef.current = true;
        startTimeRef.current = Date.now();
      } catch (error) {
        console.error('뷰 로깅 실패:', error);
      }
    };

    logView();
  }, [postId, userId]);

  // 페이지 이탈 시 체류시간 로깅
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (startTimeRef.current && postId) {
        const dwellTime = Date.now() - startTimeRef.current;
        
        // 30초 이상 체류한 경우에만 dwell 로깅
        if (dwellTime > 30000) {
          try {
            await interactionAPI.logInteraction({
              member_id: userId,
              post_id: postId,
              action_type: INTERACTION_TYPES.DWELL,
              weight: INTERACTION_WEIGHTS[INTERACTION_TYPES.DWELL],
            });
          } catch (error) {
            console.error('체류시간 로깅 실패:', error);
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [postId, userId]);

  // 인터랙션 로깅 함수들
  const logLike = async () => {
    try {
      await interactionAPI.logInteraction({
        member_id: userId,
        post_id: postId,
        action_type: INTERACTION_TYPES.LIKE,
        weight: INTERACTION_WEIGHTS[INTERACTION_TYPES.LIKE],
      });
    } catch (error) {
      console.error('좋아요 로깅 실패:', error);
    }
  };

  const logComment = async () => {
    try {
      await interactionAPI.logInteraction({
        member_id: userId,
        post_id: postId,
        action_type: INTERACTION_TYPES.COMMENT,
        weight: INTERACTION_WEIGHTS[INTERACTION_TYPES.COMMENT],
      });
    } catch (error) {
      console.error('댓글 로깅 실패:', error);
    }
  };

  return {
    logLike,
    logComment,
  };
}; 