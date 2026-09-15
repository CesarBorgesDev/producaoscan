import os
import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    base_dir = Path(sys.executable).resolve().parent
    os.chdir(base_dir)
    if str(base_dir) not in sys.path:
        sys.path.insert(0, str(base_dir))
else:
    base_dir = Path(__file__).resolve().parent
    os.chdir(base_dir)
    if str(base_dir) not in sys.path:
        sys.path.insert(0, str(base_dir))

from app.main import app  # noqa: E402
import uvicorn  # noqa: E402


def main() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    print(f"ProducaoScan API em http://{host}:{port}")
    print(f"Diretório: {base_dir}")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
