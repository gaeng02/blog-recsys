import faiss
import numpy as np

class FaissClient :
    
    def __init__(self, dim : int = 768) :
        
        self.dim = dim
        self.index = faiss.IndexIDMap(faiss.IndexFlatL2(dim))

    def embed_text(self, text : str) -> np.ndarray :
        rng = np.random.RandomState(abs(hash(text)) % (2**32))
        
        return rng.rand(self.dim).astype("float32")

    def add_embedding(self, id : int, vector : np.ndarray) :
        
        self.index.add_with_ids(vector.reshape(1, -1), np.array([id], dtype = "int64"))

    def delete_embedding(self, id : int) :
        """특정 ID의 임베딩을 삭제"""
        try:
            # IndexIDMap에서는 remove_ids를 사용하여 삭제
            self.index.remove_ids(np.array([id], dtype="int64"))
        except Exception as e:
            print(f"임베딩 삭제 중 오류: {e}")

    def query(self, vector : np.ndarray, top_k : int) :
        D, I = self.index.search(vector.reshape(1, -1), top_k)
        return I[0] if len(I) > 0 else []

    def get_embedding(self, id: int):
        try:
            idx = self.index.id_map.tolist().index(id)
            return self.index.reconstruct(id)
        except Exception:
            return None
