from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")
FFPROBE_PATH = os.getenv("FFPROBE_PATH", "ffprobe")

ffmpeg_process: subprocess.Popen | None = None


def get_total_duration(clip_paths: list[Path]) -> float:
    total = 0.0

    for p in clip_paths:
        result = subprocess.run(
            [
                FFPROBE_PATH,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(p),
            ],
            capture_output=True,
            text=True,
        )

        try:
            total += float(result.stdout.strip())
        except ValueError:
            pass

    return total


def stop_render() -> None:
    global ffmpeg_process

    if ffmpeg_process and ffmpeg_process.poll() is None:
        ffmpeg_process.kill()

    ffmpeg_process = None


def get_video_args(encoder: str, performance_mode: str) -> list[str]:
    if encoder == "gpu":
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

    # CPU fallback
    if performance_mode == "fast":
        return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-threads", "6"]

    if performance_mode == "low":
        return ["-c:v", "libx264", "-preset", "slow", "-crf", "23", "-threads", "2"]

    return ["-c:v", "libx264", "-preset", "medium", "-crf", "22", "-threads", "4"]


def render(
    clip_paths: list[Path],
    output_path: Path,
    encoder: str = "gpu",
    performance_mode: str = "balanced",
    on_progress=None,
) -> None:
    global ffmpeg_process

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
        *get_video_args(encoder, performance_mode),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(output_path),
    ]

    last_reported = -1

    try:
        ffmpeg_process = subprocess.Popen(
            cmd,
            stderr=subprocess.PIPE,
            universal_newlines=True,
        )

        assert ffmpeg_process.stderr is not None

        for line in ffmpeg_process.stderr:
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
            raise subprocess.CalledProcessError(ffmpeg_process.returncode, cmd)

    finally:
        ffmpeg_process = None
        concat_file.unlink(missing_ok=True)
