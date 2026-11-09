import mimetypes
import os
import tempfile
from pathlib import Path

STORAGE_ROOT = Path(
    os.environ.get(
        "OBJECT_STORAGE_DIR",
        str(Path.home() / "yknova-studio-local-data" / "objects")
    )
).expanduser().resolve()


def init_storage(force: bool = False):
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return str(STORAGE_ROOT)


def _safe_path(key: str) -> Path:
    if not isinstance(key, str) or not key:
        raise ValueError("Invalid storage key")

    if "\\" in key or key.startswith("/"):
        raise ValueError("Invalid storage path")

    target = (STORAGE_ROOT / key).resolve()

    if not target.is_relative_to(STORAGE_ROOT) or target == STORAGE_ROOT:
        raise ValueError("Storage path outside permitted directory")

    return target


def put_object(path: str, data: bytes, content_type: str) -> dict:
    init_storage()
    target = _safe_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)

    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=target.parent,
            prefix=".upload-",
            delete=False
        ) as temp:
            temp.write(data)
            temp_name = temp.name

        os.replace(temp_name, target)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)

    return {"path": path}


def get_object(path: str):
    target = _safe_path(path)

    if not target.is_file():
        raise FileNotFoundError(f"Object not found: {path}")

    content_type = mimetypes.guess_type(target.name)[0]
    return target.read_bytes(), content_type or "application/octet-stream"
