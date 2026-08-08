"""
Quick validation script — checks all imports and file paths are correct
before running the full training pipeline.
"""
import sys
from pathlib import Path

print("Checking environment...")
BASE = Path(__file__).parent

errors = []

# 1. Python version
pv = sys.version_info
print(f"  Python {pv.major}.{pv.minor}.{pv.micro}")
if pv.major < 3 or pv.minor < 9:
    errors.append("Python 3.9+ required")

# 2. Required packages
pkgs = {"numpy": "1.26", "pandas": "2.0", "xgboost": "2.0",
        "shap": "0.45", "sklearn": "1.4", "fastapi": "0.115"}
for pkg, min_ver in pkgs.items():
    try:
        mod = __import__(pkg if pkg != "sklearn" else "sklearn")
        ver = getattr(mod, "__version__", "?")
        ok  = "✓" if ver >= min_ver else "⚠"
        print(f"  {ok} {pkg:15} {ver}")
    except ImportError:
        print(f"  ✗ {pkg:15} NOT INSTALLED")
        errors.append(f"Missing: {pkg}")

# 3. Data files
print("\nChecking data files...")
for fname in ["traders.csv","companies.csv","corporate_events.csv",
              "trades.csv","communications.csv","demo_trades.csv"]:
    fp = BASE / "data" / fname
    if fp.exists():
        kb = fp.stat().st_size / 1024
        print(f"  ✓ {fname:<30} {kb:>8.1f} KB")
    else:
        print(f"  ✗ {fname} MISSING")
        errors.append(f"Missing data: {fname}")

if errors:
    print(f"\n❌ {len(errors)} error(s):")
    for e in errors:
        print(f"   - {e}")
    sys.exit(1)
else:
    print("\n✅ All checks passed! Run: python train_model.py")
