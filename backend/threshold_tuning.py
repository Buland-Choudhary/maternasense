import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix

DATA_PATH = Path("data/Book1.csv")
TARGET = "HR_PRE"

def clean_columns(df):
    df.columns = df.columns.str.strip().str.replace("Â", "")
    return df

def main():
    print("📥 Loading data + removing duplicates...")
    df = pd.read_csv(DATA_PATH)
    df = clean_columns(df).drop_duplicates()

    X = df.drop(columns=[TARGET])
    y = df[TARGET].astype(int)

    print("Shape after dedup:", df.shape)
    print("Class counts:\n", y.value_counts())

    print("\n📦 Loading calibrated model...")
    model = joblib.load("artifacts/final_model.pkl")

    print("\n✂ Creating test split (same as training)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=0.2, random_state=42
    )

    probs = model.predict_proba(X_test)[:, 1]

    thresholds = np.arange(0.05, 0.96, 0.05)
    best_f1 = (-1, None)
    best_recall = (-1, None)

    print("\nTHRESHOLD | PRECISION | RECALL | F1")
    print("------------------------------------")

    for t in thresholds:
        preds = (probs >= t).astype(int)

        prec = precision_score(y_test, preds, zero_division=0)
        rec = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)

        print(f"{t:0.2f}      |  {prec:0.3f}    | {rec:0.3f}  | {f1:0.3f}")

        if f1 > best_f1[0]:
            best_f1 = (f1, t)

        if rec > best_recall[0]:
            best_recall = (rec, t)

    print("\n✅ Best F1:", best_f1)
    print("✅ Best Recall:", best_recall)

    # Confusion matrix at best recall threshold
    t = best_recall[1]
    preds = (probs >= t).astype(int)

    print("\n📌 Confusion Matrix @ best recall threshold =", t)
    print(confusion_matrix(y_test, preds))

if __name__ == "__main__":
    main()