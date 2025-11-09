import FaissSearch as FS

items, texts = FS.load_sentences("C:/Users/lenovo/Desktop/SEFB/MyGitTest/PolicyAI/imperial_policies.jsonl")
index, _ = FS.build_index(texts)
print(FS.search(index, "late submission penalty", texts, k=5))
