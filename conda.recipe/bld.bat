python setup.py --quiet install --single-version-externally-managed --record record.txt
mkdir "%RECIPE_DIR%\share\jupyter\labextensions\@pyviz\jupyter_pyviz"
xcopy /S "%SRC_DIR%\pyviz_comms\labextension\*" "%PREFIX%\share\jupyter\labextensions\@pyviz\jupyter_pyviz\"
xcopy "%SRC_DIR%\pyviz_comms\labextension\install.json" "%PREFIX%\share\jupyter\labextensions\@pyviz\jupyter_pyviz\install.json"
