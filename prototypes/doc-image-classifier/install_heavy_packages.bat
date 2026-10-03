@echo off
echo Installing heavy ML packages (this takes 15-30 minutes)...
echo.

echo [1/3] Installing PyTorch CPU...
py -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
echo PyTorch: done

echo [2/3] Installing EasyOCR...
py -m pip install easyocr
echo EasyOCR: done

echo [3/3] Installing albumentations...
py -m pip install albumentations
echo Albumentations: done

echo.
echo All heavy packages installed.
pause
