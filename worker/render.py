from __future__ import annotations

import os
import logging
import re
import subprocess
from pathlib import Path
import sys
from collections import deque


def get_media_tool_path(env_name: str, default_name: str) -> str:
    configured = os.getenv(env_name)

    if configured:
        return configured

    return default_name


def validate_media_tool(name: str, executable: str) -> None:
    path = Path(executable)

    if path.is_absolute() and not path.exists():
        raise RuntimeError(f"{name} is missing: {path}")

    if path.is_absolute() and not os.access(path, os.X_OK):
        raise RuntimeError(f"{name} is not executable: {path}")


def validate_media_tools() -> None:
    validate_media_tool("FFmpeg", FFMPEG_PATH)
    validate_media_tool("FFprobe", FFPROBE_PATH)


FFMPEG_PATH = get_media_tool_path("FFMPEG_PATH", "ffmpeg")
FFPROBE_PATH = get_media_tool_path("FFPROBE_PATH", "ffprobe")

ffmpeg_process: subprocess.Popen | None = None


def get_total_duration(clip_paths: list[Path]) -> float:
    total = 0.0

    for clip_path in clip_paths:
        try:
            result = subprocess.run(
                [
                    FFPROBE_PATH,
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(clip_path),
                ],
                capture_output=True,
                text=True,
                check=True,
            )
        except FileNotFoundError as error:
            raise RuntimeError(
                f"FFprobe could not be started: {FFPROBE_PATH}"
            ) from error
        except subprocess.CalledProcessError as error:
            details = error.stderr.strip() or "No FFprobe error output"

            raise RuntimeError(f"FFprobe failed for {clip_path}: {details}") from error

        duration_text = result.stdout.strip()

        try:
            total += float(duration_text)
        except ValueError as error:
            raise RuntimeError(
                f"FFprobe returned an invalid duration for "
                f"{clip_path}: {duration_text!r}"
            ) from error

    return total


def stop_render() -> None:
    global ffmpeg_process

    if ffmpeg_process and ffmpeg_process.poll() is None:
        ffmpeg_process.kill()

    ffmpeg_process = None


def resolve_encoder(encoder: str) -> str:
    """Resolve saved GPU selections without assuming hardware availability."""
    if encoder == "gpu":
        if sys.platform == "darwin":
            return "videotoolbox"
        if sys.platform == "win32":
            return "nvenc"
        return "cpu"

    if encoder not in {"cpu", "nvenc", "amf", "qsv", "videotoolbox"}:
        raise ValueError(
            f"Unsupported encoder: {encoder!r}. "
            "Choose cpu, nvenc, amf, qsv, or videotoolbox."
        )
    return encoder


def get_video_args(encoder: str, performance_mode: str) -> list[str]:
    builders = {
        "cpu": get_cpu_args,
        "nvenc": get_nvenc_args,
        "amf": get_amf_args,
        "qsv": get_qsv_args,
        "videotoolbox": get_videotoolbox_args,
    }
    return builders[resolve_encoder(encoder)](performance_mode)


def detect_encoders(performance_mode: str = "balanced") -> dict:
    """List build capabilities, then check hardware with a short real encode."""
    validate_media_tool("FFmpeg", FFMPEG_PATH)
    listing = subprocess.run(
        [FFMPEG_PATH, "-hide_banner", "-encoders"],
        capture_output=True, text=True, check=True, timeout=10,
    )
    compiled = set(re.findall(r"^\s*V\S{5}\s+(\S+)", listing.stdout, re.MULTILINE))
    candidates = [("cpu", "CPU / x264", "libx264")]
    if sys.platform == "darwin":
        candidates.append(("videotoolbox", "Apple / VideoToolbox", "h264_videotoolbox"))
    else:
        candidates.extend([
            ("nvenc", "NVIDIA / NVENC", "h264_nvenc"),
            ("amf", "AMD / AMF", "h264_amf"),
            ("qsv", "Intel / Quick Sync", "h264_qsv"),
        ])
    results = []
    for encoder, label, codec in candidates:
        available = False
        reason = "Not included in this FFmpeg build."
        if codec in compiled:
            try:
                probe = subprocess.run(
                    [FFMPEG_PATH, "-hide_banner", "-v", "error", "-f", "lavfi",
                     "-i", "color=c=black:s=1280x720:r=30", "-frames:v", "3",
                     *get_video_args(encoder, performance_mode), "-f", "null", "-"],
                    capture_output=True, text=True, timeout=10,
                )
                available = probe.returncode == 0
                if not available:
                    logging.getLogger("worker").info(
                        "Encoder probe failed encoder=%s performance_mode=%s: %s",
                        encoder, performance_mode, probe.stderr.strip(),
                    )
                reason = None if available else (
                    "Hardware or driver could not initialize."
                    if encoder != "cpu" else "CPU encoding test failed."
                )
            except subprocess.TimeoutExpired:
                reason = "Encoding test timed out."
                logging.getLogger("worker").info("Encoder probe timed out encoder=%s", encoder)
        results.append({"id": encoder, "label": label, "available": available, "reason": reason})
    preferred = next((item["id"] for item in results if item["available"] and item["id"] != "cpu"), None)
    if preferred is None:
        preferred = next((item["id"] for item in results if item["available"]), None)
    return {"encoders": results, "preferred": preferred}


def get_amf_args(performance_mode: str) -> list[str]:
    quality, bitrate, maxrate, bufsize = {
        "fast": ("speed", "8M", "12M", "16M"),
        "low": ("quality", "5M", "7M", "10M"),
    }.get(performance_mode, ("balanced", "6M", "8M", "12M"))
    return [
        "-c:v", "h264_amf", "-quality", quality, "-rc", "vbr_peak",
        "-b:v", bitrate, "-maxrate", maxrate, "-bufsize", bufsize,
    ]


def get_qsv_args(performance_mode: str) -> list[str]:
    preset, bitrate, maxrate, bufsize = {
        "fast": ("veryfast", "8M", "12M", "16M"),
        "low": ("slow", "5M", "7M", "10M"),
    }.get(performance_mode, ("medium", "6M", "8M", "12M"))
    return [
        "-c:v", "h264_qsv", "-preset", preset,
        "-b:v", bitrate, "-maxrate", maxrate, "-bufsize", bufsize,
    ]


def get_nvenc_args(performance_mode: str) -> list[str]:
    if performance_mode == "fast":
        return [
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p4",
            "-rc",
            "vbr",
            "-cq",
            "23",
            "-b:v",
            "8M",
            "-maxrate",
            "12M",
            "-bufsize",
            "16M",
        ]

    if performance_mode == "low":
        return [
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p6",
            "-rc",
            "vbr",
            "-cq",
            "25",
            "-b:v",
            "5M",
            "-maxrate",
            "7M",
            "-bufsize",
            "10M",
        ]

    return [
        "-c:v",
        "h264_nvenc",
        "-preset",
        "p5",
        "-rc",
        "vbr",
        "-cq",
        "24",
        "-b:v",
        "6M",
        "-maxrate",
        "8M",
        "-bufsize",
        "12M",
    ]


def get_videotoolbox_args(performance_mode: str) -> list[str]:
    if performance_mode == "fast":
        return [
            "-c:v",
            "h264_videotoolbox",
            "-b:v",
            "10M",
            "-maxrate",
            "14M",
            "-bufsize",
            "20M",
        ]

    if performance_mode == "low":
        return [
            "-c:v",
            "h264_videotoolbox",
            "-b:v",
            "5M",
            "-maxrate",
            "7M",
            "-bufsize",
            "10M",
        ]

    return [
        "-c:v",
        "h264_videotoolbox",
        "-b:v",
        "7M",
        "-maxrate",
        "10M",
        "-bufsize",
        "14M",
    ]


def get_cpu_args(performance_mode: str) -> list[str]:
    if performance_mode == "fast":
        return [
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "21",
            "-threads",
            "6",
        ]

    if performance_mode == "low":
        return [
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "23",
            "-threads",
            "2",
        ]

    return [
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "22",
        "-threads",
        "4",
    ]


def render(
    clip_paths: list[Path],
    output_path: Path,
    encoder: str = "gpu",
    performance_mode: str = "balanced",
    on_progress=None,
) -> None:
    global ffmpeg_process

    encoder = resolve_encoder(encoder)
    video_args = get_video_args(encoder, performance_mode)
    validate_media_tools()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    concat_file = output_path.parent / "concat.txt"
    concat_file.write_text(
        "\n".join(f"file '{p.as_posix()}'" for p in clip_paths),
        encoding="utf-8",
    )

    total_duration = get_total_duration(clip_paths)

    cmd = [
        FFMPEG_PATH,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-af",
        "highpass=f=80,afftdn,lowpass=f=8000",
        *video_args,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(output_path),
    ]

    last_reported = -1
    error_lines: deque[str] = deque(maxlen=40)

    try:
        ffmpeg_process = subprocess.Popen(
            cmd,
            stderr=subprocess.PIPE,
            universal_newlines=True,
        )

        assert ffmpeg_process.stderr is not None

        for line in ffmpeg_process.stderr:
            error_lines.append(line.rstrip())
            if total_duration > 0 and on_progress:
                match = re.search(r"time=(\d+):(\d+):(\d+\.\d+)", line)

                if match:
                    h, m, s = match.groups()
                    elapsed = int(h) * 3600 + int(m) * 60 + float(s)
                    percent = min(int((elapsed / total_duration) * 100), 99)

                    if percent >= last_reported + 5:
                        on_progress(percent)
                        last_reported = percent

        ffmpeg_process.wait()

        if ffmpeg_process.returncode != 0:
            details = "\n".join(error_lines) or "No FFmpeg error output"
            hint = " Try CPU encoding." if encoder != "cpu" else ""
            raise RuntimeError(
                f"FFmpeg rendering failed using {encoder} "
                f"(exit code {ffmpeg_process.returncode}).{hint}\n{details}"
            )

    finally:
        ffmpeg_process = None
        concat_file.unlink(missing_ok=True)
