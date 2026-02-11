@echo off
echo ========================================
echo  SISTEMA DE PASTAGENS - FLASK
echo ========================================

cd /d "%~dp0"

echo.
echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo Iniciando servidor...
echo Acesse: http://localhost:5000
echo.
echo Pressione Ctrl+C para parar
echo.

python app.py
