import asyncio
import json
import sys
import os
import re
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# 프로젝트 루트를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import engine, Base, AsyncSessionLocal
from backend.models import Member, Tag, Post, PostTag, TagVector
from backend.vector_db import FaissClient
from backend.vector_utils import get_embedding, vector_to_json

vec_client = FaissClient(dim=768)

# mock-data 읽기
def load_mock_data():
    # tags.json 읽기
    tags_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'src', 'mock-data', 'tags.json')
    with open(tags_path, 'r', encoding='utf-8') as f:
        tags_data = json.load(f)
    
    # posts.json 읽기
    posts_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'src', 'mock-data', 'posts.json')
    with open(posts_path, 'r', encoding='utf-8') as f:
        posts_data = json.load(f)
    
    return tags_data, posts_data

async def migrate_mock_data():
    print("Mock 데이터를 DB로 마이그레이션 시작...")
    
    # 1) 테이블 생성 (없으면)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 2) mock 데이터 로드
    tags_data, posts_data = load_mock_data()
    print(f"로드된 태그: {len(tags_data)}개")
    print(f"로드된 게시글: {len(posts_data)}개")
    
    # 3) 세션 준비
    async with AsyncSessionLocal() as session:
        # 기존 데이터 삭제 (선택사항)
        await session.execute(text("DELETE FROM post_tags"))
        await session.execute(text("DELETE FROM tag_vectors"))
        await session.execute(text("DELETE FROM interactions"))
        await session.execute(text("DELETE FROM posts"))
        await session.execute(text("DELETE FROM tags"))
        await session.execute(text("DELETE FROM members"))
        await session.commit()
        
        # 4) 멤버 생성 (기본 사용자)
        members = [Member(username=f"user{i}") for i in range(1, 6)]
        session.add_all(members)
        await session.commit()
        print("멤버 생성 완료")
        
        # 5) 태그 생성
        tags = []
        for tag_data in tags_data:
            tag = Tag(tag_name=tag_data['name'])
            tags.append(tag)
        session.add_all(tags)
        await session.commit()
        print("태그 생성 완료")
        
        # 6) 태그 벡터 생성 및 저장
        print("태그 벡터 생성 시작...")
        for tag in tags:
            try:
                # 태그명을 벡터화
                tag_vector = get_embedding(tag.tag_name)
                vector_json = vector_to_json(tag_vector)
                
                # TagVector 테이블에 저장
                tag_vector_record = TagVector(
                    tag_id=tag.tag_id,
                    vector=vector_json
                )
                session.add(tag_vector_record)
                
                print(f"태그 '{tag.tag_name}' 벡터 생성 완료")
            except Exception as e:
                print(f"태그 '{tag.tag_name}' 벡터 생성 실패: {e}")
        
        await session.commit()
        print("태그 벡터 저장 완료")
        
        # 7) 게시글 생성
        posts = []
        for post_data in posts_data:
            # 랜덤 멤버 선택
            member = members[post_data['id'] % len(members)]
            
            post = Post(
                post_id=post_data['id'],  # 원본 ID 유지
                member_id=member.member_id,
                category='study',  # 기본값
                title=post_data['title'],
                content=post_data['content'],
                image=post_data.get('image'),
                created_at=datetime.fromisoformat(post_data['created_at'].replace('Z', '+00:00')),
                views=0
            )
            posts.append(post)
        
        session.add_all(posts)
        await session.commit()
        print("게시글 생성 완료")
        
        # 8) 태그 매핑
        for post_data in posts_data:
            if 'tags' in post_data and post_data['tags']:
                for tag_id in post_data['tags']:
                    # tag_id가 실제 존재하는지 확인
                    if tag_id <= len(tags):
                        post_tag = PostTag(
                            post_id=post_data['id'],
                            tag_id=tag_id
                        )
                        session.add(post_tag)
        
        await session.commit()
        print("태그 매핑 완료")
        
        # 9) FAISS 벡터 추가
        for post in posts:
            vec = vec_client.embed_text(post.content)
            vec_client.add_embedding(post.post_id, vec)
        
        print("FAISS 벡터 추가 완료")
        
        # 10) 샘플 인터랙션 생성 (추천 시스템 테스트용)
        from backend.models import Interaction
        import random
        
        actions = ["view", "like", "comment"]
        for _ in range(50):  # 50개의 샘플 인터랙션
            member = random.choice(members)
            post = random.choice(posts)
            weight = random.uniform(0.5, 2.0)
            inter = Interaction(
                member_id=member.member_id,
                post_id=post.post_id,
                action_type=random.choice(actions),
                weight=weight,
                created_at=datetime.now(timezone.utc)
            )
            session.add(inter)
        
        await session.commit()
        print("샘플 인터랙션 생성 완료")
        
        # 11) 사용자 임베딩 업데이트
        from backend.recommendations import update_user_embedding
        for member in members:
            await update_user_embedding(member.member_id)
        
        print("사용자 임베딩 업데이트 완료")
    
    print("✅ Mock 데이터 마이그레이션 완료!")
    print(f"  - 태그: {len(tags_data)}개")
    print(f"  - 게시글: {len(posts_data)}개")
    print(f"  - 멤버: {len(members)}개")

if __name__ == "__main__":
    asyncio.run(migrate_mock_data()) 