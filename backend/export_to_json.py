import asyncio
import json
import os
import sys
import numpy as np


# 프로젝트 루트를 Python 경로에 추가
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT_DIR)

from backend.db import AsyncSessionLocal, get_session
from backend.models import Post, Tag, Member, PostTag, Interaction
from backend.vector_db import FaissClient
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# 프로젝트 루트 기준 database 디렉토리로 변경
EXPORT_DIR = os.path.join(ROOT_DIR, 'database')
os.makedirs(EXPORT_DIR, exist_ok=True)

async def export_table(session, model, filename, to_dict_func=None):
    result = await session.execute(select(model))
    items = result.scalars().all()
    if to_dict_func:
        data = [to_dict_func(item) for item in items]
    else:
        data = [item.__dict__ for item in items]
        for d in data:
            d.pop('_sa_instance_state', None)
    with open(os.path.join(EXPORT_DIR, filename), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"Exported {filename} ({len(data)} records)")

async def export_all():
    session = AsyncSessionLocal()
    try:
        # Post는 tags를 eager loading으로 가져오기
        result = await session.execute(
            select(Post).options(selectinload(Post.tags))
            )
        posts = result.scalars().all()
        posts_data = [post.to_dict() for post in posts]
        with open(os.path.join(EXPORT_DIR, 'posts.json'), 'w', encoding='utf-8') as f:
            json.dump(posts_data, f, ensure_ascii=False, indent=2, default=str)
        print(f"Exported posts.json ({len(posts_data)} records)")
        
        await export_table(session, Tag, 'tags.json')
        await export_table(session, Member, 'members.json')
        await export_table(session, PostTag, 'post_tags.json')
        await export_table(session, Interaction, 'interactions.json')
        
        # TagVector 테이블 export (id, vector)
        from backend.models import TagVector
        result = await session.execute(select(TagVector))
        tag_vectors = result.scalars().all()
        tag_vec_data = []
        for tag_vec in tag_vectors:
            tag_vec_data.append({"id": tag_vec.tag_id, "vector": json.loads(tag_vec.vector)})
        with open(os.path.join(EXPORT_DIR, 'tag_vectors.json'), 'w', encoding='utf-8') as f:
            json.dump(tag_vec_data, f, ensure_ascii=False, indent=2)
        print(f"Exported tag_vectors.json ({len(tag_vec_data)} records)")
        
    finally:
        session.close()

    # --- Post 벡터 export ---
    print("게시글 벡터를 생성/저장 중...")
    from backend.vector_utils import get_embedding
    post_vec_data = []
    for post in posts:
        vec = get_embedding(post.content)
        post_vec_data.append({"id": post.post_id, "vector": vec.tolist()})
    with open(os.path.join(EXPORT_DIR, 'post_vectors.json'), 'w', encoding='utf-8') as f:
        json.dump(post_vec_data, f, ensure_ascii=False, indent=2)
    print(f"Exported post_vectors.json ({len(post_vec_data)} records)")

    # --- User 벡터 export ---
    print("사용자 벡터를 생성/저장 중...")
    user_vec_data = []
    from backend.recommendations import update_user_embedding
    for member_id in range(1, 6):  # member_id 1~5
        # interactions 기반 user vector 생성
        # update_user_embedding은 실제로 FAISS에만 넣으므로, 여기서는 직접 계산
        # (간단히: 해당 사용자의 interaction에서 post content 벡터의 가중합)
        async for session2 in get_session():
            q = await session2.execute(
                select(Interaction).where(Interaction.member_id == member_id)
            )
            inters = q.scalars().all()
        if not inters:
            continue
        vecs = []
        weights = []
        for inter in inters:
            post = next((p for p in posts if p.post_id == inter.post_id), None)
            if post:
                post_vec = get_embedding(post.content)
                vecs.append(post_vec * inter.weight)
                weights.append(inter.weight)
        if vecs:
            user_vec = np.sum(vecs, axis=0) / (sum(weights) or 1)
            user_vec = user_vec.astype('float32')
            user_vec_data.append({"id": member_id, "vector": user_vec.tolist()})
    with open(os.path.join(EXPORT_DIR, 'user_vectors.json'), 'w', encoding='utf-8') as f:
        json.dump(user_vec_data, f, ensure_ascii=False, indent=2)
    print(f"Exported user_vectors.json ({len(user_vec_data)} records)")

if __name__ == "__main__":
    asyncio.run(export_all()) 