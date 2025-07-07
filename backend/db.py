from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# 현재 파일의 디렉토리를 기준으로 절대 경로 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite+aiosqlite:///{current_dir}/test.db"

engine = create_async_engine(DATABASE_URL, echo = True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit = False)
Base = declarative_base()

async def get_session() :
    async with AsyncSessionLocal() as session:
        yield session
