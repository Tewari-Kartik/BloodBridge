"""Proper evaluation: fix tokenizer + run full test set evaluation."""
import sys, os, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.getcwd())

import torch
import torch.nn.functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from backend.ml.preprocessing.cleaner import BloodRequestCleaner

# Load best checkpoint with correct tokenizer
model = AutoModelForSequenceClassification.from_pretrained('backend/models/urgency_classifier/checkpoint-304')
tokenizer = AutoTokenizer.from_pretrained('google/muril-base-cased')
model.eval()

# Save properly (model + tokenizer together)
best_dir = 'backend/models/urgency_classifier/best_model'
os.makedirs(best_dir, exist_ok=True)
model.save_pretrained(best_dir)
tokenizer.save_pretrained(best_dir)
meta = {'label2id': {'P0_CRITICAL':0,'P1_HIGH':1,'P2_MODERATE':2,'P3_INFO':3},
        'id2label': {'0':'P0_CRITICAL','1':'P1_HIGH','2':'P2_MODERATE','3':'P3_INFO'}}
with open(os.path.join(best_dir, 'label_config.json'), 'w') as f:
    json.dump(meta, f, indent=2)
print('Model + tokenizer saved to best_model/')

# Load test data
with open('data/processed/splits/test.json', 'r', encoding='utf-8') as f:
    test = json.load(f)
print(f'Test set: {len(test)} messages')

# Predict
cleaner = BloodRequestCleaner()
ID2LABEL = {0:'P0_CRITICAL', 1:'P1_HIGH', 2:'P2_MODERATE', 3:'P3_INFO'}
LABEL2ID = {v:k for k,v in ID2LABEL.items()}

true_labels, pred_labels, confidences = [], [], []
for i, msg in enumerate(test):
    text = cleaner.clean(msg['message'])['cleaned']
    inputs = tokenizer(text, max_length=128, padding='max_length', truncation=True, return_tensors='pt')
    with torch.no_grad():
        probs = F.softmax(model(**inputs).logits[0], dim=-1)
    pred_id = probs.argmax().item()
    true_labels.append(LABEL2ID[msg['urgency']])
    pred_labels.append(pred_id)
    confidences.append(probs[pred_id].item())
    if (i+1) % 50 == 0:
        print(f'  Predicted {i+1}/{len(test)}...')

print(f'  Done! {len(test)} predictions.\n')

# Results
label_names = ['P0_CRITICAL', 'P1_HIGH', 'P2_MODERATE', 'P3_INFO']
acc = accuracy_score(true_labels, pred_labels)
f1w = f1_score(true_labels, pred_labels, average='weighted', zero_division=0)
f1m = f1_score(true_labels, pred_labels, average='macro', zero_division=0)
avg_conf = sum(confidences) / len(confidences)

p0_true = sum(1 for t in true_labels if t == 0)
p0_correct = sum(1 for t, p in zip(true_labels, pred_labels) if t == 0 and p == 0)
p0_recall = p0_correct / max(p0_true, 1)

print('=' * 55)
print('URGENCY CLASSIFIER - FINAL EVALUATION')
print('=' * 55)
print(f'  Accuracy       : {acc:.4f}')
print(f'  F1 (weighted)  : {f1w:.4f}')
print(f'  F1 (macro)     : {f1m:.4f}')
print(f'  P0 Recall      : {p0_recall:.4f} ({p0_correct}/{p0_true})')
print(f'  Avg Confidence : {avg_conf:.4f}')

print(f'\n{classification_report(true_labels, pred_labels, target_names=label_names, zero_division=0)}')

cm = confusion_matrix(true_labels, pred_labels)
print('Confusion Matrix (rows=true, cols=predicted):')
header = f'{"":>15s}  {"P0_CRI":>6s}  {"P1_HIG":>6s}  {"P2_MOD":>6s}  {"P3_INF":>6s}'
print(header)
for i, row in enumerate(cm):
    vals = "  ".join(f"{v:6d}" for v in row)
    print(f'{label_names[i]:>15s}  {vals}')

errors = sum(1 for t, p in zip(true_labels, pred_labels) if t != p)
print(f'\nTotal errors: {errors}/{len(test)} ({errors/len(test)*100:.1f}%)')

# Save report
report = {
    'accuracy': round(acc, 4), 'f1_weighted': round(f1w, 4),
    'f1_macro': round(f1m, 4), 'p0_recall': round(p0_recall, 4),
    'avg_confidence': round(avg_conf, 4),
    'test_size': len(test), 'errors': errors,
}
with open(os.path.join(best_dir, 'evaluation_report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print(f'\nReport saved to {best_dir}/evaluation_report.json')
