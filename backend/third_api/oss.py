"""S3-compatible avatar uploads (MinIO / AWS / Aliyun OSS S3 gateway)."""

from __future__ import annotations

import uuid
from typing import Optional
from urllib.parse import urljoin

from common.logger import get_logger
from settings.config import get_settings

logger = get_logger("third_api.oss")

_ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


def oss_configured() -> bool:
    s = get_settings()
    return bool(
        (s.oss_bucket or "").strip()
        and (s.oss_access_key or "").strip()
        and (s.oss_secret_key or "").strip()
    )


def _client(endpoint_override: str = ""):
    import boto3
    from botocore.client import Config

    s = get_settings()
    kwargs = {
        "service_name": "s3",
        "aws_access_key_id": s.oss_access_key,
        "aws_secret_access_key": s.oss_secret_key,
        "region_name": s.oss_region or "us-east-1",
        "config": Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    }
    endpoint = endpoint_override or (s.oss_endpoint or "").strip()
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client(**kwargs)


def create_avatar_presign(user_id: int, content_type: str) -> dict:
    """Generate a PUT presign for avatar upload. Raises ValueError on bad type."""
    if not oss_configured():
        raise RuntimeError("oss not configured")

    ctype = (content_type or "image/jpeg").lower().strip()
    ext = _ALLOWED_TYPES.get(ctype)
    if not ext:
        raise ValueError("unsupported content type")

    s = get_settings()
    key = f"{(s.oss_prefix or 'avatars/').lstrip('/')}{user_id}/{uuid.uuid4().hex}.{ext}"
    try:
        # Use public endpoint for presigned URLs so browsers can reach MinIO directly
        presign_endpoint = (s.oss_endpoint_public or "").strip() or (s.oss_endpoint or "").strip()
        client = _client(endpoint_override=presign_endpoint)
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": s.oss_bucket,
                "Key": key,
                "ContentType": ctype,
            },
            ExpiresIn=600,
        )
    except Exception:
        logger.exception("oss presign failed user_id=%s key=%s", user_id, key)
        raise

    if (s.oss_public_base_url or "").strip():
        public_url = urljoin(s.oss_public_base_url.rstrip("/") + "/", key)
    elif (s.oss_endpoint or "").strip():
        public_url = f"{s.oss_endpoint.rstrip('/')}/{s.oss_bucket}/{key}"
    else:
        public_url = f"https://{s.oss_bucket}.s3.{s.oss_region}.amazonaws.com/{key}"

    logger.info("presigned avatar user_id=%s key=%s", user_id, key)
    return {
        "upload_url": upload_url,
        "public_url": public_url,
        "object_key": key,
        "content_type": ctype,
        "expires_in": 600,
        "headers": {"Content-Type": ctype},
    }
