from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from backend.db import Base
from datetime import datetime, timezone

class Member (Base) :
    
    __tablename__ = "members"
    member_id = Column(Integer, primary_key = True, index = True)
    username  = Column(String(50), unique = True, nullable = False)

class Tag (Base) :
    
    __tablename__ = "tags"
    tag_id   = Column(Integer, primary_key = True, index = True)
    tag_name = Column(String(50), unique = True, nullable = False)

class TagVector (Base) :
    
    __tablename__ = "tag_vectors"
    tag_id = Column(Integer, ForeignKey("tags.tag_id"), primary_key = True)
    vector = Column(Text, nullable = False)  # JSON 형태로 벡터 저장

class Post (Base) :
    
    __tablename__ = "posts"
    post_id    = Column(Integer, primary_key = True, index = True)
    member_id  = Column(Integer, ForeignKey("members.member_id"), nullable = False)
    category   = Column(Text, nullable = False)
    title      = Column(String(200), nullable = False)
    content    = Column(Text, nullable = False)
    image      = Column(String(500), nullable=True)
    views      = Column(Integer, default = 0, nullable = False)
    created_at = Column(DateTime, default = datetime.now(timezone.utc))
    updated_at = Column(DateTime, onupdate = datetime.now(timezone.utc))

    tags = relationship("Tag", secondary = "post_tags", backref = "posts")

    def to_dict(self) :
        return {
            "post_id" : self.post_id,
            "member_id" : self.member_id,
            "category" : self.category,
            "title" : self.title,
            "content" : self.content,
            "image" : self.image,
            "views" : self.views,
            "created_at" : self.created_at.isoformat(),
            "tags" : [tag.tag_id for tag in self.tags] if self.tags else []
        }

class PostTag (Base) :
    
    __tablename__ = "post_tags"
    post_id = Column(Integer, ForeignKey("posts.post_id"), primary_key = True)
    tag_id  = Column(Integer, ForeignKey("tags.tag_id"), primary_key = True)

class Interaction (Base) :
    
    __tablename__ = "interactions"
    interaction_id = Column(Integer, primary_key = True, index = True)
    member_id      = Column(Integer, ForeignKey("members.member_id"), nullable = False)
    post_id        = Column(Integer, ForeignKey("posts.post_id"), nullable = False)
    action_type    = Column(String(20), nullable = False)
    weight         = Column(Float, nullable = False)
    created_at     = Column(DateTime, default = datetime.now(timezone.utc))
