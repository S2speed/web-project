"""Development media serving with HTTP byte-range support."""
import mimetypes
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, StreamingHttpResponse


RANGE_PATTERN = re.compile(r'^bytes=(\d*)-(\d*)$')
CHUNK_SIZE = 64 * 1024


def _partial_file_iterator(file_handle, length):
    remaining = length
    try:
        while remaining > 0:
            chunk = file_handle.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk
    finally:
        file_handle.close()


def serve_media(request, path):
    """Serve local media and honor the single byte range used by audio players."""
    media_root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (media_root / path).resolve()
    if file_path == media_root or media_root not in file_path.parents or not file_path.is_file():
        raise Http404('Media file not found.')

    file_size = file_path.stat().st_size
    content_type = mimetypes.guess_type(file_path.name)[0] or 'application/octet-stream'
    range_header = request.headers.get('Range', '').strip()
    match = RANGE_PATTERN.fullmatch(range_header) if range_header else None

    if not match:
        response = FileResponse(file_path.open('rb'), content_type=content_type)
        response['Accept-Ranges'] = 'bytes'
        response['Content-Length'] = file_size
        return response

    start_text, end_text = match.groups()
    if not start_text and not end_text:
        response = HttpResponse(status=416)
        response['Content-Range'] = f'bytes */{file_size}'
        return response

    if start_text:
        start = int(start_text)
        end = min(int(end_text), file_size - 1) if end_text else file_size - 1
    else:
        suffix_length = int(end_text)
        start = max(file_size - suffix_length, 0)
        end = file_size - 1

    if start >= file_size or start > end:
        response = HttpResponse(status=416)
        response['Content-Range'] = f'bytes */{file_size}'
        return response

    length = end - start + 1
    file_handle = file_path.open('rb')
    file_handle.seek(start)
    response = StreamingHttpResponse(
        _partial_file_iterator(file_handle, length),
        status=206,
        content_type=content_type,
    )
    response['Accept-Ranges'] = 'bytes'
    response['Content-Length'] = length
    response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    response['Content-Disposition'] = f'inline; filename="{file_path.name}"'
    return response
