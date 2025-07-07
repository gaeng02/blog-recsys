from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db import get_session
from backend.vector_db import FaissClient
from backend.models import Post, Interaction, Tag, PostTag, TagVector
from datetime import timedelta
import numpy as np
from sqlalchemy.orm import selectinload
from backend.vector_utils import get_embedding, json_to_vector, cosine_similarity

vec_client = FaissClient(dim = 768)

# 기능 1: 사용자 기반 추천 (user-based CF) - 태그 기반 추천
async def get_user_based_recs (user_id : int, top_n : int = 3) :
    
    # 1. 사용자 벡터를 FAISS에서 직접 가져오기
    user_vec = vec_client.get_embedding(user_id)
    if user_vec is None:
        user_vec = vec_client.embed_text(f"user:{user_id}")
        vec_client.add_embedding(user_id, user_vec)
    
    # 2. 모든 태그 벡터와 사용자 벡터의 유사도 계산
    async for session in get_session():
        result = await session.execute(
            select(Tag.tag_id, Tag.tag_name, TagVector.vector)
            .join(TagVector, Tag.tag_id == TagVector.tag_id)
        )
        tag_vectors = result.all()
    
    if not tag_vectors:
        # 태그 벡터가 없으면 기존 방식 사용
        post_ids = vec_client.query(user_vec, top_n)
        async for session in get_session():
            q = await session.execute(
                select(Post).options(selectinload(Post.tags)).where(Post.post_id.in_(post_ids))
            )
            return {"posts": q.scalars().all(), "similarity": None, "tag_name": None}
    
    tag_vectors = tag_vectors or []
    similarities = []
    for tag_id, tag_name, vector_json in tag_vectors:
        tag_vector = json_to_vector(vector_json)
        if user_vec is not None and tag_vector is not None:
            similarity = cosine_similarity(user_vec, tag_vector)
            similarities.append((tag_id, tag_name, similarity))
    
    similarities = similarities or []
    similarities.sort(key=lambda x: x[2], reverse=True)
    if len(similarities) > 0:
        most_similar_tag_id = similarities[0][0]
        most_similar_tag_name = similarities[0][1]
        most_similar_score = similarities[0][2]
        print(f"사용자 {user_id}에게 가장 유사한 태그: {most_similar_tag_name} (유사도: {most_similar_score:.4f})")
        
        # 해당 태그를 가진 게시글들 조회
        async for session in get_session():
            result = await session.execute(
                select(Post).options(selectinload(Post.tags))
                .join(PostTag, Post.post_id == PostTag.post_id)
                .where(PostTag.tag_id == most_similar_tag_id)
                .order_by(Post.views.desc(), Post.created_at.desc())
                .limit(top_n)
            )
            posts = result.scalars().all() or []
            
            # 충분한 게시글이 없으면 다른 유사한 태그들도 고려
            if len(posts) < top_n and len(similarities) > 1:
                additional_posts = []
                for tag_id, tag_name, _ in similarities[1:3]:  # 상위 3개 태그까지 고려
                    if len(posts) + len(additional_posts) >= top_n:
                        break
                    result = await session.execute(
                        select(Post).options(selectinload(Post.tags))
                        .join(PostTag, Post.post_id == PostTag.post_id)
                        .where(PostTag.tag_id == tag_id)
                        .where(Post.post_id.notin_([p.post_id for p in posts + additional_posts]))
                        .order_by(Post.views.desc(), Post.created_at.desc())
                        .limit(top_n - len(posts) - len(additional_posts))
                    )
                    additional_posts.extend(result.scalars().all() or [])
                
                posts.extend(additional_posts)
            
            # 각 게시글별 태그 벡터와의 유사도 계산
            tag_vector = None
            for tid, tname, vjson in tag_vectors:
                if tid == most_similar_tag_id:
                    tag_vector = json_to_vector(vjson)
                    break
            post_similarities = []
            if tag_vector is not None and len(posts) > 0:
                for post in posts[:top_n]:
                    post_vec = vec_client.get_embedding(post.post_id)
                    if post_vec is None:
                        post_vec = get_embedding(f"post:{post.post_id}")
                        if post_vec is not None:
                            vec_client.add_embedding(post.post_id, post_vec)
                    if post_vec is not None and user_vec is not None:
                        assert user_vec is not None and post_vec is not None, "user_vec/post_vec None 오류"
                        sim = cosine_similarity(post_vec, tag_vector)
                        post_similarities.append(round(float(sim), 4))
                    else:
                        post_similarities.append(None)
            else:
                post_similarities = [None for _ in posts[:top_n]]
            return {
                "posts": posts[:top_n],
                "similarity": round(float(most_similar_score), 4),
                "tag_name": most_similar_tag_name,
                "post_similarities": post_similarities
            }
    else:
        # similarities가 비어있으면 기존 방식 사용
        if user_vec is None:
            return {"posts": [], "similarity": None, "tag_name": None}
        post_ids = vec_client.query(user_vec, top_n)
        async for session in get_session():
            q = await session.execute(
                select(Post).options(selectinload(Post.tags)).where(Post.post_id.in_(post_ids))
            )
            return {"posts": q.scalars().all(), "similarity": None, "tag_name": None}

# 기능 2: 최신 게시글
async def get_latest_posts (top_n : int = 3) :
    async for session in get_session() :
        q = await session.execute(
            select(Post).options(selectinload(Post.tags)).order_by(Post.created_at.desc()).limit(top_n)
        )
        return q.scalars().all()

# 기능 3: 조회수 높은 게시글
async def get_top_viewed_posts (top_n : int = 3) :
    
    async for session in get_session() :
        q = await session.execute(
            select(Post).options(selectinload(Post.tags)).order_by(Post.views.desc()).limit(top_n)
        )
        return q.scalars().all()

# 기능 4: 포스팅 본 후 추천 (재사용)
async def get_post_view_recs (user_id : int, post_id : int, top_n : int = 3) :
    return await get_user_based_recs(user_id, top_n)

# 기능 5: LLM 기반 태그 추천 (stub)
async def suggest_tags_for_content(content: str, max_tags: int = 5):
    try:
        content_vector = get_embedding(content)
        if content_vector is None:
            print(f"컨텐츠 벡터 생성 실패: {content[:50]}...")
            return ["ai", "머신러닝", "딥러닝", "Python", "데이터분석"][:max_tags]
        
        async for session in get_session():
            result = await session.execute(
                select(Tag.tag_id, Tag.tag_name, TagVector.vector)
                .join(TagVector, Tag.tag_id == TagVector.tag_id)
            )
            tag_vectors = result.all()
        
        tag_vectors = tag_vectors or []
        if not tag_vectors:
            print("태그 벡터가 없어 기본 태그 반환")
            return ["ai", "머신러닝", "딥러닝", "Python", "데이터분석"][:max_tags]
        
        similarities = []
        for tag_id, tag_name, vector_json in tag_vectors:
            tag_vector = json_to_vector(vector_json)
            if content_vector is not None and tag_vector is not None:
                similarity = cosine_similarity(content_vector, tag_vector)
                similarities.append((tag_id, tag_name, similarity))
        
        similarities.sort(key=lambda x: x[2], reverse=True)
        recommended_tags = [tag_name for _, tag_name, _ in similarities[:max_tags]]
        
        # 항상 최대 max_tags개까지 반환 (부족하면 기본 태그로 채움)
        if len(recommended_tags) < max_tags:
            default_tags = ["ai", "머신러닝", "딥러닝", "Python", "데이터분석"]
            for t in default_tags:
                if t not in recommended_tags:
                    recommended_tags.append(t)
                if len(recommended_tags) >= max_tags:
                    break
        
        print(f"추천 태그: {recommended_tags}")
        return recommended_tags
    except Exception as e:
        print(f"태그 추천 중 오류 발생: {e}")
        return ["ai", "머신러닝", "딥러닝", "Python", "데이터분석"][:max_tags]

# 기능 6: 주간 이메일 콘텐츠 생성
async def generate_weekly_email (user_id : int) :
    recs = await get_user_based_recs(user_id, top_n=5)
    titles = [p.title for p in recs["posts"]]
    return "이번 주 추천 게시글:\n" + "\n".join(titles)

# 기능 7: 컨텐츠 기반 유사도 검색
async def search_content_based (query : str, top_n : int = 6) :
    q_vec = vec_client.embed_text(query)
    post_ids = vec_client.query(q_vec, top_n)
    async for session in get_session():
        q = await session.execute(select(Post).where(Post.post_id.in_(post_ids)))
        return q.scalars().all()

# 기능 8: 하이브리드 검색
async def search_hybrid (query : str, user_id : int, top_n : int = 3) :
    first = await search_content_based(query, top_n*2)  # 6
    
    user_tags = ["머신러닝"]
    merged_q = query + " " + " ".join(user_tags)
    m_vec = vec_client.embed_text(merged_q)
    merged_ids = vec_client.query(m_vec, top_n)
    async for session in get_session():
        q2 = await session.execute(select(Post).where(Post.post_id.in_(merged_ids)))
        second = q2.scalars().all()
    return first + second


# 기능 9: 사용자 임베딩 업데이트
async def update_user_embedding (user_id : int, dim : int = 768) :
    print(f"사용자 {user_id} 벡터 업데이트 시작")
    
    # 1) interactions 조회
    async for session in get_session() :
        q = await session.execute(
            select(Interaction).where(Interaction.member_id == user_id)
        )
        inters = q.scalars().all() or []

    if not inters :
        print(f"사용자 {user_id}의 interaction이 없음")
        return

    print(f"사용자 {user_id}의 interaction 개수: {len(inters)}")

    # 2) 최신 user vector (없으면 0벡터)
    user_vec = vec_client.get_embedding(user_id)
    if user_vec is None or (hasattr(user_vec, 'shape') and user_vec.shape[0] != dim):
        user_vec = np.zeros(dim, dtype='float32')
        print(f"사용자 {user_id} 벡터 초기화 (0벡터)")

    # 3) interaction별로 가중치 적용하여 user vector 업데이트
    updated_count = 0
    for inter in (inters or []):
        view = 0.1 if inter.action_type == 'view' else 0.0
        like = 0.3 if inter.action_type == 'like' else 0.0
        comment = 0.6 if inter.action_type == 'comment' else 0.0
        w = (view + like + comment) * 0.1
        if w == 0:
            continue
        
        post_vec = vec_client.get_embedding(inter.post_id)
        if post_vec is None:
            post_vec = vec_client.embed_text(f"post:{inter.post_id}")
            if post_vec is not None:
                vec_client.add_embedding(inter.post_id, post_vec)
                print(f"게시글 {inter.post_id} 벡터 생성 및 저장")
        
        if post_vec is not None and user_vec is not None:
            assert user_vec is not None and post_vec is not None, "user_vec/post_vec None 오류"
            user_vec = ((1 - w) * user_vec) + (w * post_vec)
            updated_count += 1
            print(f"사용자 {user_id} 벡터 업데이트: {inter.action_type} (가중치: {w:.3f})")

    user_vec = user_vec.astype('float32')

    # 4) 기존 user embedding 삭제 (IndexIDMap 사용 시)
    try:
        vec_client.delete_embedding(user_id)
        print(f"사용자 {user_id} 기존 벡터 삭제")
    except:
        print(f"사용자 {user_id} 기존 벡터 삭제 실패 (없을 수 있음)")

    # 5) FAISS에 업데이트
    vec_client.add_embedding(user_id, user_vec)
    print(f"사용자 {user_id} 새 벡터 저장 완료 (업데이트된 interaction: {updated_count}개)")

