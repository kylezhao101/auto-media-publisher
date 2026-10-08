import subprocess
import unittest
from unittest.mock import patch

import render


class EncoderDetectionTests(unittest.TestCase):
    def detect(self, listing, probes, platform="win32", mode="balanced"):
        responses = [subprocess.CompletedProcess([], 0, listing, ""), *probes]
        with patch.object(render.sys, "platform", platform), \
                patch.object(render, "validate_media_tool"), \
                patch.object(render.subprocess, "run", side_effect=responses) as run:
            result = render.detect_encoders(mode)
        return result, run

    def test_listed_gpu_that_fails_probe_falls_back_to_cpu(self):
        result, run = self.detect(
            " V....D libx264 CPU\n V....D h264_nvenc NVIDIA\n A..... aac Audio\n",
            [subprocess.CompletedProcess([], 0, "", ""),
             subprocess.CompletedProcess([], 1, "", "No capable devices")],
        )
        self.assertEqual(result["preferred"], "cpu")
        self.assertFalse(result["encoders"][1]["available"])
        self.assertIn("driver", result["encoders"][1]["reason"])
        self.assertEqual(run.call_count, 3)
        self.assertIn("-encoders", run.call_args_list[0].args[0])

    def test_mac_uses_videotoolbox_and_selected_performance_settings(self):
        result, run = self.detect(
            " V....D libx264 CPU\n V....D h264_videotoolbox Apple\n",
            [subprocess.CompletedProcess([], 0, "", "")] * 2,
            platform="darwin", mode="low",
        )
        self.assertEqual(result["preferred"], "videotoolbox")
        command = run.call_args_list[-1].args[0]
        self.assertIn("h264_videotoolbox", command)
        self.assertIn("5M", command)
        self.assertEqual(len(result["encoders"]), 2)

    def test_timeout_marks_encoder_unavailable(self):
        result, _ = self.detect(
            " V....D h264_qsv Intel\n",
            [subprocess.TimeoutExpired("ffmpeg", 10)],
        )
        self.assertIsNone(result["preferred"])
        self.assertIn("timed out", result["encoders"][-1]["reason"])

    def test_listing_failure_is_reported(self):
        with patch.object(render, "validate_media_tool"), \
                patch.object(render.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "ffmpeg")):
            with self.assertRaises(subprocess.CalledProcessError):
                render.detect_encoders()


if __name__ == "__main__":
    unittest.main()
