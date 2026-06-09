@echo off
cd /d "%~dp0"

echo Installing dependencies...
pip install -r requirements.txt pyinstaller

echo Building worker binary...
pyinstaller ^
  --onefile ^
  --name worker ^
  --add-binary "%FFMPEG_PATH%;." ^
  --add-binary "%FFPROBE_PATH%;." ^
  --hidden-import=googleapiclient ^
  --hidden-import=google.auth ^
  --hidden-import=google.oauth2 ^
  worker.py

echo Copying to desktop resources...
if not exist "..\desktop\resources" mkdir "..\desktop\resources"
copy dist\worker.exe ..\desktop\resources\worker.exe

echo Done.