import json
import numpy as np
import faiss as fs
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

def load_sentences(jsonl_path, text_key="text"):
    items, texts = [], []
    with open(jsonl_path,'r',encoding='utf-8') as f:
        for ln, line in enumerate(f, 1):

            try:
                data = json.loads(line.strip())
            except json.JSONDecodeError as e:
                print(f"[Warning] Line {ln} not a valid jsonl: {e}")
                continue

            if not data:
                continue

            if text_key not in data or not data[text_key]:
                print(f"[Warning] Line {ln} missing '{text_key}'")
                continue

            items.append(data)
            texts.append(data[text_key])        
    return items, texts    

def build_index(texts):
    vector = model.encode(texts, normalize_embeddings=True).astype("float32")
    vector = np.ascontiguousarray(vector, dtype='float32')
    index = fs.IndexFlatIP(vector.shape[1])
    index.add(vector)
    return index, vector

def search(index, query, texts, k=5):
    query_vector = model.encode([query], normalize_embeddings=True).astype("float32")
    scores, ids = index.search(query_vector, k)
    results = []
    for rank, (i, s) in enumerate(zip(ids[0], scores[0]), 1):
        i = int(i)
        results.append({"rank": rank, "score": float(s), "text": texts[i], "id": i})
    return results