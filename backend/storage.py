"""Object storage. R2 (S3 API) if configured; local files only for development.
Private packages must never be exposed as public bucket objects.
"""
import mimetypes
import os
import tempfile
from pathlib import Path

STORAGE_ROOT = Path(os.getenv('OBJECT_STORAGE_DIR', str(Path.home() / 'yknova-studio-local-data' / 'objects'))).expanduser().resolve()


def _r2_config():
    keys = ('R2_ENDPOINT_URL', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY')
    values = [os.getenv(k, '') for k in keys]
    if any(values) and not all(values):
        raise RuntimeError('Incomplete R2 configuration; set all four R2 environment variables')
    return dict(zip(keys, values)) if all(values) else None


def is_r2():
    return _r2_config() is not None


def _r2_client():
    import boto3
    cfg = _r2_config()
    if not cfg:
        raise RuntimeError('R2 not configured')
    return boto3.client('s3', endpoint_url=cfg['R2_ENDPOINT_URL'],
                        aws_access_key_id=cfg['R2_ACCESS_KEY_ID'],
                        aws_secret_access_key=cfg['R2_SECRET_ACCESS_KEY'], region_name='auto')


def init_storage(force=False):
    if is_r2():
        return 'r2:' + _r2_config()['R2_BUCKET']
    if os.getenv('REQUIRE_R2', '0') == '1':
        raise RuntimeError('R2 is required but is not configured')
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return str(STORAGE_ROOT)


def _validate_key(key):
    if not isinstance(key, str) or not key or key.startswith('/') or '\\' in key or any(seg in ('', '.', '..') for seg in key.split('/')):
        raise ValueError('Invalid object key')
    return key


def _safe_path(key):
    key = _validate_key(key)
    target = (STORAGE_ROOT / key).resolve()
    if not target.is_relative_to(STORAGE_ROOT) or target == STORAGE_ROOT:
        raise ValueError('Storage path outside permitted directory')
    return target


def put_object(path, data, content_type):
    _validate_key(path)
    if is_r2():
        _r2_client().put_object(Bucket=_r2_config()['R2_BUCKET'], Key=path, Body=data,
                                ContentType=content_type or 'application/octet-stream')
        return {'path': path}
    init_storage()
    target = _safe_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.upload-', delete=False) as temp:
            temp.write(data)
            temp_name = temp.name
        os.replace(temp_name, target)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)
    return {'path': path}


def get_object(path):
    _validate_key(path)
    if is_r2():
        obj = _r2_client().get_object(Bucket=_r2_config()['R2_BUCKET'], Key=path)
        return obj['Body'].read(), obj.get('ContentType') or 'application/octet-stream'
    target = _safe_path(path)
    if not target.is_file():
        raise FileNotFoundError(f'Object not found: {path}')
    return target.read_bytes(), mimetypes.guess_type(target.name)[0] or 'application/octet-stream'


def presign_download(path, filename, expires=60):
    """Private R2 GET URL, only call after checking the buyer's entitlement."""
    _validate_key(path)
    if not path.startswith('yknova/packages/'):
        raise ValueError('Not a package key')
    if not is_r2():
        return None
    safe_name = ''.join(ch for ch in filename if ch.isalnum() or ch in '._- ')[:120] or 'download.zip'
    return _r2_client().generate_presigned_url('get_object', Params={
        'Bucket': _r2_config()['R2_BUCKET'], 'Key': path,
        'ResponseContentDisposition': f'attachment; filename="{safe_name}"',
        'ResponseContentType': 'application/zip',
    }, ExpiresIn=min(max(int(expires), 1), 120))
