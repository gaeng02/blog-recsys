from transformers import MarianMTModel, MarianTokenizer
from sentence_transformers import SentenceTransformer
import numpy as np

def load_model(src_lang="ko", tgt_lang="en"):
    model_name = f"Helsinki-NLP/opus-mt-{src_lang}-{tgt_lang}"
    tokenizer = MarianTokenizer.from_pretrained(model_name)
    model     = MarianMTModel.from_pretrained(model_name)
    return tokenizer, model

def translate(texts, tokenizer, model, batch_size=8):
    # texts: str 또는 str 리스트
    inputs = tokenizer(texts, return_tensors="pt", padding=True)
    translated = model.generate(**inputs)
    return tokenizer.batch_decode(translated, skip_special_tokens=True)

def cosine_sim (a, b) : 
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

if __name__ == "__main__":
    tokenizer, model = load_model("ko", "en")
    modelq = SentenceTransformer('sentence-transformers/LaBSE')
    
    vec = []
    
    samples = [
        "이 문장은 한국어와 machine learning 용어가 섞여 있어요.",
        "인공지능은 미래 기술의 핵심입니다.",
        "AI는 미래 기술의 핵심입니다."
    ]
    
    outputs = translate(samples, tokenizer, model)
    for src, tgt in zip(samples, outputs) :
        print(f"SOURCE: {src}\nTRANSLATION: {tgt}\n")
        vec.append(modelq.encode(tgt, convert_to_numpy = True))
    
    print(cosine_sim(vec[0], vec[1]))
    print(cosine_sim(vec[1], vec[2]))
    print(cosine_sim(vec[2], vec[0]))
    
    print(vec[0].shape)
    print(vec[1].shape)
    print(vec[2].shape)
    