import asyncio, random, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from backend.db import engine, Base, AsyncSessionLocal
from backend.models import Member, Tag, Post, PostTag, Interaction
from backend.vector_db import FaissClient
from datetime import datetime, timezone

vec_client = FaissClient(dim = 768)

async def seed() :
    
    # 1) 테이블 생성 (없으면)
    async with engine.begin() as conn :
        await conn.run_sync(Base.metadata.create_all)

    # 2) 세션 준비
    async with AsyncSessionLocal() as session :
        # -- 2.1 멤버 생성
        members = [Member(username=f"user{i}") for i in range(1, 6)]
        session.add_all(members)
        await session.commit()

        # -- 2.2 태그 생성 (프론트엔드와 일치)
        tag_names = [
            "머신러닝", "딥러닝", "Python", "데이터분석", "AI", 
            "통계학", "NLP", "컴퓨터비전", "강화학습", "스터디"
        ]
        tags = [Tag(tag_name = n) for n in tag_names]
        session.add_all(tags)
        await session.commit()

        # -- 2.3 포스트 생성
        posts = []
        for i in range(1, 11) :
            member = random.choice(members)
            p = Post(
                member_id = member.member_id,
                category = random.choice(["project","study","notice"]),
                title = f"샘플 포스트 #{i}",
                content = f"이것은 샘플 내용입니다. 번호 {i}",
                created_at = datetime.now(timezone.utc)
            )
            posts.append(p)
        session.add_all(posts)
        await session.commit()
        # 태그 매핑 & 포스트 벡터 추가
        for p in posts:
            # 임의의 2개 태그 매핑
            chosen = random.sample(tags, 2)
            for t in chosen:
                session.add(PostTag(post_id = p.post_id, tag_id = t.tag_id))
            # FAISS에 포스트 임베딩 추가
            vec = vec_client.embed_text(p.content)
            vec_client.add_embedding(p.post_id, vec)
        await session.commit()

        # -- 2.4 사용자 인터랙션 생성
        actions = ["view","like","comment"]
        for _ in range(20) :
            m = random.choice(members)
            p = random.choice(posts)
            weight = random.uniform(0.5, 2.0)
            inter = Interaction (
                member_id = m.member_id,
                post_id = p.post_id,
                action_type = random.choice(actions),
                weight = weight,
                created_at = datetime.now(timezone.utc)
            )
            session.add(inter)
        await session.commit()

        # -- 2.5 user_embeddings 초기화 (interactions 기반 업데이트)
        from backend.recommendations import update_user_embedding
        for m in members :
            await update_user_embedding(m.member_id)

    print("Seeding Completed : members, tags, posts, interactions, embeddings 모두 추가됨")

if __name__ == "__main__" :
    asyncio.run(seed())
