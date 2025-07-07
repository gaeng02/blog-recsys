import json
import numpy as np
import hashlib

def get_embedding(text: str) -> np.ndarray:
    """텍스트를 간단한 해시 기반 벡터로 변환"""
    try:
        # 텍스트를 해시하여 일관된 벡터 생성
        hash_obj = hashlib.md5(text.encode('utf-8'))
        hash_hex = hash_obj.hexdigest()
        
        # 해시값을 768차원 벡터로 변환
        vector = np.zeros(768, dtype='float32')
        for i, char in enumerate(hash_hex):
            if i < 768:
                vector[i] = ord(char) / 255.0
        
        # 나머지 차원은 해시값의 다른 부분으로 채움
        for i in range(len(hash_hex), 768):
            vector[i] = (ord(hash_hex[i % len(hash_hex)]) + i) % 255 / 255.0
        
        return vector
    except Exception as e:
        print(f"벡터화 중 오류 발생: {e}")
        # 오류 시 랜덤 벡터 반환
        return np.random.rand(768).astype('float32')

def vector_to_json(vector: np.ndarray) -> str:
    """numpy 벡터를 JSON 문자열로 변환"""
    return json.dumps(vector.tolist())

def json_to_vector(vector_json: str) -> np.ndarray:
    """JSON 문자열을 numpy 벡터로 변환"""
    return np.array(json.loads(vector_json), dtype='float32')

def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """두 벡터 간의 코사인 유사도 계산"""
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot_product / (norm1 * norm2) 