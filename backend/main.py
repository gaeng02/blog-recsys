from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncEngine
from backend.db import engine, Base, get_session
from backend.models import Post, Member, Tag, PostTag, Interaction
from backend.recommendations import (
    get_user_based_recs, get_latest_posts, get_top_viewed_posts,
    get_post_view_recs, suggest_tags_for_content, generate_weekly_email,
    search_content_based, search_hybrid, update_user_embedding
)
from backend.vector_db import FaissClient
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta
from backend.vector_utils import json_to_vector, cosine_similarity

vec_client = FaissClient(dim=768)

@asynccontextmanager
async def lifespan(app: FastAPI) :
    
    async with engine.begin() as conn :
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(lifespan = lifespan)

# CORS 설정 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite 기본 포트
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙 (프론트엔드)
app.mount("/static", StaticFiles(directory = "frontend"), name = "static")


# 루트 index.html
@app.get("/", include_in_schema = False)
async def serve_index() :
    return FileResponse("frontend/index.html")

# post.html 상세 페이지
@app.get("/post.html", include_in_schema = False)
async def serve_post() :
   return FileResponse("frontend/post.html")

# create.html, search.html 도 동일하게 필요하다면 추가
@app.get("/create.html", include_in_schema = False)
async def serve_create() :
    return FileResponse("frontend/create.html")

@app.get("/search.html", include_in_schema = False)
async def serve_search() :
    return FileResponse("frontend/search.html")


# --- API Endpoints ---

# 0) 게시글 단일 조회 (조회수 증가 없음)
@app.get("/api/posts/{post_id}")
async def read_post (post_id: int) :
    async for session in get_session() :
        result = await session.execute(
            select(Post).options(selectinload(Post.tags)).where(Post.post_id == post_id)
        )
        post = result.scalars().first()
        if not post:
            raise HTTPException(status_code=404, detail={"error": "게시글을 찾을 수 없습니다."})
        
        return post.to_dict()

# 0-1) 게시글 조회수 증가
@app.post("/api/posts/{post_id}/view")
async def increment_view (post_id: int) :
    async for session in get_session() :
        result = await session.execute(
            select(Post).where(Post.post_id == post_id)
        )
        post = result.scalars().first()
        if not post:
            raise HTTPException(status_code=404, detail={"error": "게시글을 찾을 수 없습니다."})
        
        # 조회수 증가
        post.views += 1
        await session.commit()
        
        return {"message": "조회수가 증가되었습니다.", "views": post.views}

# 태그 목록 반환
@app.get("/api/tags")
async def get_tags():
    try:
        async for session in get_session():
            result = await session.execute(
                select(Tag.tag_id, Tag.tag_name, func.count(PostTag.post_id))
                .select_from(Tag)
                .outerjoin(PostTag, Tag.tag_id == PostTag.tag_id)
                .group_by(Tag.tag_id, Tag.tag_name)
            )
            tags = result.all()
            return [
                {"id": tag_id, "name": tag_name, "count": count} for tag_id, tag_name, count in tags
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"태그 목록 조회 오류: {e}"})

# 1~3) 대시보드 3×3
@app.get("/api/dashboard/{user_id}")
async def dashboard(user_id : int) :
    user_recs = await get_user_based_recs(user_id, 3)
    latest    = await get_latest_posts(3)
    popular   = await get_top_viewed_posts(3)
    
    return {
        "user_recs": [p.to_dict() for p in user_recs] if user_recs else [],
        "latest":    [p.to_dict() for p in latest] if latest else [],
        "popular":   [p.to_dict() for p in popular] if popular else [],
    }

# 메인페이지 추천 게시글 (사용자 기반 + 최신 + 인기)
@app.get("/api/recommendations/{user_id}")
async def get_recommendations(user_id: int):
    try:
        user_recs_result = await get_user_based_recs(user_id, 3)
        user_recs = user_recs_result["posts"]
        similarity = user_recs_result["similarity"]
        tag_name = user_recs_result["tag_name"]
        post_similarities = user_recs_result.get("post_similarities", [])
        latest = await get_latest_posts(3)
        popular = await get_top_viewed_posts(3)
        return {
            "user_based": [p.to_dict() for p in user_recs] if user_recs else [],
            "latest": [p.to_dict() for p in latest] if latest else [],
            "popular": [p.to_dict() for p in popular] if popular else [],
            "similarity": similarity,
            "tag_name": tag_name,
            "post_similarities": post_similarities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"추천 시스템 오류: {e}"})

# 포스트 상세페이지 하단 추천 게시글 (페이지네이션 지원)
@app.get("/api/posts/{post_id}/related")
async def get_related_posts(post_id: int, user_id: int = 1, page: int = 1, page_size: int = 3):
    try:
        async for session in get_session():
            # 현재 게시글 조회 (조회수 증가 없이)
            result = await session.execute(
                select(Post).options(selectinload(Post.tags)).where(Post.post_id == post_id)
            )
            current_post = result.scalars().first()
            if not current_post:
                raise HTTPException(status_code=404, detail={"error": "게시글을 찾을 수 없습니다."})
            current_tags = [tag.tag_id for tag in current_post.tags]
            related_posts = []
            if current_tags:
                result = await session.execute(
                    select(Post).options(selectinload(Post.tags))
                    .join(PostTag, Post.post_id == PostTag.post_id)
                    .where(PostTag.tag_id.in_(current_tags))
                    .where(Post.post_id != post_id)
                    .order_by(Post.views.desc())
                )
                all_related = result.scalars().all() or []
                seen = set()
                for p in all_related:
                    if getattr(p, 'post_id', None) is not None and p.post_id not in seen:
                        seen.add(p.post_id)
                        related_posts.append(p)
            if not related_posts:
                user_recs = await get_user_based_recs(user_id, 20) or []
                seen = set([int(post_id)])
                related_posts = []
                for p in user_recs:
                    if getattr(p, 'post_id', None) is not None and p.post_id not in seen:
                        seen.add(p.post_id)
                        related_posts.append(p)
            total = len(related_posts)
            start = (page - 1) * page_size
            end = start + page_size
            page_items = related_posts[start:end]
            return {
                "total": total,
                "page": page,
                "page_size": page_size,
                "posts": [p.to_dict() for p in page_items]
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"관련 포스트 추천 오류: {e}"})

# 4) 본 후 추천
@app.get("/api/posts/{user_id}/{post_id}/recs")
async def post_recs (user_id : int, post_id : int) :
    recs = await get_post_view_recs(user_id, post_id, 3)
    return [p.to_dict() for p in recs] if recs else []

# 5) 게시글 생성 + 태그 추천
@app.post("/api/posts/")
async def create_post (payload : dict) :
    async for session in get_session() :
        # tags 필드는 Post 생성 시 제외
        post_data = payload.copy()
        post_data.pop('tags', None)
        post = Post(**post_data)
        session.add(post)
        await session.commit()
        await session.refresh(post)

        # 태그 추천 & 매핑
        recommended_tags = await suggest_tags_for_content(payload["content"])
        
        # 추천된 태그들을 처리
        for tag_name in recommended_tags:
            # 1. 태그가 이미 존재하는지 확인
            existing_tag = await session.execute(
                select(Tag).where(Tag.tag_name == tag_name)
            )
            tag = existing_tag.scalars().first()
            
            if not tag:
                # 2. 태그가 없으면 새로 생성
                tag = Tag(tag_name=tag_name)
                session.add(tag)
                await session.commit()
                await session.refresh(tag)
                
                # 3. 새 태그의 벡터 생성 및 저장
                from backend.vector_utils import get_embedding, vector_to_json
                from backend.models import TagVector
                
                try:
                    tag_vector = get_embedding(tag_name)
                    vector_json = vector_to_json(tag_vector)
                    
                    tag_vector_record = TagVector(
                        tag_id=tag.tag_id,
                        vector=vector_json
                    )
                    session.add(tag_vector_record)
                    await session.commit()
                    print(f"새 태그 '{tag_name}' 벡터 생성 완료")
                except Exception as e:
                    print(f"태그 '{tag_name}' 벡터 생성 실패: {e}")
            
            # 4. PostTag 매핑 (중복 방지)
            existing_mapping = await session.execute(
                select(PostTag).where(
                    PostTag.post_id == post.post_id,
                    PostTag.tag_id == tag.tag_id
                )
            )
            if not existing_mapping.scalars().first():
                session.add(PostTag(post_id=post.post_id, tag_id=tag.tag_id))
        
        await session.commit()

        # FAISS 벡터 추가
        vec = vec_client.embed_text(payload["content"])
        vec_client.add_embedding(int(post.post_id), vec)

        return {"post_id" : post.post_id, "tags" : recommended_tags}

# 게시글 수정 API
@app.put("/api/posts/{post_id}")
async def update_post(post_id: int, payload: dict):
    print(f"게시글 수정 요청 - post_id: {post_id}, payload: {payload}")
    async for session in get_session():
        # 기존 게시글 조회
        result = await session.execute(
            select(Post).where(Post.post_id == post_id)
        )
        post = result.scalars().first()
        
        if not post:
            print(f"게시글을 찾을 수 없음: {post_id}")
            return {"error": "게시글을 찾을 수 없습니다."}
        
        # 게시글 정보 업데이트
        post.title = payload["title"]
        post.content = payload["content"]
        post.category = payload["category"]
        post.image = payload.get("image", post.image)
        post.updated_at = datetime.now(timezone.utc)
        
        # 기존 태그 매핑 삭제 및 사용되지 않는 태그 정리
        existing_tags = await session.execute(
            select(PostTag).where(PostTag.post_id == post_id)
        )
        old_tag_ids = set()
        for tag_mapping in existing_tags.scalars().all():
            old_tag_ids.add(tag_mapping.tag_id)
            await session.delete(tag_mapping)
        
        print(f"기존 태그 삭제: {old_tag_ids}")
        
        # 이제 사용되지 않는 태그들 삭제
        for tag_id in old_tag_ids:
            # 해당 태그를 사용하는 다른 게시글이 있는지 확인
            other_posts = await session.execute(
                select(PostTag).where(PostTag.tag_id == tag_id)
            )
            if not other_posts.scalars().first():
                # 사용되지 않는 태그 삭제
                tag_to_delete = await session.execute(
                    select(Tag).where(Tag.tag_id == tag_id)
                )
                tag = tag_to_delete.scalars().first()
                if tag:
                    await session.delete(tag)
                    print(f"사용되지 않는 태그 삭제: {tag.tag_name} (ID: {tag_id})")
        
        # 새 태그 매핑 추가
        if "tags" in payload and payload["tags"]:
            for tag_item in payload["tags"]:
                tag = None
                if isinstance(tag_item, int):
                    tag = await session.get(Tag, tag_item)
                elif isinstance(tag_item, str):
                    tag = (await session.execute(select(Tag).where(Tag.tag_name == tag_item))).scalars().first()
                    if not tag:
                        tag = Tag(tag_name=tag_item)
                        session.add(tag)
                        await session.commit()
                        await session.refresh(tag)
                if tag:
                    session.add(PostTag(post_id=post_id, tag_id=tag.tag_id))
        
        await session.commit()
        print(f"게시글 수정 완료 - 새 태그: {payload['tags']}")
        
        # FAISS 벡터 업데이트
        try:
            vec = vec_client.embed_text(payload["content"])
            vec_client.delete_embedding(post_id)
            vec_client.add_embedding(post_id, vec)
            print(f"FAISS 벡터 업데이트 완료: {post_id}")
        except Exception as e:
            print(f"벡터 업데이트 실패: {e}")
        
        return {"post_id": post_id, "message": "게시글이 수정되었습니다.", "tags": payload["tags"]}

# 6) 게시글 삭제
@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: int):
    async for session in get_session():
        # 게시글 존재 확인
        result = await session.execute(
            select(Post).where(Post.post_id == post_id)
        )
        post = result.scalars().first()
        if not post:
            raise HTTPException(status_code=404, detail={"error": "게시글을 찾을 수 없습니다."})
        
        # 게시글에 연결된 태그 ID들 저장
        post_tags_result = await session.execute(
            select(PostTag.tag_id).where(PostTag.post_id == post_id)
        )
        post_tag_ids = {row[0] for row in post_tags_result.all()}
        
        # 관련된 post_tags 삭제
        await session.execute(
            text("DELETE FROM post_tags WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        
        # 관련된 interactions 삭제
        await session.execute(
            text("DELETE FROM interactions WHERE post_id = :post_id"),
            {"post_id": post_id}
        )
        
        # 게시글 삭제
        await session.delete(post)
        
        # 이제 사용되지 않는 태그들 삭제 (commit 전에 처리)
        for tag_id in post_tag_ids:
            # 해당 태그를 사용하는 다른 게시글이 있는지 확인
            other_posts = await session.execute(
                select(PostTag).where(PostTag.tag_id == tag_id)
            )
            if not other_posts.scalars().first():
                # 사용되지 않는 태그 삭제
                tag_to_delete = await session.execute(
                    select(Tag).where(Tag.tag_id == tag_id)
                )
                tag = tag_to_delete.scalars().first()
                if tag:
                    await session.delete(tag)
                    print(f"사용되지 않는 태그 삭제: {tag.tag_name} (ID: {tag_id})")
        
        # 모든 변경사항을 한 번에 커밋
        await session.commit()
        
        # 벡터 DB에서도 삭제
        try:
            vec_client.delete_embedding(post_id)
        except Exception as e:
            print(f"벡터 DB 삭제 오류: {e}")
        
        return {"message": "게시글이 성공적으로 삭제되었습니다."}

# 태그 추천 API (글 작성 중 실시간 추천)
@app.post("/api/posts/suggest-tags")
async def suggest_tags(payload: dict):
    content = payload.get("content", "")
    if not content:
        return {"tags": []}
    
    recommended_tags = await suggest_tags_for_content(content, max_tags=5)
    return {"tags": recommended_tags}

# 6) 주간 이메일
@app.post("/api/weekly-email/{user_id}")
async def weekly_email(user_id : int, bg : BackgroundTasks) :
    bg.add_task(generate_weekly_email, user_id)
    return {"status" : "queued"}

# 7) 검색
@app.get("/api/search/")
async def search(q : str) :
    results = await search_content_based(q, 6)
    return [p.to_dict() for p in results] if results else []

# 8) 하이브리드 검색
@app.get("/api/search/hybrid/")
async def hybrid (q : str, user_id : int) :
    results = await search_hybrid(q, user_id)
    return [p.to_dict() for p in results] if results else []

# --- 사용자 상호작용 기록 & user vector 갱신 ---
@app.post("/api/interactions/")
async def log_interaction(payload : dict) :
    async for session in get_session() :
        # 최근 10초 이내 동일한 interaction이 있으면 기록하지 않음
        recent = await session.execute(
            select(Interaction).where(
                Interaction.member_id == payload["member_id"],
                Interaction.post_id == payload["post_id"],
                Interaction.action_type == payload["action_type"],
                Interaction.created_at > datetime.utcnow() - timedelta(seconds=10)
            )
        )
        if recent.scalars().first():
            return {"status": "duplicate"}
        inter = Interaction(**payload)
        session.add(inter)
        await session.commit()
        # interaction이 기록될 때마다 user_vector를 실시간으로 업데이트
        await update_user_embedding(payload["member_id"])
    return {"status" : "ok"}

# 전체 게시글 목록 반환 (태그 필터링 포함)
@app.get("/api/posts")
async def get_posts(tag: int = None):
    async for session in get_session():
        q = select(Post).options(selectinload(Post.tags)).order_by(Post.created_at.desc())
        if tag:
            q = q.join(PostTag, Post.post_id == PostTag.post_id).where(PostTag.tag_id == tag)
        result = await session.execute(q)
        posts = result.scalars().all()
        # 데이터 구조를 일관성 있게 맞춤
        return [{
            **p.to_dict(),
            "id": p.post_id  # 프론트엔드에서 기대하는 id 필드 추가
        } for p in posts]

@app.post("/api/posts/{post_id}/recommend-tags")
async def recommend_tags_for_post(post_id: int, max_tags: int = 5):
    # 1. 해당 post의 벡터 가져오기 (없으면 생성)
    post_vec = vec_client.get_embedding(post_id)
    if post_vec is None:
        async for session in get_session():
            post = await session.get(Post, post_id)
            if not post:
                raise HTTPException(status_code=404, detail="게시글 없음")
            post_vec = vec_client.embed_text(post.content)
            vec_client.add_embedding(post_id, post_vec)
    # 2. 모든 태그 벡터와 유사도 계산
    async for session in get_session():
        result = await session.execute(
            select(Tag.tag_id, Tag.tag_name, TagVector.vector)
            .join(TagVector, Tag.tag_id == TagVector.tag_id)
        )
        tag_vectors = result.all()
    similarities = []
    for tag_id, tag_name, vector_json in tag_vectors:
        tag_vector = json_to_vector(vector_json)
        if post_vec is not None and tag_vector is not None:
            similarity = cosine_similarity(post_vec, tag_vector)
            similarities.append((tag_id, tag_name, similarity))
    similarities.sort(key=lambda x: x[2], reverse=True)
    recommended_tags = [tag_name for _, tag_name, _ in similarities[:max_tags]]
    return {"tags": recommended_tags}


